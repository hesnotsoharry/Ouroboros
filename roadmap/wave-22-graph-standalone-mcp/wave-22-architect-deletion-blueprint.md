---
status: DRAFT
created: 2026-05-26
wave: 22
phase: 2
deliverable: deletion-blueprint
produced_by: sonnet-refactor-planner
consumed_by: phase-5-sonnet-migration-executor
---

# Wave 22 Phase 2 — In-IDE Graph + Consumer Chain Deletion Blueprint

Read-only deliverable. Produced by `sonnet-refactor-planner`. Consumed by Phase 5 `sonnet-migration-executor`.

**Locked context:** Cole picked A2 (Decision 4) — aggressive removal with capability loss accepted. Terminal Claude Code sessions inside the IDE will lose auto-context injection post-Wave-22. The blueprint enumerates the deletion + edit work; preservation paths are out of scope.

## Refactor goal

Remove the in-IDE codebase graph subsystem (`src/main/codebaseGraph/`) and its consumer chain from the Agent IDE, leaving the graph-independent portions of `contextLayer/` and all other subsystems intact.

## Summary

| Category | File count (approx) |
|---|---|
| DELETE (codebaseGraph subsystem) | ~111 files |
| DELETE (contextLayer graph-dependent) | 8 files |
| DELETE (orchestration / startup wiring) | 4 files |
| DELETE (IPC handlers + preload bridges) | 3 files |
| MODIFY (cross-cutting callers) | ~12 files |
| KEEP (contextLayer survivors) | ~20 files |
| IPC channels removed | 12 (`graph:*`) |
| Renderer files modified | 3 (`useSymbolDisambiguation.ts`, `electron-workspace.d.ts`, `preloadSupplementalApis.ts`) |

## Current structure

| Path | Responsibility |
|---|---|
| `src/main/codebaseGraph/` | In-process graph engine (SQLite + tree-sitter indexer, Cypher query engine, MCP tool handlers) — ~111 files |
| `src/main/contextLayer/repoMap*.ts` (5 files) | Repo-map generation backed by graph queries |
| `src/main/contextLayer/contextInjector.ts` | Context packet enrichment using the repo map |
| `src/main/contextLayer/repoMapWorker*.ts` (2 files) | Worker process driving repo-map generation |
| `src/main/mainStartupGraph.ts` | Startup wiring for graph init/dispose |
| `src/main/mainStartupContextLayerTrigger.ts` | Triggers contextLayer rebuild after graph ready |
| `src/main/ipc-handlers/graphHandlers.ts` | Registers 10 `graph:*` IPC channels |
| `src/main/ipc-handlers/graphHandlersNeighbourhood.ts` | Registers 2 more `graph:*` IPC channels |
| `src/preload/preloadSupplementalGraphApis.ts` | Preload bridge for `graph:*` channels |
| Cross-cutting callers | `main.ts`, `mainStartup.ts`, `windowManager.ts`, `hooksLifecycleHandlers.ts`, `hooksSessionHandlers.ts`, `contextPacketBuilder.ts`, `ipc-handlers/misc.ts`, `ipc-handlers/gitOperations.ts`, `ipc-handlers/filesHelpers.ts` |
| `src/main/mobileAccess/channelCatalog.desktopOnly.ts` | 12 `graph:*` entries in the capability catalog |
| `src/renderer/types/electron-workspace.d.ts` | `graph: GraphAPI` on `ElectronAPI` |
| `src/renderer/components/AgentChat/useSymbolDisambiguation.ts` | Calls `window.electronAPI.graph.searchGraph` |

## Proposed end-state

