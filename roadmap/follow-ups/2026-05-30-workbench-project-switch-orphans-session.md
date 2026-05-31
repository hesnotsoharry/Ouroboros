---
status: RESOLVED
created: 2026-05-30
updated: 2026-05-30
resolved: 2026-05-30
priority: MEDIUM
---

> **RESOLVED 2026-05-30 — commit `9e39772a`.** Implemented Option A: per-project
> tab collections driven IN-PLACE inside `WorkbenchTabsProvider` (no key-based
> remount), with an in-memory `Map<projectRoot, FrameCollections>` so switch-back
> restores instantly. `useWorkbenchRestore` + `useTabRestoreInit` re-keyed by
> `projectRoot`. Review caught a transitional-render restore race (stale project-A
> data applied to B + A's session resumed under B); fixed by stamping restore state
> with `forProject` and deriving `isReady` synchronously. Regression test
> `staleRestore.race.regression.test.ts` reproduces it (verified red without the
> guard). Carve-out filed: in-memory cache is unbounded per visited project
> → `2026-05-30-workbench-project-cache-unbounded.md`.

# Project switch respawns + orphans the live workbench claude session

## Symptom (live-verified 2026-05-30)
Switching to another project and back loses the claude session you were working in ("the session I was working in just disappeared"). Rapid switching produces a spawn "storm" — a new pane-stamped claude session every few seconds, `agentsCount` climbing.

## Root cause
`src/renderer/components/Workbench/Workbench.tsx`:
- `projectKey = projectCtx?.projectRoot ?? '__no-project__'` (~line 209).
- `<CenterPane key={projectKey}>` (~line 129, PRE-EXISTING) and now `<WorkbenchTabsProvider key={projectKey}>` (~line 215) both remount on project switch.
- On remount, `useTabRestoreInit` (in `Terminals/WorkbenchTabsProvider.tsx`) synchronously builds a fresh default tab (`useRef(buildNewTab(...))`) and spawns a new claude once `isReady`. The previous project's live tab is orphaned, and `useWorkbenchRestore` (async) loses the race to the synchronous default-tab spawn.

This is pre-existing (CenterPane was already keyed by `projectKey` before the tab-state refactor); the provider inherited the same lifecycle.

## Fix shape
On project switch, RESTORE the target project's persisted tabs rather than spawning a fresh default + orphaning the prior one. Options:
- Drive per-project collections inside the provider keyed by `projectRoot` WITHOUT a `key`-based remount (the provider already receives `projectRoot`; switch the active collection by project). Removes the remount-spawn entirely.
- OR defer the default-tab spawn until `useWorkbenchRestore` resolves, so restore wins when persisted tabs exist.
Coordinate with `useWorkbenchRestore` + `useWorkbenchSessionPersist` (per-project persistence). Verify the previous project's session is preserved on switch-away and re-attached on switch-back.

## Source
Surfaced during live verification of commit `d4fc7318`. Pre-existing lifecycle behavior, not introduced by the tab-state refactor.
