---
status: COMPLETE
created: 2026-05-26
wave: 19
phase: 3a
finding: B
agent: sonnet-architect
---

# Wave 19 Finding B — FK Constraint Fix — Architect Plan

## TL;DR

Split `processDefinitionChunk` into a two-phase operation within `definitionPass`: all
symbol nodes across all chunks are inserted first (multiple transactions), then all
cross-chunk edges (DEFINES_METHOD, HANDLES) are flushed in a second pass over the same
chunks. Additionally, invalidate the catalog hash when any pass throws during a cold
index so partial indexes never get accepted as complete. Fix B (callResolutionPass
source-id guard) is adopted as a defense-in-depth safety net. Together these three
changes (Fix A + Fix C + Fix B as safety net) produce a complete, correct graph on
cold index for any project size.

---

## Diagnostic Re-Verification

All code citations from the bug doc were verified against the current worktree files.
Corrections and confirmations follow.

### graphDatabase.ts — `foreign_keys = ON` at line 70

**CONFIRMED, CORRECTED LINE.** The pragma is at line 70 of the file, but it is part
of a multi-statement inline array at that line:

```typescript
// graphDatabase.ts:70 (actual)
const pragmas = ['cache_size = -32000', 'temp_store = MEMORY', 'mmap_size = 134217728', 'foreign_keys = ON', 'busy_timeout = 5000'];
```

This is a single long line, not a standalone `this.db.pragma('foreign_keys = ON')` call.
The diagnostic memo's citation "line 70: `applyPragmas` sets `foreign_keys = ON`" is
**substantively correct** — the pragma is set unconditionally in `applyPragmas` for
non-readonly connections. Line number is correct. No correction needed.

### graphDatabaseSchema.ts — FK definitions at lines 35–65

