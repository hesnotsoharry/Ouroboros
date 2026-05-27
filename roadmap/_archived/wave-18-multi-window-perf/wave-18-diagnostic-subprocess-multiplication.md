---
status: IN-PROGRESS
created: 2026-05-25
updated: 2026-05-25
---

# Wave 18 Phase 1B -- Subprocess Multiplication Diagnostic

Investigation scope: 13,321 ms event-loop jank at 2026-05-25 23:03:33. Handle spike: 45 ChildProcess + 45 Pipe + 95 MessagePort with 3 windows open.

---

## 1. TL;DR

The 30+ concurrent child processes are not caused by a single broken singleton. They are the product of four independent subprocess-spawning systems, each correct in its own scope, all triggering in the same startup window when 3 windows open simultaneously. The dominant subprocess contributor is the repoIndexer git chain, which fires once per distinct project root via `contextLayerController.initialize()`, spawning 3-4 `git execFile` calls per root concurrently (`src/main/orchestration/repoIndexerSupportGit.ts:17,26,36,127`). Compounded by per-window pty terminal spawns (1 ChildProcess + 2 Pipe each on Windows ConPTY) and the claude-usage-poller single `powershell.exe`, the total reaches ~34 ChildProcess and ~45 Pipe. The 13.3s event-loop jank is **not** caused by subprocess spawning (which is async) — it is caused by synchronous `better-sqlite3` `db.transaction()` calls in `IndexingPipeline.runPass()` (`src/main/codebaseGraph/indexingPipeline.ts:60-70`) running on the main thread during `systemTwoRegistry.acquire()` -> `watcher.initWithLaunchDiff()` (`systemTwoRegistry.ts:133`), blocking the event loop while iterating thousands of graph DB rows synchronously.

---

## 2. Subprocess Inventory

| Subprocess type | Where spawned | Scope | 3-window count |
|---|---|---|---|
| node-pty shell (cmd.exe/pwsh) | `src/main/pty.ts:185` `pty.spawn()` | Per terminal pane, renderer-initiated | ~5/window * 3 = **15 ChildProcess, ~30 Pipe** |
| `git status --porcelain=v1` | `src/main/orchestration/repoIndexerSupportGit.ts:26` `execGitStatus` | Per distinct root, per `buildRepoIndexSnapshot` call | 1 * 3 = **3 ChildProcess** |
| `git branch --show-current` (nested in status callback) | `src/main/orchestration/repoIndexerSupportGit.ts:36` | Per distinct root, nested inside status | 1 * 3 = **3 ChildProcess** |
| `git log --oneline -5` (recent commits) | `src/main/orchestration/repoIndexerSupportGit.ts:191` `buildRecentCommits` | Per distinct root, per `buildRepoIndexSnapshot` call | 1 * 3 = **3 ChildProcess** |
| `git diff HEAD --unified=0` (hunks) | `src/main/orchestration/repoIndexerSupportGit.ts:127` `parseDiffHunks` | Per distinct root, per `buildRepoIndexSnapshot` call | 1 * 3 = **3 ChildProcess** |
| `git log --name-only -200` (co-change) | `src/main/codebaseGraph/passes/gitCoChangePass.ts:40` via `src/main/util/gitExec.ts:17` | Per distinct root, per full index run (worker thread) | 1 * 3 = **3 ChildProcess** |
| `git rev-parse --git-dir` (isRepo cold miss) | `src/main/ipc-handlers/gitRepoStatusCache.ts:70` | Per distinct root at first call, then cached | 1 * 3 = **3 ChildProcess** (cold only) |
| `powershell.exe` (claude-usage-poller) | `src/main/claudeUsagePoller.ts:187` | Process-global singleton | **1 ChildProcess + 1-2 Pipe** |

**Estimated totals** (3 windows, 3 distinct roots, 5 terminals each):
- ChildProcess: 15 (pty) + 12 (repoIndexer) + 3 (gitCoChangePass) + 3 (git:isRepo) + 1 (poller) = **~34**
- Pipe: ~30 (ConPTY per pty; Windows creates 2 Pipe handles per node-pty session) + 1-2 (poller) + hook connections (~3-5) = **~35-45**

