---
status: OPEN
created: 2026-05-25
updated: 2026-05-25
priority: MED
---

# Codex-specific usage poller (analogous to claudeUsagePoller)

## Context

Discovered during Wave 16 Phase 4 (usage snapshot coalescer). The slow path
on `usage:getUsageWindowSnapshot` is `getLatestCodexUsageSnapshot()`, which
scans up to 40 JSONL files across 14 days of `~/.codex/sessions/` on every
call. The Wave 16 P4 coalescer eliminates the N-concurrent-scan problem
(per-renderer-window fan-out at boot) but the first call of each 300s
cache interval still bears the full scan cost (~2.5–3.4s observed in 3-window
trace).

Claude usage has a poller (`src/main/claudeUsagePoller.ts`) that pre-warms
its cache on a 5-min interval; Codex has no equivalent. The trace stayed
on-demand because of historical sequencing.

## Proposed fix

Add a `codexUsagePoller.ts` mirroring the claude poller's shape:
- 5-min interval (or use the shared `POLL_INTERVAL_MS`)
- Scans `~/.codex/sessions/` and writes the snapshot to in-process state
- The Wave 16 P4 coalescer's `fetchFn` reads from the poller's cached state
  instead of triggering a fresh scan

After this lands, first-call latency on the snapshot handler drops from
~3s to ~0ms — the scan happens off the IPC critical path entirely.

## Why deferred

Wave 16 P4's coalescer is a strict improvement on its own. The poller is
an additive win that doesn't change Wave 16's correctness or scope.
Reasonable to schedule into a future perf wave or address opportunistically
when the codex sessions code is next touched.

## Related

- Wave 16 P4 commit: `e72d1ae0`
- Files: `src/main/ipc-handlers/usageSnapshotCoalescer.ts`, `src/main/claudeUsagePoller.ts` (pattern reference)