**CONFIRMED, MINOR CORRECTION.** The FK definitions are at lines 35–61 (not 35–65).
The table content matches the diagnostic's description exactly: `nodes.project →
projects(name)`, `edges.project → projects(name)`, `edges.source_id → nodes(id)`,
`edges.target_id → nodes(id)`, all with `ON DELETE CASCADE`. No functional difference.

### indexingPipeline.ts — `runPass` at lines 59–70 and `runChunkedPass` at lines 75–87

**CONFIRMED, MINOR CORRECTION.** `runPass` spans lines 59–71 (one line longer than
cited due to closing brace placement). `runChunkedPass` spans lines 73–87. The key
behavioral facts cited are correct: `runPass` wraps the thunk in `db.transaction()`;
`runChunkedPass` does NOT add an outer transaction and calls `thunk()` directly.

### `runCorePasses` at lines 100–127

**CONFIRMED EXACTLY.** The pass sequence is confirmed as structure → definitions →
imports → calls, all via `runChunkedPass` except structure (via `runPass`). CHUNK = 500
is hardcoded at line 106. The diagnostic's citation is accurate.

### indexingPipelinePasses.ts — `structurePass` at lines 31–53

**CONFIRMED.** `structurePass` at lines 31–53 inserts Project node (line 37 inline),
then Folder nodes, Folder edges, File nodes, File edges — all committed atomically via
the single `runPass` wrapper upstream. File nodes are present before `definitionPass`
runs. The diagnostic's claim that File `source_id` references are always valid for
DEFINES edges is correct.

### `collectDefinitions` — DEFINES_METHOD cross-chunk violation (cited lines 115–148)

**CONFIRMED, LINE CORRECTION.** `collectDefinitions` is at lines 115–148 in the
current file. The critical code:

```typescript
// indexingPipelinePasses.ts:137-146 (actual)
if (def.kind === 'Method' && def.receiver) {
  const classQn = `${fileQn}.${def.receiver}`;
  acc.edges.push({
    source_id: classQn,    // ← Class node: MAY be in a DIFFERENT chunk
    target_id: symbolQn,   // ← Method node: in THIS chunk
    type: 'DEFINES_METHOD',
  });
}
```

Note: `classQn` is constructed as `${fileQn}.${def.receiver}` — meaning the Class is
assumed to be in the SAME FILE as the Method. This is correct for the common case
(class and its methods in the same file), but NOT for cases where a class is defined in
one file and methods are added to it in another (e.g., TypeScript declaration merging,
mixins, or test helpers that extend a base class from another file). The FK violation
fires when the Class-file is in a different 500-file chunk than the Method-file — both
are from the same file per the current logic, but if that file is in a later chunk,
the Class node doesn't exist yet when the Method's chunk processes the DEFINES_METHOD
edge.

**ADDITIONAL FINDING (not in diagnostic).** The `classQn` construction uses `fileQn`
(the Method's file's qualified name) as the prefix, not the Class's actual file. For a
single-file class + method pair (the 99% case), this is correct. The FK violation
happens when chunk M processes a Method file and emits a DEFINES_METHOD edge where
`source_id = classQn = fileQn.ClassName` — but the Class node `fileQn.ClassName` was
only inserted when chunk N (containing the Method's file, which also defines the Class)
processes ITS node phase. Since chunk M processes the edge in the same transaction as
the node insert, if M < N the Class node doesn't exist yet. This confirms the
diagnostic's root cause.

### `addRouteNodes` — HANDLES cross-chunk violation (cited lines 150–181)

**CONFIRMED EXACTLY** at lines 150–181. Route nodes are inserted in the same chunk as
their file, but handler targets (`${fileQn}.${route.handlerName}`) reference symbol
nodes that may not exist yet if the handler is defined in a different file that lands
in a later chunk.

**ADDITIONAL FINDING.** In `addRouteNodes`, the Route node itself is inserted into
`acc.nodes`, and the HANDLES edge `source_id = routeQn` is always the Route node being
inserted in the same chunk — so the Route source is safe. The risk is only
`target_id = ${fileQn}.${route.handlerName}` referencing a handler symbol in a
different file's chunk.

### `processDefinitionChunk` at lines 193–208

**CONFIRMED EXACTLY** at lines 193–208. The function accumulates nodes and edges
together, then calls `db.insertNodes(acc.nodes)` followed immediately by
`db.insertEdges(acc.edges)` — both inside the outer `db.transaction()` wrapper in
`definitionPass`. This confirms the root cause: edge insert for DEFINES_METHOD and
HANDLES can reference nodes from other chunks that haven't been committed yet.

### `callResolutionPass` at lines 198–216

**CONFIRMED, LINE CORRECTION.** `callResolutionPass` public function is at lines
198–216. `buildSymbolsByName` at lines 165–177. The diagnostic's description of the
mechanism is accurate: `buildSymbolsByName` reads only successfully-inserted nodes, so
any node dropped by a failed `definitionPass` chunk will be absent, causing subsequent
`callResolutionPass` edge inserts with that node as `source_id` to fail the FK check.

### `graphDatabaseHelpers.ts` — `insertEdge` uses `INSERT OR REPLACE` (cited lines 44–51)

**CONFIRMED EXACTLY** at lines 44–51. `insertEdge` uses:
```sql
INSERT OR REPLACE INTO edges (project, source_id, target_id, type, props, confidence)
VALUES (@project, @source_id, @target_id, @type, @props, @confidence)
```
`INSERT OR REPLACE` on a FK violation still throws — OR REPLACE only handles UNIQUE
conflicts, not FK violations. The diagnostic's conclusion is correct: the fix must be
upstream.

### `mainStartupGraph.ts` — `triggerContextLayerRebuildAfterGraphReady` at line 100

**CONFIRMED EXACTLY** at line 100:
```typescript
void triggerContextLayerRebuildAfterGraphReady();
```
This fires after a successful cold index. The diagnostic's Section 9 item 7 question
(whether this always triggers a cold `runIndex`) is now answerable from the code:
`triggerContextLayerRebuildAfterGraphReady` is imported from
`mainStartupContextLayerTrigger` — it triggers a context LAYER rebuild (not a graph
reindex). This is the context layer (CLAUDE.md enrichment layer), not the indexing
worker. The "run 3" in the diagnostic's three-runs-in-a-row analysis is therefore a
MISATTRIBUTION — run 3 is almost certainly a second `ensureIndexed` call from a
second window acquiring the Gamify root, not this trigger. This trigger rebuilds
context layers, not the graph itself. Section 9 item 7 can be CLOSED — it is not a
forceRebuild of the graph index.

---

## Option Spectrum Evaluation

### Option 1: Two-pass insertion within `definitionPass` (diagnostic Fix A) — RECOMMENDED CORE

**Mechanism:** Restructure `definitionPass` into two sequential sweeps over all chunks:
1. Phase 1 — all chunks → insert ONLY nodes (DEFINES edges are safe because File nodes
   are already committed from structurePass; Class/Method/Function symbol nodes can be
   inserted per-chunk without cross-chunk references).
2. Phase 2 — all chunks → insert ALL edges (DEFINES, DEFINES_METHOD, HANDLES,
   DEFINES_ROUTE). By the time Phase 2 runs, all symbol nodes from all chunks are
   committed.

**Spectrum position: Industry standard.** This is the two-phase commit pattern for
batch graph loading: insert vertices first, then insert edges. It is the canonical
approach used by graph databases (Neo4j bulk import, TigerGraph loader), CSV import
pipelines, and bulk-load recommendations for any referential-integrity-enforced store.
See: [SQLite FK docs — "use deferred FK constraints or load in correct dependency
order"](https://sqlite.org/foreignkeys.html).

**Pros:**
- Eliminates the FK violation at its structural root, not just its symptom.
- No change to FK enforcement policy — constraints remain fully active.
- Memory overhead is bounded: edges accumulate per-chunk during Phase 2 (same as
  current behavior), not globally. Phase 1 accumulates only nodes per chunk.
- Clear separation of concerns — Phase 1 and Phase 2 are independently readable.
- No new tables, no schema changes, no migration required.

**Cons:**
- Two iteration loops over the file list instead of one. For 1200 files at chunk 500,
  this is 3 × 2 = 6 transactions instead of 3. The overhead per-file is negligible
  (accumulation is O(1) per file); the extra 3 transactions are SQLite BEGIN/COMMIT
  round-trips, which at WAL mode are approximately 1–5ms each. Total overhead:
  ~10–15ms on a 1200-file project. Acceptable.
- `processDefinitionChunk` must be split or parametrized (nodes-only mode vs
  edges-only mode). Touches ~20–30 lines.
- Import pass already correctly handles cross-chunk File→File edges because File nodes
  are all committed by structurePass. This fix does NOT affect importPass — it is
  already clean.

**Integration cost:** Low. 1 file (`indexingPipelinePasses.ts`), ~20–30 new lines,
~5 lines changed in `definitionPass`.

**Risk:** Very low. The behavior is a strict superset of the current behavior — nodes
inserted the same way, edges inserted after all nodes committed.

---

### Option 2: Sorted single-pass chunk ordering (process parent-class files before method files)

**Mechanism:** Before chunking `indexedFiles`, sort them so that files containing
class definitions appear before files containing methods of those classes. Process
chunks in that sorted order so Class nodes are always committed before DEFINES_METHOD
edges that reference them.

**Spectrum position: Non-standard for this problem shape.** Topological sort of file
dependencies is well-established for build systems; applying it to intra-pass insert
ordering is less common and introduces fragility.

**Pros:** Single pass maintained. No architectural change to chunk processing.

**Cons:**
- Requires a dependency analysis step before chunking: for each Method definition with
  a `receiver`, determine which file contains the Class. This analysis requires reading
  parse results before chunking, adding a pre-pass.
- The sort key is the `receiver` field from tree-sitter parse results — not always
  available cleanly for all language configurations (Go struct methods, Python class
  methods, etc.).
- Cross-file class/method relationships (declaration merging, mixins) are not handled
  even with sorting — the Class must be in the SAME file as the Method for the current
  `classQn = ${fileQn}.${def.receiver}` construction to be resolvable by sort order.
- If the sort produces equal-priority groups (no dependency between chunks), chunking
  becomes non-deterministic across runs.
- Adds complexity that is fragile — any future feature that creates new cross-chunk
  references would need to update the sort key logic.

**Integration cost:** Medium. Pre-sort step + dependency extraction logic needed.

**Risk:** Medium. The sort correctness depends on parse result completeness, which
varies by language config. Any gap in the sort logic silently regresses to the current
behavior.

**Verdict:** Rejected. Option 1 is simpler, more correct, and has no fragile
dependency on parse result structure.

---

### Option 3: INSERT OR IGNORE on edges + post-pass cleanup

**Mechanism:** Change `insertEdge` to `INSERT OR IGNORE` (skip the row if FK fails).
After all definition chunks complete, run a cleanup pass that attempts to re-insert
edges that were skipped due to missing nodes.

**Spectrum position: Non-standard, fragile.** Silently dropping constraint violations
and sweeping afterward is an anti-pattern in referential-integrity systems.

**Pros:** Minimal change to insertion logic.

**Cons:**
- `INSERT OR IGNORE` on an FK violation means the edge is silently dropped — no error,
  no retry signal. The cleanup pass has no way to know which edges were skipped unless
  they are buffered separately.
- Would require maintaining a separate buffer of "edges that might have been skipped"
  — effectively reimplementing the two-pass approach but with more moving parts.
- If the cleanup pass fails or is skipped, data loss is silent.
- The schema has `UNIQUE(source_id, target_id, type)` on edges. `INSERT OR IGNORE` on
  a UNIQUE conflict would also silently discard duplicate edges — which is different
  behavior from `INSERT OR REPLACE` on duplicates. This changes the deduplication
  semantics.

**Verdict:** Rejected. The diagnostic correctly dismissed this. Two-pass (Option 1) is
simpler and fully correct without the silent-loss risk.

---

### Option 4: `PRAGMA defer_foreign_keys = ON` per transaction

**Mechanism:** Before each `db.transaction()` call in `definitionPass`, set
`PRAGMA defer_foreign_keys = ON`. SQLite then defers all FK checks until the outermost
COMMIT. Within a single chunk transaction, nodes and edges are inserted without FK
enforcement; on COMMIT, SQLite verifies all FKs against the then-committed state.

**Spectrum position: Emerging, but with a critical constraint.**

**Critical finding from research:** `defer_foreign_keys` has a key restriction: it
must be SET BEFORE the transaction starts — not inside the transaction callback. In
better-sqlite3, `db.transaction(fn)()` calls `BEGIN` immediately before invoking `fn`.
Setting `db.pragma('defer_foreign_keys = ON')` INSIDE the transaction callback
(after `BEGIN`) is "inside a transaction" in SQLite's terms and the pragma is either
silently ignored or ineffective, depending on SQLite's internal state machine.
([SQLite PRAGMA docs](https://www.sqlite.org/pragma.html))

Additionally, `defer_foreign_keys` auto-resets at COMMIT/ROLLBACK. So it must be
re-set before each of the N chunk transactions in `definitionPass`. This is achievable,
but requires wrapping each chunk transaction outside better-sqlite3's `db.transaction()`
helper — using manual `db.prepare('BEGIN').run()` / `db.pragma('defer_foreign_keys=ON')`
/ `db.prepare('COMMIT').run()` sequences — because there is no pre-transaction hook in
better-sqlite3's transaction API.

**DOES NOT SOLVE the cross-chunk problem.** Even with deferred FK enforcement, a
DEFINES_METHOD edge in chunk M will be committed at the end of chunk M's transaction,
but the Class node it references may only be inserted in chunk N's transaction (later).
Deferral delays FK enforcement to COMMIT of the current transaction — not to the end
of ALL transactions. Since each chunk is a separate transaction, deferral within chunk
M only defers to chunk M's COMMIT. The Class node from chunk N still doesn't exist
yet. **This option does not fix the problem.**

**Integration cost:** Medium, and ultimately futile for this problem.

**Risk:** High — creates false confidence that the fix is complete when the cross-chunk
ordering problem remains.

**Verdict:** Rejected. `defer_foreign_keys` is useful for migration-style operations
where ALL inserts happen in a SINGLE transaction. It does not solve multi-transaction
cross-chunk FK ordering.

---

### Option 5: Wrap the entire definition pass in a single outer transaction

**Mechanism:** Add an outer `db.transaction()` wrapper around all chunks in
`definitionPass`, so all 1200 files' nodes AND edges are committed atomically.

**Spectrum position: Anti-pattern at this data volume.** Single large transactions in
SQLite are standard for batch imports; but they conflict with the explicit design goal
of `runChunkedPass` — yielding the event loop between chunks via `setImmediate` to
avoid starving IPC messages.

**Pros:** Simplest change (wrap the loop in one `db.transaction()`). All nodes committed
before any edge's FK is checked.

**Cons:**
- Defeats chunking. The entire `definitionPass` becomes one transaction — potentially
  seconds of SQLite write-lock held while processing 1200+ files. IPC messages are
  starved during this time.
- `runChunkedPass` explicitly docs "no outer transaction — chunked passes manage their
  own per-chunk transactions internally." An outer transaction directly contradicts
  this design.
- Memory overhead: entire node + edge accumulator for all 1200 files lives in memory
  before any COMMIT. At 500 files/chunk × 3 chunks, this is ~3× the current peak
  memory per-chunk.
- The event-loop yielding after each chunk via `setImmediate` in `runChunkedPass`
  provides the IPC non-starvation guarantee. An outer transaction eliminates this.

**Verdict:** Rejected. Contradicts the fundamental purpose of chunked processing.

---

### Option 6: `callResolutionPass` safety net only (diagnostic Fix B) — ADOPTED AS COMPLEMENT

**Mechanism:** In `callResolutionPass`, before inserting each batch of CALLS edges,
filter out edges where `source_id` (callerQn) does not exist in the DB. Since
`buildSymbolsByName` already reads only successfully-inserted nodes, any callerQn that
was dropped by a failed definition chunk will not appear in `symbolsByName` — meaning
`resolveCallEdges` would not produce an edge with that callerQn as `source_id` in the
first place. The actual risk is more subtle: `callerQn` is built from `enclosingDef`
which is from `file.parsed.definitions` (the in-memory parse result), not from
`symbolsByName`. So a caller function whose definition chunk failed would NOT be in
`symbolsByName` and would NOT produce a valid `calleeQn` via `resolveCallee`, but
`callerQn = ${fileQn}.${enclosingDef.name}` is still constructed from the parse result.

**Fix B adds a pre-insert filter:** verify `db.getNode(callerQn) !== null` before
including the edge. This is O(N calls) extra reads at the cost of N SQLite point-reads.
For a 1200-file project with ~5000 call sites, this is ~5000 point-reads —
approximately 5–10ms at typical SQLite read speeds. Acceptable.

**Role in the combined fix:** With Option 1 in place, `callResolutionPass` FK
violations should not occur (definition chunks no longer fail, so all callerQn nodes
exist). Fix B is a **defense-in-depth safety net** for any future scenario where a
definition chunk fails for a non-FK reason (parse error, disk error, etc.). It prevents
cascading FK failures from propagating to the calls pass.

**Integration cost:** Low. ~8–10 lines in `callResolutionPass`.

**Risk:** Negligible. The filter is purely additive — it only removes edges that would
have failed anyway.

**Verdict:** ADOPTED as complementary to Option 1.

---

### Option 7: Catalog-hash invalidation on partial index (diagnostic Fix C) — ADOPTED AS COMPLEMENT

**Mechanism:** Track whether any pass threw during a cold index run. If YES, call
`db.setGraphMetadata(...)` to blank the catalog hash instead of `db.writeCatalogHash()`.
The next `verifyCatalogHash` call returns false, triggering a clean full rebuild.

**Note on `setGraphMetadata`:** The diagnostic mentions this method name but it is not
visible in the graphDatabase.ts public surface as read. The actual implementation
uses `db.writeCatalogHash(projectName)` (confirmed at `mainStartupGraph.ts:87`).
The inverse — invalidating the hash — would be accomplished by writing an empty string
or sentinel value. The implementer must locate or create the invalidation method. One
clean approach: add a `db.invalidateCatalogHash(projectName)` method that sets the
stored hash to `''`, causing `verifyCatalogHash` to return false. Alternatively,
write a known-wrong value.

**Role in the combined fix:** This is orthogonal to Option 1. Even after Option 1 fixes
the FK violation, a disk error or parse failure could still cause a partial index.
Fix C ensures partial indexes trigger a clean rebuild rather than being accepted
as complete.

**Integration cost:** Low. ~15–20 lines across `indexingPipeline.ts` (pass-error
counter) and `mainStartupGraph.ts` (conditional hash write vs. invalidate).

**Risk:** Low. The one risk is over-triggering: if `verifyCatalogHash` is called
frequently and the hash is blank, it could trigger extra rebuilds. But this only fires
on a genuinely failed pass — not on every startup.

**Verdict:** ADOPTED as complementary to Option 1.

---

## Pick

**Core fix: Option 1** (two-pass insertion within `definitionPass`)
**Adopted complements: Option 6** (callResolutionPass source-id guard) + **Option 7**
(catalog-hash invalidation on partial index)

**Confidence: High.** The root cause is confirmed by code inspection. Option 1
addresses it at its structural source with no architectural risk. Options 6 and 7 are
defense-in-depth additions that close two known downstream failure modes. None of the
rejected options (2, 3, 4, 5) address the cross-chunk ordering problem correctly.

**Spectrum position for the combined fix:**
- Option 1 (two-phase node-before-edge loading): **Industry standard** for bulk graph
  import under referential integrity enforcement.
- Option 6 (pre-insert existence check): **Industry standard** defensive programming
  at a write boundary.
- Option 7 (hash invalidation on partial success): **Industry standard** for
  cache/catalog integrity — "don't commit a hash for a partial result" is a universal
  principle in content-addressable stores.

---

## Integration Shape

### Files to touch

| File | Change |
|------|--------|
| `src/main/codebaseGraph/indexingPipelinePasses.ts` | Core fix (Option 1): split `processDefinitionChunk` into `processDefinitionChunkNodes` + `processDefinitionChunkEdges`; update `definitionPass` to run two loops. |
| `src/main/codebaseGraph/indexingPipelineCallResolution.ts` | Safety net (Option 6): add `existsInDb` pre-filter in `callResolutionPass` before edge insert. |
| `src/main/codebaseGraph/indexingPipeline.ts` | Partial-index tracking (Option 7): add `passErrorCount` counter; pass to `runCorePasses`; propagate to `runIndex`. |
| `src/main/codebaseGraph/graphDatabase.ts` (or `graphDatabaseSession.ts`) | Option 7 support: add `invalidateCatalogHash(projectName)` method. |
| `src/main/mainStartupGraph.ts` | Option 7 wire-up: call `db.invalidateCatalogHash` instead of `db.writeCatalogHash` when `passErrorCount > 0`. |

### No new files required.

### Option 1 — Detailed integration shape for `indexingPipelinePasses.ts`

The current `processDefinitionChunk` accumulates both nodes and edges, then flushes
both. The two-phase refactor splits the accumulation and flush points:

```
Current:
  processDefinitionChunk(db, projectName, files):
    acc = { nodes: [], edges: [] }
    for file of files: collectDefinitions + addRouteNodes → acc
    db.insertNodes(acc.nodes)
    db.insertEdges(acc.edges)  ← FK violation here

