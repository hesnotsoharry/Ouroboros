---
project: agent-ide
updated: 2026-05-29
active-focus: jank/freeze investigation (main-thread block on cold-start restore)
last-wave: wave-14-rails-ui-fix-sweep
last-wave-status: SHIPPED-PENDING-MANUAL-SMOKE
---

## Current state

- Branch: master · HEAD `6e41dbfc` (jank instrumentation — **local only, NOT pushed**) on top of `66369791`.
- **Active focus: severe main-process freeze.** "Mini-freezes for months"; one episode blocked the main thread ~73s and froze the whole machine ~4 min. Investigation in progress — see below.
- Prior session, pushed to master: lag fix, trust/restricted-mode fix, git:branch cache+dedupe, stale-path migration, paneId hook, restore instrumentation, phantom-session fix.
- **HELD — local commit `66369791` (Thing 3, windowGroups multi-root persistence), NOT pushed.** It expands the exact cold-start restore path implicated in the freeze; push only after restore is verified in the launched multi-window app.
- Product: terminal workbench shell only (chat removed Wave 100 / v2.35.0).

## Jank investigation (active)

**Symptom:** event loop blocked up to 73s on cold-start; heap flat ~22MB (NOT GC/leak). During the block: git:branch 65s, files:mkdir 36s, files:pathExists 10s (×30), files:saveFile 16s; 91 sockets / 46 MessagePorts.

**Confirmed:** trigger is the cold-start file-watcher fan-out — N windows × M project roots each calling `files:watchDir` → many concurrent `@parcel/watcher.subscribe()`. Diagnostician REFUTED the sync-fs / execSync hypothesis (all hot handlers are async).

**Open — needs one launched-app repro:** the exact mechanism. The jank watchdog is `setInterval`-based, so a 73s reading means a TRUE main-thread block (pure libuv-threadpool starvation would NOT trip a timer). Instrumentation (`6e41dbfc`) splits `watcher.subscribe()` syncMs (main-thread) vs totalMs and logs in-flight ops at each block.

**First data point (dev single-window repro, 2026-05-29):** subscribe `syncMs=1 totalMs=27` (small dir) — does NOT block the main thread. **Storm did NOT reproduce under `npm run dev`:** dev clamps to ONE window, and project-root watchers mount lazily with the file tree (NOT at session-restore — only the agent-memory dir got watched). Reproducing the freeze needs the **launched/built multi-window app with file trees mounting**, not `npm run dev`.

**Planned architecture ("fix jank forever", 3 layers):**
1. Universal runtime net — upgrade jankDetector (monitorEventLoopDelay + block attribution) into a dev/CI regression gate. Catches all jank, any mechanism.
2. Architectural pattern — single-flight dedup + concurrency-cap for cross-window expensive ops (watcher subscribe, git); if main-thread block confirmed → file-watching to a `UtilityProcess` (VS Code model). User chose "watch immediately" (no deferring watcher start).
3. Static hygiene — ESLint `n/no-sync` + ban `execSync`/`spawnSync` scoped to `src/main/**` (good hygiene; would NOT have caught this freeze).

Reports this session: `sonnet-diagnostician` (root cause), `sonnet-architect` (external best-practice + enforcement blueprint) — both in conversation, not yet filed.

## Next steps

1. **Repro the freeze in the launched multi-window app** (build + launch, restore the 3-window × 5-root layout, let file trees mount). Capture `[trace:watcher-subscribe] timing` (big-repo syncMs/totalMs) + `[jank] active ops at block`. Large syncMs → UtilityProcess isolation; small syncMs + large totalMs → coalescing + caps. (UI repro — deferred per user.)
2. Lock the jank wave plan around the confirmed mechanism, then build (Lane A wave: nativeWatcher.ts, files.ts, bootstrap.ts, jankDetector.ts, ipc.ts, eslint config, doctrine).
3. Verify restore in launched app → then push Thing 3 (`66369791`) and the instrumentation (`6e41dbfc`).

## Deferred — UI (untouched, per "nothing UI")

- Right-click menu z-index (renders behind rail) · inner rail showing only "Running" with no sessions · globe re-scope to project.
- Wave 14 manual smoke: `_archived/wave-14-rails-ui-fix-sweep/wave-14-smoke-report.md`.

## Backlog (pre-jank)

- Wave 15 cleanup seeds: pre-existing-test-failures, workbench-projectswitch-timeout, channel-catalog-persist.
- Follow-ups: internalmcp-asar-packaging, vestigial-chat-orchestration-cleanup. Bugs: chatstatenewpath-dynamic-require, silent-buildrepoindex-hang, e2e-teardown-hang.

## Reference index

- Conventions: [`../CLAUDE.md`](../CLAUDE.md) · Decisions (6): [`decisions/`](decisions/) · Vendor-gotchas: [`../.claude/vendor-gotchas/`](../.claude/vendor-gotchas/)
- Wave history: [`_index-history.md`](_index-history.md) · Archived: [`_archived/`](_archived/)
- Stryker floor 21% (current 31.72%) · lockfile: `npm run lockfile:sync` (WSL2) only.
