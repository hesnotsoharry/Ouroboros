---
status: OPEN
created: 2026-05-25
updated: 2026-05-25
priority: MED
---

# `repoMap-worker` request id=3 took 3927ms (vs ~459ms first boot)

## Context

Surfaced in Cole's second 3-window boot trace (2026-05-25 19:06:35–19:06:39).
The codebase-graph repoMap worker emitted:

```
[trace:repoMap-worker] request id=3
[trace:repoMap-worker] response id=3 workerMs=3927
[worker:repoMap] [trace:generateRepoMap] phase=crossModuleDeps ms=3866 edges=0
```

The dominant cost was `crossModuleDeps` at 3866ms. First boot of the same
session (request id=0) showed `crossModuleDeps` at 412ms; subsequent boots
typically <150ms. The 8× regression happened mid-session, not at cold boot.

## Hypotheses

1. **Graph DB lock contention** — `codebase-graph.db` is opened read-only by
   the worker but writes from other paths could be locking it. Coincides
   with a `[context-layer] Invalidation: session_start` at 19:06:28, ~5s
   before the slow worker call. Worth checking if the invalidation path
   writes to the DB and blocks the worker.
2. **Cold cache after invalidation** — `session_start` invalidation clears
   the module cache; the next worker request re-walks the cross-module
   dependency graph from scratch. If the graph state is "post-invalidation
   but pre-rewarming," cost spikes.
3. **`files=1` is wrong** — the worker logs `start files=1 roots=1` for
   this call. If the worker is supposed to be scanning more files but is
   only seeing 1, the high cost would be elsewhere (full crossModuleDeps
   compute despite tiny input).

## Investigation shape

- Add timing breakdowns inside `crossModuleDeps`: time spent on graph
  query vs in-memory analysis.
- Log whether the worker's read-only DB connection is being blocked by
  writes from another process at the time of the spike.
- Reproduce: trigger a `session_start` invalidation manually and observe
  the next worker call.

Dispatch `sonnet-diagnostician` for this if a one-off instrumentation
session doesn't yield the cause.

## Why this isn't in Wave 16

Wave 16 was scoped to IPC handler caching. The repoMap worker is its own
subsystem with its own cost profile. The 3927ms spike is a regression
worth diagnosing but not in scope.

## Related

- Boot trace timestamp: 2026-05-25 19:06:35–19:06:39
- Files: `src/main/codebaseGraph/`, `src/main/contextLayer/`
- Codebase-graph CLAUDE.md at `src/main/codebaseGraph/CLAUDE.md` if it exists
