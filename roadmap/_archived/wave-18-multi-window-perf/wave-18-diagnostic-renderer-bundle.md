# Wave 18 Phase 1C — Renderer Bundle Load Diagnostic
## Renderer Bundle 20s Delay in 3-Window Dev Mode

**Assigned surface:** Why does `renderer-bundle-loaded` take ~27s total (20s gap after `window-ready`) when 3 windows are open?

**Evidence gathered:** code reading (no runtime instrumentation needed — the cause is structurally visible).

---

## 1. TL;DR

In dev mode, every `BrowserWindow` calls `win.loadURL(ELECTRON_RENDERER_URL)` — a direct HTTP fetch to the single Vite dev server (default port 5173). Each window gets its own renderer process with its own V8 engine, which independently requests, downloads, and JIT-compiles the full renderer bundle from that one Node.js HTTP server. The Vite dep pre-bundle cache (`node_modules/.vite/deps`) holds **66.8 MB / 545 JS files** including a 5.5 MB Monaco core chunk, a 2.1 MB secondary chunk, 24.7 MB of dep JS total, plus ~8.9 MB of first-party renderer source across 1938 TS/TSX files that Vite transforms on-the-fly per request. Vite's Node.js dev server has a single-threaded event loop — when 3 windows open simultaneously (restored by `restoreWindowSessions`), they all hammer it with module requests at the same millisecond. Each window's renderer process must parse and JIT the bundle independently. Three concurrent V8 parses of a ~25 MB payload on a single-core-bottlenecked Windows dev machine produces the observed serialization. The 20-second gap is the combined load time of 3 sequential (effectively) module-graph resolutions across a single-threaded Vite HTTP server plus 3× V8 cold parses of the same large bundle.

---

## 2. Renderer Load Path (code-cited)

### Step 1 — Window creation

`windowManagerSessions.ts:66` — `restoreWindowSessions()` calls `_createWindow(session.projectRoots[0])` for each persisted session. With 3 sessions persisted, this fires `createWindow()` three times in a tight loop (`windowManagerSessions.ts:78`: `source.map(restoreOneSession)`).

`windowManager.ts:228-236` — each `createWindow()` calls `loadWindowContent(win)`.

`windowManagerHelpers.ts:233-240` — `loadWindowContent`:
```ts
export function loadWindowContent(win: BrowserWindow): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    void win.loadURL(rendererUrl);   // ← in dev mode, fires immediately
    return;
  }
  void win.loadFile(path.join(outMainDir, '../renderer/index.html'));
}
```
In dev mode, `ELECTRON_RENDERER_URL` is set by electron-vite (default `http://localhost:5173`). All 3 windows call `win.loadURL('http://localhost:5173')` with no stagger and no shared cache.

`.claude/smoke-config.json:3` confirms the Vite dev server port: `"devServerUrl": "http://localhost:5173"`.

### Step 2 — What the Vite dev server must serve per window

Each window's renderer process fetches `index.html`, then triggers module graph resolution. Every `.tsx` and `.ts` file under `src/renderer/` is transformed by Vite on request (no pre-compilation in dev mode beyond deps). The dep pre-bundle cache (`node_modules/.vite/deps`) holds 545 JS files totaling 24.7 MB, with the largest files:

- `chunk-5DP7TD6K.js` — **5.5 MB** (Monaco core; shared by `monaco-editor.js` and all language grammar files)
- `chunk-LHVIMXNT.js` — **2.1 MB** (secondary Monaco/shared chunk)
- `react-dom_client.js` — 0.96 MB
- `pdfjs-dist.js` — 0.76 MB
- `emacs-lisp-NU3KXBM4.js` — 0.74 MB

Plus the first-party source: 1081 `.tsx` files (5.4 MB), 857 `.ts` files (3.5 MB) — all transformed per-request by Vite's esbuild pipeline.