After the refactor:
- `src/main/codebaseGraph/` — entirely absent
- `src/main/contextLayer/` — retains ~20 graph-independent files; `contextLayerController.ts` survives with `enrichPacket` returning pass-through and `runFullRebuild` producing an empty `RepoMap`
- `src/main/mainStartupGraph.ts` + `src/main/mainStartupContextLayerTrigger.ts` — absent
- `src/main/ipc-handlers/graphHandlers.ts` + `graphHandlersNeighbourhood.ts` — absent
- `src/preload/preloadSupplementalGraphApis.ts` — absent
- 12 `graph:*` IPC channels — removed from all surfaces (handlers, preload, type declarations, capability catalog)
- `contextLayer:progress` channel — **survives** (emitted by AI module summarization, no graph dependency)
- `src/renderer/components/AgentChat/useSymbolDisambiguation.ts` — `window.electronAPI.graph.searchGraph` call replaced with an always-empty stub

## DELETE list

### `src/main/codebaseGraph/` (entire subsystem — ~111 files)

`git rm -r src/main/codebaseGraph/` in Step 22 (final).

Includes all `.ts` source files, all `.test.ts` files, `CLAUDE.md`, `passes/CLAUDE.md`, and `__fixtures__/modernTs.ts`. The 44 test files inside this directory tree go with the source (no separate enumeration needed).

### `src/main/contextLayer/` graph-dependent files (8)

| File | Reason |
|---|---|
| `repoMapGenerator.ts` | Imported from `contextLayerController.ts:42`; consumes `codebaseGraph/graphController` queries |
| `repoMapGeneratorGraph.ts` | Imports from `codebaseGraph/` directly |
| `repoMapGeneratorRanking.ts` | Imports from `codebaseGraph/` |
| `repoMapGeneratorDeps.ts` | Imports from `codebaseGraph/` |
| `repoMapGeneratorQuerySource.ts` | Imports from `codebaseGraph/` |
| `contextInjector.ts` | Imported from `contextLayerController.ts:17`; uses repoMap output |
| `repoMapWorkerClient.ts` | Imports from `codebaseGraph/graphDatabaseHelpers` |
| `repoMapWorker.ts` | Worker entry; imports from `codebaseGraph/` |

### Orchestration / startup wiring (4)

| File | Reason |
|---|---|
| `src/main/mainStartupGraph.ts` | Graph init/dispose wiring; no other consumers after Step 10 |
| `src/main/mainStartupContextLayerTrigger.ts` | Triggers contextLayer after graph ready; orphan after graph removed |
| `src/main/mainStartupContextLayerTrigger.test.ts` | Subject deleted; test goes too |
| `src/main/orchestration/graphSummaryBuilder.ts` | *⚠️ Unverified* — likely imports `GraphController` for structural hotspots; if confirmed, delete with its callers updated; if it has no graph imports, KEEP. Phase 5 executor verifies via `grep` before deletion |

### IPC handlers + preload bridges (3)

| File | Reason |
|---|---|
| `src/main/ipc-handlers/graphHandlers.ts` | Registers 10 `graph:*` channels; no longer needed |
| `src/main/ipc-handlers/graphHandlersNeighbourhood.ts` | Registers 2 `graph:*` channels |
| `src/main/ipc-handlers/graphHandlersNeighbourhood.test.ts` | Subject deleted; test goes too |
| `src/preload/preloadSupplementalGraphApis.ts` | Preload bridge for `graph:*`; no callers after handlers removed |

## MODIFY list

For each file: EXACT lines/blocks to strip + what stays. The Phase 5 executor runs `npx tsc --noEmit` after each edit; any line numbers below should be verified against current file state before stripping (codebases shift; line numbers are guidance, not exact).

### `src/main/main.ts`

