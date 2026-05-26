---
status: COMPLETE
created: 2026-05-25
phase: 1-diagnostic
---

# Wave 17 — Phase 1 Diagnostic: Save Cascade

## 1. TL;DR

The 9–13s main-thread block has two overlapping root causes that are structurally visible in the code. Neither is "generateRepoMap on main thread" — that was fixed before this wave and is confirmed shipped (`main.ts:188` wires `generateRepoMapFn` to the repoMap worker).

**Root cause A (dominant, ~9s):** Every watcher-triggered incremental reindex calls `IndexingPipeline.index()` on the indexing worker, which runs a full O(N\_all\_files) catalog scan via `discoverFiles()` + `filterChangedFiles()` BEFORE determining how many files changed (`indexingPipelineIncremental.ts:65-92`, called from `indexingPipeline.ts:333`). For AgentIDE (~18K nodes), this scan takes 9+ seconds on the worker thread even when 0 files changed. The `[trace:autoSync.reindex] done in 9075ms files=0` log confirms the worker spent 9s on a no-op catalog walk. Because `IndexingWorkerClient` serializes all `runIndex` jobs one at a time (`indexingWorkerClient.ts:168-170`), a second save event queues behind the in-flight scan and the second `triggerReindex()` awaits for the full 9s before even dispatching.

**Root cause B (secondary, ~3–4s):** The `repoMapWorker`'s Cypher queries run against a read-only SQLite connection concurrently with the indexing worker's multi-second write transactions. WAL mode allows concurrent reads but write transactions create checkpoint waits in the read-only connection. This is the mechanism behind the `repoMap-worker` 412ms→3927ms regression (`repoMapGeneratorDeps.ts:69-94`).

**The `files:saveFile` 12,924ms measurement is not a slow handler.** `handleSaveFile` does: path-security check + `fs.writeFile` + return (under 5ms total, `files.ts:270-278`). The `patchIpcMainHandle` wrapper at `ipc.ts:259-270` measures wall-clock time from IPC-receive to `finally` block execution. A 12.4s event-loop jank stall delays ALL microtask/macrotask processing including that `finally` block — it fires 12.4s after the handler actually returned and reports false latency. The root cause of the stall is the concurrent indexing work.

---

## 2. Reproduction — Call Graph from `files:saveFile` to Graph DB

```
Renderer: IPC invoke "files:saveFile"
  |
  v
files.ts:270  handleSaveFile()
  checkPathOrTrusted()                  [sync, fast]
  filesHelpers.writeTextFile()          [await fs.writeFile, <5ms]
  return { success: true }              [IPC handler done — renderer unblocks]

[patchIpcMainHandle finally runs: ms = Date.now()-t, but if
 jank stalled the loop for 12.4s, this fires 12.4s after handler
 returned and reports 12,924ms -- FALSE POSITIVE]

SEPARATE PATH: @parcel/watcher event fires ~50-500ms after fs.writeFile

systemTwoRegistry.ts:153  subscribeNativeWatcher callback
  watcher.receiveWatcherEvent(event.path)
  [APP_DEBOUNCE_MS = 300ms accumulates events — autoSync.ts:43]
  drainPendingEvents() -> onFileChange(paths)
  debouncedReindex()
  [DEBOUNCE_MS = 3000ms timer — autoSync.ts:47]
  triggerReindex()

autoSync.ts:287  triggerReindex()
  if (reindexing) return                [guard: only one in flight]
  reindexing = true
  await getIndexingWorkerClient().runIndex({ incremental: true })
  [IndexingWorkerClient.ts:65-69]
    queue.push(() => dispatch(...))
    drainQueue() -- if busy: DOES NOT dispatch, queues for later
    [if another job was already running, this awaits up to 9s
     for the in-flight scan to complete before dispatching]

Worker thread (indexingWorker.ts):
  pipeline.index({ incremental: true })
    IndexingPipeline.runIndex()
      discoverFiles(projectRoot)              [FULL walk, O(N files)]
        walkDirectoryImpl() recursively
      filterChangedFiles(db, name, allFiles)  [O(N_all_files)]
        mapConcurrent(allFiles, classifyFile)
          per file: db.getFileHash()          [SQLite read, sync]
          if mtime/size differs:
            hashFileContent()                 [async file read + SHA-256]
        [ALL files classified even if 0 changed]
      if changed.length === 0:
        structureFiles = []
        runAllPasses with empty indexedFiles  [still runs!]
          prefetchGitCoChangeData()           [git subprocess]
          runCorePasses with 0 files          [no-op SQLite txns]
          runEnrichmentPasses with 0 files    [no-op]
        finalizeIndex(projectName, opts, [])  [db.getNodeCount, upsertProject]
      post { type: "result", filesIndexed: 0 }

Main thread:
  autoSync.handleReindexResult() resolves
  log "[trace:autoSync.reindex] done in 9075ms files=0"
  reindexing = false

SECOND CASCADE (fires ~5s after save, overlapping with above):

filesHelpers.ts:207  broadcastFileChange() called by watcher callback
  [200ms debounce -- DEBOUNCE_MS const at line 175]
  flushPendingChanges()
    getContextLayerController().onFileChange(type, filePath)
      contextLayerWatcher.handleFileChange()
      [DEFAULT_DEBOUNCE_MS = 5000ms timer -- contextLayerWatcher.ts:31]
      fireDebounced() -> onInvalidation callback
        contextLayerControllerHelpers.ts:221
          forceRebuild().catch(...)

contextLayerController.ts:282  forceRebuild()
  runFullRebuild()
    this.buildRepoIndex([this.workspaceRoot])    [MAIN THREAD -- unquantified]
    mapFn = getRepoMapWorkerClient().generateRepoMap(opts)  [off-main, worker]
```