New:
  collectChunkAccumulator(projectName, files): → NodeAccumulator
    // Pure: accumulate nodes + edges from parse results
    // No DB access

  definitionPass(db, projectName, indexedFiles, options):
    // Phase 1: all chunks → nodes only
    for chunk of chunks:
      db.transaction(() => {
        acc = collectChunkAccumulator(projectName, chunk)
        for file of chunk: updateFileProps(db, ...)  ← still needs DB read
        db.insertNodes(acc.nodes)
      })
    // Phase 2: all chunks → edges only
    for chunk of chunks:
      db.transaction(() => {
        acc = collectChunkAccumulator(projectName, chunk)
        db.insertEdges(acc.edges)
      })
```

**Optimization note:** `collectDefinitions` and `addRouteNodes` are called twice (once
per phase). For large projects this doubles parse-result iteration (in-memory, not
DB). The implementer may prefer to collect all accumulators in one pre-pass and
cache them in a `Map<chunkIndex, NodeAccumulator>`. This avoids re-iterating parse
results. At 500 files per chunk × O(definitions per file) the re-iteration cost is
negligible (~1ms), so either approach is acceptable.

**`updateFileProps`** calls `db.getNode(fileQn)` and `db.updateNodeProps()` — these
must remain in Phase 1 (node phase) since they update an existing node's props.

**ESLint constraint check:** `indexingPipelinePasses.ts` is currently 277 lines (last
read). Adding ~30–40 lines for the two-phase split will approach the 300-line limit.
The implementer must check: if the file exceeds 300 lines, extract
`collectChunkAccumulator` into a helper or a new `indexingPipelinePassesSupport.ts`
module. The ESLint `max-lines` limit (300, skip blanks/comments) is enforced.

### Option 6 — Detailed integration shape for `indexingPipelineCallResolution.ts`

Add a pre-insert filter in `callResolutionPass` before `db.insertEdges`:

```
Before inserting resolveChunkEdges result:
  validEdges = edges.filter(e => db.getNode(e.source_id) !== null)
  db.insertEdges(validEdges)
