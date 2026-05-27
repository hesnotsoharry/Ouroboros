---
status: SHIPPED
created: 2026-05-26
updated: 2026-05-27
wave: 22
type: substantive
predecessor: wave-21-ouroboros-graph-tier-2
---

# Wave 22 — Ouroboros Codebase Graph: Standalone MCP Server Extraction — RESULT

## What shipped

The Ouroboros codebase graph subsystem was extracted from `src/main/codebaseGraph/` into a new monorepo subpackage at `packages/codebase-graph-mcp/`, distributed as `@hesnotsoharry/codebase-graph-mcp` and consumable via stdio MCP from any Claude Code session in any project (not just inside Agent IDE). The in-IDE graph subsystem and its consumer chain were deleted; the IDE's `internalMcp/` auto-inject was rewired to point at the new package.

### Phase 1 — Walking-skeleton npm package

Files added under `packages/codebase-graph-mcp/`:
- `package.json` — `name: "@hesnotsoharry/codebase-graph-mcp"`, `type: "module"`, `bin`, `engines.node: ">=20.0.0"`, deps on `@modelcontextprotocol/sdk@^1.29.0` + `zod@^3.25.0`.
- `tsconfig.json` — emit to `dist/`.
- `src/index.ts` — stdio MCP server with a `ping` health-check tool.
- `vitest.config.ts`.
- `README.md` — consumption pattern.
- Orchestrator-authored acceptance test at `tests/walking-skeleton.smoke.test.ts` — spawns compiled server, asserts MCP handshake + `ping` returns `pong`.

Plus `.mcp.json` at the worktree root pointing Claude Code at the local `dist/index.js`.

### Phase 2 — Deletion blueprint (architect deliverable)

`roadmap/wave-22-graph-standalone-mcp/wave-22-architect-deletion-blueprint.md` (434 lines) — read-only blueprint enumerating DELETE / MODIFY / KEEP classifications for every file under `src/main/codebaseGraph/` + the consumer chain in `contextLayer/`, plus the 12 disappearing `graph:*` IPC channels, the renderer-side caller list, and a 29-step ordered migration sequence. Flagged 6 verification gaps for Phase 5 pre-flight.

### Phase 3 — Code migration into package with IDE deps stripped

