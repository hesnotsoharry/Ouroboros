---
project: agent-ide
updated: 2026-05-30
active-focus: wave-101 PENDING LIVE SMOKE — machine-lockup RESOLVED this session (4 commits); npm run typecheck now fully green
last-wave: wave-101-telemetry-pipeline-removal
last-wave-status: CODE-COMPLETE-PENDING-LIVE-SMOKE
---

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

**⚠️ The sidebar is NOT fully working yet — live verification surfaced 3 pre-existing bugs + 1 tooling gap. 4 follow-ups filed; handle in order:**
1. **HIGH — `session_stop` un-owns the session** (`src/main/hooks.ts`) → multi-turn tool events dropped.
   THIS is the live "tool calls don't populate" cause; the sidebar is unusable until it's fixed.
   → `follow-ups/2026-05-30-session-stop-unowns-multiturn-tool-events.md`
2. project-switch respawns + orphans the live session (= backlog `workbench-projectswitch-timeout`).
   → `follow-ups/2026-05-30-workbench-project-switch-orphans-session.md`
3. globe pane-unaware / stuck "thinking" (= the Deferred "globe re-scope to project" below).
   → `follow-ups/2026-05-30-workbench-globe-pane-unaware-stuck-thinking.md`
4. `test:layout` is mis-scoped — Workbench suite ungated; + the 2 stale Wave-3 session tests.
   → `follow-ups/2026-05-30-test-layout-misscoped-workbench-ungated.md`

## Current state

- Branch: **`freeze-fix-and-wave-101-scaffold`** off master. **Nothing pushed yet.** Wave-101 itself is **CODE-COMPLETE** — 10 commits (`3045beb6`..`2c16ddc5`), all 8 phases done; + the 4 lockup/typecheck commits above (`5634e1fe`..`6fe19109`).
- **The freeze is PERMANENTLY FIXED.** Wave-101 deleted the telemetry SQLite store (the 100 ms synchronous `flushEvents` + WAL checkpoint against a 689 MB `telemetry.db` that blocked the main thread up to 193 s), all drain handlers, the dead tap pipeline, `editProvenance`, the 44-file `research/` subsystem + its UI, and the hook-process queue writers. No synchronous SQLite write remains on the main event loop.
- **Live AgentSidebar feed preserved surgically.** The `hooks.ts → hooks:event → AgentSidebar` path was kept; the `store.record` persistence seam was cut. Guard test `src/main/hooks.liveEmissionInvariant.test.ts` (5/5).
- **Gates:** `npm run typecheck` **fully green** (web 0 + node 0 — fixed this session; was red at both layers) · lint clean on touched files · `test:layout` 819 pass · `test:main` subsystems (conflict/embeddings/flowTracer/config) green · session-restore regression 24/24.
- HELD (unchanged, post-wave decisions): `66369791` (Thing 3, windowGroups multi-root persistence) still not pushed. Product: terminal workbench shell only.

## Next steps

1. **Live smoke (REQUIRED before push — could not be agent-served):** `npm run dev` → launch an inner Claude Code session → confirm **AgentSidebar updates live** (NOW/timeline/files/context) → main log has **no** `[telemetry]`/`[*-drain]`/`flushEvents`/`router-shadow` lines → **no** `telemetry.db` recreated. Also confirm the lockup fix holds: launch with the now-clean store spawns **≤1 session, no process storm** (B4 re-verify).
2. **On smoke pass:** flip wave-101 to SHIPPED, push the branch, run the wrap. Version: minor bump (feature/removal wave). The branch now carries both wave-101 AND the machine-lockup fix.
3. **Post-ship housekeeping:** the 2 new follow-ups (`appconfig-schema-type-drift-sweep`, `mcp-json-amplifier-cleanup`); decide on the held Thing 3 (`66369791`); doc sweep for `roadmap/docs/data-model.md:237` (stale `researchSettings` ref).

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