```

The filter is per-chunk inside the existing `db.transaction()` loop. The `db.getNode`
call uses the already-prepared `getNode` statement — point-read, O(1) per call.

**Alternative (marginally more efficient):** build a Set of valid node IDs from
`buildSymbolsByName`'s result and filter against that Set instead of hitting the DB
per-edge. This is O(1) per filter check and avoids DB round-trips. The Set would be
`new Set([...symbolsByName.values()].flat())`. This is cleaner and faster.

The implementer should use the Set-based filter (uses existing `symbolsByName` data
already in scope at the call site).

### Option 7 — Detailed integration shape

`indexingPipeline.ts` `runCorePasses` currently has no error tracking across passes.
Add a simple counter:

```
// In runCorePasses (or as a return value from it):
let passErrors = 0;
// Wrap runChunkedPass to detect if it caught an error:
//   → Add optional `onError` callback to runChunkedPass, or
//   → Return a boolean indicating whether the pass threw
// Propagate passErrors count upward to runIndex.
// In mainStartupGraph.ts runInitialIndex:
//   if (result.passErrors > 0) db.invalidateCatalogHash(projectName)
//   else db.writeCatalogHash(projectName)
```

`IndexingResult` type (`indexingPipelineTypes.ts`) should gain an optional
`passErrors?: number` field. `buildIndexResult` in `indexingPipelineResult.ts` sets it.

`invalidateCatalogHash(projectName)` in `graphDatabase.ts` (or `graphDatabaseSession.ts`
if that's where `writeCatalogHash` lives): look up `writeCatalogHash` implementation
to find the key format, then write an empty string or sentinel to the same key.

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| `indexingPipelinePasses.ts` hits 300-line ESLint limit after Phase 1+2 split | Low | Medium | Extract `collectChunkAccumulator` to a helper or to `indexingPipelineSupport.ts` if needed. Check line count before submitting. |
| Phase 2 edge inserts for HANDLES edges still fail if handler symbol wasn't inserted (e.g., parse error dropped the handler file) | Low | Low | Option 6's Set-filter on edges would catch this if it's extended to include target_id check too. Explicitly verify both source_id AND target_id in Option 6's filter. |
| Double-accumulation of NodeAccumulators (Phase 1 + Phase 2 both call collectChunkAccumulator) | Low | Certain | Acceptable; pure in-memory re-iteration, ~1ms per 500 files. Or cache accumulators if measurable in profiling. |
| `invalidateCatalogHash` method doesn't exist; implementer creates it with wrong key | Medium | Medium | Grep for `writeCatalogHash` implementation first; use the exact same key format with value `''`. |
| Worker DB path after Option 7 — both main and worker connections share the same SQLite file; if worker writes catalog hash after invalidation, it could overwrite blank with a partial-success hash | Low | Low | `writeCatalogHash` / `invalidateCatalogHash` is only called from `mainStartupGraph.ts` (main thread) after `workerClient.runIndex()` resolves. The worker never calls `writeCatalogHash`. Safe. |
| Re-iteration correctness: Phase 2 must iterate chunks in the same order as Phase 1 so edge foreign keys match committed nodes | Low | Certain (by implementation) | Use the same `chunks` variable for both loops — do not re-chunk. `chunkArray(indexedFiles, size)` must be called once and stored. |

### Rollback shape

If the fix produces unexpected behavior, rollback is a git revert of the 5-file
change. The schema is unchanged, no migrations are added. Database state after a
failed run is no worse than current (partial edges dropped), and after a successful
rollback the next run returns to the pre-fix behavior (partial edges dropped silently).

---

## Test Plan

### Primary reproducer (diagnostic's suggested approach — REFINED)

Create a `fixtureFkOrdering` test directory with exactly 4 files:
- `classA.ts` — defines `class Foo {}`
- `methodA.ts` — defines a function `bar()` with `receiver: 'Foo'` (so it emits a
  DEFINES_METHOD edge with `source_id = <fileQn_of_methodA>.Foo` — wait, this is
  wrong)

**CORRECTION to diagnostic's reproducer:** `classQn = ${fileQn}.${def.receiver}` uses
the METHOD file's `fileQn`, not a separate class file. So the FK violation fires when:
- File A defines class `Foo` (A is in chunk 1)
- File A also has a parse result for a Method `bar` with `receiver = 'Foo'`
- At `chunkSize = 2`, file A is in chunk 1 together with file B
- The DEFINES_METHOD edge source_id = `<fileQn_of_A>.Foo` — the Class node —
  IS inserted in the same chunk as the Method, so no violation

Wait — re-reading `collectDefinitions`: for each `def` in `file.parsed.definitions`,
if `def.kind === 'Method' && def.receiver`, the DEFINES_METHOD edge has
`source_id = ${fileQn}.${def.receiver}` (the Class, built from the SAME file's `fileQn`)
and `target_id = symbolQn` (the Method, also in the same file). Both nodes are in the
same chunk. The FK violation would only fire if a Method refers to a Class in a
DIFFERENT file — which requires `def.receiver` to resolve to a class defined elsewhere.

**The FK violation fires in practice** because the TreeSitter parser generates Method
definitions with a `receiver` field. If the Class definition and Method definitions are
in DIFFERENT source files (e.g., a TypeScript `class Foo` in `foo.ts` and a method
added via prototype extension in `fooMethods.ts`), the chunks would diverge. But
within the same file, they're in the same chunk.

**More likely real-world trigger:** The 1200-file Gamify project is hitting this because
a large file with many definitions is in one chunk, and another file that references
those definitions as receivers is in a different chunk. The tree-sitter parser's
`receiver` detection picks up the class name for method definitions — if the test
fixture places a class definition in chunk 1 and a function with `receiver = thatClass`
in chunk 2 (a DIFFERENT file), the FK fires.

**Revised test fixture:**
```
fixtures/fk-ordering/
  file-a.ts: export class Foo { }
  file-b.ts: (will be parsed with a synthetic receiver that references Foo)
  file-c.ts: export function baz() { }
  file-d.ts: export function qux() { }
