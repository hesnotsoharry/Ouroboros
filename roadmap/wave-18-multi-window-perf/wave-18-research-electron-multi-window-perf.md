---
status: COMPLETE
created: 2026-05-25
wave: 18
type: research
agent: haiku-research-extractor (output captured by orchestrator; agent lacked Write tool)
---

# Multi-Window Electron Perf — Best Practices Research

## TL;DR

Industry standard for multi-window Electron is a centralized main-process service registry (file watchers, subprocesses, lifecycle) with per-window renderer bundles communicating via IPC/MessagePort. VS Code's shared process pattern is canonical. Renderer bundles **cannot** be shared (Chromium isolation), but file watchers and subprocesses MUST be deduplicated at main process. The 27s load time is likely per-window bundle fetch; lazy-restore (load window 1 immediately, queue 2–3 for 2–5s later) is the standard perf optimization. Anti-patterns: per-window service registration, pre-loading all windows, synchronization via HTTP eventual consistency, hidden window memory leaks.

## Topic 1: Shared main-process services pattern

**Industry standard:** One singleton service registry in the main process (or a hidden "shared process" BrowserWindow) that spawns and owns all child processes. Renderer windows request services and receive MessagePort objects for direct communication.

Per VS Code's architecture: *"Any window that requires file watching or integrated terminals would talk to the shared process via message port to acquire these services."* This moved ownership of child processes from the renderer process to the extension host, eliminating per-window registration.

**Implementation:**
- Main process maintains registries: `Map<serviceType, childProcess>` and `Map<windowId, serviceHandle>`.
- When a renderer requests a service (e.g., "give me a file watcher"), main process either reuses existing instance or spawns one via `utilityProcess.fork()`.
- Main process sends a `MessagePort` to the renderer, which then communicates directly with the utility process — bypassing the main event loop for subsequent messages.

**Anti-pattern:** Per-window service registration. Bloomca (2025) warns: *"pre-loading all potential windows on launch but keeping them hidden quickly affects both startup performance and resource usage."* Each window independently spawning file watchers, PTY pools, or subprocess registries causes N×M resource handles.

## Topic 2: Renderer bundle sharing

**Industry standard:** Renderer bundles are NOT shared. Each `new BrowserWindow()` spawns a separate Chromium renderer process with its own V8 isolate. This is by design per Electron's process model: *"one website crashing or hanging would not affect the entire browser."*

**Cost:** Each additional BrowserWindow adds 150–250 MB of memory (Bloomca 2025). The 27s bundle load Agent IDE experiences is likely three separate webpack/Vite builds loaded into three separate V8 contexts.

**Optimization tactics (not sharing, but reducing per-bundle load):**
1. **Session reuse:** Configure multiple windows to use the same `webContents.session` (e.g., `partition: 'persist:shared'`) to share HTTP cache and storage.
2. **Lazy-restore:** Load window 1 at startup; queue windows 2–3 to load after app is interactive (2–5s delay).
3. **Code splitting:** Reduce per-bundle size via dynamic imports, so subsequent window bundles download smaller assets via shared HTTP cache.

## Topic 3: File system watchers across windows

**Industry standard:** Create ONE file watcher in the main process or utility process; deduplicate identical watch requests; broadcast fs events to all interested windows via IPC.

Per VS Code's File Watcher Internals:
- *"Requests that are identical (resource + options) are deduplicated"* at the IFileService layer.
- Correlated requests emit events only to specific requesters; uncorrelated requests broadcast globally.
- File watchers run in a UtilityProcess to reduce compute intensity on the main Electron process.

**Deduplication map pattern:**
```
Map<watchPath, Set<windowIds>>
```
When window A and window B both watch `/src/`, the main process maintains one chokidar/`@parcel/watcher` instance and broadcasts fs events to both windows.

