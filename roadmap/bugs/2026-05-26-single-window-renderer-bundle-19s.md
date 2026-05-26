---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
---

# Bug: Single-window renderer bundle 19s cold-start (window-ready to renderer-bundle-loaded)

Trace: app-ready=236ms ipc-ready=6268ms services-ready=6586ms window-ready=7048ms renderer-bundle-loaded=26097ms react-root-created=26097ms first-render=26172ms
Observed: 2026-05-26 00:18-00:20, post-Wave-18 W2 (commit 524b7fa2).

---

## 1. TL;DR

The 19s gap between window-ready (7s) and renderer-bundle-loaded (26s) is Chromium downloading and V8-parsing approximately 25 MB of Vite-pre-bundled JavaScript from the dev server on a cold HTTP cache. The Vite dep cache contains 549 pre-bundled JS files totalling 24.7 MB -- dominated by Monaco editor (chunk-5DP7TD6K.js at 5.7 MB + chunk-LHVIMXNT.js at 2.2 MB + monaco-editor.js at 169 KB), pdfjs-dist.js (796 KB), Shiki oniguruma WASM inlined as base64 in wasm-4HOA73UW.js (622 KB), and approximately 250 Shiki language grammar chunks. All of Monaco and pdfjs are in the eager module graph -- they are statically imported into FileViewer.tsx, which is statically imported by EditorContent.tsx with no lazy-load boundary. On first run with the new persist:shared partition (introduced in 524b7fa2) there is no HTTP cache; Chromium fetches all 24.7 MB from the Vite dev server, then V8 parses it -- on Windows this takes 18-20s. On warm runs the overhead drops dramatically. Wave-18 W2 correctly addresses multi-window via HTTP cache sharing, but the cold-start first-window penalty was pre-existing and remains.

---

## 2. Single-window load path