```

Since tree-sitter real parsing controls what `receiver` is set to, the most reliable
reproducer is to mock `IndexedFile.parsed` directly in the test (bypassing tree-sitter)
to inject a controlled `definitions` array where file-b has a Method with
`receiver = 'Foo'` pointing at file-a's class. This is already how the codebase-graph
test suite works (mocked parse results).

**Test assertions (without fix — should FAIL):**
1. Run `definitionPass(db, 'test', [fileA, fileB, fileC, fileD], { chunkSize: 2 })`
   where fileA has `{ kind: 'Class', name: 'Foo', ... }` and fileB has
   `{ kind: 'Method', name: 'bar', receiver: 'Foo', ... }` (with fileB's fileQn != fileA's fileQn).
   Wait — `receiver: 'Foo'` produces `source_id = ${fileBQn}.Foo` which is NOT the Class
   node (which would be `${fileAQn}.Foo`). The FK violation requires the Class to be
   defined in a different file.

**FUNDAMENTAL INSIGHT:** For the FK violation to fire with the current code,
`def.receiver` must produce a `classQn` that is NOT the same file as the Method. But
`classQn = ${fileQn}.${def.receiver}` ALWAYS uses the SAME file's `fileQn`. So the
DEFINES_METHOD edge always references a Class node that should be in the SAME chunk.

This means DEFINES_METHOD FK violations would only fire if the Class node insertion
in Phase 1 of the same chunk failed — i.e., if `db.insertNodes` for the Class's chunk
ITSELF threw before the Class was committed, and then the edge was attempted.

**REVISED ROOT CAUSE READING:** The FK violation fires because within a single chunk's
`db.transaction()`, `db.insertNodes(acc.nodes)` and `db.insertEdges(acc.edges)` are
BOTH called — but `insertNodes` itself may fail (e.g., if the FTS5 trigger or another
constraint fires), leaving some nodes uncommitted, and then `insertEdges` references
those uncommitted nodes.

OR: more likely, the FK violation fires on HANDLES edges where
`target_id = ${fileQn}.${route.handlerName}` — the handler symbol — is defined in a
DIFFERENT file (and therefore a different chunk). Route nodes are in file A, but
the handler function `handlerName` is defined in file B which is in a different chunk.
This is a genuine cross-FILE, cross-CHUNK reference.

**The HANDLES edge is the primary FK violation trigger.** DEFINES_METHOD is secondary
(only for cross-file class/method relationships).

**Revised test fixture (concrete and correct):**
```
file-a.ts:  // Route file
  // parsed.routes = [{ method: 'GET', path: '/users', handlerName: 'getUsers' }]
  // No function definitions