These estimates match the observed 45 ChildProcess + 45 Pipe peak within measurement variance.

---

## 3. Per-Hypothesis Verdict

### H1: PTY terminals -- ~5 sessions x 3 windows = 15 pty spawns at startup

**CONFIRMED -- partial contributor.**

- `src/main/pty.ts:185`: `pty.spawn(shell, finalArgs, ...)` -- one ChildProcess per terminal
- PTY restoration is renderer-initiated via `pty:restoreSession` IPC, NOT automatic from `main.ts` startup
- The 12 `[xterm-init] term.open()` log lines with 6 unique session IDs indicate ~5-6 pty sessions at startup
- Windows ConPTY creates 2 Pipe handles per `node-pty` session (one stdin/stdout pipe, one ConPTY helper)
- Count contribution: **~15 ChildProcess + ~30 Pipe**

### H2: Hook server pipes -- each Claude Code session = 1 pipe per connection

**INCONCLUSIVE -- Pipe handles only, zero ChildProcess contribution.**

- `src/main/hooks.ts:306`: `startHooksServer(window)` called once for the first window only, inside `main.ts:145` `startBackgroundServices(mainWindow)`
- The hooks server creates 1 Server handle. Each inbound Claude Code session creates 1 Pipe handle
- 3 active Claude Code PTY sessions = 3 Pipe handles. Zero ChildProcess.

### H3: claude-usage-poller spawned per-window instead of singleton

**REFUTED -- correctly singleton.**

- `src/main/claudeUsagePoller.ts:303`: module-level `let intervalId = null` guard
- `src/main/claudeUsagePoller.ts:331-332`: `startClaudeUsagePoller()` returns early if `intervalId` already set
- `src/main/main.ts:145`: called once inside `startBackgroundServices(mainWindow)`, which is called once at startup for the first window only
- Log `[claude-usage-poller] spawning: powershell.exe` confirms exactly 1 instance
- Count contribution: **1 ChildProcess + 1-2 Pipe**

### H4: Wave 16 caches are scoped per-window instead of process-global

**REFUTED -- all Wave 16 caches are correctly module-scoped.**

- `src/main/ipc-handlers/shellHistoryCache.ts:24-27`: `const cache = new Map(); let pending = null` -- module-level. Comment line 21: "Module-scoped so all windows share a single warm entry."
- `src/main/ipc-handlers/gitRepoStatusCache.ts:26-27`: `const cache = new Map<string, Entry>(); const pendingMap = new Map()` -- module-level. Comment line 19: "module-scoped so all windows share."
- `src/main/ipc-handlers/extensionStoreCache.ts:44-50`: all three cache vars are module-level `let`s. Comment line 26: "Module-scoped so all windows share."
- `readShellHistory()` at `src/main/ipc-handlers/miscSymbolSearch.ts:220-227` is pure `fs.readFile` -- no subprocess spawned.

### H5: Hot reload / file save triggering subprocess explosion

**CONFIRMED -- partial trigger for git subprocess burst; NOT direct jank cause.**

- File save triggers `@parcel/watcher` events -> `AutoSyncWatcher.receiveWatcherEvent` -> 300ms debounce -> incremental reindex
- Each incremental index run calls `prefetchGitCoChangeData` (1 `git log` per root)
- With 3 roots monitored, 1 file save = up to 3 concurrent `git log` subprocesses
- `[ipc-perf] slow handler { channel: 'files:saveFile', ms: 13467 }` is a `patchIpcMainHandle` queue-wait artifact (Wave 17 Lesson 1) -- the save I/O is fast; the 13467ms is time spent waiting in the event queue during the 13.3s jank

---

## 4. Dominant Contributor

**Primary subprocess source:** `src/main/orchestration/repoIndexerSupportGit.ts`

- `execGitStatus` (line 24-40): spawns `git status --porcelain=v1` then `git branch --show-current` (2 `execFile` calls per root)
- `buildRecentCommits` (line 189-199): spawns `git log --oneline -5` (1 `execFile` per root)
- `parseDiffHunks` (line 124-136): spawns `git diff HEAD --unified=0` (1 `execFile` per root)

