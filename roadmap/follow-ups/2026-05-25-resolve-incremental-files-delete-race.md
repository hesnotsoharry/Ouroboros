---
status: OPEN
created: 2026-05-25
updated: 2026-05-25
priority: LOW
wave: 17
---

# `resolveIncrementalFiles` skips `pruneDeleted` on the no-op fast-path

## Context

Surfaced by Wave 17 Phase 2's `sonnet-phase-reviewer` (Axis 3 — Integrity, edge case 3).

The fast-path in `resolveIncrementalFiles` at `src/main/codebaseGraph/indexingPipelineIncremental.ts:156-159`:

```typescript
const isIncrementalRun = changed.length < allFiles.length;
if (changed.length === 0 && isIncrementalRun) {
  return { filesToProcess: [], isIncrementalRun };
}

for (const file of changed) deleteNodes(file.relativePath);
pruneDeleted(allFiles);
```

`pruneDeleted` is only called on the NON-fast-path branch. If `changedPaths` contains a deleted file (e.g., a file removed between the watcher event and the reindex) AND the remaining hinted files happen to all be unchanged by content hash, the fast-path fires and `pruneDeleted` is never called. The DB then retains a stale `file_hash` entry for the deleted file.

## Impact

Narrow race condition. Requires:
1. A `changedPaths` hint containing a file that was just deleted, AND
2. All other hinted files (if any) to be unchanged.

In practice: stale `file_hash` records accumulate slowly and are reconciled on the next full reindex. Not visible to the user; doesn't affect correctness of graph queries (graph nodes for the deleted file are scoped to the indexing-time scan, not the hash table).

## Proposed fix

Move `pruneDeleted` outside the if-branch. It's idempotent — calling it on an empty changed set is fine (it walks `allFiles` and deletes anything in the DB that's not in the file set).

Alternatively: drop the fast-path's `pruneDeleted` skip entirely, since the cost of `pruneDeleted` on an unchanged tree is minimal (a single DB query + maybe a few deletes for the actually-deleted files).

## Why deferred from Wave 17

Wave 17 Phase 2 was scoped to the dominant blocker (the O(N) catalog scan). This edge case is in the refactor's seam but isn't a regression — pre-existing code didn't have this exact path either (since the original code always ran `pruneDeleted` after a non-empty `changed`). It surfaced from the helper extraction.

## Files

- `src/main/codebaseGraph/indexingPipelineIncremental.ts` (the `resolveIncrementalFiles` function)
- `src/main/codebaseGraph/indexingPipelineIncremental.test.ts` (regression test once fixed)