file-b.ts:  // Handler file
  // parsed.definitions = [{ kind: 'Function', name: 'getUsers', ... }]

file-c.ts:  // Filler
file-d.ts:  // Filler
```

With `chunkSize = 2`: chunk 1 = [file-a, file-b], chunk 2 = [file-c, file-d].
Both route and handler are in the SAME chunk → no FK violation.

With `chunkSize = 1`: chunk 1 = [file-a], chunk 2 = [file-b], ...
file-a's chunk tries to insert HANDLES edge with `target_id = fileB.getUsers` — but
file-b is in a LATER chunk whose nodes haven't been inserted yet. FK violation fires.

**The fix must be tested at `chunkSize = 1` to reliably reproduce the HANDLES violation.**

### Test cases to implement

1. **Regression: HANDLES FK violation (chunkSize=1)**
   - 4 files: route file (A) + handler file (B) + 2 fillers
   - chunkSize = 1
   - WITHOUT fix: `HANDLES` edge missing from DB (transaction rolled back)
   - WITH fix: `HANDLES` edge present for all routes

2. **Regression: DEFINES_METHOD cross-file FK violation (if applicable)**
   - 4 files: class definition (A) — requires parser to set `receiver` to a class in
     a DIFFERENT file. This may require test-only parse result injection.
   - Verify the edge is present after fix.

3. **Catalog hash invalidation (Option 7)**
   - Mock `runCorePasses` to simulate a pass throw
   - Verify `db.verifyCatalogHash(projectName)` returns false after the failed run
   - Verify the next `resolveIndexReason` call returns `'hash-mismatch'`

4. **callResolutionPass source-id guard (Option 6)**
   - Drop a callerQn node from the DB manually (simulating a failed definition chunk)
   - Run `callResolutionPass`
   - Verify no FK exception is thrown and no CALLS edge referencing the missing node
     is inserted

5. **Regression guard: no behavior change on small projects (no chunking)**
   - 3-file project below chunk threshold: verify identical node + edge counts before
     and after fix

### Test scope

Run `npm run test:codebasegraph` after the fix. This covers the indexing pipeline
subsystem. Full `test:main` if the `graphDatabase.ts` or `mainStartupGraph.ts` changes
need validation.

### Verification without running the full indexer

After the fix ships, Cole can verify in the dev startup trace by checking:
- Absence of `[pipeline] pass=definitions threw, isolating: FOREIGN KEY constraint failed`
- Absence of `[pipeline] pass=calls threw, isolating: FOREIGN KEY constraint failed`
- Edge count stability across cold-index runs: run `SELECT COUNT(*) FROM edges WHERE
  project = 'gamify'` in the SQLite DB after each of two cold indexes — counts should
  match.

---

## Out-of-Scope / Deferred

### Section 9 item 7 — `triggerContextLayerRebuildAfterGraphReady` (forceRebuild origin)

**CLOSED.** Code inspection at `mainStartupGraph.ts:100` confirms this fires
`triggerContextLayerRebuildAfterGraphReady()` — a context LAYER rebuild (CLAUDE.md
enrichment), NOT a graph reindex. The "run 3" in the three-runs analysis is likely
a second `ensureIndexed` from a second window (Gamify opened as a secondary root),
not from this trigger. No investigation or fix needed here.

### Incremental run protection

The FK fix applies to cold index runs (`isIncrementalRun = false`). Incremental runs
process only changed files and call `resolveFilesToProcess` which deletes stale nodes
and re-inserts. For small changesets (< 500 files), incremental runs use a single
`processDefinitionChunk` call (no chunking). Option 1's two-phase split is safe for
the non-chunked path too — the same functions are called, just with all files in one
accumulation step.

### Chunk size of 500 — not re-evaluated

The CHUNK = 500 constant is hardcoded in `runCorePasses`. This wave does not change
the chunk size. The fix should work correctly for any chunk size ≥ 1.

### Import pass FK safety

`importPass` emits only IMPORTS edges with `source_id = fileQn` (File nodes) and
`target_id = targetQn` (either another File node from `fileQnMap` or a Package node
created inline). File nodes are committed by `structurePass` before `importPass` runs.
Package nodes are created inline in `getOrCreatePackageNode` during the same chunk
transaction. No FK violation risk in `importPass`. No fix needed.

### Three-runs-in-a-row (runs 2 and 3)

Fix C (Option 7) addresses run 2 (catalog hash drift from partial index). Run 3 is
addressed by the closed Section 9 item 7 finding above (not a third graph reindex).
If run 2 still occurs after Option 7 is in place, investigate `launchDiff`
`writeCatalogHash` interaction separately — out of scope for this fix.

---

## Sources

- [SQLite PRAGMA defer_foreign_keys documentation](https://www.sqlite.org/pragma.html) — confirms per-transaction reset and the requirement to set before BEGIN
- [SQLite Foreign Keys documentation — ordering and deferred constraints](https://sqlite.org/foreignkeys.html) — confirms two-phase (vertex-before-edge) as the industry-standard approach for batch loading
- Wave 18 architect plan (`wave-18-architect-w3-indexer-offload.md`) — reference structure and confirmed WAL mode + worker DB isolation facts
- Codebase inspection: `graphDatabase.ts:70`, `graphDatabaseSchema.ts:35–61`, `indexingPipeline.ts:59–127`, `indexingPipelinePasses.ts:115–224`, `indexingPipelineCallResolution.ts:198–216`, `graphDatabaseHelpers.ts:44–51`, `mainStartupGraph.ts:100`
- better-sqlite3 v12.8.0 (`package.json:130`): standard SQLite PRAGMA API, no better-sqlite3-specific FK pragma behavior documented; general SQLite docs apply