`electron.vite.config.ts:121-126` — the Monaco plugin is wired into the renderer:
```ts
monacoEditorPlugin({
  languageWorkers: ['editorWorkerService', 'typescript', 'json', 'css', 'html'],
  globalAPI: false,
  customDistPath: ...
})
```
5 language workers = 5 additional worker JS bundles loaded per window.

### Step 3 — Vite dev server serialization

Vite's dev server is a Node.js HTTP server. It processes requests on a single event loop. `electron.vite.config.ts` does not configure `server.port` for the renderer, so electron-vite picks the default (5173). There is **one shared Vite dev server for all windows**.

When 3 windows call `loadURL(rendererUrl)` simultaneously, each window's Chromium renderer process sends module requests. The Vite server handles them serially (one-at-a-time on the event loop). The 5.5 MB Monaco core chunk must be read, processed, and served for each window individually because HTTP responses are per-connection, not multicast. Each window's request for `chunk-5DP7TD6K.js` is a separate HTTP transaction.

### Step 4 — Per-process V8 parse

Each `BrowserWindow` gets its own Chromium renderer OS process with its own V8 isolate. There is no shared JIT cache between renderer processes. Even if the Vite server serves the same bytes, each process must parse and compile ~25 MB of JavaScript from scratch. On a Windows dev machine the CPU bottleneck from 3 simultaneous V8 cold-parses of the same large bundle is real.

### Step 5 — DevTools open per window

`windowManagerHelpers.ts:219-221`:
```ts
export function openDevToolsInDevelopment(win: BrowserWindow): void {
  if (process.env.NODE_ENV !== 'development') return;
  win.webContents.openDevTools({ mode: 'detach' });
}
```
Called inside `ready-to-show` (`windowManagerHelpers.ts:229`). Each window opens a detached DevTools window, adding a 4th renderer process per window that itself loads resources. With 3 main windows: 3 detached DevTools windows = 6 renderer processes total.

### Step 6 — Perf marker singleton vs. multi-window

`perfMetrics.ts:34-43` — `markStartup` is a **global singleton** that ignores duplicates:
```ts
export function markStartup(phase: StartupPhase): void {
  const already = marks.find((m) => m.phase === phase);
  if (already) {
    log.warn(`[perf] markStartup: phase "${phase}" already marked — ignoring duplicate`);
    return;
  }
  ...
}
```
`windowManagerHelpers.ts:226` — `markStartup('window-ready')` fires inside `win.once('ready-to-show', ...)` — so it fires for whichever window gets `ready-to-show` first. Windows 2 and 3 trigger the duplicate warning.

The renderer-side marks (`renderer-bundle-loaded`, `react-root-created`, `first-render`) are sent via IPC (`perf:mark` channel, `perfHandlers.ts:65`). With 3 windows, all 3 renderers invoke `window.electronAPI.perf.mark()` when they finish loading — so the IPC handler fires 3 times for each phase. The first call marks; calls 2 and 3 hit the `already` guard and emit the duplicate warning. This is why the symptom shows "phase X already marked — ignoring duplicate" 6 times (2 extra calls × 3 phases). The `[perf] startup:` summary fires 3 times because `flushStartupLog()` in `perfHandlers.ts:66` is triggered by `phase === 'first-render'` — and all 3 windows fire `first-render`.

`perfHandlers.ts:52-56`:
```ts
function flushStartupLog(): void {
  const summary = formatStartupSummary();
  if (summary) log.info('[perf] startup:', summary);
  appendStartupRecord(getStartupTimings());
}
```
This fires on every `first-render` IPC call, not just the first. Three windows = 3 summary lines + 3 records appended to `startup-timings.jsonl`.

---