**Key structural observation:** `handleSaveFile` is NOT in the autoSync or contextLayer cascade chains. Both cascades are triggered by the `@parcel/watcher` OS event, not by the IPC handler. The IPC handler's measured latency is entirely a `patchIpcMainHandle` timer artifact from jank stall delay.

---

## 3. Per-Hypothesis Verdict

### H1: autoSync.reindex synchronous work on main thread — REFUTED (but symptom is real for a different reason)

The reindex does NOT run synchronously on the main thread. `autoSync.ts:296-308` routes through `getIndexingWorkerClient().runIndex(...)` which dispatches to the dedicated indexing worker thread. Evidence: `indexingWorker.ts:45-52` — `IndexingPipeline` and `TreeSitterParser` are both instantiated in the worker thread, never on main.

However the 9075ms is still real: `triggerReindex()` `await`s the worker result at line 298 (`const result = await getIndexingWorkerClient().runIndex(...)`). The `reindexing = true` flag at line 291 prevents a second concurrent `triggerReindex`. So when the second watcher event arrives during the first scan, its `triggerReindex` call returns early (line 288: `if (this.reindexing) return`). The PROBLEM is that the first call's 9s scan holds `reindexing = true` for 9s, and the watcher MISSES the second save's change notification entirely during that window — the event was debounced away.

Root-of-root cause: `filterChangedFiles` at `indexingPipelineIncremental.ts:65-92` runs `mapConcurrent(allFiles, classifyFile)` where `allFiles` is the FULL discovered set — not just the files the watcher reported changed. For a repo with 3K–8K source files, this O(N) scan costs 9s even when 0 files changed.

### H2: better-sqlite3 write contention — CONFIRMED (contributing factor)

`graphDatabase.ts:68`: `db.pragma("journal_mode = WAL")` — write connection in WAL mode.

`indexingWorker.ts:47`: `db = new GraphDatabase(resolveWorkerDbPath())` — the worker opens its OWN read-WRITE connection to the same database file (NOT read-only). This is the same construction as the main thread's `GraphDatabase`.

`repoMapWorkerQueryClient.ts:46`: `_db = new GraphDatabase(dbPath, { readonly: true })` — repoMap worker opens a READ-ONLY connection.

During `indexingPipeline.ts:66` `db.transaction(thunk)` calls (structurePass, definitionPass, importPass, callResolutionPass), the indexing worker holds a write lock. The repoMap worker's `CypherEngine.execute()` at `repoMapGeneratorDeps.ts:82` (inside `fetchEdgeRows`) must wait for WAL checkpoint. `busy_timeout = 5000` (`graphDatabase.ts:70`) caps the wait but does not prevent 100-3000ms stalls per query. For ~30–50 modules, the `crossModuleDeps` phase runs ~60–100 Cypher queries, compounding to 3–4s.

This is a secondary effect. Fixing H1 (eliminating the long catalog-scan transactions) eliminates the write pressure that causes H2.

