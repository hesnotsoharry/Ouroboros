---
status: OPEN
severity: HIGH
created: 2026-05-27
updated: 2026-05-27
scheduled-for: wave-14-rails-ui-fix-sweep
---

# Bug: Inner rail shows the same fake/placeholder sessions across every project

## Symptom

Cole, 2026-05-27:

> Sessions are randomly populating the inner rail on all projects (all the same sessions, session 5dcef7f1, session 46851144, session 948cfbab, sessions 798ce35a, session 23bbb093, etc — there is a lot more).

The inner rail's session list shows an identical set of UUID-keyed sessions on EVERY project. Switching active project doesn't change the list. These sessions do not correspond to real Claude / Codex / shell sessions Cole has spawned — they appear to be placeholder data, leaked mock fixtures, or a single shared source being rendered without project-id filtering.

## Distinct from existing bugs

- `roadmap/bugs/2026-05-20-session-list-empty-on-relaunch.md` — opposite symptom (empty on relaunch).
- `roadmap/follow-ups/2026-05-20-claude-session-restore-fidelity.md` — about Claude-session restore fidelity on persist. Different surface.

This is sessions APPEARING that shouldn't, not sessions DISAPPEARING that should.

## Suspected sources (ranked)

1. **Mock data leak** — `src/renderer/components/Workbench/workbenchMockData.rails.ts` exports `MOCK_SESSIONS` (e.g. `'s-ai-1'`). The IDs Cole sees are 8-hex-char (`5dcef7f1`, `46851144`), which DOES NOT match the mock-data style, so this is the less likely source — but worth checking whether a different mock fixture (maybe a UUID-style one) is still wired into the inner rail.
2. **`useWorkbenchAgentData` filtering bug** — `src/renderer/components/Workbench/Rails/InnerRail.tsx` consumes `sessions` from `useWorkbenchAgentData()` and filters by `projectId`. If the filter is missing or comparing against the wrong field (e.g. comparing `session.projectId` to `activeProjectRoot` when the persisted shape uses a different key), all sessions on the store appear on all projects.
3. **`sessionCrud:list` returning stale/global data** — `src/main/ipc-handlers/sessionCrud.ts` handleList. If it returns ALL sessions across the store instead of scoped to the active project, the renderer-side filter would be load-bearing and could be missing.
4. **Wave 100 cleanup gap** — Wave 100 removed the chat surface; some session-listing code may have been left half-wired and is pulling from a now-orphaned source.

## Code surface

- `src/renderer/components/Workbench/Rails/InnerRail.tsx` (lines 42-48 per prior explorer: where `sessions` is filtered by `projectId`)
- `src/renderer/hooks/useWorkbenchAgentData.ts` — the adapter feeding the rail
- `src/main/ipc-handlers/sessionCrud.ts` — `handleList()` at ~line 66-69
- `src/renderer/components/Workbench/workbenchMockData.rails.ts` — any remaining `MOCK_SESSIONS` exports still consumed
- Whatever store backs the persisted session list (likely SQLite under `sessionsData` or similar)

## Reproduction

1. Launch the IDE (`npm run dev`).
2. Add 2+ projects via the outer rail.
3. Switch between projects.
4. Observe: the inner rail session list does NOT change between projects, and the sessions listed are UUIDs that Cole did not spawn.

## Suggested approach when picked up

Dispatch `sonnet-diagnostician` with the suspect ranking above. The diagnostic likely takes one repro + a `[trace:innerRail.sessions]` probe showing what `useWorkbenchAgentData` is returning per project switch.

## Severity rationale

HIGH because it makes the inner rail's session list functionally useless across projects — Cole can't tell which session belongs to which project. Compounds with the top-terminal cwd bug (separate doc): the inner rail and dock terminals are the two main "what's running in this project" surfaces, and both are broken right now.