- **Strip:** line 12 (`import { initContextLayer } from './contextLayer/contextLayerController'`)
- **Strip:** line 13 (`import { getRepoMapWorkerClient } from './contextLayer/repoMapWorkerClient'`)
- **Strip:** line 26 — `initCodebaseGraph` destructured from `'./mainStartup'`; remove from the destructure (keep other imports from mainStartup)
- **Strip:** lines 174–204 — `startContextLayerAsync()` body: strip `initContextLayer(...)` call (~lines 182–196) and `initCodebaseGraph()` call (~lines 197–199). Lines 200–203 (`loadPersistedContextCache()` + `startContextRefreshTimer()`) belong to agentChat — **KEEP** these but relocate if needed (move to `app.whenReady()` block or equivalent if the surrounding function is removed entirely)
- **Strip:** line 21 — `import { loadPersistedContextCache, startContextRefreshTimer, ... } from './ipc-handlers/agentChat'` — this is needed for the lines kept above, so KEEP this import; only strip the graph/contextLayer parts of the destructure if applicable
- **Keep:** everything else (Electron app lifecycle, BrowserWindow management, IPC handler registration that doesn't touch graph)

### `src/main/mainStartup.ts`

- **Strip:** line 21 (`export { disposeCodebaseGraph, initCodebaseGraph } from './mainStartupGraph'`)
- **Keep:** everything else

### `src/main/contextLayer/contextLayerController.ts`

- **Strip:** line 17 (`import { injectContextLayer } from './contextInjector'`)
- **Strip:** line 42 (`import { generateRepoMap } from './repoMapGenerator'`)
- **Modify:** `runFullRebuild()` (lines ~155–174): replace the `generateRepoMap(...)` call block with `const repoMap: RepoMap = { modules: [], generatedAt: Date.now() };` (match exact shape from `contextLayerTypes.ts` `RepoMap` interface)
- **Modify:** `enrichPacket()` (lines ~224–246): replace the `injectContextLayer(...)` call with an immediate `return { packet, injected: false };` (or whatever the no-op return shape is per `ContextLayerController.enrichPacket` signature in `contextLayerControllerTypes.ts`)
- **Keep:** module summarization, the `contextLayer:progress` emission (line ~216 in `enqueueForSummarization`), everything else

### `src/main/windowManager.ts`

- **Strip:** line 12 (`import { acquireGraphController, releaseGraphController }`)
- **Strip:** line 13 (`import { acquireContextLayer, releaseContextLayer }`)
- **Strip:** lines ~205–206 (`acquireGraphController(...)` call)
- **Strip:** lines ~298–302 (`releaseGraphController(...)` call)
- **Strip:** lines ~321–326 (`acquireContextLayer(...)` / `releaseContextLayer(...)` calls)
- **Keep:** everything else (window lifecycle, BrowserWindow management, focus handling)

### `src/main/hooksLifecycleHandlers.ts`

- **Strip:** line 13 (`import { getGraphController } from '../codebaseGraph/...'`)
- **Keep:** line 14 (`import { getContextLayerController }`) — contextLayer survives
- **Strip from `handleFileChanged` (~line 121):** `getGraphController()?.onFileChange?.(...)` call; KEEP the adjacent `getContextLayerController()?.onFileChanged(...)` call
- **Keep from `handleCwdChanged` (~line 107):** `getContextLayerController()?.onCwdChanged(...)` — no graph dependency

### `src/main/hooksSessionHandlers.ts`

- **Strip:** line 12 (`import { getGraphController }`)
- **Keep:** line 14 (`import { getContextLayerController }`)
- **Strip:** ~line 105 `getGraphController()?.onSessionStart()`; KEEP adjacent contextLayerController call
- **Strip:** ~line 117 `getGraphController()?.onGitCommit()`; KEEP adjacent contextLayerController call

### `src/main/ipc-handlers/misc.ts`

- **Strip:** line 7 (`import { registerGraphHandlers } from './graphHandlers'`)
- **Strip:** line 35 (`registerGraphHandlers(channels);`)
- **Keep:** all other handler registrations

### `src/main/ipc-handlers/gitOperations.ts`

- **Strip:** lines ~11–12 — strip the `getGraphController` import; KEEP `getContextLayerController` import on the same/adjacent line
- **Strip:** ~lines 189–190 in `flushPendingChanges` — `graphCtrl.onFileChange(...)` call
- **Strip:** ~line 228 — `getGraphController()?.onGitCommit()`
- **Keep:** ~line 229 — `getContextLayerController()?.onGitCommit()`

### `src/main/ipc-handlers/filesHelpers.ts`

- **Strip:** lines ~14–15 — strip the `getGraphController` import; KEEP `getContextLayerController` import
- **Strip:** ~lines 189–190 in `flushPendingChanges` — `graphCtrl.onFileChange(...)` call; KEEP adjacent contextLayerController call

### `src/preload/preloadSupplementalApis.ts`

- **Strip:** line 25 (`import { graphApi } from './preloadSupplementalGraphApis'`)
- **Strip:** line 303 (`graph: graphApi,` from the exported object)
- **Keep:** the `contextLayer.onProgress` subscription block (~lines 265–267) — push channel survives

### `src/renderer/components/AgentChat/useSymbolDisambiguation.ts`

- **Modify:** lines ~60–61 — replace `window.electronAPI.graph.searchGraph(bareName, MAX_SYMBOL_RESULTS)` with `Promise.resolve({ success: true as const, results: [] })`. The function signature and hook interface are unchanged; callers continue to work with empty results.
- **Risk:** verify the exact return-shape contract from `GraphAPI['searchGraph']` in `electron-graph.d.ts` before writing the stub. If the contract is more elaborate, match it.

### `src/renderer/types/electron-workspace.d.ts`

- **Strip:** line ~20 — `import { GraphAPI }` from `electron-graph`
- **Strip:** line ~325 — `graph: GraphAPI` property on `ElectronAPI`
- **Keep:** `contextLayer: ContextLayerAPI` (~line 300)
- **Risk:** `electron-graph.d.ts` is NOT deleted in this wave — `GraphPanel/` components still reference it. Removing `graph` from `ElectronAPI` will cause TypeScript errors in `GraphPanel` components. Those errors are accepted (Wave 100 deletes GraphPanel). The Phase 5 executor SHOULD confirm the TypeScript errors are limited to `GraphPanel/` files before proceeding past this step.

### `src/main/mobileAccess/channelCatalog.desktopOnly.ts`

- **Strip:** lines ~62–73 — remove all 12 `graph:*` entries from `DESKTOP_ONLY_CATALOG`:
  - `graph:detectChanges`
  - `graph:getArchitecture`
  - `graph:getBlastRadius`
  - `graph:getCodeSnippet`
  - `graph:getGraphSchema`
  - `graph:getNeighbourhood`
  - `graph:getStatus`
  - `graph:queryGraph`
  - `graph:reindex`
  - `graph:searchCode`
  - `graph:searchGraph`
  - `graph:traceCallPath`
- **Risk:** `channelCatalogCoverage.test.ts` asserts catalog-handler correspondence; after removing both the handlers (Steps 17, 20, 21) and the catalog entries (this step), the test should pass naturally. Executor reads the test file before this step to confirm.

## KEEP list (contextLayer survivors)

These files have no `codebaseGraph/` imports (confirmed via prior analysis) and survive intact:

| File | Rationale |
|---|---|
| `contextLayerController.ts` | Survives as MODIFIED — module detection + AI summarization logic intact |
| `contextLayerControllerHelpers.ts` | Pure utilities; no graph imports |
| `contextLayerControllerSupport.ts` | Directory-walk module detection; no graph imports |
| `contextLayerControllerTypes.ts` | Type definitions; no graph imports |
| `contextLayerGC.ts` | Storage GC; no graph imports |
| `contextLayerModuleSummary.ts` | Goal-conditioned summary ranking; no graph imports |
| `contextLayerRefresher.ts` | Dirty-module refresh; no graph imports |
| `contextLayerRegistry.ts` | Singleton registry; no graph imports |
| `contextLayerStore.ts` | Persistence layer; no graph imports |
| `contextLayerTypes.ts` | Config/type definitions; no graph imports |
| `contextLayerWatcher.ts` | File/git event routing; no graph imports |
| `moduleDetector.ts` | Directory-driven module identity |
| `moduleDetectorHelpers.ts` | Detection helpers |
| `moduleDetectorMatching.ts` | Pattern matching |
| `moduleDetectorSingleFile.ts` | Single-file module detection |
| `moduleDetectorUtils.ts` | Utilities |
| `moduleSummarizer.ts` | Haiku-based AI summarization |
| `summarizationQueue.ts` | Async summarization queue; emits `contextLayer:progress` |
| `summarizationQueueHelpers.ts` | Queue helpers |
| `repoMapGeneratorFrameworks.ts` | *⚠️ Unverified KEEP* — appears to be framework detection by config files (no graph imports), but Phase 5 executor runs `grep 'codebaseGraph' src/main/contextLayer/repoMapGeneratorFrameworks.ts` before assuming. If grep returns hits, move to DELETE list. |

## IPC channels removed

| Channel | Main handler file | Renderer callers |
|---|---|---|
| `graph:searchGraph` | `graphHandlers.ts` | `useSymbolDisambiguation.ts:60`; `GraphPanel/` components (Wave 100 cleanup) |
| `graph:queryGraph` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:traceCallPath` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:getArchitecture` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:getCodeSnippet` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:detectChanges` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:searchCode` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:getGraphSchema` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:getStatus` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:reindex` | `graphHandlers.ts` | `GraphPanel/` components |
| `graph:getNeighbourhood` | `graphHandlersNeighbourhood.ts` | `GraphPanel/` components |
| `graph:getBlastRadius` | `graphHandlersNeighbourhood.ts` | `GraphPanel/` components |

**`contextLayer:progress` — SURVIVES.** Emitted by `summarizationQueue.ts` via `contextLayerController.ts:~216`. Consumed by `useProgressSubscriptions.ts:84–90` in the renderer. No change needed.

**`GraphPanel/` UI behavior:** all `graph:*` IPC calls from `GraphPanel/` components will return `undefined` or throw at runtime since the handlers are gone. Panels will show permanent error/loading states. This is explicitly accepted under Decision 4 (A2) and deferred to Wave 100 cleanup. Note in the result brief.

## Test files affected

### Delete with the code

- `src/main/codebaseGraph/**/*.test.ts` (~44 files) — gone as part of Step 22
- `src/main/mainStartupContextLayerTrigger.test.ts` — subject deleted in Step 12
- `src/main/ipc-handlers/graphHandlersNeighbourhood.test.ts` — subject deleted in Step 21
- `src/main/contextLayer/repoMapGenerator*.test.ts` and `contextInjector.test.ts` — subjects deleted in Steps 2–7. Confirm via glob `src/main/contextLayer/*.test.ts` before deletion.

### Modify to remove graph-dependent assertions

- `src/main/mobileAccess/channelCatalogCoverage.test.ts` — asserts catalog-handler correspondence. After removing `graph:*` from BOTH catalog and handler registrations, the test should pass naturally. If the test asserts the converse direction, it may need updates. Executor reads this file (lines 1–80) before Step 27.
- `src/main/contextLayer/contextLayerController.test.ts` (if it exists) — may assert behavior about `enrichPacket` returning enriched content. After Step 1 makes `enrichPacket` a pass-through, those specific assertions fail. Modify or remove the failing assertions; KEEP the rest of the file.

### No change needed

- `src/renderer/hooks/useProgressSubscriptions.ts` and its test — `contextLayer:progress` channel survives
- `src/preload/*.test.ts` — preload tests don't cover `graphApi` specifically per prior reads; verify if any do
- `src/main/ipc-handlers/config.test.ts` — contextLayer config handling survives

## Ordered migration sequence

The Phase 5 `sonnet-migration-executor` follows these steps in order. After each step the executor runs `npm run build` + `npx tsc --noEmit` and verifies green before proceeding. The order is designed so edits to consumer files happen BEFORE deletion of imported files, keeping the typecheck green through the migration.

```
Step  1 — MODIFY src/main/contextLayer/contextLayerController.ts
            Strip imports of contextInjector + repoMapGenerator; replace call
            sites with stubs (empty RepoMap; no-op enrichPacket).

Step  2 — DELETE src/main/contextLayer/repoMapGenerator.ts
Step  3 — DELETE src/main/contextLayer/repoMapGeneratorGraph.ts
Step  4 — DELETE src/main/contextLayer/repoMapGeneratorRanking.ts
Step  5 — DELETE src/main/contextLayer/repoMapGeneratorDeps.ts
Step  6 — DELETE src/main/contextLayer/repoMapGeneratorQuerySource.ts
Step  7 — DELETE src/main/contextLayer/contextInjector.ts

Step  8 — MODIFY src/main/main.ts
            Strip imports + call sites of initContextLayer, getRepoMapWorkerClient,
            initCodebaseGraph. Relocate the agentChat warm-load calls
            (loadPersistedContextCache + startContextRefreshTimer) if their
            containing function is removed.

Step  9 — DELETE src/main/contextLayer/repoMapWorkerClient.ts
Step 10 — DELETE src/main/contextLayer/repoMapWorker.ts

Step 11 — MODIFY src/main/mainStartup.ts
            Strip the disposeCodebaseGraph + initCodebaseGraph re-export.

Step 12 — DELETE src/main/mainStartupGraph.ts
Step 13 — DELETE src/main/mainStartupContextLayerTrigger.ts (+ its test)

Step 14 — MODIFY src/main/windowManager.ts
            Strip acquireGraphController/releaseGraphController +
            acquireContextLayer/releaseContextLayer wiring.

Step 15 — MODIFY src/main/hooksLifecycleHandlers.ts
            Strip getGraphController import + onFileChange call;
            KEEP contextLayerController calls.

Step 16 — MODIFY src/main/hooksSessionHandlers.ts
            Strip getGraphController import + onSessionStart/onGitCommit calls;
            KEEP contextLayerController calls.

Step 17 — MODIFY src/main/ipc-handlers/misc.ts
            Strip registerGraphHandlers import + call.

Step 18 — MODIFY src/main/ipc-handlers/gitOperations.ts
            Strip getGraphController import + call sites; KEEP contextLayer calls.

Step 19 — MODIFY src/main/ipc-handlers/filesHelpers.ts
            Strip getGraphController import + call sites; KEEP contextLayer calls.

Step 20 — DELETE src/main/ipc-handlers/graphHandlers.ts
Step 21 — DELETE src/main/ipc-handlers/graphHandlersNeighbourhood.ts (+ its test)

Step 22 — VERIFY src/main/orchestration/graphSummaryBuilder.ts
            Executor runs `grep -l 'codebaseGraph' src/main/orchestration/*.ts`.
            If graphSummaryBuilder.ts imports from codebaseGraph/, DELETE it
            and identify any callers (likely in contextPacketBuilder.ts) — strip
            those call sites with a MODIFY pass. If no graph imports, KEEP.

Step 23 — DELETE src/main/codebaseGraph/ (entire directory; ~111 files)
            `git rm -r src/main/codebaseGraph/`

Step 24 — MODIFY src/preload/preloadSupplementalApis.ts
            Strip graphApi import + the `graph: graphApi` export field.

Step 25 — DELETE src/preload/preloadSupplementalGraphApis.ts

Step 26 — MODIFY src/renderer/components/AgentChat/useSymbolDisambiguation.ts
            Replace window.electronAPI.graph.searchGraph(...) call with
            Promise.resolve({ success: true as const, results: [] }).

Step 27 — MODIFY src/renderer/types/electron-workspace.d.ts
            Strip GraphAPI import + graph property on ElectronAPI.
            Expect TypeScript errors in src/renderer/components/Layout/GraphPanel/
            (deferred to Wave 100); confirm errors are limited to that scope.

Step 28 — MODIFY src/main/mobileAccess/channelCatalog.desktopOnly.ts
            Strip all 12 graph:* entries from DESKTOP_ONLY_CATALOG.

Step 29 — VERIFY + cleanup
            Run npm run build, npx tsc --noEmit, npm run test:main.
            Tier-2 friction discovered along the way is handled per
            development-pipeline scope-creep tiers.

Step Final — Commit summary
            Single phase-5 commit per migration-executor doctrine. Optional:
            split into "consumer-strip" + "delete-graph" + "renderer-cleanup"
            commits for cleaner history. Executor's call.
```

## Dependency updates (reference table)

Every import reference that requires an edit (not a deletion of the importing file itself):

| File | Line (approx) | Action |
|---|---|---|
| `src/main/main.ts` | 12 | REMOVE `import { initContextLayer } from './contextLayer/contextLayerController'` |
| `src/main/main.ts` | 13 | REMOVE `import { getRepoMapWorkerClient } from './contextLayer/repoMapWorkerClient'` |
| `src/main/main.ts` | 26 | Remove `initCodebaseGraph` from the destructure of `./mainStartup` |
| `src/main/mainStartup.ts` | 21 | REMOVE `export { disposeCodebaseGraph, initCodebaseGraph } from './mainStartupGraph'` |
| `src/main/contextLayer/contextLayerController.ts` | 17 | REMOVE `import { injectContextLayer } from './contextInjector'` |
| `src/main/contextLayer/contextLayerController.ts` | 42 | REMOVE `import { generateRepoMap } from './repoMapGenerator'` |
| `src/main/windowManager.ts` | 12 | REMOVE `import { acquireGraphController, releaseGraphController }` |
| `src/main/windowManager.ts` | 13 | REMOVE `import { acquireContextLayer, releaseContextLayer }` |
| `src/main/hooksLifecycleHandlers.ts` | 13 | REMOVE `import { getGraphController }` |
| `src/main/hooksSessionHandlers.ts` | 12 | REMOVE `import { getGraphController }` |
| `src/main/ipc-handlers/misc.ts` | 7 | REMOVE `import { registerGraphHandlers } from './graphHandlers'` |
| `src/main/ipc-handlers/gitOperations.ts` | 11–12 | Strip only `getGraphController`; keep `getContextLayerController` |
| `src/main/ipc-handlers/filesHelpers.ts` | 14–15 | Strip only `getGraphController`; keep `getContextLayerController` |
| `src/preload/preloadSupplementalApis.ts` | 25 | REMOVE `import { graphApi } from './preloadSupplementalGraphApis'` |
| `src/renderer/types/electron-workspace.d.ts` | 20 | REMOVE `import { GraphAPI }` from `electron-graph` |
| `src/renderer/components/AgentChat/useSymbolDisambiguation.ts` | 60–61 | Replace `window.electronAPI.graph.searchGraph(...)` with `Promise.resolve({ success: true as const, results: [] })` |

## Risks surfaced during the survey

- **`GraphPanel/` renderer components are left broken at runtime, not compile-time.** `electron-graph.d.ts` is NOT deleted in Wave 22 (it's a Wave-100 concern). After Step 27 strips `graph` from `ElectronAPI`, TypeScript errors in `GraphPanel/` components are expected and accepted under Decision 4 (A2). Document in the result brief.

- **`useSymbolDisambiguation.ts` graceful degradation:** the replacement must return the correct type shape so callers checking `result.success && result.results` work. Confirm the type contract from `GraphAPI['searchGraph']` return type in `electron-graph.d.ts` before writing the stub.

- **`contextLayerController.ts` `enrichPacket` return shape:** the pass-through stub must match the exact shape `contextPacketBuilder.ts::enrichPacketWithContextLayer` (~line 168) expects. Read the `ContextLayerController` interface in `contextLayerControllerTypes.ts` (lines 1–50) before writing the stub.

- **`startContextLayerAsync` removal in `main.ts`:** the agentChat warm-load calls (`loadPersistedContextCache` + `startContextRefreshTimer`) currently live inside `startContextLayerAsync`. If the whole function is removed, these calls MUST be relocated (move to `app.whenReady()` block or equivalent). Dropping them entirely would break agentChat context warm-loading.

- **`repoMapGeneratorFrameworks.ts` KEEP status is unverified.** The KEEP list assumes no graph imports. Executor confirms with `grep 'codebaseGraph' src/main/contextLayer/repoMapGeneratorFrameworks.ts` before Step 23. If hits found, move to DELETE.

- **`contextLayerRegistry.ts` acquire/release pattern:** after stripping `acquireContextLayer`/`releaseContextLayer` from `windowManager.ts`, confirm the registry doesn't leave the controller in an inconsistent state that breaks AI summarization. The controller's singleton init path may need adjustment if `initContextLayer()` is removed from `main.ts`.

- **`graphSummaryBuilder.ts` in `src/main/orchestration/`** — not enumerated in primary analysis; if it imports from `codebaseGraph/`, it belongs in DELETE. Step 22 in the migration sequence VERIFIES this with grep.

- **`channelCatalogCoverage.test.ts` exact assertion direction** — passes naturally if it asserts "every registered handler is in the catalog" (both go away in lockstep). May need updates if it asserts the converse. Executor reads before Step 28.

- **`contextLayerController.ts` `enrichPacket` exact signature** — the pass-through stub must conform. Executor reads `contextLayerControllerTypes.ts` (lines 1–50) before Step 1.

- **MCP tool handlers in `codebaseGraph/mcpToolHandlerDefs*.ts`** — registered as part of the codemode/internalMcp surface. Verify with `src/main/codemode/` CLAUDE.md that deleting these files doesn't orphan a handler registration. If `codemode/` registers MCP handlers from `codebaseGraph/`, that wiring needs stripping too. Add a Step between 22 and 23 if needed.

## Verification

After each step: `npx tsc --noEmit` must pass.

After Step 23 (codebaseGraph deletion): `npm run test:codebasegraph` will fail with "no test files found" — expected. Switch to `npm run test:main` to confirm surviving main-process tests pass.

After all steps: `npm run test:main`, `npm run test:preload`, `npm run test:ipc`, `npm run test:renderer` (or scoped `test:agentchat`), and full `npx tsc --noEmit`. Full `npm test` runs at wave-end commit.

Manual check (deferred to Phase 6): open the IDE in dev mode (`npm run dev`), send a chat message, confirm the agent receives a context packet (check main-process logs for `contextLayer` activity). Confirm no crash on startup despite missing `initContextLayer` call.

## Out-of-scope (deferred to Wave 100 or later)

- `src/renderer/types/electron-graph.d.ts` — type declaration file. Not deleted in Wave 22.
- `src/renderer/components/Layout/GraphPanel/` — 8 renderer component files. Will show dead UI; cleanup is Wave 100 scope.
- Loopback rewiring (standalone MCP server as in-IDE consumer) — explicitly excluded by Decision 4 (A2).
- `src/main/orchestration/contextPacketBuilder.ts::enrichPacketWithContextLayer` (lines ~159–175) — after Step 1, the dynamic-import block still works correctly (it calls the surviving controller which now no-ops). Executor's call whether to strip it or leave as-is.

## Known gaps the executor must verify before starting

1. `grep 'codebaseGraph' src/main/contextLayer/repoMapGeneratorFrameworks.ts` — confirm KEEP vs DELETE.
2. `grep -l 'codebaseGraph' src/main/orchestration/*.ts` — confirm whether `graphSummaryBuilder.ts` is in DELETE.
3. Read `src/main/codemode/CLAUDE.md` and `grep -l 'codebaseGraph' src/main/codemode/` — confirm whether codemode registers MCP handlers from `codebaseGraph/`.
4. Read `src/main/mobileAccess/channelCatalogCoverage.test.ts` lines 1–80 — confirm assertion direction before Step 28.
5. Read `src/main/contextLayer/contextLayerControllerTypes.ts` lines 1–50 — confirm `ContextLayerController.enrichPacket` signature for the Step 1 stub.
6. `grep -l 'graphApi\|window.electronAPI.graph' src/renderer/` — surface any renderer files beyond `useSymbolDisambiguation.ts` and GraphPanel components that reference graph IPC.
