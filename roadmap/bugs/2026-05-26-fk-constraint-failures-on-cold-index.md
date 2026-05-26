---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
---

# Bug: FK constraint failures on cold index of Gamify project

**Observed symptom (2026-05-26 00:18–00:20 startup trace):**
```
[pipeline] pass=definitions threw, isolating: FOREIGN KEY constraint failed
[pipeline] pass=calls threw, isolating: FOREIGN KEY constraint failed
```
Three cold-index runs for Gamify within ~33s; FK errors fire on each. Index
reports `success=true` with ~1200 nodes despite the errors.

---

## 1. TL;DR

The FK failing is `edges.source_id → nodes(id)` and `edges.target_id → nodes(id)`.
It is triggered by `definitionPass` and `callResolutionPass` — both insert edges
whose `source_id` or `target_id` references a node that does not yet exist in the
`nodes` table when `foreign_keys = ON` is enforced.

This is **pre-existing** — the schema has had FK constraints since schema version 0,
and the definition/call passes have always emitted edges that reference nodes outside
the current chunk's just-inserted nodes. Wave 18's W3 change (`f5d0c509`) is
responsible for **surfacing** the bug in the trace by adding a new code path
(`handleLaunchDiff`) that calls `pipeline.index({ incremental: true, changedPaths })`
inside the worker before the cold `runIndex` queues. However, as the queue-serialization
analysis below shows, the FK violation cannot be caused by a race between those two
runs — it is purely a within-run pass-ordering problem that has always existed and was
previously masked.

**Severity:** Medium. Data loss is real (some edges are silently dropped per run), but
`insertNode` uses `INSERT OR REPLACE` so node upserts survive. The "isolating" catch
means the whole chunk's edges for the failing transaction are dropped; those edges are
never retried. Graph completeness is therefore measurably worse than a no-FK-enforcement
run would produce. The indexer returns `success=true` regardless, so callers see no
signal.

---

## 2. The "isolating" catch — what is silently dropped

`indexingPipeline.ts:59–70` (`runPass`):

```typescript
private async runPass(phase, thunk, report): Promise<void> {
  report(phase);
  try {
    this.db.transaction(thunk);
  } catch (err) {
    log.warn('[pipeline] pass=%s threw, isolating: %s', phase, ...);
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
}
```

For `definitions` and `calls` the pipeline uses `runChunkedPass` (not `runPass`)
(`indexingPipeline.ts:75–87`), which has the same catch structure but no outer
transaction — each chunk manages its own inner `db.transaction(...)`.

In `definitionPass` (`indexingPipelinePasses.ts:210–224`):
```typescript
for (const chunk of chunkArray(indexedFiles, size)) {
  db.transaction(() => processDefinitionChunk(db, projectName, chunk));
}
```

In `processDefinitionChunk` (`indexingPipelinePasses.ts:193–208`), `db.insertNodes`
is called (which wraps node inserts in a nested `db.transaction()`), and then
`db.insertEdges` is called (which wraps edge inserts in another `db.transaction()`).

When `db.insertEdges` throws (FK violation on any edge in the batch), the
`db.transaction` wrapper re-throws, the outer `db.transaction(() =>
processDefinitionChunk(...))` sees the throw, and `runChunkedPass` catches it and
logs. The entire chunk's edge batch is rolled back. Every edge in that 500-file chunk
that would have been inserted is dropped.

**What the database ends up missing:**
- `DEFINES` edges from File nodes to symbol nodes for any chunk that contains a
  `source_id` that doesn't yet exist (e.g., a File node whose structurePass insertion
  was partial, or a cross-chunk Class node reference).
- `DEFINES_METHOD` edges from Class to Method when the Class node is in a different
  chunk than the Method.
- `CALLS`/`ASYNC_CALLS` edges whose `source_id` (a caller function) was defined in a
  chunk that failed, or whose `target_id` (a callee) wasn't inserted yet.
- `HANDLES` edges from Route nodes to handler symbol nodes in other chunks.

In practice this means the call graph and DEFINES edges are incomplete for any project
large enough to be split across multiple 500-file chunks.

---

## 3. Schema audit — all FK constraints

`graphDatabaseSchema.ts:35–65`:

```sql
nodes (
  id      TEXT PRIMARY KEY,
  project TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
  ...
)

edges (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  project   TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ...
)

project_summaries (
  project TEXT PRIMARY KEY REFERENCES projects(name) ON DELETE CASCADE
)
```

There are four FK constraints total:

| Table | Column | References | Action |
|---|---|---|---|
| `nodes` | `project` | `projects(name)` | CASCADE |
| `edges` | `project` | `projects(name)` | CASCADE |
| `edges` | `source_id` | `nodes(id)` | CASCADE |
| `edges` | `target_id` | `nodes(id)` | CASCADE |