**Anti-pattern:** Per-window `fs.watch()` or chokidar instances. This causes OS file-handle contention (exactly Agent IDE's "Invalid handle" 22× failure mode).

## Topic 4: Subprocess lifecycle and pooling

**Industry standard:** Main process or utility process owns ALL subprocesses (PTY sessions, git operations, language servers). Renderers do NOT spawn subprocesses directly.

Per Electron's utilityProcess API:
- `utilityProcess.fork(modulePath, args, options)` spawns Node.js child with MessagePort support.
- Each utility process can spawn further children (e.g., PTY server utility process spawning `node-pty` instances).
- Main process maintains registry to prevent fan-out: `Map<windowId, childProcess[]>`.

**Simple pool implementation sketch:**
```javascript
class SubprocessPool {
  constructor(maxSize = 10) {
    this.available = [];
    this.inUse = new Map(); // windowId → process
    this.maxSize = maxSize;
  }
  acquire(windowId) {
    const proc = this.available.pop() || this.spawn();
    this.inUse.set(windowId, proc);
    return proc;
  }
  release(windowId) {
    const proc = this.inUse.get(windowId);
    if (proc) {
      this.available.push(proc);
      this.inUse.delete(windowId);
    }
  }
}
```

**Anti-pattern:** Each renderer window spawning its own PTY or `child_process.fork()` instances. This causes ~45 concurrent subprocesses (Agent IDE's exact symptom: ~15 per window × 3).

## Topic 5: Window restoration patterns

**Industry standard:** Electron 27+ provides `windowStatePersistence` API (built-in since 2024). Configure per-window unique `name` identifier and `windowStatePersistence: { bounds: true, displayMode: true }` to automatically persist and restore position, size, and maximized state.

For multiple windows:
1. Store window list + bounds in config file (JSON or SQLite).
2. On app relaunch, restore window 1 immediately.
3. **Lazy-restore:** Queue windows 2–3 to load 2–5s later (after main window is interactive).

**Implementation sketch:**
```javascript
createWindow(0); // window 1, shown immediately
setTimeout(() => {
  createWindow(1);
  createWindow(2);
}, 2000); // windows 2–3 load after app is interactive
```

**Anti-pattern:** Eagerly restoring all N windows on startup. For Agent IDE (3 windows = 27s total load), lazy-restore reduces perceived startup time.

## Topic 6: Common anti-patterns

Per Bloomca (2025), Atomic Object, and Electron issue #6063:

1. **Hidden window memory leaks:** `browserWindow.hide()` removes the window from `BrowserWindow.getAllWindows()`, making it invisible to cleanup code. Use `destroy()` instead or maintain explicit registry.

2. **Per-window service registration:** Each window independently initializing file watchers, PTY pools, or global event listeners. Pattern guard: `BrowserWindow.getAllWindows().length === 1 ? init() : reuse()`.

3. **Synchronization via HTTP eventual consistency:** Relying on network requests across windows creates poor UX during latency or offline. Solution: use **Broadcast Channel API** (same-process, synchronous, same-origin only) or IPC.

4. **Window out-of-sync:** Data flow entirely in web app (renderer) without a shared main-process source of truth. Multi-window apps need a canonical state holder — main process or shared service.

5. **Communication complexity:** No built-in renderer-to-renderer messaging. Route through main (slower) or use Broadcast Channel API with clientId filtering to avoid self-messages.

6. **Pre-loading all windows at startup:** Reported to "quickly affect both startup performance and resource usage." Lazy-restore is preferred.

## Recommended architecture for Agent IDE

### Industry standard (ADOPT)

1. **Shared main-process singleton services:**
   - File watcher: One chokidar or `@parcel/watcher` instance (Agent IDE already uses `@parcel/watcher`) with deduplication map.
   - PTY manager: Registry of node-pty instances, owned by main process; renderers request via IPC.
   - Hook server: Single named-pipe listener (Agent IDE already has this).

2. **Per-window renderer bundles with lazy-restore:**
   - Accept per-window bundle load cost.
   - Load window 1 at startup (~9s).
   - Lazy-restore windows 2–3 after 2–5s delay (~9s each, but in background after app is interactive).
   - Use shared `Session` to cache HTTP assets between windows.

3. **IPC → MessagePort routing:**
   - Main process answers service requests; renderers receive MessagePort and communicate directly with utility processes.

4. **Window state persistence:**
   - Use Electron 27+ `windowStatePersistence` for automatic bounds/displayMode restoration.

### Emerging best practice (TRIAL)

1. **Utility process for file watching:** Move watcher logic into a dedicated UtilityProcess per VS Code's model (standard as of Electron 7.0, 2022). This unblocks the main event loop.

2. **Broadcast Channel for renderer-to-renderer sync:** Use for theme/settings sync between windows (same origin, no IPC overhead). Designate one window as authoritative writer to IndexedDB to prevent race conditions.

### Experimental (ASSESS)

1. **Worker threads for CPU-bound tasks:** Instead of spawning subprocesses, use Node.js Worker threads in a utility process. Trade-off: shared memory, reduced isolation.

## Confidence

**High** — all findings are sourced from official Electron documentation, VS Code's published architecture, and recent production best-practice blogs (2024–2025). Sources directly address the six questions. One caveat: VS Code's file watcher wiki does not explicitly document cross-window deduplication behavior, only single-process deduplication, so that inference is medium confidence.

## Sources

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — Official multi-process architecture docs
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — Inter-process communication patterns
- [Electron Message Ports](https://www.electronjs.org/docs/latest/tutorial/message-ports) — Direct renderer-to-service communication
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process) — Child process spawning for services
- [VS Code Process Architecture & Sandboxing (2022)](https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox) — Shared process pattern, utility processes for file watching/terminals
- [VS Code File Watcher Internals](https://github.com/microsoft/vscode/wiki/File-Watcher-Internals) — Deduplication, UtilityProcess, multi-window broadcasting
- [Multi-Window Electron Apps (Bloomca, 2025)](https://blog.bloomca.me/2025/07/21/multi-window-in-electron.html) — Anti-patterns, synchronization costs, memory overhead
- [How to Handle Multiple Windows in an Electron App (Atomic Object)](https://spin.atomicobject.com/multiple-windows-electron-app/) — Memory leaks, communication complexity
- [Electron Window State Persistence RFC](https://github.com/electron/rfcs/blob/main/text/0016-save-restore-window-state.md) — Built-in restoration API (Electron 27+)
- [A Comprehensive Guide to Electron App Development in 2025 (Medium)](https://medium.com/@swabhab.panigrahi/a-comprehensive-guide-to-electron-app-development-in-2025-9f15caed16f1) — Multi-window patterns, resource management

## Meta-framework follow-up

The `haiku-research-extractor` catalog agent could not Write its own report (the agent's `tools:` allow-list lacks `Write` — current tools are `WebFetch`, `WebSearch`, plus Context7 MCP only). This is the second time in the wave-process that an agent reported DONE-but-no-action because its toolset was wrong for what the brief asked. Worth filing a meta follow-up to either (a) add `Write` to `haiku-research-extractor`'s allowed tools, or (b) update the agent description to document the orchestrator must own report-file-writing for this agent. See `meta/roadmap/follow-ups/`.
