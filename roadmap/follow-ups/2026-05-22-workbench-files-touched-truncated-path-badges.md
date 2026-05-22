---
status: OPEN
created: 2026-05-22
updated: 2026-05-22
priority: LOW
origin: wave-4-workbench-agent-sidebar-live (Phase 3 implementer + reviewer note)
---

# FilesTouched +N/−N badges miss on >80-char truncated paths

## What

Phase 3 enriches the FilesTouched rows with `+N/−N` diff badges by matching each touched-file row
against the fetched `FileDiff[]`. The match (`buildBadgeMap` in
`src/renderer/components/Workbench/useWorkbenchAgentData.diff.ts`, consumed by `deriveFilesTouched`
in `useWorkbenchAgentData.ts`) keys on **exact** `FileDiff.relativePath` equality with the row path.

The row path comes from `ToolCallEvent.input`, which is truncated to ≤80 chars
(`useAgentEvents.payload.ts:301`). For deep paths that exceed 80 chars, the ellipsized row path will
not exact-match the full `relativePath`, so the badge map misses and the row renders with no badge
(`adds:0/dels:0`).

## Why it's LOW (accepted Phase-3 degrade)

- The list row still renders correctly (from `toolCalls`); only the decorative badge is absent.
- This is the same graceful-degrade posture as the diff-pipeline-off case (ADR D5): badges are
  decorative and degrade out cleanly, no error.
- No current test exercises a >80-char colliding path for badges; the Phase-2 dedup already handles
  the list-row case with ellipsis-tolerant keys.

## The fix (when taken)

Make the badge match ellipsis-tolerant — reuse the same suffix/segment-match key the Phase-2
touched-files dedup uses, rather than raw `relativePath` equality. Do NOT forward the full
(untruncated) `file_path` over IPC for this — that was explicitly out of scope for Wave 4
(dedup/match defensively in the renderer).

File: `src/renderer/components/Workbench/useWorkbenchAgentData.diff.ts` (`buildBadgeMap` /
match key).

Trigger to schedule: if missing badges on deep paths are observed in live smoke, or alongside the
diff-subscription refactor follow-up.
