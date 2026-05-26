---
status: OPEN
created: 2026-05-25
updated: 2026-05-25
wave: 16-p10-hotfix
---

# IndexingWorkerClient not disposed on per-window release

## Context

Wave 16 P10 hotfix fixed the 12.6s event-loop stall in `systemTwoRegistry.release()`
by making the `@parcel/watcher` native subscription close fire-and-forget.

During diagnosis, the diagnostician flagged a separate gap: `IndexingWorkerClient`
is created in `graphControllerCompatRegistry.acquireGraphController()` (or its
dependencies) but its `dispose()` is NOT called on the per-window
`releaseGraphController` path.

The `disposeIndexingWorkerClient()` call in `mainStartupGraph.disposeCodebaseGraph()`
covers the app-quit path, but individual window closes do not call it. If multiple
windows share the same worker client (current architecture), this may be intentional;
if each window has its own client instance, the worker thread leaks on window close.

## What to investigate

1. Check whether `IndexingWorkerClient` is a singleton or per-window instance.
2. If per-window: wire `IndexingWorkerClient.dispose()` into
   `graphControllerCompatRegistry.releaseGraphController()` (when refCount drops
   to zero).
3. If singleton: document the lifecycle assumption in `codebaseGraph/CLAUDE.md`
   so future readers don't wonder if it's a leak.

## Impact

If per-window and leaking: orphaned worker threads accumulate over multi-window
sessions. Low-urgency — worker threads are bounded by open windows and are
reclaimed on app-quit regardless.

## Files to check

- `src/main/codebaseGraph/indexingWorkerClient.ts` — `dispose()` implementation
- `src/main/codebaseGraph/graphControllerCompatRegistry.ts` — `releaseGraphController`
- `src/main/mainStartupGraph.ts` — `disposeCodebaseGraph` (app-quit path)