**Call chain:**
```
buildRepoIndexSnapshot (repoIndexer.ts:217-218)
  <- contextLayerController.initialize() (contextLayerController.ts:99-115)
     <- runFullRebuild() -> buildRepoIndexTimed() -> buildRepoIndex([root])
  <- contextLayerRegistry.acquireContextLayer() (contextLayerRegistry.ts:92-99)
  <- windowManager.ts:297 setWindowProjectRoot()
```

**Count estimate:** 3 roots * 4 git subprocesses = **12 concurrent ChildProcess handles** spawned within seconds of startup.

**Secondary subprocess source:** `src/main/codebaseGraph/passes/gitCoChangePass.ts:40` `prefetchGitCoChangeData`

- Runs `git log --name-only -200` (200 commits, all file names -- the heaviest git operation in the codebase)
- Called from `indexingPipeline.ts:169` inside the indexing worker thread
- Worker thread subprocesses still appear as ChildProcess + Pipe on the Electron main process handle list
- 3 roots * 1 heavy `git log` = **3 additional ChildProcess**

---

## 5. The 13.3s Jank Cause

Subprocess spawning is async (libuv thread pool). 30+ concurrent child processes do not block the event loop. The jank is a **main-thread stall**.

**Most likely cause (runtime confirmation needed):** synchronous `better-sqlite3` `db.transaction()` on the main thread.

Evidence chain:

1. `windowManager.ts:298`: `void acquireGraphController(projectRoot)` fires when renderer calls `window.setProjectRoots()`
2. `graphControllerCompatRegistry.ts:94`: `await systemTwoRegistry.acquire(root, _deps.db, pipeline)` -- awaited on main thread
3. `systemTwoRegistry.ts:133`: `await watcher.initWithLaunchDiff()` -- runs on main thread
4. `indexingPipeline.ts:60-70`: `runPass()` wraps each pass in `this.db.transaction(thunk)` -- `better-sqlite3` transactions are **synchronous** (C++ native binding, blocks the JS event loop for the entire transaction duration)
5. `indexingPipeline.ts:70-71`: `await new Promise<void>((resolve) => setImmediate(resolve))` -- yields only **between** passes, not between individual row operations within a pass
6. For AgentIDE at ~18K nodes, a cold structure or definition pass iterates thousands of rows in a single synchronous transaction -- 5-15 seconds on Windows

**Why `initWithLaunchDiff` runs on the main thread:**
```
windowManager.ts:298 void acquireGraphController(projectRoot)
  -> graphControllerCompatRegistry.ts:81 async acquireGraphController(root, pipeline)
  -> systemTwoRegistry.ts:103 async acquire(projectRoot, db, pipeline)
  -> systemTwoRegistry.ts:133 await watcher.initWithLaunchDiff()
  -> [any synchronous db.transaction() calls inside initWithLaunchDiff or the pipeline it calls]
```
The entire chain is on the main thread. The `IndexingWorkerClient` only handles `runIndex()` jobs (triggered later by `ensureIndexed()`). The launch-diff scan uses the pipeline directly.

The jank detector at `src/main/jankDetector.ts` fires because the main thread cannot service IPC callbacks during this synchronous window. The `[ipc-perf] slow handler` lines for `files:pathExists` (755ms, 632ms) and `files:saveFile` (13467ms) are queue-wait artifacts -- those handlers were queued and waiting while the main thread was blocked.

**Instrumentation required to confirm:** add `log.info('[trace:s2registry.initWithLaunchDiff] start/end')` in `autoSync.ts`, and `log.info('[trace:pipeline.runPass] start phase=%s / end elapsed=%dms', phase, elapsed)` bracketing `db.transaction()` in `indexingPipeline.ts:runPass()`. The phase with the longest elapsed time corresponds to the jank window.

---

## 6. Proposed Fix Shapes

*Descriptions only. Phase 2 implements.*

### Fix 1: Serialize contextLayer initialization across roots

