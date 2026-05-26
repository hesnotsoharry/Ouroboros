---
status: COMPLETED
created: 2026-05-25
author: sonnet-diagnostician
phase: 1D
---

# Wave 18 Phase 1D — rulesWatcher Contention Diagnostic

## TL;DR

The 22 "Invalid handle" failures are caused by two compounding bugs, not one. First, the directories being watched (`C:\Web App\Agent IDE\.claude\commands` and `C:\Web App\Agent IDE\.claude\rules`) do not exist on disk — the project path `Agent IDE` has no `.claude/` subtree. Second, the `@parcel/watcher` Windows native backend (`WindowsBackend.cc`) calls `CreateFileW` on the target directory; when the directory doesn't exist, Windows returns `INVALID_HANDLE_VALUE`, and the backend throws `WatcherError("Invalid handle")`. That error object carries no `.code` property, so the `subscribeMdDir` catch handler's ENOENT/ENOTDIR guard does not fire — it falls through to the `log.warn` branch. Third, each of the N windows in the session (the 2026-05-25 trace shows 3 windows) contains 2 component instances of `useRulesAndSkills`, each of which fires a `rulesAndSkills:startWatcher` IPC call on mount. Each IPC call is serialized through the main-process singleton handler but individually calls `startRulesWatcher`, which attempts both missing directories. 3 windows × 2 hook instances × 1 IPC each = ~6 watcher start attempts × 2 failing paths × ~1 attempt per subscription = 12 base failures. The remaining 10 are plausibly explained by React strict-mode double-mount in dev mode (dev Vite doubles effect runs), which doubles the effect firing to ~6 × 2 = ~12 attempts × 2 dirs = 24, close to the 22 observed. The count is not a retry loop — it is a pure mount-multiplication artifact.

---

## 1. rulesWatcher Lifecycle

### Where created

`startRulesWatcher` is defined at `src/main/rulesAndSkills/rulesWatcher.ts:75`. It:

1. Builds 4 directories to watch via `buildMdDirectories(projectRoot)` (line 21–28):
   - `{projectRoot}/.claude/commands`
   - `{projectRoot}/.claude/rules`
   - `{HOME}/.claude/commands`
   - `{HOME}/.claude/rules`
2. Builds 2 direct files: `{projectRoot}/CLAUDE.md`, `{projectRoot}/AGENTS.md`
3. Calls `subscribeMdDir(dir, debounced)` in parallel for all 4 dirs (line 85-88)
4. Calls `fs.watch(filePath, debounced)` for each direct file (line 92-94)
5. Returns a cleanup function that closes all subscriptions on call

### Where consumed

`startRulesWatcher` is called exclusively from one place in production code:

`src/main/ipc-handlers/rulesAndSkills.ts:272` — the `activateWatcher` function inside `registerRulesAndSkillsHandlers`:

```ts
// line 265
let stopWatcher: (() => void) | null = null;

// line 268
ipcMain.handle('rulesAndSkills:startWatcher', (event, projectRoot: string) => {
  const denied = assertPathAllowed(event, projectRoot);
  if (denied) return denied;
  if (stopWatcher) stopWatcher();
  stopWatcher = startRulesWatcher(projectRoot, broadcastChanged);
  return { success: true };
});
```

### Scope

`stopWatcher` is a **module-level variable** at `rulesAndSkills.ts:265` — shared across all windows in the main process. There is exactly one `ipcMain.handle` for `rulesAndSkills:startWatcher` registered per process lifetime.

This means: every time any window's renderer invokes `rulesAndSkills:startWatcher`, the existing watcher is torn down and a new one is started. There is no per-window isolation at the IPC handler level. The watcher is process-global by design.

### Who calls the IPC from the renderer

`startWatcher` is called from the `useRulesAndSkills` hook at `src/renderer/hooks/useRulesAndSkills.ts:90-91`:

```ts
useEffect(() => {
  if (!projectRoot || !hasRulesAndSkillsAPI()) return;
  if (typeof window.electronAPI.rulesAndSkills.startWatcher === 'function') {
    void window.electronAPI.rulesAndSkills.startWatcher(projectRoot);  // line 91
  }
  void refresh();
  return window.electronAPI.rulesAndSkills.onChanged(() => { void refresh(); });
}, [projectRoot, refresh]);  // line 97
```