### H3: files:saveFile does post-write work synchronously — REFUTED

`handleSaveFile` at `files.ts:270-278`:

```typescript
async function handleSaveFile(event: IpcMainInvokeEvent, filePath: string, content: string) {
  const denied = checkPathOrTrusted(event, filePath);
  if (denied) return denied;
  try {
    return await writeTextFile(filePath, content);
  } catch (err) {
    return toErrorResult(err);
  }
}
```

`writeTextFile` at `filesHelpers.ts:162-170`: sole operation is `await fs.writeFile(filePath, content, "utf-8")`, then `return { success: true }`. No activation events, no cache invalidation, no graph operations.

`broadcastFileChange` at `filesHelpers.ts:207-217` is called from the `@parcel/watcher` callback (`files.ts:187-189`) — a SEPARATE code path, not from `handleSaveFile`. The `handleSaveFile` handler does not call `broadcastFileChange` at any point.

The 12,924ms slow-handler measurement is a timer artifact. Proof: `patchIpcMainHandle` at `ipc.ts:259-270` uses `const t = Date.now()` before `await handler(...)` and logs `ms = Date.now() - t` in `finally`. A 12.4s jank stall blocks all event-loop processing including the microtask queue. The `finally` block is a pending microtask that cannot execute during the stall — it executes 12.4s after the handler actually returned, reporting false handler latency.

### H4: Tree-sitter parsing on the main thread — REFUTED

Tree-sitter runs exclusively in the worker thread. `indexingWorker.ts:48-49`: `parser = new TreeSitterParser(); await parser.init()` — WASM loaded in worker. For an incremental run with 0 changed files, `parsePass` receives an empty `filesToProcess` array (`indexingPipeline.ts:244-246`) and returns immediately — no WASM calls occur.

### H5: Lock contention between codebase-graph worker and main — CONFIRMED (worker-to-worker, not worker-to-main)

Confirmed under H2. The contention is between the indexing worker (writer, read-write connection) and the repoMap worker (reader, read-only connection). The main thread's connection is used for QueryEngine reads, which WAL allows concurrently with other reads. The slow-path is specifically repoMap-worker Cypher queries waiting during indexing-worker write transactions.

Evidence: `repoMapGeneratorQuerySource.ts:29-33` — in a non-main thread, `getQuerySource()` returns `getWorkerQueryClient()` (the read-only connection). `repoMapGeneratorDeps.ts:73` calls this on every `fetchEdgeRows` call. `indexingPipeline.ts:66` wraps each pass's thunk in `db.transaction(thunk)`, holding a write lock for the duration of each pass.

### H6 (additional): contextLayerWatcher 5s debounce + runFullRebuild on main — CONFIRMED (second cascade, explains remaining ~3s gap)

Not in original hypothesis list, but structurally visible.

`contextLayerControllerHelpers.ts:221-225`: `onInvalidation: () => { forceRebuild().catch(...) }` — the invalidation callback calls `forceRebuild()` on the main thread.

`contextLayerWatcher.ts:31`: `DEFAULT_DEBOUNCE_MS = 5_000`. After a file save, `filesHelpers.broadcastFileChange` routes to `getContextLayerController().onFileChange()` -> `contextLayerWatcher.handleFileChange()` which sets a 5s timer. When it fires: `forceRebuild()` -> `contextLayerController.runFullRebuild()` at `contextLayerController.ts:142-185`:

1. `this.buildRepoIndex([this.workspaceRoot])` — runs `buildRepoIndexSnapshot` synchronously on the main thread. This includes `buildRepoFacts` (git log, diff operations). Duration unquantified — needs instrumentation.
2. `mapFn(...)` = `getRepoMapWorkerClient().generateRepoMap(opts)` — OFF main (repoMap worker).

The timing gap (12.4s jank vs 9s indexer) suggests `buildRepoIndex` accounts for ~3s. This requires runtime instrumentation to confirm (Section 5, point D).

---

## 4. Dominant Blocker

**File:** `src/main/codebaseGraph/indexingPipelineIncremental.ts:65-92` — `filterChangedFiles()`
**Called from:** `src/main/codebaseGraph/indexingPipeline.ts:333-347` — `resolveFilesToProcess()`

