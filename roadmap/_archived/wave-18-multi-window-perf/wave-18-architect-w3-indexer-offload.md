---
status: COMPLETE
created: 2026-05-25
wave: 18
phase: 4a
finding: W3
agent: sonnet-architect (output captured by orchestrator; agent has no Write tool)
---

# Wave 18 W3 — Cold-Start Indexer Offload — Architect Plan

## TL;DR

**The 1B diagnostic citation was partially wrong.** `indexingPipeline.ts:60-70` (`runPass()` / `db.transaction()`) only executes inside `indexingWorker.ts` in the current code — all paths to `runPass()` go through the worker. The **actual main-thread blocking is `autoSync.ts:361` — `this.opts.db.getAllFileHashes(this.opts.projectName)`** — a synchronous `better-sqlite3` read of all file hash rows executed on the main thread inside `initWithLaunchDiff()`.

**Recommendation: Option A1** — add a `launchDiff` message type to the existing worker protocol. Worker performs `getAllFileHashes` + concurrent `fs.stat` loop + conditional incremental index; returns single `LaunchDiffResultMessage`. `AutoSyncWatcher.initWithLaunchDiff()` becomes a single call to `getIndexingWorkerClient().runLaunchDiff()`. ~60 LOC across 4 files. High-confidence, low-risk, mirrors Wave 17's worker-offload pattern.

## Constraints verified

- **`runPass()` already off-main.** Confirmed: `indexingPipeline.ts:60-70` only executes inside `indexingWorker.ts`. The diagnostic memo's citation was the wrong line; the actual stall is `autoSync.ts:361`.
- **Downstream reindex already off-main.** `initWithLaunchDiff()` → `triggerReindex()` → `getIndexingWorkerClient().runIndex()` is correctly routed through the worker.
- **`better-sqlite3` is synchronous by design.** No async API. Moving off main requires moving to a different thread (= the existing worker).
- **WAL mode enabled** (`graphDatabase.ts:68`). Multiple concurrent readers safe.
- **Worker has independent `GraphDatabase` connection.** Opened with `dbPath` via `workerData` (see `indexingWorker.ts:47`). Reads `file_hashes` concurrently with main-thread connection is safe under WAL.
- **`IndexingWorkerClient` serializes via queue + mutex.** Cold-start `launchDiff` + incremental reindex requests serialize correctly through single-worker model.
- **Worker import graph constraint.** `indexingWorker.ts` must not import from `electron` or transitively require it. `fs` and `path` are fine.
- **ESLint limits:** `indexingWorker.ts` 131 lines / 300 cap; `indexingWorkerClient.ts` 234 lines / 300 cap. Both have headroom.
- **`IndexingOptions` serializable shape:** `Omit<IndexingOptions, 'onProgress'>` = `IndexRequestOptions` is the worker-boundary shape. A new `LaunchDiffRequest` needs only `projectRoot`, `projectName` — strict subset.

## Options considered

### Option A1 — Add `launchDiff` worker message (RECOMMENDED)

Worker handles new `LaunchDiffRequest`: (1) opens `getAllFileHashes(projectName)` from its own connection, (2) runs concurrent `fs.stat` loop via `mapWithConcurrency`, (3) if stale files found, calls `pipeline.index({ incremental: true, changedPaths: stale })` and returns both diff + index result. Main thread's `IndexingWorkerClient` gets new `runLaunchDiff(opts)` method mirroring `runIndex`.

- **Pros:** Main thread never touches `getAllFileHashes`. Single message round-trip does diff + conditional reindex. No architectural change to worker singleton. Consistent with Wave 17 pattern.
- **Cons:** Extends worker protocol with 2 new types. `autoSync.ts` loses direct `db` access for launch path.
- **Integration cost:** Low. 4 files, ~60 net new lines. `indexingWorkerTypes.ts` (+2 interfaces), `indexingWorker.ts` (+1 handler ~25 lines), `indexingWorkerClient.ts` (+1 method ~20 lines), `autoSync.ts` (~12 lines replaced).
- **Risk:** Low. Worker DB already reads same file via WAL. `mapWithConcurrency` pattern battle-tested. Queue serialization prevents conflicts.