The effect fires on every change to `projectRoot` or `refresh` (stable ref in practice). It fires once when `projectRoot` transitions from null to a real path during startup (async hydration via `getProjectRoots()`).

### How many hook instances per window

`useRulesAndSkills` is instantiated in **two separate components** per window in IDE mode:

1. `AgentRightSidebarTabs` — `src/renderer/components/Layout/InnerAppLayout.agent.tsx:141`
2. `useAgentChatWorkspace` — `src/renderer/components/AgentChat/useAgentChatWorkspace.ts:323` (mounted inside `AgentChatWorkspace` via `AgentRightSidebarTabs`)

In ChatWorkbench mode a third instance is possible via `WorkbenchRulesPanel` (`ChatWorkbenchUtilityDrawer.tsx:79`), though that component is only mounted when the drawer is open and the rules tab is active.

**Per window: 2 active hook instances in the steady state IDE mode.**

---

## 2. Why the Directories Fail with "Invalid handle" (not ENOENT)

The two failing paths in the log are:
- `C:\Web App\Agent IDE\.claude\commands`
- `C:\Web App\Agent IDE\.claude\rules`

On-disk reality (verified):
- `C:\Web App\Agent IDE` exists (it is a distinct project directory from `C:\Web App\AgentIDE`)
- `C:\Web App\Agent IDE\.claude` does **not** exist
- Therefore neither `commands/` nor `rules/` under it exist

The `subscribeMdDir` error handler at `rulesWatcher.ts:51-59` filters by `.code`:

```ts
const code = (err as NodeJS.ErrnoException).code;
if (code === 'ENOENT' || code === 'ENOTDIR') {
  log.info(`[rulesWatcher] skipping missing dir: ${dir}`);
  return null;
}
log.warn(`[rulesWatcher] watchRecursive failed for ${dir}:`, err);
```

The `@parcel/watcher` Windows backend (`node_modules/@parcel/watcher/src/windows/WindowsBackend.cc`) uses `CreateFileW` to open the target directory handle:

```c
mDirectoryHandle = CreateFileW(
  utf8ToUtf16(watcher->mDir).data(),
  FILE_LIST_DIRECTORY, ...
);
if (mDirectoryHandle == INVALID_HANDLE_VALUE) {
  throw WatcherError("Invalid handle", mWatcher);
}
```

When the directory doesn't exist, Windows returns `INVALID_HANDLE_VALUE` and the C++ backend throws a `WatcherError("Invalid handle")`. This error is surfaced as a JavaScript `Error` with message `"Invalid handle"` — but **without a `.code` property** (unlike Node.js's `fs.*` calls which set `.code = 'ENOENT'`).

Since `(err as NodeJS.ErrnoException).code` is `undefined`, neither `'ENOENT'` nor `'ENOTDIR'` matches, and the error falls through to the `log.warn` branch at line 57, which is what Cole sees in the trace.

The guard at line 53-55 was written assuming Node.js filesystem error conventions. `@parcel/watcher`'s native Windows backend throws a different error shape for the same semantic condition.

---

## 3. Per-Hypothesis Verdict

### Hypothesis 1: Per-window setup tries to create its own watcher; Windows allows only one handle per directory — REFUTED (partially)

The core claim that "Windows only allows one watcher handle per directory" is **incorrect for ReadDirectoryChangesW** — Windows does allow multiple handles to the same directory from the same process. The actual failure is not handle contention — it is that the directories **don't exist**, so `CreateFileW` fails for every attempt. There is no concurrency constraint being violated.

The per-window multiplication claim is **CONFIRMED** — multiple renderer instances do call `startWatcher` independently, and this drives the failure count up. But the root cause is the nonexistent directories + wrong error shape, not OS handle contention.

### Hypothesis 2: Aggressive retry loop fires every X ms with no backoff — REFUTED

There is no retry loop in `subscribeMdDir` or `startRulesWatcher`. Each call to `startRulesWatcher` makes exactly one `watcher.subscribe()` call per directory (4 total). There is no setTimeout/setInterval-driven retry. The 11 attempts per path come from React effect re-firing (multiple hook instances × multiple windows × possible dev-mode double-invoke), not from retry logic.