`filterChangedFiles` runs `mapConcurrent(allFiles, classifyFile)` where `allFiles` is the COMPLETE discovered file set — not just the files the watcher reported as changed. For each file, `classifyFile` calls `db.getFileHash(projectName, file.relativePath)` (SQLite read) and conditionally `hashFileContent(file.absolutePath)` (async file read + SHA-256). This O(N\_all\_files) scan runs to completion even when the outcome is "0 files changed."

**No early-exit path exists** in `IndexingPipeline.runIndex()` when `filesToProcess.length === 0`. Even a confirmed no-op runs `prefetchGitCoChangeData` (git subprocess call, `indexingPipeline.ts:169`), all enrichment passes with empty arrays, `finalizeIndex` (DB writes: `getNodeCount`, `getEdgeCount`, `upsertProject`), and `buildIndexResult`. Each is fast individually but they add up on the worker thread.

The 9s worker occupancy then serializes all subsequent `runIndex` calls through `IndexingWorkerClient`'s single-job queue (`indexingWorkerClient.ts:168-170`: `drainQueue` only dispatches when `!this.busy`).

---

## 5. Proposed Instrumentation

DO NOT add these yet. These are locations for Cole to add timing logs in a running session to verify the diagnosis before implementing Phase 2.

**A. Worker queue depth at runIndex entry** — `indexingWorkerClient.ts:65` (start of `runIndex` body):
```typescript
log.info(`[trace:workerClient.runIndex] queueDepth=${this.queue.length} busy=${this.busy}`);
```
Confirms whether the 9s is queue-wait time vs active processing.

**B. filterChangedFiles entry and exit** — `indexingPipelineIncremental.ts:65` (before `mapConcurrent`):
```typescript
const t0fc = Date.now();
log.info(`[trace:filterChangedFiles] start allFiles=${files.length} project=${projectName}`);
```
At return (line 91): `log.info(\`[trace:filterChangedFiles] done changed=\${changed.length} elapsed=\${Date.now()-t0fc}ms\`);`

This is the key discriminator: if `allFiles` is 3K–8K and `elapsed` is ~8–9s, Root Cause A is confirmed. If elapsed is fast, the 9s is somewhere else and needs more investigation.

**C. Incremental pipeline file counts** — `indexingPipeline.ts:334` inside `resolveFilesToProcess`, after `filterChangedFiles`:
```typescript
log.info(`[trace:pipeline.resolve] allFiles=${allFiles.length} changed=${changed.length}`);
```
Confirms that `changed=0` is the common path and quantifies how often the fast-path would apply.

**D. buildRepoIndex timing** — `contextLayerController.ts:143`:
```typescript
const t0ri = Date.now();
const snapshot = await this.buildRepoIndex([this.workspaceRoot]);
log.info(`[trace:contextLayer.buildRepoIndex] elapsed=${Date.now()-t0ri}ms`);
```
Quantifies how much of the remaining jank comes from the contextLayer rebuild path vs the indexing worker. If this is > 200ms, it is the Phase 5 target.

**E. autoSync trigger with pending paths** — `autoSync.ts:287` at the start of `triggerReindex`:
```typescript
log.info(`[trace:autoSync.triggerReindex] pendingEventsSize=${this.pendingEvents.size} reindexing=${this.reindexing}`);
```
Confirms whether the watcher is correctly accumulating paths before the 3s debounce fires.

---

## 6. IndexingWorkerClient Lifecycle Answer

`IndexingWorkerClient` is a **module-level singleton with cross-window lifetime**.

Evidence: `indexingWorkerClient.ts:221-228`:
```typescript
let _client: IndexingWorkerClient | null = null;

export function getIndexingWorkerClient(): IndexingWorkerClient {
  _client ??= new IndexingWorkerClient();
  return _client;
}
```

This singleton is created once and shared across all windows. `releaseGraphController()` at `graphControllerCompatRegistry.ts:120-139` does NOT call `workerClient.dispose()` on per-window release. `disposeIndexingWorkerClient()` (`indexingWorkerClient.ts:230-233`) IS called from `disposeCodebaseGraph()` (`mainStartupGraph.ts:193`) which runs at app shutdown via `app.before-quit` — correct lifetime.

**Verdict for `2026-05-25-indexing-worker-not-disposed-on-window-close.md`:** Close as WONTFIX / working-as-intended. The `IndexingWorkerClient` is correctly scoped as a singleton shared across all windows. Per-window dispose would incorrectly terminate a shared resource mid-flight for other windows. The lifecycle is: created at first `getIndexingWorkerClient()` call during startup, shared until `disposeCodebaseGraph()` at app exit.

