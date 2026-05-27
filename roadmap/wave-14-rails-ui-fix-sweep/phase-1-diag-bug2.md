---
status: COMPLETE
created: 2026-05-27
wave: 14
phase: 1a
---

# Phase 1a Diagnostic — Bug #2 (fake sessions across projects)

## Reproduction trace

1. App cold-boots. `usePersistedSessionsLoader` fires (`useAgentEvents.ts:144–161`), calls
   `window.electronAPI.sessions.load()`, and dispatches `LOAD_PERSISTED` with every session
   the store returns.

2. `loadPersistedSessions` (`useAgentEvents.session-utils.ts:80–86`) appends all restored
   sessions to `state.sessions` with no project filtering.

3. `toPersistedSession` / `buildPersistedSessionFields` (`useAgentEvents.payload.ts:219–239`)
   reconstructs each session from the SQLite row. `cwd` is absent from
   `buildPersistedSessionFields` — it is not in the field list. Restored sessions surface
   with `cwd: undefined`.

4. `useDerivedSessions` (`useAgentEvents.ts:78–97`) produces `currentSessions` as
   `sessions.filter(isLiveSession)`, where `isLiveSession` accepts `status === 'idle'`.
   Sessions that were idle at persist time survive with their stored status intact, because
   `getStatusValue` in `payload.ts:279–288` passes `'idle'` through as-is.

5. `useWorkbenchAgentData` (`useWorkbenchAgentData.ts:426`) passes `currentSessions` through
   `mapToRailSession`, which calls `deriveProjectId(session)` at line 209. That function
   returns `'unknown'` whenever `session.cwd` is falsy (`useWorkbenchAgentData.ts:186–188`).

6. `InnerRail` filters at `InnerRail.tsx:44–48`. `currentProjectId` is the basename of the
   real project root. Sessions with `projectId === 'unknown'` never match it, so they all
   fall into `otherSessions` and are rendered under every project unchanged.

The UUID IDs Cole sees are the real session IDs stored in SQLite from prior dev/test runs.
They are not mock data and not newly generated — they are stale persisted sessions being
faithfully restored without their `cwd`.

## Root cause

`cwd` is missing from `buildPersistedSessionFields`, so all restored sessions arrive with
`cwd: undefined`, causing `deriveProjectId` to return `'unknown'` for every one — making
them appear as cross-project ghost sessions in the inner rail's "other sessions" list.

## Files implicated

- `src/renderer/hooks/useAgentEvents.payload.ts:219–239` — `buildPersistedSessionFields`
  does not persist or restore `cwd`; this is where the field is dropped.
- `src/renderer/hooks/useAgentEvents.ts:55–57` — `isLiveSession` admits `'idle'` status,
  so restored idle sessions enter `currentSessions`.
- `src/renderer/components/Workbench/useWorkbenchAgentData.ts:186–188` — `deriveProjectId`
  falls back to `'unknown'` for sessions with no `cwd`.
- `src/renderer/components/Workbench/Rails/InnerRail.tsx:44–48` — project filter is correct
  in logic but cannot work when `projectId` is always `'unknown'`.

## Proposed fix scope

**Renderer-only, with a one-field persistence change (no IPC boundary touch).**

1. Add `cwd: getStringValue(raw, 'cwd')` to `buildPersistedSessionFields`
   (`useAgentEvents.payload.ts`, ~1 LOC). This restores `cwd` through the persist/load
   round-trip so `deriveProjectId` produces real project basenames.

2. Verify the session save path already writes `cwd` to the store — `window.electronAPI.sessions.save(session)`
   passes the full `AgentSession` object, so if `cwd` is present on the live session at
   persist time, it reaches SQLite. Check the SQLite schema in `src/main/storage/` before
   finalizing: if there is no `cwd` column, that would be a BOUNDARY concern requiring a
   migration (flag for implementer).

Estimated: ~3–5 LOC change + 1 test assertion update. No IPC shape change required.

## Cross-contamination risk

- **SQLite schema**: If `sessions` table has no `cwd` column, the save side may already be
  dropping it and the restore-side fix alone is insufficient. Needs a schema check.
- **`sessionCrud:list` is unrelated**: That channel serves the chat shell's `SessionSidebar`,
  not `useAgentEvents`. The fix does not touch it.
- **`isLiveSession` breadth**: `isLiveSession` intentionally includes `'idle'` so resumed
  sessions appear live. Do not narrow — it has ~48 `AgentMonitor` consumers. Fix in the
  persistence layer, not the filter.
- **Already-persisted rows**: Sessions persisted before the fix have no `cwd` in SQLite.
  They will still restore as `'unknown'` until re-saved or deleted. A one-time store sweep
  is optional hygiene, not load-bearing for the fix going forward.

## ADR D4 lock recommendation

This supports D4 Option A (no heuristic fallback, paneId-keyed primary) — restoring `cwd`
makes the basename comparison in `InnerRail` functional, which is the prerequisite for
project-scoped session display to work correctly at all.

## Confidence

HIGH — the causal chain is structurally visible with no ambiguous branches. The field
omission in `buildPersistedSessionFields` is a single, directly observable point of failure;
every downstream effect follows deterministically from it. No runtime instrumentation is
needed to confirm; the relevant code paths are pure and the field list is exhaustively
enumerable.