### Hypothesis 3: Watcher singleton is missing — CONFIRMED (design intent, but has a side-effect bug)

The watcher IS designed to be a process-global singleton — `stopWatcher` at `rulesAndSkills.ts:265` is module-scoped, and calling `startWatcher` stops the old one before starting new. However, with multiple hook instances per window (2) × multiple windows (3), the IPC handler receives rapid sequential calls, each stopping the previous watcher and starting a new one. Under normal single-window conditions this works fine. With 3 windows × 2 instances = 6 sequential `startWatcher` calls during startup, the singleton is torn down and rebuilt 5 times unnecessarily.

Additionally, **the IPC call is per-renderer-mount** (not process-global or window-deduplicated) — so the singleton pattern in main is sabotaged by the fan-out from multiple renderer hook instances.

### Hypothesis 4: @parcel/watcher version-specific Windows bug — REFUTED

The version installed is `2.5.6`. The behavior — `CreateFileW` failing for nonexistent directories and throwing "Invalid handle" — is correct and expected Windows behavior. This is not a version regression. The bug is in the caller's error handling, not in the library.

### Hypothesis 5: The directory might not exist OR was deleted between check and call — CONFIRMED (primary root cause)

The two failing directories (`C:\Web App\Agent IDE\.claude\commands` and `C:\Web App\Agent IDE\.claude\rules`) do not exist. `C:\Web App\Agent IDE` is a different project directory that has no `.claude/` subtree. This is the primary root cause of the "Invalid handle" errors. The directories are legitimate watch targets (they come from a real `projectRoot` value), but this particular project has never been initialized with a `.claude/` directory.

---

## 4. Retry/Error-Handling Pattern — Why 11 Attempts, Not 1 or Infinite

There is no retry. The 11 attempts × 2 paths = 22 failures decompose as follows:

**Per watcher start attempt:** `startRulesWatcher` calls `subscribeMdDir` for each of 4 directories. For this particular project root (`C:\Web App\Agent IDE`), 2 of the 4 dirs fail: `{root}/.claude/commands` and `{root}/.claude/rules`. The home-dir variants (`~/.claude/commands`, `~/.claude/rules`) succeed if those dirs exist.