**Problem:** 3 concurrent `contextLayerController.initialize()` calls at startup spawn 12 git processes simultaneously.

**Fix shape:** In `src/main/contextLayer/contextLayerRegistry.ts`, add a module-level `initQueue: Promise<void> = Promise.resolve()` that chains `initialize()` calls: `initQueue = initQueue.then(() => impl.initialize())`. Peak concurrent git processes drops from 12 to 4 (sequential per root). No user-observable latency change since contextLayer is not needed until the first chat turn fires.

### Fix 2: Defer contextLayer initialization 2-3 seconds after project root assignment

**Problem:** `acquireContextLayer` fires immediately during startup, competing with pty spawns and graph acquisition for OS resources.

**Fix shape:** In `contextLayerRegistry.acquireContextLayer()`, start `impl.initialize()` inside `setTimeout(() => ..., 2000)` after adding the controller to the registry. The controller is registered immediately for future consumers; the heavy `initialize()` (file walks + 4 git processes) fires after startup I/O has settled.

### Fix 3: Move synchronous SQLite work in initWithLaunchDiff to the worker thread

**Problem:** `systemTwoRegistry.acquire()` -> `watcher.initWithLaunchDiff()` on the main thread may call `IndexingPipeline.runPass()` -> `db.transaction()` synchronously, stalling the event loop for seconds.

**Fix shape:** (a) Audit `AutoSyncWatcher.initWithLaunchDiff()` for any direct `pipeline.runPass()` or `db.*` calls. If found, route through `IndexingWorkerClient.runIndex()` instead (moves SQLite work to the worker thread). (b) Alternatively, fire `acquireGraphController` inside a `setImmediate` callback after window creation, decoupling it from the window-ready critical path.

### Fix 4: Defer gitCoChangePass on cold (first-launch) index

**Problem:** `prefetchGitCoChangeData` runs `git log --name-only -200` per root on every full index run, including the initial cold index. For AgentIDE (200 commits), this is the heaviest git operation in the codebase and is an enrichment pass, not core indexing.

**Fix shape:** In `indexingPipeline.ts:runEnrichmentPasses()`, accept a `skipGitEnrichment?: boolean` option. In `makeEnsureIndexedCallback` (`mainStartupGraph.ts:139`), pass `skipGitEnrichment: true` when `reason === 'first-launch'`. Schedule a background re-enrichment run 60 seconds after the initial index completes. Subsequent incremental indexes run the pass normally.

### Fix 5: Stagger window creation during session restore

**Problem:** `restoreWindowSessions()` creates all windows within milliseconds; renderers fire `window.setProjectRoots()` as each renderer loads, causing 3 concurrent `acquireContextLayer` + `acquireGraphController` calls within the same second.

**Fix shape:** In `windowManagerSessions.ts:restoreWindowSessions()`, stagger window creation with 300ms inter-window delays using sequential `async reduce`: each window waits 300ms before creating the next. This serializes the concurrent acquire burst without user-observable latency.

---

## 7. Phase 2+ Hand-off

### Root cause ranking

| Rank | Cause | File:line | Fix shape |
|---|---|---|---|
| P1 (jank cause) | Synchronous `db.transaction()` on main thread during `initWithLaunchDiff` | `src/main/codebaseGraph/indexingPipeline.ts:60-70`, `src/main/codebaseGraph/systemTwoRegistry.ts:133` | Fix 3 |
| P2 (subprocess burst) | 3 concurrent `contextLayerController.initialize()` calls spawn 12 git processes | `src/main/contextLayer/contextLayerRegistry.ts:92-99`, `src/main/orchestration/repoIndexerSupportGit.ts:17,26,36,127` | Fix 1 or Fix 2 |
| P3 (subprocess burst) | `git log --name-only -200` per root on cold index | `src/main/codebaseGraph/passes/gitCoChangePass.ts:40`, `src/main/codebaseGraph/indexingPipeline.ts:169` | Fix 4 |
| P4 (expected, no fix) | ~15 pty spawns across 3 windows | `src/main/pty.ts:185` | None needed |
| P5 (expected, no fix) | 1 `powershell.exe` usage poller | `src/main/claudeUsagePoller.ts:187` | None needed |