### Option A2 — `setImmediate`-defer `initWithLaunchDiff`

Change `await watcher.initWithLaunchDiff()` at `systemTwoRegistry.ts:133` to `setImmediate(() => { void watcher.initWithLaunchDiff(); })`. Remove `await`, make `acquire()` synchronous.

- **Pros:** One-line change. No new message types. Startup IPC immediately unblocked.
- **Cons:** Blocking `getAllFileHashes` still runs on main, just later. 3 concurrent deferred calls (3 windows × 3 roots) still produce jank ~300ms after startup. **Defers rather than eliminates.**
- **Verdict:** Valid as interim fix; doesn't fully solve. Not recommended as primary.

### Option B — Break `db.transaction()` into yielding chunks

- **Verdict:** REFUTED. The actual blocker is a read (`getAllFileHashes`), not a transaction. No chunking API in better-sqlite3 for reads — entire result set materializes synchronously. Doesn't apply.

### Option C — Dedicated cold-start worker

- **Verdict:** UNNECESSARY COMPLEXITY. Two workers writing same DB = WAL write-lock contention. Single-worker queue already serializes correctly.

### Option D — Coalesce with W4 subprocess registry

- **Verdict:** Correct direction, wrong wave phase. Ship A1 first; W4 queue serialization is natural follow-up.

## Recommendation

**Option A1.** Industry-standard pattern for offloading synchronous blocking work to a worker thread. Project already uses this pattern for incremental reindex (Wave 17 commit `b449df2d`). Applying same pattern to launch-diff path.

**Spectrum position: Industry standard.** Node.js `worker_threads` is the established pattern for event-loop protection when a C++ binding is synchronous-by-design.

## Integration shape

### New files

None.

### Modified files

| File | Changes |
|---|---|
| `src/main/codebaseGraph/indexingWorkerTypes.ts` | Add `LaunchDiffRequest` (→ worker), `LaunchDiffResultMessage` (← worker). Add to union types `IndexingWorkerRequest` and `IndexingWorkerResponse`. Define `LaunchDiffResult`. |
| `src/main/codebaseGraph/indexingWorker.ts` | Add `handleLaunchDiff(req)`: opens `getAllFileHashes(projectName)`, runs concurrent `fs.stat` loop, conditionally calls `pl.index({ incremental: true, changedPaths })`, posts `LaunchDiffResultMessage`. Add `case 'launchDiff'` to `handleMessage`. |
| `src/main/codebaseGraph/indexingWorkerClient.ts` | Add `runLaunchDiff(opts): Promise<LaunchDiffResult>`. Same queue-dispatch pattern as `runIndex`. |
| `src/main/codebaseGraph/autoSync.ts` | `initWithLaunchDiff()`: replace `await this.onLaunchDiff()` + `triggerReindex()` with single `await getIndexingWorkerClient().runLaunchDiff({ projectRoot, projectName })`. |

### Migration order (walking-skeleton-first)

1. **Worker types first** (`indexingWorkerTypes.ts`): add `LaunchDiffRequest` + `LaunchDiffResultMessage`. Pure type additions, no behavior change.
2. **Worker handler** (`indexingWorker.ts`): add `handleLaunchDiff`. Independently testable.
3. **Client method** (`indexingWorkerClient.ts`): add `runLaunchDiff()`. End-to-end round-trip works.
4. **AutoSync wire-up** (`autoSync.ts`): replace `initWithLaunchDiff` body. Behavioral change lands here.

Each step independently testable. Steps 1-3 = no observable behavior change.

### Observability — trace lines to add