The `nodes.project → projects(name)` FK is satisfied because `discoverAndResolve`
calls `db.upsertProject` before any pass runs (`indexingPipeline.ts:218–224`).

The `edges.project → projects(name)` FK is also satisfied (same reason).

**The failing constraints are `edges.source_id → nodes(id)` and
`edges.target_id → nodes(id)`.**

`foreign_keys = ON` is set unconditionally in `graphDatabase.ts:70` via `applyPragmas`.
This is active on both the main-thread DB and the worker's independent DB connection
(the worker constructs its own `new GraphDatabase(resolveWorkerDbPath())` at
`indexingWorker.ts:52`).

---

## 4. Pass ordering audit

`IndexingPipeline.runCorePasses` (`indexingPipeline.ts:100–127`):

```
structure   → runPass (ONE transaction: Project node + all Folder nodes +
              all Folder edges + all File nodes + all File edges)
definitions → runChunkedPass (definitionPass, chunks of 500)
imports     → runChunkedPass (importPass, chunks of 500)
calls       → runChunkedPass (callResolutionPass, chunks of 500)
```

`structurePass` (`indexingPipelinePasses.ts:31–53`) runs as a single transaction
that inserts the Project node, all Folder nodes, folder edges, all File nodes, and
file CONTAINS_FILE edges — ALL in one `db.transaction(thunk)` block via `runPass`.

This means all File nodes (id = qualified name, e.g.
`gamify.src.app.layout`) are in the DB before `definitionPass` starts. The
`DEFINES` edge's `source_id = fileQn` is therefore always valid.

**However, `definitionPass` also creates `DEFINES_METHOD` and `HANDLES` edges whose
`source_id` or `target_id` reference symbol nodes that are being inserted in OTHER
chunks of the same pass.** In `collectDefinitions`
(`indexingPipelinePasses.ts:115–148`):

```typescript
if (def.kind === 'Method' && def.receiver) {
  const classQn = `${fileQn}.${def.receiver}`;
  acc.edges.push({
    source_id: classQn,    // ← a Class node: MAY be in a DIFFERENT chunk
    target_id: symbolQn,   // ← the Method node: in THIS chunk
    type: 'DEFINES_METHOD',
  });
}
```

A `DEFINES_METHOD` edge has `source_id = classQn`. The Class node is inserted by
whatever chunk contains the file where the Class is defined. If that file falls in
chunk N and the Method file falls in chunk M (M ≠ N), the `DEFINES_METHOD` edge in
chunk M will reference a Class node ID that either (a) hasn't been inserted yet
(class file is in a later chunk) or (b) was rolled back (its chunk failed). This is
the FK violation for `pass=definitions`.

In `addRouteNodes` (`indexingPipelinePasses.ts:150–181`):
```typescript
edges.push({
  source_id: routeQn,
  target_id: `${fileQn}.${route.handlerName}`,  // ← may be in a different chunk
  type: 'HANDLES',
});
```

For `callResolutionPass` (`indexingPipelineCallResolution.ts:198–216`):

```typescript
export function callResolutionPass(db, projectName, indexedFiles, options) {
  const symbolsByName = buildSymbolsByName(db, projectName);  // reads DB post-definitions
  ...
  for (const chunk of chunkArray(indexedFiles, size)) {
    db.transaction(() => db.insertEdges(resolveChunkEdges(chunk, callCtx)));
  }
}
```

`buildSymbolsByName` reads only the Function, Method, and Class nodes that
successfully made it into the DB. But `resolveCallEdges` produces edges with
`source_id = callerQn` — if that callerQn's definition chunk was rolled back by a
prior FK failure, `callerQn` doesn't exist in the DB. The FK check on `source_id`
then rejects the edge. This is the FK violation for `pass=calls`.

**Root cause of the ordering violation:** Both `definitionPass` and `callResolutionPass`
emit edges whose endpoint nodes may be absent at insert time because:
1. `definitionPass` uses per-chunk transactions, so chunk N's nodes don't exist when
   chunk M (M < N) runs.
2. `callResolutionPass` inherits dropped nodes from failed definition chunks, then
   tries to insert edges referencing those dropped nodes.

---

## 5. Per-hypothesis verdict

### H1 — Wave 18 W3 transaction-boundary regression
**REFUTED.**

The `launchDiff` path and cold `runIndex` are serialized through
`IndexingWorkerClient.queue` (`indexingWorkerClient.ts:67`, `drainQueue` at line
215). The queue is single-consumer: `drainQueue` only dequeues when `this.busy ===
false` (line 215), and `this.busy = true` is set in `dispatch` before the message
is sent (line 183). `busy` is cleared in `settle` or `settleLaunchDiff` only after
the worker responds (lines 257, 249).