BrowserWindow.loadURL (windowManagerHelpers.ts loadWindowContent line 235) fires ELECTRON_RENDERER_URL (http://localhost:5173) into the persist:shared partition (windowManager.ts createBrowserWindow line 116). Chromium fetches index.html, parses the module script, triggers Vite module-graph walk.

Static import chain:

- src/renderer/index.tsx
- -> App.tsx -> App.helpers.tsx
- -> InnerAppLayout.tsx (line 16: import FileViewerManager from ../FileViewer barrel)
- -> EditorContent.tsx (line 7: import FileViewer, useFileViewerManager from ../FileViewer barrel)
- -> FileViewer/index.ts barrel (line 38: export MonacoEditor from ./MonacoEditor)
- -> MonacoEditor.tsx (line 1: import * as monaco from monaco-editor)  -- 7.9 MB eager load

Also:
- FileViewer.tsx (line 13: import PdfViewer from ./PdfViewer)
- -> PdfViewer.tsx (line 2: import * as pdfjsLib from pdfjs-dist)  -- 796 KB eager load

The renderer-bundle-loaded mark (index.tsx line 132) fires as the very first statement of bootstrapApp(), before createRoot. It captures the moment all static imports have resolved -- all of Monaco plus pdfjs plus transitive deps have been fetched and V8-parsed. window-ready marks the Electron ready-to-show event (windowManagerHelpers.ts setupReadyToShow line 226). The 19s gap is entirely Chromium HTTP fetch plus V8 parse time.

---

## 3. What markers exist (or are missing) between window-ready and renderer-bundle-loaded?

Currently: none. The 19s is a black box from main-process perspective. Proposed additions via window.electronAPI.perf.mark:

- renderer-html-received: index.html inline script (first code to execute) -- isolates Chromium to Vite HTTP latency for HTML
- renderer-dom-content-loaded: DOMContentLoaded listener in index.html inline script -- initial HTML parse complete

Most actionable for future instrumentation: add a PerformanceObserver for resource timing entries at the start of bootstrapApp(), log the 10 slowest fetched JS files by duration. This would directly name the slow chunks without guessing.

---

## 4. Per-hypothesis verdict

H1 (1C blamed multi-window incorrectly; single-window also has this cost): CONFIRMED. The 1C diagnostic worked from a 3-window trace and never measured a single-window baseline. The cold-cache single-window cost is independent of window count.

H2 (Vite optimizeDeps cold-start): REFUTED for current state. Commit 83d227d7 (2026-04-20) changed optimizeDeps.force from always-true to opt-in via FORCE_OPTIMIZE_DEPS=1. electron.vite.config.ts line 145 confirms this. Normal npm run dev does NOT re-bundle every start. The pre-bundle itself (24.7 MB already on disk in node_modules/.vite/deps/) is the persisting cost -- Vite serves it over HTTP on every cold partition start. Note: this was previously a 20-30s cost (per commit 83d227d7) and is now resolved for warm invocations.

H3 (Monaco worker setup): PARTIALLY CONFIRMED, does not explain the 19s alone. Workers spawn lazily after Monaco instantiates and do not block module loading. The primary Monaco cost is the static import in MonacoEditor.tsx line 1, which forces V8 to parse chunk-5DP7TD6K.js (5.7 MB) plus chunk-LHVIMXNT.js (2.2 MB) synchronously before bootstrapApp fires.

H4 (partition persist:shared introduces overhead): CONFIRMED for first-run cold start; REFUTED as a recurring regression. The 00:18 trace was taken approximately 8 minutes after the W2 commit (00:09:34), meaning the shared partition was brand-new with a cold or near-empty HTTP cache. Chromium partition creation is one-time sub-second overhead; the 19s is HTTP cache miss on 24.7 MB of JS. The partition now contains 44 MB of HTTP cache data; subsequent cold starts should be much faster.

H5 (renderer bundle size grown substantially): CONFIRMED as underlying condition. 549 pre-bundled JS files at 24.7 MB. Largest: chunk-5DP7TD6K.js (5.7 MB Monaco core), chunk-LHVIMXNT.js (2.2 MB Monaco secondary), react-dom_client.js (1 MB), pdfjs-dist.js (796 KB), wasm-4HOA73UW.js (622 KB Shiki WASM base64), zod.js (466 KB), approximately 250 Shiki language chunks, @xterm/xterm.js (431 KB), monaco-vim.js (431 KB).

H6 (synchronous renderer-side init): REFUTED as dominant cost. renderer-bundle-loaded fires as the first statement of bootstrapApp (index.tsx line 132), before createRoot. react-root-created equals renderer-bundle-loaded at 26097ms; React init is near-zero. The gap is module loading, not React.

H7 (tree-sitter WASM init in renderer): REFUTED. No tree-sitter imports exist anywhere under src/renderer/. Tree-sitter is confined to src/main/codebaseGraph/.

H8 (DevTools/extensions loading): REFUTED. Trace shows 0 extensions. openDevToolsInDevelopment fires after window-ready and is async; it does not block renderer module loading.

---

## 5. Re-evaluation of the 1C diagnostic

The 1C diagnostic was correct for multi-window but over-generalized by omitting any single-window baseline. Its proposed cause (Vite HTTP serialization plus per-window cache isolation) is real, and the partition fix correctly addresses window-2+ loading cost.

Where 1C erred: it implied the fix would meet the Wave 16 HANDOFF goal of less than 5s. That goal was set under different conditions (smaller bundle, or warm-cache measurement). The 1C diagnostic never addressed cold-cache single-window cost because it had no single-window data point. The current 26s trace is single-window cold-cache -- outside 1C scope entirely. The two costs are additive: 1C fixed the multi-window serialization cost; the single-window cold-cache cost remains and was always there.

---

## 6. Dominant single-window blocker

src/renderer/components/FileViewer/ContentRouter.tsx line 18 -- static import of MonacoEditorHost which causes MonacoEditor.tsx line 1 to do import * as monaco from monaco-editor (approximately 7.9 MB V8 parse, approximately 8 MB HTTP).

Combined with: src/renderer/components/FileViewer/FileViewer.tsx line 13 -- static import of PdfViewer.tsx line 2 doing import * as pdfjsLib from pdfjs-dist (approximately 796 KB HTTP).

Both libraries are dragged into the eager module graph, fetched and V8-parsed before the user sees any UI. Neither is used until the user opens a file.

---

## 7. Proposed fix shapes (DO NOT IMPLEMENT -- ranked by impact + ease)

Fix A: Lazy-load MonacoEditorHost, MonacoDiffEditor, and PdfViewer (HIGH impact, MEDIUM effort)

Convert ContentRouter.tsx lines 15 and 18 direct imports to React.lazy() with Suspense fallback (LazyPanelFallback). Convert FileViewer.tsx line 13 PdfViewer import to React.lazy. Monaco loads only when user opens a file; pdfjs loads only for PDF files. Estimated cold-start improvement: 12-16s reduction in renderer-bundle-loaded.

Note: src/renderer/components/Workbench/CLAUDE.md lines 190-191 already documents this exact hazard ("FileViewer statically pulls Monaco + pdfjs, whose module-init touches browser APIs jsdom lacks") and its mitigation for the Workbench shell (lazy-loading FileViewer itself from Workbench). ContentRouter needs the same solution applied one level deeper.

Fix B: Remove Monaco/pdfjs re-exports from the FileViewer barrel (MEDIUM impact, LOW effort, prerequisite for A)

src/renderer/components/FileViewer/index.ts lines 35-44 re-export MonacoEditor, MonacoEditorHost, MonacoDiffEditor, disposeMonacoModel, disposeMonacoHostModel, registerInlineCompletionProvider, KeybindingMode, disableVimMode, enableVimMode. Any consumer importing ANY name from the ../FileViewer barrel pulls in all exports and their module-level side effects. Removing these from the barrel stops it from being an eager-load trigger. Consumers import directly from per-source files.

Fix C: optimizeDeps.exclude for monaco-editor and pdfjs-dist (LOW impact standalone, HIGH impact after A+B)

Add optimizeDeps.exclude: [monaco-editor, pdfjs-dist] to the renderer section of electron.vite.config.ts. Prevents Vite from pre-bundling these libraries. Only effective after Fix A+B; otherwise Monaco is still eagerly fetched as many raw ESM files rather than pre-bundled chunks.

Fix D: V8 code cache (LOW incremental impact)

The shared partition Code Cache/js/ exists at 1.8 MB -- Chromium is already writing bytecode. This reduces parse time on warm runs but does not reduce HTTP transfer on cold start. Not the primary fix.

---

## 8. Phase 2+ hand-off

For Fix A (recommended):

1. src/renderer/components/FileViewer/ContentRouter.tsx: Replace static imports of MonacoEditorHost (line 18) and MonacoDiffEditor (line 15) with React.lazy(). Wrap their render sites in Suspense with LazyPanelFallback.

2. src/renderer/components/FileViewer/FileViewer.tsx: Replace the PdfViewer import (line 13) with React.lazy. Wrap the PdfViewer render site in Suspense.

3. src/renderer/components/FileViewer/index.ts: Remove re-exports of MonacoEditor, MonacoEditorHost, disposeMonacoModel, disposeMonacoHostModel, MonacoDiffEditor, registerInlineCompletionProvider, KeybindingMode, disableVimMode, enableVimMode (lines 35-44) from the barrel. Consumers import these directly from their source file.

4. Gates: run ANALYZE=true npm run build and verify Monaco does not appear in the eagerly-loaded initial chunk. Run test:layout, test:filetree, test:renderer scoped tests.

5. Verification protocol: delete the Partitions/shared directory under the Electron userData path (on Windows: %APPDATA%\ouroboros\Partitions\shared\) to force cold HTTP cache, run npm run dev, check [perf] startup: log line. Target: renderer-bundle-loaded under 8000ms.

6. Warm-run note: Cole next run after W2 partition is warm (44 MB HTTP cache is populated). The 26s is a cold-cache first-run anomaly. Fix A is still valuable for: first install, branch switches that change the lockfile hash (causing Vite to re-run optimizeDeps), and CI environments.