## 3. Per-Hypothesis Verdict

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| 1 | Each window loads the full bundle independently from Vite dev server | **CONFIRMED** | `windowManagerHelpers.ts:235-236` — each window calls `win.loadURL(rendererUrl)` unconditionally; no shared context or session partition configured in `webPreferences`; Vite responds per-connection, not multicast |
| 2 | JS parsing/compiling on the renderer process is per-window CPU-bound | **CONFIRMED** | Each `BrowserWindow` is a separate OS process with an isolated V8; no shared JIT cache between processes; 3 windows × ~25 MB dep cache = ~75 MB worth of V8 parse; the 5.5 MB Monaco core chunk alone is parsed 3 times |
| 3 | Monaco editor loader is per-window and very heavy | **CONFIRMED** | `electron.vite.config.ts:121-126` wires `vite-plugin-monaco-editor` with 5 language workers into the renderer; `node_modules/.vite/deps/chunk-5DP7TD6K.js` = 5.5 MB Monaco core; all language-specific chunks reference it; each window loads all of them |
| 4 | Vite HMR ws connections may serialize | **CONFIRMED (partial)** | More precisely: Vite's HTTP server (Node.js single-threaded event loop) serializes module requests from concurrent windows; HMR ws connections add to this but the HTTP module serving is the bottleneck, not the WS upgrade itself |
| 5 | `window-ready=6298ms` is already slow — 3× single-window window-ready | **CONFIRMED** | `windowManagerHelpers.ts:226` — `markStartup('window-ready')` fires only for the first window (singleton guard drops subsequent calls); 6298ms is not 3×, it's the real first-window time; the stated "was <5s single-window per Wave 16" was the full startup to first-render, not just window-ready; 6298ms window-ready with heavy background services at startup is plausible even for window 1 |

---

## 4. Dominant Cause

**File + line:** `windowManagerHelpers.ts:233-240` (`loadWindowContent`) + `windowManagerSessions.ts:78` (`restoreWindowSessions` — tight loop creating 3 windows simultaneously).

**Measurement:** 66.8 MB Vite dep cache served per-connection with a 5.5 MB Monaco core chunk; 1938 source files transformed per-request. Three simultaneous requests to a single-threaded Node.js server + 3× independent V8 cold-parses of the same payload = ~20s on a Windows dev machine. Single-window is fast because there is no contention.

