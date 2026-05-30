---
project: agent-ide
updated: 2026-05-30
active-focus: CRITICAL machine-lockup — codebase/MCP process storm (see bugs/2026-05-30-machine-lockup-mcp-process-storm.md)
last-wave: wave-101-telemetry-pipeline-removal
last-wave-status: CODE-COMPLETE-PENDING-LIVE-SMOKE
---

## ⚠️ CRITICAL — START HERE (2026-05-30): machine lockup from MCP process storm

User's machine **locked up ~13 min** on IDE launch. Root cause is a **storm of codebase-MCP
processes** (`codebase-memory-mcp.exe`, user-observed in Task Manager) — each Claude session spawns a
heavy MCP per `.mcp.json`, each scanning a repo → OS-level CPU/disk saturation. Smoking gun:
`[jank] event loop blocked for ~107101ms` (107 s) with `ops: []` = Electron main thread STARVED by
other processes, not blocking on its own code. `git:branch` hit **104 s**, `files:mkdir` 12 s.

**This is a DIFFERENT cause than the two already fixed** — NOT the telemetry-SQLite freeze (wave-101
removed it) and NOT the approval sockets (removed this session, commit `684e9f81`).

**Full triage + raw log + the concrete lead (stale `.mcp.json` pointing at a legacy
`C:\Web App\Agent IDE\out\main\ouroborosMcp.js` electron MCP, spawned per session):**
→ **`roadmap/bugs/2026-05-30-machine-lockup-mcp-process-storm.md`**

**First moves for the fresh session (start at the OS, not the app log):** `tasklist`/`Get-Process`
to count the MCP/electron-run-as-node/node processes + their parent PIDs; check `.mcp.json` in all 3
roots (AgentIDE/Gamify/ContractorApp); determine why ~94 (phantom-session spawn loop? per-call MCP
leak? stale-path retry storm?); check whether each MCP launch does a full cold repo scan.

This session's 5 commits (semaphore, diff-review gate, xterm, approval removal, cleanup) are verified
green (tsc + build + tests) but did NOT stop the lockup. All on `freeze-fix-and-wave-101-scaffold`,
**not pushed**.

## Current state

- Branch: **`freeze-fix-and-wave-101-scaffold`** off master. **Nothing pushed yet.** Wave-101 is **CODE-COMPLETE** — 10 commits (`3045beb6`..`2c16ddc5`), all 8 phases (1–6, 6b, 5b) done; Phase 7 automated gates green.
- **The freeze is PERMANENTLY FIXED.** Wave-101 deleted the telemetry SQLite store (the 100 ms synchronous `flushEvents` + WAL checkpoint against a 689 MB `telemetry.db` that blocked the main thread up to 193 s), all drain handlers, the dead tap pipeline, `editProvenance`, the 44-file `research/` subsystem + its UI, and the hook-process queue writers. **No synchronous SQLite write remains on the main event loop** — the freeze class is structurally gone (the earlier stopgap is now moot; its 722 MB backup was deleted).
- **Live AgentSidebar feed preserved surgically.** The `hooks.ts → hooks:event → AgentSidebar` path was kept; the `store.record` persistence seam was cut. Guard test `src/main/hooks.liveEmissionInvariant.test.ts` proves emission is independent of the store (5/5 green at every phase).
- **Gates:** tsc clean (default config) · lint 0 errors · `test:main` 3356 pass / **3 pre-existing** codemode `/packages/` failures (zero wave-introduced) · guard 5/5 · dangling-ref grep clean. Telemetry data tree deleted (~935 MB freed); live `codebase-graph.db` untouched.
- HELD (unchanged, post-wave decisions): `66369791` (Thing 3, windowGroups multi-root persistence) still not pushed. Instrumentation (`main.ts`, `migrateStaleRoots.ts` `[trace:startup]`) intentionally **uncommitted** (excluded from every wave commit via partial staging). Product: terminal workbench shell only.

## Next steps

1. **Live smoke (REQUIRED before push — could not be agent-served):** `npm run dev` → launch an inner Claude Code session → confirm **AgentSidebar updates live** (NOW/timeline/files/context) → main log has **no** `[telemetry]`/`[*-drain]`/`flushEvents`/`router-shadow` lines → **no** `telemetry.db` recreated → relaunch confirms `~/.claude/settings.json` no longer has `router-shadow`/`session_start_spawn_cost` hooks (the `pruneRemovedHooksFromSettings` one-time pass).
2. **On smoke pass:** flip wave-101 to SHIPPED, push the branch, run the wrap (HANDOFF rewrite + decision promotion). Version: minor bump (feature/removal wave).
3. **Post-ship housekeeping:** decide on the held instrumentation + Thing 3 (`66369791`); optionally clear the 16 KB orphaned `research-cache.db`; doc sweep for `roadmap/docs/data-model.md:237` (stale `researchSettings` ref).

## Track A — residual micro-lag (committed `c2bfa902`, separate root cause)

Uncached `git:status`/`git:statusDetailed` + undebounced `useGitStatusDetailed` fired one `git status` subprocess per `files:change` per root (3 roots × N inner Claude Code sessions) → subprocess storm, repeated sub-2 s jank, `git:branch` 4–26 s under load. Fix: new `gitStatusCache.ts` (5 s TTL + dogpile coalescing, mirrors `gitBranchCache`) on both channels; 150 ms debounce + in-flight guard on the detailed hook; poll 3 s→8 s. Deferred (noted in commit): `directoryWatchRegistry` listener-multiplexer consolidation, subprocess concurrency cap.

## Deferred — UI (untouched)

- Right-click menu z-index (renders behind rail) · inner rail showing only "Running" with no sessions · globe re-scope to project.
- Wave 14 manual smoke: `_archived/wave-14-rails-ui-fix-sweep/wave-14-smoke-report.md`.

## Backlog

- Wave 15 cleanup seeds: pre-existing-test-failures, workbench-projectswitch-timeout, channel-catalog-persist.
- Follow-ups: internalmcp-asar-packaging. (`vestigial-chat-orchestration-cleanup` is now subsumed by wave-101's `src/main/research/` deletion; telemetry-retention LATENT bug is moot once wave-101 deletes the store.) Bugs: chatstatenewpath-dynamic-require, silent-buildrepoindex-hang, e2e-teardown-hang.

## Reference index

- Conventions: [`../CLAUDE.md`](../CLAUDE.md) · Decisions (6): [`decisions/`](decisions/) · Vendor-gotchas: [`../.claude/vendor-gotchas/`](../.claude/vendor-gotchas/)
- Wave history: [`_index-history.md`](_index-history.md) · Archived: [`_archived/`](_archived/)
- Stryker floor 21% (current 31.72%) · lockfile: `npm run lockfile:sync` (WSL2) only.