**How many start attempts are made:** In a 3-window session (Cole's trace), with each window in IDE mode running 2 `useRulesAndSkills` instances:
- 3 windows × 2 instances = 6 potential IPC calls
- In React dev mode (Vite dev server), `useEffect` fires twice per mount (StrictMode double-invoke) in development — roughly doubling the call count
- 6 base × ~2 dev-mode = ~11-12 total `startWatcher` IPC calls
- Each call fails on the same 2 paths → 11-12 × 2 = 22-24 failures

The 22 observed matches 11 × 2 exactly — consistent with 11 `startWatcher` IPC calls, each producing 2 failures (one per nonexistent directory).

Each failure is independent, instantaneous, and does not trigger any retry. After the warn-log, `subscribeMdDir` returns `null`, and the failed directory is silently skipped. The watcher still functions for the directories that DO exist.

---

## 5. Proposed Fix Shapes

Two independent fixes are needed; they are complementary, not alternatives.

### Fix A — Handle "Invalid handle" as a missing-directory signal (primary)

**Problem:** `@parcel/watcher`'s Windows backend throws `Error("Invalid handle")` for nonexistent directories, but the catch filter checks for `err.code === 'ENOENT'` which is never set by the native backend.

**Fix shape:** Extend `subscribeMdDir`'s catch handler in `rulesWatcher.ts` to also treat "Invalid handle" as a silently-skipped missing directory:

```ts
const code = (err as NodeJS.ErrnoException).code;
const message = err instanceof Error ? err.message : String(err);
const isMissingDir =
  code === 'ENOENT' || code === 'ENOTDIR' || message === 'Invalid handle';
if (isMissingDir) {
  log.info(`[rulesWatcher] skipping missing dir: ${dir}`);
  return null;
}
log.warn(`[rulesWatcher] watchRecursive failed for ${dir}:`, err);
```

Alternatively, check directory existence with `fs.existsSync` or `fs.stat` before calling `watchRecursive`, and skip with `log.info` when absent. The `fs.existsSync` approach is simpler but has a TOCTOU window; the message-match approach is immediate but string-fragile. Either is sufficient; the message-match is the tighter one-line fix.

This fix eliminates all 22 logged errors without changing watcher behavior.

### Fix B — Deduplicate `startWatcher` IPC calls per projectRoot (secondary, performance)

**Problem:** Each `useRulesAndSkills` hook instance fires `startWatcher` on mount, and with 2 instances per window × 3 windows = 6+ calls during startup. Each call tears down and rebuilds the entire watcher, which is wasteful even when the directories exist.

**Fix shape:** In the main-process IPC handler, track the current `projectRoot` being watched and skip re-setup when it matches:

```ts
let stopWatcher: (() => void) | null = null;
let activeRoot: string | null = null;

ipcMain.handle('rulesAndSkills:startWatcher', (event, projectRoot: string) => {
  const denied = assertPathAllowed(event, projectRoot);
  if (denied) return denied;
  if (activeRoot === projectRoot) return { success: true };  // idempotent
  if (stopWatcher) stopWatcher();
  stopWatcher = startRulesWatcher(projectRoot, broadcastChanged);
  activeRoot = projectRoot;
  return { success: true };
});
```

Additionally, the renderer could be updated to deduplicate at the hook level using a per-window singleton (e.g., a React context or a module-level Map keyed by projectRoot), but the main-process idempotency check is the cheaper and more robust fix.

### Fix C — Validate directory existence before watchRecursive (defense-in-depth, optional)

Add an `fs.existsSync(dir)` check in `subscribeMdDir` before calling `watchRecursive`. This would eliminate the "Invalid handle" error entirely, replacing it with the existing `log.info` "skipping missing dir" path. This is more robust than message-string matching but adds a syscall per directory on every watcher start.

---

## 6. Connection to Other Wave 18 Work

This issue is structurally identical to the pattern Wave 18's waveplan identifies as the "per-window resources where there should be global singletons" class:

- **Wave 18 1B (subprocess multiplication):** per-window resource setup instead of main-process-global
- **Wave 18 1E (duplicate event firing):** handlers registered per-window when they should fire once
- **Wave 16 P5 (inverse):** global teardown firing per-window on close

The `rulesWatcher` issue is the **setup-side** variant: a resource that should be started once globally is being started N times (once per hook instance per window per projectRoot transition). The main-process singleton exists (`stopWatcher`) but is repeatedly torn down and rebuilt by fan-out from multiple renderer mounts.

The watcher itself (`broadcastChanged → BrowserWindow.getAllWindows().forEach(win => win.webContents.send(...))`) correctly broadcasts to all windows after any single watcher fires. There is no need for per-window watchers — one process-global watcher is sufficient.

---

## 7. Phase 2+ Hand-off

An implementer needs to make two changes:

**Change 1 — `src/main/rulesAndSkills/rulesWatcher.ts` (lines 51-59):**
Extend the catch handler in `subscribeMdDir` to recognize `"Invalid handle"` as a missing-directory signal, logging at `info` level instead of `warn`. The existing `ENOENT`/`ENOTDIR` guard is already correct for Linux/macOS; this extends it for Windows.

**Change 2 — `src/main/ipc-handlers/rulesAndSkills.ts` (lines 265-276):**
Add an `activeRoot` guard to the `rulesAndSkills:startWatcher` IPC handler so re-calling with the same `projectRoot` is a no-op. This prevents the N-window × M-hook-instance fan-out from unnecessarily tearing down and rebuilding a working watcher.

**Verification:**
After Change 1: launch with a projectRoot that has no `.claude/commands` or `.claude/rules` — confirm 0 `[rulesWatcher] watchRecursive failed` log lines appear.
After Change 2: launch with 3 windows — confirm `startRulesWatcher` is called exactly once during startup (add a one-time log line or count existing log output), not 6-12 times.

**Test files to update:**
- `src/main/rulesAndSkills/rulesWatcher.test.ts` — add a test case for `subscribeMdDir` where `watchRecursive` throws `Error("Invalid handle")`, asserting it is silently skipped (returns null, no warn logged).
- `src/main/ipc-handlers/rulesAndSkills.test.ts` — add a test for the idempotent `startWatcher` behavior (calling twice with the same root only starts one watcher).

**No architectural decisions required.** Both fixes are contained within existing files and don't change any IPC contracts or inter-subsystem boundaries.
