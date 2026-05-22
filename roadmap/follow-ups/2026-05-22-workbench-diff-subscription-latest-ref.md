---
status: OPEN
created: 2026-05-22
updated: 2026-05-22
priority: LOW
origin: wave-4-workbench-agent-sidebar-live (Phase 3 phase-reviewer FLAG)
---

# Workbench diff subscription — convert to latest-ref pattern (both hooks)

## What

The `diff_review_ready` subscription in `useWorkbenchAgentData.diff.ts` (`useDiffReviewState`)
lists `enableTerminalDiffReview` in its `useEffect` dependency array. When the user toggles the
setting, the effect tears down and re-registers the `window.electronAPI.hooks.onAgentEvent`
subscription. There is a ~1-render-cycle window between cleanup and re-subscribe where an inbound
`diff_review_ready` event would be silently dropped.

The Phase-3 acceptance work mirrors the **existing reference pattern** in
`src/renderer/hooks/useDiffReviewTrigger.ts:43`, which has the identical deps-array shape (and the
identical imprecision). Phase 3 deliberately matched the reference rather than diverge — fixing one
sibling and leaving the other would create two competing patterns for the same job.

## Why it's LOW (not fixed inline)

- Practical impact is effectively nil: the diff pipeline's emission is main-side-gated on the same
  `enableTerminalDiffReview` flag, so right after toggling on, the re-subscribe lands in the same
  React commit tick as the first emission. The dropped-event window requires an event to arrive in
  the exact cleanup→re-subscribe gap.
- All Phase-3 acceptance + render tests pass; this is a refinement, not a defect.

## The fix (when taken)

Convert BOTH hooks together to the React "latest ref" pattern:
- Hold `enableTerminalDiffReview` in a `useRef`, updated each render.
- Subscribe once with `[]` deps; read `flagRef.current` inside the callback guard.
- This eliminates the teardown/re-subscribe cycle entirely and keeps the two hooks consistent.

Files: `src/renderer/components/Workbench/useWorkbenchAgentData.diff.ts`,
`src/renderer/hooks/useDiffReviewTrigger.ts`.

Trigger to schedule: any wave that next touches the agent-event subscription pattern, or a
renderer-hooks consistency sweep.