110 source files mirrored from `src/main/codebaseGraph/` to `packages/codebase-graph-mcp/src/` with IDE-specific dependencies stripped:
- `import log from '../logger'` → injected `Logger` interface (new `loggerInterface.ts` with default `consoleErrorLogger`).
- `graphDatabaseHelpers.ts` `require('electron')` → `getDbPath` constructor parameter on `GraphDatabase`.
- Singleton imports → constructor parameters on consuming classes (`IndexingWorkerClient`, `AutoSyncWatcher`, `GraphGc`).
- `gitCoChangePass.ts` `'../../util/gitExec'` → local `gitExec.ts` using `child_process.spawn` directly.
- `internalMcpTypes` import → new local `types.ts` defining `McpToolDefinition` + `McpToolResult` + `textResult`.
- `systemTwoRegistry.ts` uses `@parcel/watcher` directly (vs the IDE's wrapper).
- Three new bridge files: `loggerInterface.ts`, `types.ts`, `gitExec.ts`.

6 runtime dependencies added: `@node-rs/xxhash`, `@parcel/watcher`, `@vscode/tree-sitter-wasm`, `better-sqlite3@^12.x`, `tree-sitter-wasms`, `web-tree-sitter`. Per `research-22.md`, `better-sqlite3@^12.x` ships prebuilts for Node 22.x LTS on Windows/macOS/Linux — no node-gyp rebuild needed.

Original `src/main/codebaseGraph/` left untouched in this phase (Phase 5 deletes it).

**One self-fix during Phase 3:** the migrated codebaseGraph barrel `index.ts` collided with the Phase 1 walking-skeleton entry. Renamed migrated barrel → `lib.ts`, restored Phase 1 entry at `src/index.ts`. Walking-skeleton smoke green after recovery (commit `bdf1eb0b`).

### Phase 4 — Wire full MCP tool surface

`src/index.ts` parses `--root <path>` CLI arg. New `src/serverBootstrap.ts` (101 lines):
- `buildDbPath(rootPath)` — derives storage path via SHA256(rootPath).slice(0,8) under `~/.ouroboros-graph/<hash>/graph.db`.
- `buildContext(rootPath, dbPath)` — wires `GraphDatabase`, `QueryEngine`, `CypherEngine`, `IndexingWorkerClient` with constructor injection + lazy `parser.init()` shim (deferred to first `index()` call to avoid blocking server boot).
- `registerGraphTools(server, context, rootPath)` — iterates `createGraphMcpTools(context)` from the migrated `mcpToolHandlers.ts`, registers each via `server.registerTool` with `z.object({}).passthrough()` schema. Logs `[trace:graph-mcp.tool.<name>] called` per invocation via `console.error`.

15 tools advertised: `index_repository`, `list_projects`, `delete_project`, `index_status`, `search_graph`, `get_architecture`, `search_code`, `get_code_snippet`, `trace_call_path`, `detect_changes`, `query_graph`, `manage_adr`, `ingest_traces`, `get_graph_schema`, `ping`.

Post-build `scripts/fix-extensions.mjs` rewrites relative imports in `dist/` to add `.js` extensions (Node ESM requirement; TS with `"module": "ESNext"` emits extensionless).

`treeSitterParser.ts` modified for `createRequire(import.meta.url)` ESM compatibility (package copy only; IDE original untouched in this phase).

Orchestrator-authored acceptance test at `tests/tool-surface.acceptance.test.ts` — spawns server against a 2-file TS fixture (`tests/acceptance-fixture/{greeter.ts, inventory.ts}`), asserts all 6 named contract tools surface AND respond with discriminating content. 7/7 green.

### Phase 5 — Delete in-IDE graph + consumer chain

`src/main/codebaseGraph/` (~110 files) deleted. Plus:
- `src/main/contextLayer/repoMap*` (5 files) + `contextInjector*` (2 files) + `repoMapWorkerQueryClient.ts` (architect's naming-grep miss).
- `src/main/mainStartupContextLayerTrigger.ts`, `mainStartupGraph.ts`, `orchestration/graphSummaryBuilder.ts`.
- `src/standalone/ouroborosMcp/` — the pre-Wave-22 in-tree standalone path (executor scope expansion; dead code after `codebaseGraph/` deletion; in-scope per wave plan §Context).

12 `graph:*` IPC channels removed from `mobileAccess/channelCatalog.desktopOnly.ts`; `window.electronAPI.graph` removed from typed surface in `electron-workspace.d.ts`; `src/preload/preloadSupplementalGraphApis.ts` deleted. GraphPanel renderer components retain stale `electronAPI.graph` references — accepted Wave 100 breakage per Decision 4 A2.

**Scope expansion mid-Phase:** the architect's blueprint MODIFY list missed ~12 cross-cutting graph consumers. The executor halted (per migration-executor doctrine — "leave codebase buildable at every step"). Orchestrator dispatched `haiku-explorer` diagnostic confirming 3 of the 4 suspected subsystems (agentConflict, embeddings, flowTracer) were behaviorally vestigial — wired into main but no renderer caller — and the rest (agentChat*, graphSummaryBuilder, contextSelectorScoring) were live-but-Cole-doesn't-use-chat. Cole picked **Path A (stay scoped)**: extend MODIFY list to strip graph imports from all 15+ consumers; preserve their file structure; do not absorb Wave 100's chat-infrastructure removal. Documented mid-wave at `wave-22-decisions.md` and the executor's continuation brief.

Files MODIFIED to compile-after-graph-deletion (strip graph imports, preserve non-graph behavior):
- `src/main/main.ts`, `windowManager.ts`, `mainShutdown.ts`, `hooksLifecycleHandlers.ts`, `hooksSessionHandlers.ts`.
- `src/main/orchestration/contextPacketBuilder.ts`, `contextSelectorScoring.ts`.
- `src/main/ipc-handlers/{config.ts, gitOperations.ts, filesHelpers.ts, agentChatContext.ts, agentChatOrchestration.ts}`.
- `src/main/agentConflict/conflictMonitor.ts` + `conflictMonitorSupport.ts` (graph paths stub to no-op).
- `src/main/embeddings/{embeddingChunker.ts, embeddingIndexer.ts}` (replaced `GraphNode` type imports with local stub).
- `src/main/flowTracer/{canonicalFlows.ts, nlResolver.ts, traceEngine.ts}` (graph paths throw/return-empty — vestigial subsystem; preserves source for future revival).
- `src/main/contextLayer/contextLayerController.ts` (enrichPacket downgrades to pass-through).
- `src/main/configAppTypes.ts`, `configSchemaTail.ts` — removed `codebaseGraph` settings keys.
- `electron.vite.config.ts` — removed 3 deleted build entry points (`indexingWorker`, `repoMapWorker`, `ouroborosMcp`).

`sonnet-phase-reviewer` verdict: FLAG-WITH-FOLLOWUPS. Two action items resolved inline: (a) self-fix the `useSymbolDisambiguation.ts:55` `_bareName` rename to prevent Phase 8 lint failure; (b) filed `2026-05-26-internalmcp-rewire-to-standalone-package.md` promoting the IDE's stale `out/main/ouroborosMcp.js` injection to Phase 6 scope.

### Phase 6 — Cross-project smoke + per-project `.mcp.json` install + internalMcp rewire

**`.mcp.json` installed in 3 projects** (the 4th — meta workspace — filed as cross-boundary follow-up):
- `C:/Web App/AgentIDE/.worktrees/wave-22-graph-standalone-mcp/.mcp.json` (worktree; from Phase 1).
- `C:/Web App/ContractorApp/.mcp.json` — added `ouroboros` entry; preserved 3 existing entries (arcflow-context, context7, codebase-memory-mcp).
- `C:/Web App/Gamify/.mcp.json` — added `ouroboros` entry; preserved `maestro`.

**`src/main/internalMcp/` rewired** to inject the new package path:
- `index.ts` — `resolvePackageEntry()` walks `out/main/ → repo root → packages/codebase-graph-mcp/dist/index.js`.
- `internalMcpAutoInject.ts` — `buildOuroborosEntry` uses `command: 'node'`, `args: [scriptPath, '--root', projectRoot]`, dropped `ELECTRON_RUN_AS_NODE` env (new package compiles `better-sqlite3` against system Node ABI, not Electron's).
- `orchestration/providers/scopedMcpConfig.ts` — same new entry shape; reads `defaultProjectRoot` from config for `--root`.
- 5 test files updated (4 codemode tests + `internalMcpAutoInject.test.ts` + `scopedMcpConfig.test.ts`) — all green.

**Cross-project smoke** via `packages/codebase-graph-mcp/scripts/smoke-probe.mjs` (committed):

| Project | initialize | tools/list | index_repository | search_graph | index_status | Nodes | Edges |
|---|---|---|---|---|---|---|---|
| Agent IDE (worktree) | 413ms | 2ms (15) | 31.8s cold | 23ms (`ChatOrchestrationBridge`) | 42ms | 25,790 | 55,746 |
| ContractorApp | 321ms | 2ms (15) | 16.6s cold → 338ms incr | 16ms (`App`) | 19ms | 16,855 | 32,197 |
| Gamify | 353ms | 3ms (15) | 4.4s cold | 7ms (`App`) | 6ms | 3,510 | 4,337 |

Total cross-project indexing wall-clock: ~36s. Decision 5 relief valve (4hr cap) not triggered.

**Bug self-fix during smoke:** `serverBootstrap.ts:61` derived `projectName` via raw `path.basename(rootPath)` but `IndexingPipeline.index()` normalized via `path.basename(...).toLowerCase().replace(/[^a-z0-9-]/g, '-')`. On projects with uppercase letters (ContractorApp, AgentIDE), indexer wrote rows tagged `contractorapp` but QueryEngine filtered by `ContractorApp` and returned zero rows for every tool call. The wave's own acceptance tests didn't catch this — the worktree directory is `wave-22-graph-standalone-mcp` (already lowercase). Self-fixed in commit `78173b64`. Reproduced and verified by re-running cross-project smoke after the fix.

Smoke report at `roadmap/wave-22-graph-standalone-mcp/wave-22-smoke-report.md`.

### Phase 7 — Documentation + meta-side handoff

- `roadmap/docs/standalone-mcp.md` (new) — package architecture, consumption pattern, 15-tool list with one-line descriptions, storage layout, debugging tips, ABI rebuild path, cross-project install recipe, known limitations.
- Root `CLAUDE.md` "Codebase Graph" section rewritten — in-IDE graph is GONE; new pattern is `.mcp.json` per project + `mcp__ouroboros__*` tools in fresh Claude Code sessions; capability regression documented.
- Root `CLAUDE.md` "Folder Map" — removed `codebaseGraph/` entry; updated `contextLayer/` (repoMap+contextInjector gone; module-detection + summarization survive); added `packages/codebase-graph-mcp/`.
- Root `CLAUDE.md` "Known Issues / Tech Debt" — removed Wave 21 PageRank convergence item (in-IDE graph gone); added Wave 22 items.
- Root `CLAUDE.md` scoped scripts table — replaced `test:codebasegraph` with `test:codebase-graph-mcp`.
- Root `CLAUDE.md` "Further Reading" — added link to new `standalone-mcp.md` doc.
- `graph-tool-routing.md` path corrected from `rules/` to `rules-deferred/` (cold-loaded since Wave M-10).
- Meta-side follow-up filed at `C:/Web App/meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md` per the project-meta boundary (untracked in meta repo; next meta session commits it).

### Phase 8 — Wave wrap

- `npm run test:codebase-graph-mcp` — **751 passed**, 3 skipped, 0 failures (51 files).
- `npm run test:main` — **5,729 passed**, 1 failed (pre-existing `channelCatalogCoverage` — see Follow-ups), 2 skipped. 184s.
- `npx tsc --noEmit` — clean.
- `npm run build` — main + preload PASS. Renderer pre-existing fail on missing `src/renderer/generated/changelog` import (not Wave 22).
- `npm run lint` — initially 20 errors (all `no-unused-vars` from Phase 5 graph-strip dangling identifiers); fixed inline via dispatched `sonnet-implementer` to 0 errors / 5 unrelated warnings.
- `npm pack` from package — `hesnotsoharry-codebase-graph-mcp-0.1.0.tgz` (349.5 kB compressed, 1.9 MB unpacked, 470 files).
- `npm publish` attempted per Decision 7 — failed with E404 (scope not registered or not authenticated). Filed as follow-up `2026-05-26-codebase-graph-mcp-npm-publish.md` per Decision 7's fail-soft path.

## What didn't ship (per wave plan §Out of scope)

- **Restoring context injection for terminal sessions via loopback** — Decision 4 A2 explicitly accepted this capability loss.
- **Native `tree-sitter` Node bindings** — Decision 3 kept `web-tree-sitter` + WASM for ecosystem breadth; perf upgrade is a separate future wave.
- **Public npm publication** — attempted; failed soft; follow-up filed (Decision 7 path).
- **Meta-side `mcpServers` install** — project-meta boundary; deferred to next meta session.
- **Wave 100's chat-infrastructure removal** — surfaced during Phase 5 scope expansion; Cole chose Path A (stay scoped), so `AgentChat/*`, `ChatOnlyShell/*`, etc. remain in tree, graph-stripped.
- **Asar packaging for packaged Electron builds** — filed as `2026-05-27-internalmcp-asar-packaging.md`. Current path-based `.mcp.json` install works in dev; packaged builds need `extraResources`/`asarUnpack`.
- **`fix-extensions.mjs` dynamic-import regex coverage** — filed as `2026-05-26-fix-extensions-mjs-dynamic-imports.md`. Latent; not triggered by current import graph.

## Lost capabilities

**Terminal Claude Code sessions running INSIDE the IDE no longer receive auto-context injection.** Pre-Wave-22, the `contextInjector → repoMap → graph` pipeline pre-built project-aware context and injected it into terminal Claude Code sessions on session start. Post-Wave-22, terminal agents inside the IDE behave like plain Claude Code CLI sessions in any other project — they `Grep`/`Read` on demand, no pre-built context.

This was the deliberate tradeoff in Decision 4 (A2). The standalone MCP server can be wired in via `.mcp.json` to restore graph queries (Phase 6 did this for the IDE itself); the auto-injection pipeline is a future wave's concern.

## Verification

### Gates (wave wrap)

- `npx tsc --noEmit`: clean.
- `npm run lint`: 0 errors, 5 warnings (all pre-existing carryovers).
- `npm run test:codebase-graph-mcp`: 51 files / 751 passed / 3 skipped.
- `npm run test:main`: 477/478 files / 5,729 passed / 1 pre-existing fail / 2 skipped.
- `npm run build` (main + preload): clean. Renderer pre-existing fail (not Wave 22).
- `packages/codebase-graph-mcp/`: `npm run build` + `npm pack` succeed; tarball produced (470 files, 1.9 MB unpacked).
- Cross-project smoke: 3/3 projects index + serve queries within ~36s total wall-clock.

### Acceptance criteria

All 30+ acceptance criteria from waveplan-22.md §Acceptance criteria pass except:
- **Phase 8 npm publish** — attempted, failed E404, filed as follow-up per Decision 7 fail-soft.
- **Phase 6 user-observation gate (Site 2)** — Cole's fresh-session verification in each project is the manual final gate; automated smoke captured latency + node-count evidence.

### Data-shape probes (from §Verification)

- `ls src/main/codebaseGraph/` — `no such file or directory` ✓
- `grep -rn "repoMap" src/main/` — only test-removal-marker comments + KEEP file (`repoMapGeneratorFrameworks.ts`) — spec satisfied in spirit per Phase 5 reviewer.
- `grep -rn "contextInjector" src/main/` — only removal-marker comments — spec satisfied in spirit.
- `grep -rn "ouroborosMcp" src/main/` — only historical CLAUDE.md reference documenting the rename — spec satisfied.
- `grep -rn "console.log" packages/codebase-graph-mcp/src/` — only doc-comment + test fixtures — stdio protocol safety preserved.

## Follow-ups filed during the wave

- `roadmap/follow-ups/2026-05-26-fix-extensions-mjs-dynamic-imports.md` (Phase 4 review) — `fix-extensions.mjs` regex misses dynamic `import('./specifier')`. Latent; not in current server import graph.
- `roadmap/follow-ups/2026-05-26-internalmcp-rewire-to-standalone-package.md` (Phase 5 review) — promoted into Phase 6 scope and RESOLVED inline (auto-close at `/audit-followups` time).
- `roadmap/follow-ups/2026-05-27-internalmcp-asar-packaging.md` (Phase 6) — packaged Electron builds need `extraResources`/`asarUnpack` for the package.
- `roadmap/follow-ups/2026-05-26-codebase-graph-mcp-npm-publish.md` (Phase 8) — npm publish failed E404; needs `npm login` + retry.
- `C:/Web App/meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md` (Phase 7) — meta-side `.mcp.json` install + `graph-tool-routing.md` rule update; project-meta boundary defers to next meta session.

## Mid-wave decisions ratified

- **Path A (stay scoped) at Phase 5 scope expansion** — Wave 22 modifies graph-consuming files to compile-after-deletion rather than absorbing Wave 100's chat-infrastructure removal. Documented mid-wave; reduces Wave 22 footprint by 50-100 files of chat-removal work.
- **Project-name normalization fix** (commit `78173b64`) — `serverBootstrap.ts` now uses the same `path.basename().toLowerCase().replace(/[^a-z0-9-]/g, '-')` shape as `IndexingPipeline.index()`. Required for any project with uppercase letters in its directory name.

## Vendor lessons (for promotion)

- **`@modelcontextprotocol/sdk@1.29.0`**: stdio server scaffold is ~30 lines; `console.error()` for logs (stdout is protocol stream — `console.log` corrupts the stream); `registerTool` requires Zod schemas (raw JSON Schema doesn't work — use `z.object({}).passthrough()` for permissive validation).
- **`better-sqlite3@^12.x`**: prebuilts cover Node 22.x LTS on Windows/macOS/Linux; ABI rebuild only needed if Node version is outside that range OR the install machine has no internet during `npm install`.
- **`web-tree-sitter@^0.26.x`**: requires `parser.init()` (async WASM load) before first use; in Node ESM contexts (`type: "module"`), bare `require.resolve()` fails — must use `createRequire(import.meta.url)`.
- **TS `"module": "ESNext"` + Node ESM**: emits extensionless relative imports that Node can't resolve. Post-`tsc` extension-fixing script needed (or switch to a bundler).
- **npm scoped publish requires registered scope** — first publish from an authenticated user with matching scope creates the scope; otherwise E404. Document the `npm login` prerequisite in package READMEs.

## Sourcing

Wave plan: `roadmap/wave-22-graph-standalone-mcp/waveplan-22.md`.
ADR: `roadmap/wave-22-graph-standalone-mcp/wave-22-decisions.md`.
Research extract: `roadmap/wave-22-graph-standalone-mcp/research-22.md`.
Deletion blueprint: `roadmap/wave-22-graph-standalone-mcp/wave-22-architect-deletion-blueprint.md`.
Smoke report: `roadmap/wave-22-graph-standalone-mcp/wave-22-smoke-report.md`.