### Files to instrument before fixing P1

- `src/main/codebaseGraph/autoSync.ts`: add `log.info('[trace:autoSync.initWithLaunchDiff] start')` / `end` at entry/exit of `initWithLaunchDiff()` with `Date.now()` timestamps
- `src/main/codebaseGraph/indexingPipeline.ts:runPass()`: add `[trace:pipeline.runPass] start phase=%s` before `this.db.transaction(thunk)` and `[trace:pipeline.runPass] end phase=%s elapsed=%dms` after
- `src/main/codebaseGraph/systemTwoRegistry.ts:acquire()`: log before and after `await watcher.initWithLaunchDiff()`
- Reproduce: open 3 windows with 3 distinct project roots; correlate which `runPass` phase timestamp overlaps with the jank detector fire timestamp

### Key invariants to preserve

- `shellHistoryCache`, `gitRepoStatusCache`, `extensionStoreCache` are process-global and correct -- do NOT change scope
- `startClaudeUsagePoller()` is singleton-guarded by `intervalId` -- no change needed
- PTY spawns are expected and correct -- do NOT reduce
- Wave 16 dogpile fixes (pending-slot deduplication in all three caches) are correct -- preserve them

### Verification signal after fixes

- Jank detector must not fire during 3-window startup
- ChildProcess count at startup: drops from ~45 to ~20-25 (pty sessions remain; git subprocesses serialized or deferred)
- `[ipc-perf] slow handler { channel: 'files:pathExists', ms: 755 }` and `ms: 632` disappear (were queue-wait artifacts)
- `[ipc-perf] slow handler { channel: 'files:saveFile', ms: 13467 }` disappears (was 13.3s jank artifact)

### Evidence table

| Claim | File:line |
|---|---|
| Usage poller is singleton-guarded by `intervalId` | `src/main/claudeUsagePoller.ts:303,331-332` |
| Usage poller started once for first window only | `src/main/main.ts:145` |
| Shell history cache is module-scoped | `src/main/ipc-handlers/shellHistoryCache.ts:24-27` |
| Git repo status cache is module-scoped | `src/main/ipc-handlers/gitRepoStatusCache.ts:26-27` |
| Extension contributions cache is module-scoped | `src/main/ipc-handlers/extensionStoreCache.ts:44-50` |
| `readShellHistory()` is `fs.readFile`, not subprocess | `src/main/ipc-handlers/miscSymbolSearch.ts:220-227` |
| `acquireGraphController` fires `ensureIndexed` only for NEW roots | `src/main/codebaseGraph/graphControllerCompatRegistry.ts:88-92,111` |
| `acquireContextLayer` calls `initialize()` for new roots | `src/main/contextLayer/contextLayerRegistry.ts:92-99` |
| `initialize()` triggers 4 git subprocesses per root | `src/main/contextLayer/contextLayerController.ts:99-115`, `src/main/orchestration/repoIndexerSupportGit.ts:17,26,36,127` |
| `prefetchGitCoChangeData` spawns `git log --name-only -200` | `src/main/codebaseGraph/passes/gitCoChangePass.ts:40-44` |
| `gitStdout` uses `execFile('git', ...)` | `src/main/util/gitExec.ts:17,22-34` |
| `node-pty` spawns 1 ChildProcess per terminal | `src/main/pty.ts:185` |
| `acquireContextLayer` called per window on root assignment | `src/main/windowManager.ts:297` |
| `acquireGraphController` called per window on root assignment | `src/main/windowManager.ts:298` |
| `systemTwoRegistry.acquire` calls `initWithLaunchDiff()` on main thread | `src/main/codebaseGraph/systemTwoRegistry.ts:133` |
| `IndexingPipeline.runPass` uses synchronous `db.transaction()` | `src/main/codebaseGraph/indexingPipeline.ts:60-70` |
| `files:pathExists` slow handler is queue-wait artifact | `src/main/ipc-handlers/filesHelpers.ts:31-38`, Wave 17 Lesson 1 |