The worker itself processes messages sequentially via
`parentPort.on('message', handleMessage)` (`indexingWorker.ts:217`) — `async`
handlers run to completion before the next message is processed in Node.js
worker_threads.

Therefore `launchDiff` and `runIndex` cannot overlap. The queue guarantees serial
execution. H1 is refuted on structural grounds.

### H2 — Catalog hash mismatch causes redundant cold index on top of in-flight run
**PARTIALLY CONFIRMED (explains three runs; not the FK root cause).**

`resolveIndexReason` is called by `ensureIndexed` after `acquireCompatController`
returns. At that moment the launchDiff has already been dispatched to the worker
queue (dispatched during `watcher.initWithLaunchDiff()` at
`systemTwoRegistry.ts:133`). The launchDiff incremental run updates `file_hashes`
for changed files but does NOT call `db.writeCatalogHash()`. A second call to
`verifyCatalogHash` after the launchDiff writes but before a subsequent
`writeCatalogHash` may see a hash mismatch, triggering run 2. This is a contributing
factor to the three-runs pattern, not the FK cause itself.

### H3 — FK target table not populated before referencing inserts
**CONFIRMED as the root cause.** See Section 4.

`DEFINES_METHOD` edges in `definitionPass` reference Class node IDs that may not yet
be committed when the Method's chunk runs. `CALLS`/`ASYNC_CALLS` edges in
`callResolutionPass` reference symbol IDs that were dropped by a failed
`definitionPass` chunk. `HANDLES` edges reference handler symbol IDs from other
chunks.

### H4 — Project root mismatch / deleted project_id
**REFUTED.**

`db.upsertProject` is called unconditionally in `discoverAndResolve`
(`indexingPipeline.ts:218–224`) before any pass runs, ensuring the `projects` row
exists. The `nodes.project → projects(name)` and `edges.project` FKs are always
satisfied.

### H5 — Pre-existing bug; Wave 18 didn't introduce it
**CONFIRMED.** The FK violation is structurally possible in any cold index run on a
project large enough that methods and their class definitions fall in different
500-file chunks. Wave 18 made it more visible by causing Gamify to be indexed three
times per session.

---

## 6. Wave 18 regression analysis

Commit `f5d0c509` changed `autoSync.ts`'s `initWithLaunchDiff()` to dispatch
`getIndexingWorkerClient().runLaunchDiff(...)` instead of calling `this.onLaunchDiff()`
synchronously on the main thread.

The W3 change did NOT modify:
- Transaction boundaries in the indexing pipeline.
- Chunk size (still 500 files, hardcoded in `runCorePasses`).
- Pass ordering in `runCorePasses`.
- FK enforcement (`foreign_keys = ON` was already set).

The W3 change DID:
- Move the startup launchDiff + conditional incremental reindex from the main thread
  to the worker thread, serialized through the same queue as `runIndex`.
- Add a `runLaunchDiff` path that calls `pipeline.index({ incremental: true,
  changedPaths })` in the worker.

**Wave 18 is not a regression for the FK violation.** W3 caused Gamify to be indexed
more frequently per startup session, making the pre-existing bug appear in the trace
for the first time. The fix is NOT in the W3 launchDiff path.

---

## 7. Three-runs-in-a-row mechanism

**Run 1 (00:19:13):** `ensureIndexed` fires for Gamify (newly acquired root, cold
project). `resolveIndexReason` returns `'hash-mismatch'` or `'first-launch'`.
`runInitialIndex` calls `workerClient.runIndex({ incremental: false })`. Pipeline
runs all passes; FK errors on definitions/calls chunks; index returns `success=true`
(FK errors are caught per-pass, not propagated to the result).
`db.writeCatalogHash` is called after run 1 completes.

**Run 2 (00:19:18 — "catalog hash mismatch"):** The launchDiff incremental run (which
ran BEFORE run 1 in the queue) wrote some `file_hashes` updates without calling
`writeCatalogHash`. After run 1 wrote the hash, the hash reflects the state of
`file_hashes` at that moment. But the FK failures in run 1 left the graph with fewer
nodes/edges than expected. Some external trigger (e.g., project-switch event,
second window acquiring Gamify root) calls `ensureIndexed` again; `verifyCatalogHash`
returns false for the mismatch between the hash written after a partial index and the
actual node/edge state, triggering run 2.

**Run 3 (00:19:34 — forceRebuild after graph-ready):** `triggerContextLayerRebuildAfterGraphReady`
fires at `mainStartupGraph.ts:100` after run 1's `sendIndexProgress` complete event.
That trigger enqueues a third cold `runIndex`.

