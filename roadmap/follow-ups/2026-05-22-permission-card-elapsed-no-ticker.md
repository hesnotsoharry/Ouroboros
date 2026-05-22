---
status: OPEN
created: 2026-05-22
updated: 2026-05-22
type: follow-up
slug: permission-card-elapsed-no-ticker
severity: LOW
surfaced-by: wave-5-workbench-permission-overlay
---

# Permission card elapsed-time has no live ticker

## What

The `PermissionCard` elapsed pill shows `Date.now() - request.timestamp` computed **at render time**,
with no `setInterval`/`useInterval` driving periodic re-renders. Both presentations are affected:
- `useWorkbenchApproval.computeElapsedSec` (`Permission/useWorkbenchApproval.ts:27`) — overlay
- `useSidebarApproval` inline (`AgentSidebar/AgentSidebar.tsx:189`) — sidebar takeover

So the displayed elapsed seconds only update when an unrelated state change triggers a re-render, and
the two surfaces can momentarily display values a few seconds apart if they re-render at different times.

## Why it matters (barely)

Purely cosmetic. No impact on resolver correctness, request identity, keyboard routing, or which request
is shown (both select `requests[0]` from the same context — single source of truth). The flag was raised
by the Phase 2 reviewer as a known non-blocking limitation.

## Why deferred

- Pre-existing pattern (the NowBlock elapsed pill behaves the same way); not introduced by Wave 5.
- A live ticker is a small, isolated addition but not worth expanding Wave 5's renderer-only scope.

## Recommended resolution

If a live ticker is wanted: add a shared `useElapsedSeconds(timestamp)` hook (a `setInterval(…, 1000)`
that re-renders) and have both `useWorkbenchApproval` and `useSidebarApproval` consume it, so the two
surfaces stay in lockstep. ~15 lines; one file.

## Pointers

- `src/renderer/components/Workbench/Permission/useWorkbenchApproval.ts:27`
- `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.tsx:189`