- `indexingWorker.ts handleLaunchDiff`:
  - `log.info('[trace:worker.launchDiff] start projectName=%s', projectName)` (entry)
  - `log.info('[trace:worker.launchDiff] hashes=%d changed=%d deleted=%d elapsed=%dms', ...)` (after stat loop)
  - `log.info('[trace:worker.launchDiff] reindex triggered changedPaths=%d', ...)` (before `pl.index`)
- `autoSync.ts initWithLaunchDiff`:
  - `log.info('[trace:autoSync.initWithLaunchDiff] dispatching to worker root=%s', ...)` (entry)
  - `log.info('[trace:autoSync.initWithLaunchDiff] done elapsed=%dms stale=%d', ...)` (return)

Verification: `[jank]` lines should disappear from startup after the fix.

## Risks for the implementer

1. **Worker `fs` module access.** Worker is Node.js thread; full `fs` access. Existing worker uses `path` stdlib; same pattern.
2. **Concurrent launchDiff + initialIndex serialization.** `IndexingWorkerClient` serializes ALL jobs one at a time. `runLaunchDiff` dispatched first during `acquire()`; `runInitialIndex` queues behind. For first-launch roots (0 hashes), launchDiff returns immediately; initialIndex handles full index. For warm roots, launchDiff handles incremental catch-up; initialIndex detects valid catalog hash and no-ops. Verify the `resolveIndexReason` guard in `makeEnsureIndexedCallback` still fires initial index correctly for `first-launch` after diff no-ops.
3. **`mapWithConcurrency` is not exported.** Defined in `autoSync.ts` (main-process file). Worker can't import — circular. **Extract to `src/main/codebaseGraph/concurrency.ts` (already exists as home for async helpers)** OR copy the ~20-line helper into `indexingWorker.ts`.
4. **ESLint `max-lines`.** `indexingWorker.ts` 131 → ~156 (new handler ~25 lines). Safe (cap 300).
5. **No `electron` imports in worker.** Must use only `fs`, `path`, existing `GraphDatabase`, `IndexingPipeline`. `getIndexingWorkerClient` is NOT imported in worker (would be circular).
6. **`LaunchDiffResult` type export.** Define in `indexingWorkerTypes.ts` (protocol boundary file) so both `indexingWorkerClient.ts` and `autoSync.ts` import without circular deps.
7. **Test coverage.** `indexingWorker.ts` and `indexingWorkerClient.ts` have existing tests. Add test for `handleLaunchDiff` in worker test file: post `launchDiff` message to real worker pointed at temp directory; assert `LaunchDiffResultMessage` returned. Acceptance test for the behavioral change.

## Sources

- Wave 17 commit `b449df2d`: incremental reindex routed through worker (`autoSync.ts:311`)
- `autoSync.ts:361`: confirmed synchronous `better-sqlite3` call on main thread (the actual stall)
- `indexingWorker.ts:47`: worker opens independent DB connection
- `graphDatabase.ts:68`: WAL mode confirmed
- `indexingWorkerClient.ts:60,169`: single-job queue + mutex
- `mainStartupGraph.ts:80`: initial index already on worker
- Node.js `worker_threads` docs: synchronous C++ bindings should move to worker thread
- Wave 18 1F research: VS Code shared-process pattern; sync I/O off main is industry standard

## Open question(s) for the user

None. Fix is architecturally unambiguous given the confirmed code state.

## Critical correction to the W3 problem statement

The 1B diagnostic memo's claim about `IndexingPipeline.runPass()` is **partially correct** (the SQLite txn is sync) but **misnames the actual stall location**. The current code's main-thread stall is the `getAllFileHashes` READ in `autoSync.ts:361`, not the WRITE transactions in `runPass()`. The write transactions are correctly already in the worker. The fix targets the read path.

This correction is load-bearing for the implementer: don't refactor `runPass()`; just route `initWithLaunchDiff()` through the worker.