**Classification:** This is a combination of (a) expected behavior — each new root
acquire triggers `ensureIndexed`, (b) catalog hash drift from partial-index writes,
and (c) the graph-ready trigger firing a third index. All three runs are serialized
correctly through the worker queue — there is no race condition.

---

## 8. Proposed fix shape — DO NOT IMPLEMENT

Three independent fixes are needed:

### Fix A — Eliminate cross-chunk DEFINES_METHOD FK violations (definitionPass)

**Mechanism:** Split `processDefinitionChunk` into two phases within `definitionPass`:
1. First loop over all chunks: insert ONLY nodes (no edges).
2. Second loop over all chunks: insert ALL edges (DEFINES, DEFINES_METHOD, HANDLES,
   DEFINES_ROUTE).

At the start of phase 2, all symbol nodes across all chunks are committed, so no
edge can reference a missing node. This eliminates the FK violation without
touching FK enforcement settings.

Alternative: collect `DEFINES_METHOD` and `HANDLES` edges separately during node
insertion and flush them in a single post-nodes transaction.

**Scope:** `indexingPipelinePasses.ts` (`processDefinitionChunk`, `definitionPass`).
~20–30 lines.

### Fix B — Filter callResolutionPass edges against actually-inserted nodes

**Mechanism:** `callResolutionPass` calls `buildSymbolsByName` which reads only
successfully-inserted nodes. The `source_id` (callerQn) is a symbol that should have
been inserted by `definitionPass` but may have been dropped. Before inserting a batch
of CALLS edges, filter them: keep only edges where `db.getNode(edge.source_id) !== null`.

This is a safety net for Fix A — if Fix A eliminates the definition chunk failures,
callResolutionPass will no longer see dropped source nodes. But Fix B protects
against any future definition failure mode.

**Scope:** `indexingPipelineCallResolution.ts` (`callResolutionPass`). ~10–15 lines.

### Fix C — Invalidate catalog hash on partial index

**Mechanism:** After a cold index where ANY pass threw (tracked via a counter in
`IndexingPipeline`), call `db.setGraphMetadata('catalog_hash:${projectName}', '')`
instead of `db.writeCatalogHash()`. This ensures the next `verifyCatalogHash` call
returns false, triggering a clean full rebuild. Prevents the "partial index accepted
as complete" loop that causes run 2.

**Scope:** `indexingPipeline.ts` (`runCorePasses` pass-error tracking) +
`mainStartupGraph.ts` (`runInitialIndex`). ~15–20 lines.

---

## 9. Phase 2+ hand-off

1. **Worker DB path is correct post-W3.** The worker receives its DB path via
   `workerData.dbPath` (passed from `buildWorkerData()` in `indexingWorkerClient.ts:42`
   using `getDbPath()` on the main thread). Both connections point to the same SQLite
   file in WAL mode. Fix A must preserve this — no new tables are required.

2. **chunkedPass does NOT have an outer transaction.** `definitionPass` uses
   `runChunkedPass` which has no outer `db.transaction`. Fix A's two-phase approach
   can either (a) run all-nodes phase first (multiple transactions) then all-edges
   phase (multiple transactions), or (b) accumulate all edges during the first phase
   and flush in a single final transaction.

3. **`structurePass` is clean.** It inserts nodes and edges in a single transaction
   over Project, Folder, and File nodes. No symbol cross-references. No fix needed
   there.

4. **Test reproduction:** The existing `test:codebasegraph` suite does not exercise
   the cross-chunk FK scenario. A cheap reproducer: pass `chunkSize: 2` to
   `definitionPass` with a 4-file fixture where file A defines a Class and file B
   defines a Method with `receiver = ClassA`. Files A and B land in different chunks
   at size 2. Verify that without Fix A, the `DEFINES_METHOD` edge is missing from
   the DB after indexing.

5. **`insertEdge` uses `INSERT OR REPLACE`** (`graphDatabaseHelpers.ts:44–51`), not
   `INSERT OR IGNORE`. FK violations still throw even with OR REPLACE — the fix must
   be upstream (ensure nodes exist before edge inserts), not downstream (ignore
   constraint errors).

6. **Wave 18 W3 is NOT the cause and should NOT be reverted.** The queue
   serialization and worker offload are correct. The launchDiff incremental path does
   not exercise the cold-index chunk-ordering violation (it only processes changed
   files, not all files, and calls `resolveFilesToProcess` with `isIncrementalRun:
   true` which skips `deleteProject`).

7. **The `forceRebuild` (run 3) origin** — `triggerContextLayerRebuildAfterGraphReady`
   at `mainStartupGraph.ts:100` fires a third index. Tracing that function's
   implementation would clarify whether it always triggers a cold `runIndex` or
   conditionally. That is a separate investigation from the FK fix.
