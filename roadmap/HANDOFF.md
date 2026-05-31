---
project: agent-ide
updated: 2026-05-30
active-focus: freeze VERIFIED by user; AgentSidebar/project-switch/globe bugs FIXED + PUSHED this session (02632ed8/9e39772a/6cc20e45); wave-101 ship decision pending
last-wave: wave-101-telemetry-pipeline-removal
last-wave-status: CODE-COMPLETE-PENDING-LIVE-SMOKE
---

## ✅ THIS SESSION (2026-05-30): branch pushed + 3 workbench bugs fixed

**Freeze is USER-VERIFIED fixed.** Cole confirmed the IDE no longer freezes (wave-101
+ the machine-lockup session-restore fix). On that confirmation the whole stack was
**pushed** — `origin/freeze-fix-and-wave-101-scaffold` now carries all 29 prior commits
(incl. the previously-HELD `66369791` windowGroups commit) **plus** the 3 fixes below.

**3 pre-existing workbench bugs fixed (each committed, all gates green):**
1. **Sidebar went quiet after turn 1** — `02632ed8`. `session_stop` (Claude Code's
   per-turn Stop hook) was ownership-terminal in `hooks.ts`, so turn-2+ tool events
   were dropped. Removed it from `TERMINAL_EVENT_TYPES`; release only on `agent_end` +
   the `agent_stop` disconnect synthetic. Regression test; `test:hooks` 255/255.
