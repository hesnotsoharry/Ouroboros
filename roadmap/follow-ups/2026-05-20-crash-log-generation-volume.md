---
status: OPEN
created: 2026-05-20
updated: 2026-05-20
---

# High-volume crash-log generation (24k+ files)

## Origin

Surfaced while diagnosing the "freeze when browsing Settings" bug (2026-05-20). The
freeze itself was `app:getCrashLogs` synchronously reading **24,282** crash-log files
from `%userData%/crashes` on the main thread (~28s block) — fixed in `crashHandlers.ts`
(count-only endpoint + retention cap of 50 + bounded reader).

This follow-up is the **separate** problem the freeze fix uncovered: *why do 24,282
crash logs exist?*

## What we know

- `app:logError` (`crashHandlers.ts` → `writeCrashLog`) writes one `.log` file per call.
- 24,282 files totaling only ~3.7 MB → each is tiny (~150 bytes), i.e. many small,
  frequent error reports rather than a few large crashes.
- The renderer calls `app:logError` from its error-reporting path (global error handler /
  error boundary — confirm exact call sites).

## Hypothesis to investigate

Some recurring, probably-benign error is being logged on a tight loop or per-render/
per-event, producing thousands of near-identical crash logs. Candidates: an error boundary
re-throwing on every render, a rejected promise fired on an interval, or a hook/IPC failure
logged on every occurrence.

## Suggested next steps

1. Grep the renderer for `logError` / `crash.logError` call sites; identify which fires
   most.
2. Inspect a sample of the existing crash logs (before the retention prune clears them) to
   read the `Source:` + `message` — they'll name the recurring error directly. (Run before
   the new retention cap prunes the backlog, or copy a sample out first.)
3. Fix the underlying recurring error, and/or add dedup/rate-limiting to `writeCrashLog`
   (e.g. collapse identical `source+message` within a time window) so a single recurring
   fault can't flood the directory again.

## Notes

The retention cap (50) added in the freeze fix prevents unbounded *accumulation*, but does
not address the *generation rate* — if the recurring error persists, it'll just churn the
newest 50 slots. Root-cause the generator.