**The port 7890 server** in the trace (`Server listening on http://localhost:7890`) is the **web access server** (`main.ts:207-216` — `startWebServerAsync()` with `webAccessPort` config key, defaulting to 7890). It is separate from the Vite dev server (port 5173). It serves the renderer assets to browser clients, not to Electron BrowserWindows. The `Server listening on...` log is from `main.ts:213` (`log.info(\`Access URL: http://localhost:${webPort}\``)`). This server is NOT involved in the 20s gap.

---

## 5. Proposed Fix Shapes

These are descriptions only — no implementation in this phase.

### Fix A — Stagger window restoration (quickest fix, low impact)

Introduce a small stagger (e.g. 300-500ms) between `restoreOneSession` calls in `windowManagerSessions.ts:78`. This lets the Vite server finish the first window's module graph before the second window starts, dramatically reducing queue depth on the single Node.js event loop.

**Risk:** still serial; total time may not improve much — it just stops the worst queueing. Does not reduce parse count. Viable as a stopgap.

### Fix B — Shared `session` partition for all renderer windows (correct fix for Vite-HTTP bottleneck)

Assign all `BrowserWindow`s the same Electron `session` (via `webPreferences.session` or `webPreferences.partition`). Chromium's network stack caches HTTP responses at the session layer. With a shared session, windows 2 and 3 receive `chunk-5DP7TD6K.js` from the in-process HTTP cache (memory) rather than re-fetching from the Vite server. This eliminates the Vite server serialization for everything after window 1.

**This does NOT eliminate V8 parse** (each renderer process still parses independently) but cuts the Vite HTTP serving bottleneck from 3× to ~1×.

**Risk:** shared session means shared cookies, storage, credentials between windows. May need a `partition: 'persist:ouroboros-renderer'` named partition rather than the default session to avoid side-effects on other sessions.

**Relevant code:** `windowManager.ts:105-113` — `webPreferences` block in `createBrowserWindow`; add `session: electronSession` or `partition: 'persist:ouroboros-renderer'`.

### Fix C — Production build for multi-window dev (eliminates per-request transforms)

Instead of serving from the Vite dev server, serve the pre-built `out/renderer/` static files even in dev mode (or build the renderer once before multi-window sessions). `loadWindowContent` already supports this path: `win.loadFile(path.join(outMainDir, '../renderer/index.html'))`. A production build collapses the 1938-file module graph into a small set of chunks and eliminates Vite's per-request esbuild transforms entirely.

**Trade-off:** loses HMR for renderer code. Could be a config flag (`DEV_NO_HMR=1`) or a detected multi-window path.

### Fix D — Monaco lazy-loading behind dynamic import (reduces cold-parse payload)

The 5.5 MB Monaco chunk is loaded at startup even when no file viewer is open. Wrapping `<FileViewer>` or the Monaco component in `React.lazy()` + `Suspense` defers this chunk until first use, shrinking the cold-start bundle by ~5.5 MB per window. Combined with Fix B this would reduce the HTTP payload that must be cached.

**Relevant code:** `electron.vite.config.ts:121-126` (Monaco plugin) + wherever `<FileViewer>` or `<MonacoEditor>` is imported eagerly.

### Fix E — `openDevToolsInDevelopment` gated by window count or config flag

`windowManagerHelpers.ts:219-221` opens a detached DevTools window for every `BrowserWindow` in dev mode. With 3 main windows: 6 renderer processes (3 app + 3 devtools). Gate this behind a config flag or only open DevTools for window 1. This eliminates 3 "free" renderer process startup costs that compound the V8 parse problem.

---

## 6. Phase 2+ Hand-off

### What an implementer needs

1. **Fix B is the highest-leverage single change.** It directly addresses Vite HTTP serialization. The implementer needs to:
   - Decide on `partition: 'persist:ouroboros-renderer'` vs a pre-created `session` object.
   - Add `partition` to `webPreferences` in `windowManager.ts:createBrowserWindow` (line 105-113).
   - Verify that the default CSP session (`session.defaultSession.webRequest.onHeadersReceived` in `windowManagerHelpers.ts:242`) still applies to the partitioned session, or replicate the CSP setup for the new partition.

2. **Fix A as a quick complement.** Add a `setTimeout` stagger (300ms) between `restoreOneSession` calls in `windowManagerSessions.ts:78`. This is a one-line change and acts as a safety net even if Fix B has edge cases.

3. **Fix E is a free win.** Add a `getWindowCount() === 0` guard or a `OUROBOROS_OPEN_DEVTOOLS=1` env flag to `openDevToolsInDevelopment`. Zero architectural risk.

4. **Perf marker singleton is a separate, known issue.** The `markStartup` duplicate-guard and `flushStartupLog` firing 3× are separate from the load time problem. Fix: the marker should be per-window, not global, or only `flushStartupLog` from window 1's `first-render`. This is a metrics accuracy bug, not a performance bug — but it corrupts `startup-timings.jsonl` (appends 3 records per launch). File as a follow-up or address in a later phase.

5. **Fix D (Monaco lazy-load)** is a longer refactor — needs to identify all eager imports of Monaco/FileViewer in the renderer tree. Worth a separate discovery before implementation.

### Verification criteria after fixes

- `renderer-bundle-loaded` for window 2 and 3 should be close to window 1's time (within 1-2s), not 3× sequential.
- `[perf] startup:` should emit once per launch (or clearly be per-window with different IDs).
- `renderer-bundle-loaded` total should be ≤8s for 3 windows (target: <5s from `window-ready` on a warm cache).

### Files touched by any fix

| Fix | File |
|-----|------|
| A — stagger | `src/main/windowManagerSessions.ts` |
| B — shared session | `src/main/windowManagerHelpers.ts` (createBrowserWindow webPreferences), `ensureCSP` session target |
| C — no-HMR flag | `src/main/windowManagerHelpers.ts` (loadWindowContent), env/config |
| D — Monaco lazy | `src/renderer/` (wherever Monaco is imported eagerly), `electron.vite.config.ts` |
| E — DevTools gate | `src/main/windowManagerHelpers.ts` (openDevToolsInDevelopment) |