2. **Sessions lost on project switch + spawn storm** — `9e39772a`. Replaced the
   key-based provider remount with in-place per-project tab collections + an in-memory
   switch-back cache. **Review caught a transitional-render restore race** (stale
   project-A data applied to B, A's session resumed under B); fixed via a synchronous
   `forProject`-stamped readiness guard. Regression test verified red-without-fix.
3. **Globe stuck "thinking" / wrong session** — `6cc20e45`. Made `useWorkbenchGlobeData`
   pane-aware (same `useActivePaneId` chain the sidebar uses); confirmed live in prod.

**Latent branch red fixed in passing:** `useWorkbenchTabs.ts` tripped tsc `TS6133`
(unused `projectRoot` param; the eslint-disable didn't cover tsc) — the branch's web
typecheck was already red before this session. `void projectRoot;`. **`npm run typecheck`
green both layers; Workbench 401 pass / 1 skip; lint clean on all touched files.**

3 LOW carve-outs filed: globe idle-heuristic (no wire signal) · unbounded project cache
(LRU cap) · `onSessionEnd` fires per-turn. The 3 source follow-ups are now RESOLVED.

## ✅ RESOLVED (2026-05-30, this session): machine lockup — session-restore spawn loop

**Root cause found + fixed.** The ~13-min lockup was a launch-time **session-restore spawn loop**: the
renderer (`useTerminalSessions.restore.ts`) replayed every saved terminal-session snapshot as a
`claude --resume`, with **no cap and no dedup**. The electron-store (`%APPDATA%\ouroboros\config.json`)
had accumulated **40 identical ContractorApp Claude snapshots** (self-fueling — `persistCurrentSessions`
wrote running sessions back without dedup), so each launch spawned ~40 Claude CLIs → ~370 node MCP
processes + 40× 164 MB `codebase-memory-mcp.exe` → OS-level event-loop starvation (`[jank] ops:[]`,
107 s blocks). **Confirmed by live reproduction**: launched the dev IDE in the background, polled the OS
process table (census 20→368 node procs). The two earlier-suspected causes (telemetry-SQLite freeze,
approval sockets) were NOT this — a distinct cause, exactly as the bug file predicted.

**Fixed — 4 commits, all on `freeze-fix-and-wave-101-scaffold`, NOT pushed:**
- `5634e1fe` session restore: dedup (`claudeSessionId ?? cwd`) + hard cap `MAX_RESTORE_SESSIONS=8`;
  persist-side dedup closes the accumulation loop; regression test (40-dup store → ≤cap). + CLAUDE.md gotcha.
- `814744a6` finish approval-removal — commit `684e9f81` left 8 orphan files importing the deleted
  `ApprovalRequest` type, breaking typecheck. Deleted them + surgically cleaned the workbench timeline.
- `1dd4ca42` delete vestigial in-app GraphPanel — it called `electronAPI.graph` (removed Wave 22) and
  would throw at runtime; graph is served by the standalone MCP tools. (Cole's call: delete, not restore.)
- `6fe19109` repair 6 pre-existing node-side typecheck errors (AppConfig schema-type drift + missing imports).

**Immediate relief (not a commit):** cleared the 40 stale snapshots from the live store (backed up to
`config.json.storm-backup-*`). Next launch spawns ≤1 session regardless of the build.

**Branch typecheck was secretly red at TWO layers** despite wave-101 being marked "tsc clean / CODE-COMPLETE"
— web (approval + GraphPanel) and node (schema drift), the node layer hidden behind the web one by the
`&&` short-circuit in the `typecheck` script. **`npm run typecheck` is now fully GREEN (web 0 + node 0).**

Full triage + reproduction census: `bugs/2026-05-30-machine-lockup-mcp-process-storm.md`.

## ✅ SHIPPED this session (2026-05-30): AgentSidebar empty-sidebar fix — `d4fc7318` (NOT pushed)

**Root cause:** `useWorkbenchTabs` was a stateful, claude-spawning hook instantiated at TWO sites
(`TerminalShell` + `AgentSidebar`'s `useActivePaneId`) → two private `useState` tab collections + a
startup double-spawn; the sidebar read its own idle copy's `activeTabId`, never the tab the user typed
in. **Fix:** lifted tab state into a singleton `WorkbenchTabsProvider` (`Terminals/WorkbenchTabsProvider.tsx`,
mounted in `Workbench.tsx` under `key={projectKey}`); `useWorkbenchTabs` is now a thin wrapper over
`useWorkbenchTabsContext`. Binding fixed + double-spawn gone. Verified: typecheck/lint clean, Workbench
suite **398 pass** (2 pre-existing #9 fails — see follow-up 4). Bug doc:
`bugs/2026-05-30-workbench-tab-state-instance-split.md`.

**Follow-ups from that live verification — status after THIS session:**
1. ✅ RESOLVED `02632ed8` — `session_stop` ownership (`hooks.ts`). The live "tool calls
   don't populate" cause. → `follow-ups/2026-05-30-session-stop-unowns-multiturn-tool-events.md`
2. ✅ RESOLVED `9e39772a` — project-switch orphan + spawn storm.
   → `follow-ups/2026-05-30-workbench-project-switch-orphans-session.md`
3. ✅ RESOLVED `6cc20e45` (pane-awareness; idle-heuristic carved out as LOW).
   → `follow-ups/2026-05-30-workbench-globe-pane-unaware-stuck-thinking.md`
4. ⬜ STILL OPEN — `test:layout` is mis-scoped (Workbench suite ungated) + 2 stale Wave-3
   session tests. → `follow-ups/2026-05-30-test-layout-misscoped-workbench-ungated.md`

## Current state

- Branch: **`freeze-fix-and-wave-101-scaffold`** off master, **PUSHED to origin** (tracking set). Carries wave-101 (10 commits `3045beb6`..`2c16ddc5`), the 4 lockup/typecheck commits (`5634e1fe`..`6fe19109`), the previously-held `66369791` (windowGroups — no longer held, it's on origin), and this session's 3 workbench fixes (`02632ed8`/`9e39772a`/`6cc20e45`).
- **The freeze is PERMANENTLY FIXED.** Wave-101 deleted the telemetry SQLite store (the 100 ms synchronous `flushEvents` + WAL checkpoint against a 689 MB `telemetry.db` that blocked the main thread up to 193 s), all drain handlers, the dead tap pipeline, `editProvenance`, the 44-file `research/` subsystem + its UI, and the hook-process queue writers. No synchronous SQLite write remains on the main event loop.
- **Live AgentSidebar feed preserved surgically.** The `hooks.ts → hooks:event → AgentSidebar` path was kept; the `store.record` persistence seam was cut. Guard test `src/main/hooks.liveEmissionInvariant.test.ts` (5/5).
- **Gates:** `npm run typecheck` **fully green** (web 0 + node 0 — fixed this session; was red at both layers) · lint clean on touched files · `test:layout` 819 pass · `test:main` subsystems (conflict/embeddings/flowTracer/config) green · session-restore regression 24/24.
- HELD (unchanged, post-wave decisions): `66369791` (Thing 3, windowGroups multi-root persistence) still not pushed. Product: terminal workbench shell only.

## Next steps

1. **Re-smoke the workbench now that the 3 bugs are fixed (recommended before SHIPPED flip):**
   `npm run dev` → inner Claude Code session → confirm (a) **AgentSidebar updates live ACROSS
   TURNS** (was the #1 cause — tool calls should now keep populating past turn 1); (b) **switch
   projects and back — the session is preserved, no spawn storm**; (c) **the globe tracks the
   active pane's session** (not stuck "thinking" on the outer IDE session). Plus the wave-101
   checks: no `[telemetry]`/`flushEvents`/`router-shadow` lines, no `telemetry.db` recreated.
2. **Flip wave-101 → SHIPPED + wrap:** branch is already pushed; merge to master (or open a PR
   from the existing `freeze-fix-and-wave-101-scaffold` → master), minor version bump
   (feature/removal wave), run the wrap. The branch carries wave-101 + machine-lockup +
   the 3 workbench fixes together.
3. **Post-ship housekeeping:** 3 new LOW follow-ups from this session
   (`workbench-globe-idle-heuristic`, `workbench-project-cache-unbounded`,
   `handlesessionend-fires-per-turn`); the still-open `test-layout-misscoped-workbench-ungated`
   (#4); `appconfig-schema-type-drift-sweep` + `mcp-json-amplifier-cleanup`; doc sweep for
   `roadmap/docs/data-model.md:237` (stale `researchSettings` ref).

## Track A — residual micro-lag (committed `c2bfa902`, separate root cause)

Uncached `git:status`/`git:statusDetailed` + undebounced `useGitStatusDetailed` fired one `git status` subprocess per `files:change` per root (3 roots × N inner Claude Code sessions) → subprocess storm, repeated sub-2 s jank, `git:branch` 4–26 s under load. Fix: new `gitStatusCache.ts` (5 s TTL + dogpile coalescing, mirrors `gitBranchCache`) on both channels; 150 ms debounce + in-flight guard on the detailed hook; poll 3 s→8 s. Deferred (noted in commit): `directoryWatchRegistry` listener-multiplexer consolidation, subprocess concurrency cap.

## Deferred — UI (untouched)

- Right-click menu z-index (renders behind rail) · inner rail showing only "Running" with no sessions · globe re-scope to project.
- Wave 14 manual smoke: `_archived/wave-14-rails-ui-fix-sweep/wave-14-smoke-report.md`.

## Backlog

- Wave 15 cleanup seeds: pre-existing-test-failures, workbench-projectswitch-timeout, channel-catalog-persist.
- Follow-ups: internalmcp-asar-packaging · **appconfig-schema-type-drift-sweep (new)** · **mcp-json-amplifier-cleanup (new)**. Bugs: chatstatenewpath-dynamic-require, silent-buildrepoindex-hang, e2e-teardown-hang.

## Reference index

- Conventions: [`../CLAUDE.md`](../CLAUDE.md) · Decisions (6): [`decisions/`](decisions/) · Vendor-gotchas: [`../.claude/vendor-gotchas/`](../.claude/vendor-gotchas/)
- Wave history: [`_index-history.md`](_index-history.md) · Archived: [`_archived/`](_archived/)
- Stryker floor 21% (current 31.72%) · lockfile: `npm run lockfile:sync` (WSL2) only.