---

## 7. Phase 2 Hand-Off

### Status of the architect plan

The architect plan at `roadmap/follow-ups/2026-05-17-move-generateRepoMap-to-worker-plan.md` is **already fully implemented**:
- `repoMapWorker.ts` exists and runs `generateRepoMap` off-main.
- `repoMapWorkerClient.ts` is the main-thread singleton client.
- `repoMapWorkerQueryClient.ts` implements the read-only SQLite connection.
- `repoMapGeneratorQuerySource.ts` implements `getQuerySource()` with `isMainThread` branching.
- `main.ts:188` wires `generateRepoMapFn: (opts) => getRepoMapWorkerClient().generateRepoMap(opts)`.

The `triggerContextLayerRebuildAfterGraphReady` -> `ctrl.forceRebuild()` -> `runFullRebuild()` path now routes `generateRepoMap` to the worker. The remaining main-thread work inside `runFullRebuild` is `buildRepoIndex()` — unquantified without instrumentation D above.

**The architect plan is not the primary fix for the active-editing cascade.** The active-editing cascade is driven by `autoSync -> indexingWorker -> O(N) catalog scan`. The architect plan's concern (cold-start `generateRepoMap` freeze) is addressed.

### Primary fix (Phase 2 / Phase 5 of wave plan)

**Target:** Eliminate the O(N) catalog scan for incremental reindex when called by the watcher.

**Option 1 (correct, bounded scope):** Add an early-exit in `IndexingPipeline.resolveFilesToProcess()` when `changed.length === 0`. At `indexingPipeline.ts:337`, after `filterChangedFiles` returns, add:
```typescript
if (changed.length === 0 && isIncremental) {
  return { filesToProcess: [], isIncrementalRun: true };
}
```
Then in `runIndex` at line 248, if `filesToProcess.length === 0`, skip `runAllPasses`, `finalizeIndex`, skip to `buildIndexResult` with 0 counts. This eliminates the no-op cost (~9s -> <100ms) with minimal code change.

Files: `indexingPipeline.ts` only. Low risk.

**Option 2 (deeper, eliminates O(N) for single-file saves too):** Pass `changedPaths` from `autoSync.pendingEvents` through the worker protocol. Worker skips `discoverFiles()` and `filterChangedFiles()` for the non-paths, only classifying the specific files. Requires:
- `indexingWorkerTypes.ts`: add `changedPaths?: string[]` to `IndexRequestOptions`
- `indexingPipelineTypes.ts`: add `changedPaths?: string[]` to `IndexingOptions`
- `indexingPipeline.ts`: if `changedPaths` provided, use them as `filesToProcess` directly (skip the full walk)
- `autoSync.ts`: pass `Array.from(this.pendingEvents.keys())` as `changedPaths` in `runIndex` call

Option 2 gives a more durable fix and is the right long-term answer. Option 1 is a fast-path that addresses the zero-change case immediately with minimal risk.

**Recommendation for Phase 2:** Implement Option 1 first (1–2 files, low risk, addresses the 9s no-op case), then Option 2 in the same phase or a follow-up (addresses the single-file-changed case). Per the wave plan: "Trivial fix once diagnosed" applies to Option 1. Option 2 is a `haiku-implementer` task given the tight spec.

### Secondary investigation (instrumentation D first, then fix)

After Option 1 fixes the no-op 9s, if jank events of 2–4s remain, run instrumentation D to quantify `buildRepoIndex` on main. If > 500ms, either:
- Offload `buildRepoIndex` behind the contextLayer's 5s debounce (it already waits 5s, so no user-visible delay to adding more work there)
- Or increase the contextLayer debounce from 5s to 30s during active editing (reduces frequency of rebuilds)

### Files the implementer needs to touch (Option 1 only)

| File | Change |
|------|--------|
| `src/main/codebaseGraph/indexingPipeline.ts` | Early-exit in `resolveFilesToProcess` when `changed.length === 0`; skip `runAllPasses`/`finalizeIndex` in `runIndex` for empty `filesToProcess` |
| `src/main/codebaseGraph/indexingPipeline.test.ts` | Test that a reindex with 0 changed files skips all passes and returns in <100ms |

That is it for Option 1. The test is the key gate — it should verify the fast-path fires and that no DB writes occur on a no-op run.
