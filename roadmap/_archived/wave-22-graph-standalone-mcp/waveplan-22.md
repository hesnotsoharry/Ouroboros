---
status: DRAFT
created: 2026-05-26
updated: 2026-05-26
wave: 22
slug: graph-standalone-mcp
type: substantive
predecessor: wave-21-ouroboros-graph-tier-2
severity: HIGH
---

# Wave 22 — Ouroboros Codebase Graph: Standalone MCP Server Extraction

## Status

DRAFT · target v2.29.0 (minor — new cross-project capability) · drafted 2026-05-26.

## Context — why this wave exists

The Ouroboros codebase graph (~18.3K nodes, ~13.2K edges, ~80 files at `src/main/codebaseGraph/`) is internal to Agent IDE today — accessed by Claude Code only when running inside the IDE via `internalMcpAutoInject` (`src/main/internalMcp/internalMcpAutoInject.ts`). Only Agent IDE itself + Contractor App are indexed (per `~/.claude/rules-deferred/graph-tool-routing.md:57-58`). Gamify and the meta-framework workspace fall back to Grep/Read for symbol queries — significantly degraded relative to graph-backed lookups, and the 60% context-budget gate is harder to honor in those sessions because graph queries that would return targeted results aren't available.

This wave extracts `src/main/codebaseGraph/` as a standalone Node.js MCP server distributed via npm, invocable as `npx @ouroboros/codebase-graph-mcp` from any Claude Code session. Configuration lives in `.claude/settings.json` `mcpServers` block per project, surfacing `mcp__ouroboros__*` tools across all four codebases.

**Pre-flight grounding (this session):**

- **The chat-removal dependency was stale.** Prior HANDOFFs claimed Wave 22 was blocked on Wave 87 / Wave 100 (chat-surface-removal). Verified by direct import check: `Grep "from ['\"].*(agentChat|router|contextLayer|chatOrchestration)" src/main/codebaseGraph/` returns **zero matches**. `codebaseGraph/` has no dependency on the chat surface. The dependency runs the OTHER way — `src/main/contextLayer/` imports FROM `codebaseGraph` in 13 files (`repoMap*` consumers). The wave is technically unblocked; the FU's stale `blocker: wave-87-completion` frontmatter has been carried forward without verification.
- **Code-grounded portability survey already done.** Per the FU (filed 2026-05-26 from a sonnet-explorer reading of `src/main/codebaseGraph/`): ~80% of files lift-and-shift without rewrites. Coupling-boundary files needing rewrites: `graphDatabaseHelpers.ts` (getDbPath via `require('electron')` try-catch), Logger imports across ~8 files, `indexingWorkerClient.ts` (`__dirname` worker resolution), `gitCoChangePass.ts` (`../../util/gitExec` import), `autoSync.ts` + `graphGc.ts` (singleton imports), `graphStore.ts` (`../storage/database` import), MCP handler files (`internalMcpTypes` import), `internalMcpAutoInject.ts` (deprecate or replace).
- **better-sqlite3 standalone Node ABI is a non-issue.** Per `research-22.md` (this folder): `better-sqlite3@^12.x` ships prebuilt binaries for Node 22.x LTS on Windows/macOS/Linux. `npm install better-sqlite3` works out-of-the-box in a fresh Node 22 environment — no `node-gyp` rebuild, no Electron ABI workaround. This collapses the FU's "biggest unknown" (Phase 5 ABI rebuild) to zero effort.
- **MCP SDK skeleton is ~30 lines.** `@modelcontextprotocol/sdk` v1.x with stdio transport. Zod schemas, async handlers. Standalone server scaffold is one file. `console.error()` for logs (stdout is reserved for protocol messages).
- **mcpServers config shape is clear.** `.claude/settings.json` block: `{ type: "stdio", command: "npx", args: ["@ouroboros/codebase-graph-mcp", "--root", "${workspaceRoot}"], env: { ... } }`. `${workspaceRoot}` placeholder threads the project root in per-session. Session restart picks up changes.
- **Existing "standalone" path in-tree is misleading.** `internalMcpAutoInject.ts:113` references a standalone codebaseGraph entry point, but it runs under `ELECTRON_RUN_AS_NODE=1` (Electron's V8 ABI, not Node's). For true Node distribution we don't reuse that path — we build a fresh standalone entry under `packages/codebase-graph-mcp/`.

**Companion context.** This wave runs in parallel with (not gated by) Wave 100 chat-surface-removal. After Wave 100 ships, `src/main/contextLayer/` is deleted — at that point the IDE's only in-process consumer of `codebaseGraph` is gone, and a future cleanup wave can delete `src/main/codebaseGraph/` from the IDE entirely (the standalone npm package takes over). That cleanup is OUT OF SCOPE for Wave 22; this wave ships the standalone package + cross-project smoke + dual-consumer interim state.

## Goal

After Wave 22, a standalone npm package at `packages/codebase-graph-mcp/` ships the Ouroboros codebase graph as an MCP server consumable via `npx @hesnotsoharry/codebase-graph-mcp` from any Claude Code session. The package exposes the full existing tool surface (`search_graph`, `query_graph`, `trace_call_path`, `get_code_snippet`, `detect_changes`, `manage_adr`, plus the existing validation/search MCP handlers) over stdio transport, indexes the project at `${workspaceRoot}` on first invocation, and persists graph state at a path derived from the project root. Each of Agent IDE, Contractor App, Gamify, and the meta workspace gets its `.claude/settings.local.json` `mcpServers` block populated so Claude Code sessions in those projects observe `mcp__codebase-graph-mcp__*` tools and can query their own graph. Simultaneously, the in-IDE graph subsystem is **removed**: `src/main/codebaseGraph/` and its in-process consumer chain (`contextLayer/repoMap*`, `contextLayer/contextInjector*`, and call sites in main.ts / windowManager.ts / hooks* / orchestration / ipc-handlers) are deleted from the IDE tree. Terminal Claude Code sessions running inside the IDE no longer receive auto-context injection — they behave like plain Claude Code CLI sessions in any other project. Restoring context-awareness via the standalone MCP server (loopback consumption) is OUT OF SCOPE for Wave 22; future waves can rewire that path through the new package.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-22-DRAFT/wave-22-decisions.md` (renamed to `roadmap/wave-22-graph-standalone-mcp/wave-22-decisions.md` on validation pass).

All 8 decisions ratified inline by Cole 2026-05-26. Recorded here for the ADR scaffold.

1. **Repository layout: in-tree subdirectory `packages/codebase-graph-mcp/`.** Industry standard — monorepo pattern, shared lockfile, single PR per cross-package change. NOT chosen: separate repo (doubles git infrastructure — issues, PRs, CI — for a project that lives in lockstep with Ouroboros).
2. **Distribution model: npm package via `npx`, no binary bundling.** Industry standard per research-22.md. NOT chosen: `pkg` (alive but adds 50-100 MB binary size + slower cold start), `bun --compile` (still TRIAL as of May 2026), `nexe` (dead).
3. **Tree-sitter binding strategy: keep `web-tree-sitter` + WASM (lift-and-shift).** Locked by Cole via "which is better long term?" delegation. Long-term reasoning: Ouroboros aims for multi-language graph coverage. With `web-tree-sitter`, adding a language is "drop in a WASM grammar." With native `tree-sitter` Node bindings, each new language is a new npm dep with its own prebuild story per platform. Native is ~2-5× faster on indexing, but indexing is not the query-time bottleneck; for a tool that aspires to be the universal codebase-graph MCP, simplicity wins over a 12-month horizon. File a follow-up for a perf-driven native-binding migration if a real consumer surfaces the gap.
4. **In-IDE removal: aggressive — delete `src/main/codebaseGraph/` AND the consumer chain that depends on it (`src/main/contextLayer/repoMap*`, `contextInjector*`, plus call-site cleanup in `main.ts`, `windowManager.ts`, `hooksLifecycleHandlers.ts`, `hooksSessionHandlers.ts`, `orchestration/contextPacketBuilder.ts`, `ipc-handlers/{config,gitOperations,filesHelpers}.ts`, `mainStartupContextLayerTrigger.ts`).** Locked by Cole — "just the graph stuff" interpretation A2: accept capability loss. **Capability regression acknowledged:** terminal Claude Code sessions running inside the IDE will lose auto-context injection (the contextInjector → repoMap → graph pipeline that fed agents project-aware context). Post-Wave-22, terminal agents inside the IDE behave like plain Claude Code CLI sessions in any project — they Grep/Read on demand, no pre-built context. The cross-project standalone MCP server (deliverable of this wave) is the future path to restore context-awareness, but consuming it from the in-IDE side is OUT OF SCOPE here. NOT chosen: A1 loopback (in-IDE contextInjector rewired to consume standalone MCP — would have preserved capability but adds ~2 dev days + IPC latency in the hot path); NOT chosen: A3 absorb Wave 100 (~5 extra dev days; Wave 100 is a separate concern); NOT chosen: C dual-use (doesn't match "remove").
5. **First-run indexing of Gamify + meta repos: run as verification.** Locked by Cole. Indexing the two un-indexed projects IS the cross-project value demonstration. Relief valve stays: if first-run indexing exceeds 4 hrs combined wall-clock, defer the missing project(s) to a follow-up — settings blocks land regardless so tools surface.
6. **Package scope name: `@hesnotsoharry/codebase-graph-mcp`.** Locked by Cole — matches the planned GitHub repo (`github.com/hesnotsoharry/codebase-graph-mcp`). Pre-flight check at Phase 7: verify the npm scope is registered + Cole has publish access before attempting publish. NOT chosen: `@ouroboros/...` (would have been the recommended option for OSS-independence, but Cole's github-handle naming is consistent with the project's existing personal-scope conventions for now).
7. **NPM publication: attempt during Wave 22, fall back to follow-up if friction.** Locked by Cole — "publish if easy, if not add to follow up." Phase 7 includes a publish attempt with explicit fail-soft criteria: first try `npm publish` against `@hesnotsoharry/codebase-graph-mcp`; if authentication, scope-registration, or registry friction surfaces, file a follow-up at `roadmap/follow-ups/2026-XX-XX-codebase-graph-mcp-npm-publish.md` and ship the wave with local tarball install. Cross-project smoke (Phase 6) uses local tarball regardless — publish is a post-validation nice-to-have.
8. **Phase classification: walking-skeleton-first (per `~/.claude/rules-deferred/walking-skeleton-first.md`).** Industry standard per wave-process.md "Walking skeleton" rule — this wave introduces a NEW architectural surface (first npm package, first standalone MCP server, first cross-process boundary between IDE and graph subsystem). Phase 1 MUST be the thinnest end-to-end slice that runs (stdio MCP server with one trivial tool, invoked by Claude Code via a real `.claude/settings.json` config, returning a real response). NOT chosen: "set up the package" / "scaffold the structure" first — those are sub-tasks subsumed into the walking-skeleton phase per the rule.

## Scope

**In scope:**

- **Phase 1 (walking skeleton)** — Create `packages/codebase-graph-mcp/` with: `package.json` (bin, scoped name `@hesnotsoharry/codebase-graph-mcp`, ESM, engines `>=20`, dependencies), `tsconfig.json` (compile to `dist/`), `src/index.ts` (stdio MCP server with ONE `ping` tool that returns `pong`), `README.md` (consumption doc — `npx` invocation + `.claude/settings.local.json` block). Add `.claude/settings.local.json` entry in Agent IDE's own repo pointing at the local package. Smoke: live Agent IDE session, restart Claude Code, `mcp__codebase-graph-mcp__ping` tool surfaces, calling it returns `pong`.
- **Phase 2 (architect: deletion blueprint)** — `sonnet-architect` produces a read-only deletion blueprint: enumerates every file under `src/main/codebaseGraph/` + the consumer chain in `src/main/contextLayer/` + every cross-cutting import/wiring site in `main.ts`, `windowManager.ts`, `hooks*`, `orchestration/contextPacketBuilder.ts`, `ipc-handlers/{config,gitOperations,filesHelpers}.ts`, `mainStartupContextLayerTrigger.ts`. Classifies each file as DELETE (gone entirely), MODIFY (keep file, remove graph wiring), or KEEP (unrelated to graph). Identifies the IPC channels disappearing and any renderer-side callers that need updating. Produces an ordered migration sequence for the executor. Read-only; no code changes. Output written to `roadmap/wave-22-DRAFT/wave-22-architect-deletion-blueprint.md`.
- **Phase 3 (code migration to package, IDE-deps stripped)** — Copy the graph subsystem from `src/main/codebaseGraph/` to `packages/codebase-graph-mcp/src/` simultaneously stripping IDE-specific dependencies: replace `import log from '../logger'` with injected `Logger` interface across ~8 files; replace `require('electron')` in `graphDatabaseHelpers.ts:29-37` with `getDbPath` parameter; replace singleton imports (`getIndexingWorkerClient`, `../storage/database`) with constructor parameters or direct `better-sqlite3`; replace `../../util/gitExec` import in `gitCoChangePass.ts` with direct `child_process.spawn`; replace `internalMcpTypes` import in handler files with a new `packages/codebase-graph-mcp/src/types.ts`. The original `src/main/codebaseGraph/` is left untouched in this phase — Phase 5 deletes it. (Reason: copy-then-delete is safer than move-then-decouple because we can verify the standalone path works end-to-end before committing to the IDE-side deletion.)
- **Phase 4 (wire full MCP tool surface)** — Replace the stub `ping` tool with the full surface: `search_graph`, `query_graph`, `trace_call_path`, `get_code_snippet`, `detect_changes`, `manage_adr`. Migrate the existing MCP handler files (`mcpToolHandlerSearch.ts`, `mcpToolHandlerValidation.ts`) into the package. Split per-tool registration into separate files (`src/tools/search-graph.ts`, etc.) to honor the 300-line cap. Orchestrator-authored acceptance test pins the tool contract: spawn the compiled server in a child process, call each tool over MCP JSON-RPC on a TS fixture project, assert golden response shapes.
- **Phase 5 (delete in-IDE graph + consumer chain)** — Execute the Phase 2 architect blueprint via `sonnet-migration-executor`. Delete all files marked DELETE, update all files marked MODIFY (strip graph wiring while preserving non-graph behavior). Remove unused IPC channels. Update or delete renderer-side callers that reference disappearing IPC. After this phase: `src/main/codebaseGraph/` does not exist; `src/main/contextLayer/repoMap*` + `contextInjector*` do not exist; main.ts boots cleanly with no graph imports; `npm run build` succeeds; `npx tsc --noEmit` clean; `npm run test:main` passes (or tests covering deleted code are deleted too). Boundary phase — gates on a green build + clean typecheck.
- **Phase 6 (cross-project smoke)** — Install `.claude/settings.local.json` `mcpServers` block in 3 project repos: Agent IDE, Contractor App, Gamify. The 4th (meta) is filed as a cross-boundary follow-up per the project-meta boundary rule. For Gamify (and meta when its session runs the install): trigger first-time indexing by invoking the standalone server with `--root` pointing at each project. **Relief valve:** if first-time indexing exceeds 4 hrs combined wall-clock, defer the un-indexed project(s) to a follow-up; settings blocks stay. Per-project query latency captured for the result brief.
- **Phase 7 (documentation + meta-side handoff)** — Update `roadmap/docs/standalone-mcp.md` (new) — package architecture, consumption pattern, debugging tips, ABI rebuild guidance. Update root `CLAUDE.md` "Codebase Graph" section to reference the standalone path; remove or update Wave 22's deletion of the in-IDE module (root CLAUDE.md currently says "use it FIRST" for the in-IDE graph — that section gets a substantial rewrite). Update `~/.claude/rules-deferred/graph-tool-routing.md` — the rule is meta-framework state, NOT editable from this project session; file as a cross-boundary follow-up. File `meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md` for the meta-side `mcpServers` install. Mark the IDE's "lost capability" (terminal context injection) in the CHANGELOG + result brief explicitly.
- **Phase 8 (wave wrap)** — Run scoped suites (`test:main`, the new `test:codebase-graph-mcp` for the package), full lint + typecheck + formatter, the package's own `npm run build`, attempt `npm publish` against `@hesnotsoharry/codebase-graph-mcp` (fail-soft per Decision 7), `/review` mechanical, `wave-22-result.md`, `CHANGELOG.md [unreleased]` entry, `HANDOFF.md` flip, `/promote-vendor-lessons 22`, `/audit-followups wave-22-graph-standalone-mcp`. Merge worktree to master + remove (per `memory/worktree-merge-and-close-discipline.md`).

**Out of scope:**

- **Restoring context injection for terminal sessions via standalone-MCP loopback.** Per Decision 4 — A2 explicitly accepts the capability loss. A future wave can rewire the in-IDE context injection to consume the standalone MCP server (loopback) if/when Cole wants the IDE to be context-aware again. File no follow-up unless friction surfaces during dogfood.
- **Migration to native `tree-sitter` Node bindings.** Per Decision 3 — perf upgrade, separate wave. File follow-up at wrap if real consumer surfaces the gap.
- **Public npm publication beyond best-effort.** Per Decision 7 — Wave 22 attempts publish but falls back to follow-up on friction. Tarball-based consumption is the baseline.
- **Meta-side `~/.claude/settings.json` `mcpServers` install for the user-level config.** Per the project-meta boundary rule — Wave 22 is a project session; meta paths are filed as a follow-up for a meta session to execute.
- **Meta-side `graph-tool-routing.md` rule update.** Same project-meta boundary — Wave 22 files the follow-up; meta session edits the rule when the meta-side install happens.
- **New tools beyond the existing surface.** Wave 22 ships the existing tool set in a new transport. Tool evolution is post-extraction.
- **Standalone server's own dev tooling beyond build + smoke test.** No watch mode, no hot reload, no dev-time MCP inspector beyond the smoke test's stdio exchange.
- **Schema migration tooling.** If a user has a graph from Agent IDE v2.28.0 (in-IDE format) and switches to the standalone server, the schema is identical (same SQLite layout, same migrations). No data migration code needed.
- **Cypher engine improvements** — separate track (Wave 77-B `WITH` clause support already filed).
- **Wave 100's broader chat-surface removal** — `src/main/agentChat/`, `src/main/router/`, the rest of `src/main/contextLayer/` (everything Wave 22 doesn't touch). Wave 100 still owns that scope.

## Phases

| Phase | Topic | Implementer | Notes |
|-------|-------|-------------|-------|
| 0 | ADR ratification | orchestrator + Cole | All 8 decisions locked inline (2026-05-26). Update `wave-22-decisions.md` PENDING→RESOLVED for Decisions 3-7. No code. Test shape: **n/a**. |
| 1 | **Walking skeleton** — `packages/codebase-graph-mcp/` package with stdio MCP `ping` tool, end-to-end smoke via `.claude/settings.local.json` in Agent IDE | sonnet-implementer | **NEW ARCHITECTURAL SURFACE** (first npm package, first standalone MCP server, first cross-process boundary). Per `~/.claude/rules-deferred/walking-skeleton-first.md`: thinnest slice that touches every layer end-to-end with one automated smoke. Boundary phase — orchestrator authors failing smoke test FIRST: `packages/codebase-graph-mcp/tests/walking-skeleton.smoke.test.ts` spawns the compiled package via `child_process.spawn('node', ['packages/codebase-graph-mcp/dist/index.js'])`, sends an MCP `tools/call` JSON-RPC for `ping`, asserts response `content[0].text === 'pong'`. Implementer changes: (a) `packages/codebase-graph-mcp/package.json` with `name: "@hesnotsoharry/codebase-graph-mcp"`, `bin`, `type: "module"`, `engines.node >= 20`, deps on `@modelcontextprotocol/sdk` + `zod`; (b) `packages/codebase-graph-mcp/tsconfig.json` with `outDir: dist/`; (c) `packages/codebase-graph-mcp/src/index.ts` with stdio MCP server registering ONE `ping` tool that returns `{ content: [{ type: 'text', text: 'pong' }] }`; (d) `packages/codebase-graph-mcp/README.md` consumption doc; (e) `.claude/settings.local.json` mcpServers block in Agent IDE repo root pointing at compiled `dist/index.js`. Trace: `[trace:graph-mcp.server.start]` logged via `console.error` on boot. Implementer may not modify the orchestrator-authored smoke test. Test shape: **honeycomb** — boundary phase; integration smoke IS the contract. Gate: smoke test passes; `sonnet-phase-reviewer` dispatch on diff. |
| 2 | **Architect: deletion blueprint** — survey and classify every file in the in-IDE graph consumer chain | sonnet-architect | Read-only. **No sequence diagram produced — deletion blueprint deliverable only; Site 1 terminus rule per `~/.claude/notes/wave-process.md` is not applicable to this phase.** Architect deliverable: `roadmap/wave-22-DRAFT/wave-22-architect-deletion-blueprint.md`. Must include: (a) DELETE list — every file under `src/main/codebaseGraph/`, `src/main/contextLayer/repoMap*`, `src/main/contextLayer/contextInjector*`, `src/main/mainStartupContextLayerTrigger.ts`, etc.; (b) MODIFY list — every cross-cutting file that imports from the deletion set but whose non-graph behavior must be preserved (`main.ts`, `windowManager.ts`, `hooksLifecycleHandlers.ts`, `hooksSessionHandlers.ts`, `orchestration/contextPacketBuilder.ts`, `ipc-handlers/{config,gitOperations,filesHelpers}.ts`); for each MODIFY entry, the exact lines/blocks to strip; (c) IPC channels disappearing — listed by name with renderer-side caller files that need updates; (d) ordered migration sequence the executor follows (`migration-executor` works step-by-step from this); (e) test files in the deletion set that also go (test:codebasegraph tests, contextLayer tests covering deleted code); (f) test files in MODIFY set that need updating (hooks tests + orchestration tests that exercise the contextInjector path); (g) the EXACT keep-set in contextLayer/ that survives (moduleDetector* may survive — needs verification; summarizationQueue may survive; the rest go because contextInjector is the consumer that ties them together). Brief explicitly tells the architect: "Cole picked A2 — accept capability loss for terminal context injection in the IDE. Don't suggest preserving the consumer chain through loopback; that's a separate future wave." Test shape: **n/a** — read-only architect deliverable. Gate: blueprint document complete; orchestrator reviews + briefs Phase 3 from it. |
| 3 | Code migration to `packages/codebase-graph-mcp/src/` with IDE deps stripped | sonnet-implementer | NOT a boundary phase (mechanical migration; original IDE code untouched until Phase 5). Implementer changes: (a) copy graph subsystem files from `src/main/codebaseGraph/` to `packages/codebase-graph-mcp/src/` — directory structure preserved; (b) replace `import log from '../logger'` with injected `Logger` interface (define in new `packages/codebase-graph-mcp/src/loggerInterface.ts`; default impl writes to `console.error`); (c) `graphDatabaseHelpers.ts:29-37` — replace `require('electron')` try-catch with `getDbPath` constructor parameter on `GraphDatabase`; (d) `autoSync.ts`, `graphGc.ts` — accept worker client as constructor parameter (remove `getIndexingWorkerClient()` singleton); (e) `gitCoChangePass.ts` — replace `../../util/gitExec` with direct `child_process.spawn` (or injected `runGit`); (f) `graphStore.ts` — replace `../storage/database` with direct `better-sqlite3` or injected DB instance; (g) `indexingWorkerClient.ts` — accept worker entry path as constructor parameter; (h) `internalMcpTypes` import in MCP handler files replaced with new `packages/codebase-graph-mcp/src/types.ts`. Original `src/main/codebaseGraph/` left UNTOUCHED — Phase 5 deletes it. Test shape: **pyramid** — pure mechanical migration; package's own tests pass against the new path. Gate: `packages/codebase-graph-mcp/` builds (`npm run build` in the package); `npm run test:codebase-graph-mcp` passes for the lifted tests; in-IDE `test:codebasegraph` still passes (because `src/main/codebaseGraph/` untouched). Orchestrator diff glance. |
| 4 | Wire full MCP tool surface in the package | sonnet-implementer | **Boundary phase** — new tool surface contract. Orchestrator authors failing acceptance test FIRST: `packages/codebase-graph-mcp/tests/tool-surface.acceptance.test.ts` spawns the compiled server, calls each of `search_graph`, `query_graph`, `trace_call_path`, `get_code_snippet`, `detect_changes`, `manage_adr` over MCP JSON-RPC on a small TS fixture project, asserts golden response shapes per tool (shape-based + exact-value checks on the fixture). Test fails against current code (only `ping` wired). Implementer changes: (a) replace the `ping` stub in `src/index.ts` with the full tool surface; (b) split per-tool registration into per-file modules under `src/tools/` (`src/tools/search-graph.ts`, etc.) to honor the 300-line cap; (c) migrate `mcpToolHandlerSearch.ts` + `mcpToolHandlerValidation.ts` into the package; (d) add `[trace:graph-mcp.tool.<name>]` log line per tool invocation via `console.error`. Implementer may not modify the acceptance test. Test shape: **honeycomb** — IPC + cross-package boundary; integration tests carry the load. Gate: acceptance test passes; data-shape probes pass; `sonnet-phase-reviewer` dispatch on diff. |
| 5 | **Delete in-IDE graph + consumer chain** — execute Phase 2 blueprint | sonnet-migration-executor | **Boundary phase** — large blast radius (deletes 100+ files and modifies ~10 cross-cutting files). Per `~/.claude/rules/agent-catalog.md`: `sonnet-migration-executor` is the right shape (blueprint exists; step-by-step execution; gate after each step). Executor's brief: follow Phase 2 blueprint exactly. After each ordered step, verify build green (`npm run build`) + typecheck clean (`npx tsc --noEmit`); surface failures before continuing. Specific deliverables: (a) `git rm -r src/main/codebaseGraph/`; (b) `git rm` on the contextLayer deletion subset per blueprint; (c) `git rm` on `src/main/mainStartupContextLayerTrigger.ts` + its test; (d) edit main.ts to remove graph/contextLayer imports (lines 12, 13, 21, 43 + any others surfaced by typecheck); (e) edit windowManager.ts to remove `acquireContextLayer` wiring; (f) edit hooksLifecycleHandlers.ts + hooksSessionHandlers.ts to remove contextInjector calls; (g) edit orchestration/contextPacketBuilder.ts to remove repoMap-based packet building; (h) remove the IPC channels in `ipc-handlers/{config,gitOperations,filesHelpers}.ts` that exposed contextLayer to renderer; (i) update or delete affected tests; (j) update renderer-side callers of disappearing IPC (if any — blueprint identifies). Test shape: **honeycomb** — the build + typecheck + `test:main` IS the contract. Gate: `npm run build` succeeds; `npx tsc --noEmit` clean; `npm run test:main` passes (or test files covering deleted code are deleted, not skipped). **`sonnet-phase-reviewer` dispatch on diff** — large deletion + critical-path edits = high mental-model-divergence risk. |
| 6 | Cross-project smoke + per-project `.claude/settings.local.json` install | orchestrator + sonnet-smoke-runner | Install `mcpServers.codebase-graph-mcp` block in 3 project files: `C:/Web App/AgentIDE/.claude/settings.local.json` (already done in Phase 1 — verify), `C:/Web App/ContractorApp/.claude/settings.local.json`, `C:/Web App/Gamify/.claude/settings.local.json`. The 4th (meta) is filed as cross-boundary follow-up per the project-meta boundary rule. For Gamify: trigger first-time indexing by invoking the standalone server with `--root C:/Web App/Gamify`. Verify `mcp__codebase-graph-mcp__search_graph` returns rows in a fresh Claude Code session of each project. Capture per-project query latency. **Relief valve:** if Gamify indexing exceeds 4 hrs wall-clock, defer that project to a follow-up; settings block stays so the tool surfaces (queries return zero rows pending indexing). For Agent IDE specifically: this is the regression-validation step — does the standalone path produce correct results on the project that just had its in-IDE graph DELETED? Verify the standalone server can re-index Agent IDE from scratch. Test shape: **honeycomb** — boundary smoke; cross-project tool surfacing IS the verification. Gate: smoke report at `roadmap/wave-22-DRAFT/wave-22-smoke-report.md` (post-rename: `roadmap/wave-22-graph-standalone-mcp/wave-22-smoke-report.md`) lists per-project tool-availability + sample-query results + latencies. |
| 7 | Documentation + meta-side handoff | sonnet-implementer | Implementer changes: (a) new `roadmap/docs/standalone-mcp.md` — architecture diagram (ASCII), consumption pattern with the `.claude/settings.local.json` block shape, debugging tips (`console.error` for logs; stdio protocol corruption if `console.log` used), ABI rebuild path if prebuilts miss; (b) substantially rewrite root `CLAUDE.md` "Codebase Graph — use it FIRST" section — the in-IDE graph is GONE; the new instruction is "the codebase-graph MCP server is configured in `.claude/settings.local.json`; tools surface as `mcp__codebase-graph-mcp__*` in fresh Claude Code sessions"; (c) update root `CLAUDE.md` "Folder Map" — remove the codebaseGraph entry (gone) + the contextLayer/repoMap entry (gone); add `packages/codebase-graph-mcp/` entry; (d) update root `CLAUDE.md` "Known Issues / Tech Debt" — remove the wave-21-related items pointing at codebaseGraph internals (no longer in this repo); note the lost in-IDE context-injection capability as a deliberate Wave 22 tradeoff; (e) file `meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md` — meta-side `mcpServers` block install + `~/.claude/rules-deferred/graph-tool-routing.md` rule update (deferred to meta session per the boundary). Test shape: **n/a** — docs only. Gate: orchestrator diff glance; markdown renders. |
| 8 | Wave wrap | orchestrator | Run scoped suites: `npm run test:main`, new `npm run test:codebase-graph-mcp`. Full `npm run lint`, `npx tsc --noEmit`, formatter. Inside `packages/codebase-graph-mcp/`: `npm run build` + `npm pack` to produce a local tarball. **Attempt `npm publish`** against `@hesnotsoharry/codebase-graph-mcp` per Decision 7; if authentication or scope-registration friction, file follow-up at `roadmap/follow-ups/2026-05-26-codebase-graph-mcp-npm-publish.md` and ship the wave with tarball-only. `/review` mechanical gap-check — verdict gates merge. Orchestrator diff review of the whole wave (especially the deletion phase). Run the data-shape probes from §Verification. Write `wave-22-result.md` — explicitly call out the capability regression (terminal context injection gone) in a "Lost capabilities" section. `CHANGELOG.md [unreleased]` entry — minor version bump per the new cross-project capability + breaking removal of the in-IDE graph. `git push` per standing posture (CI observable but not gating per bulletin: GH minutes exhausted through 2026-06-01). `HANDOFF.md` flip. `/audit-followups wave-22-graph-standalone-mcp` — auto-archive the source FU. `/promote-vendor-lessons 22` — extract MCP SDK + better-sqlite3 + npm-publish lessons. Merge worktree to master + remove. Test shape: **n/a**. |

### Phase ordering

Phase 0 (ADR) is already complete — decisions locked inline this session. Phase 1 (walking skeleton) and Phase 2 (architect blueprint) can run in PARALLEL — different surfaces (Phase 1 builds the new package shell; Phase 2 surveys the in-IDE consumer chain). Phase 3 depends on Phase 1 (package shell exists). Phase 4 depends on Phase 3 (decoupled code in package). Phase 5 depends on Phase 2 (blueprint) + Phase 4 (standalone path proven via acceptance test before deletion is committed). Phase 6 depends on Phase 4 + Phase 5 (both standalone and in-IDE-delete done before cross-project smoke validates the end state). Phase 7 depends on Phase 5. Phase 8 (wrap) depends on all.

```
Phase 0 (ADR — DONE inline)
   |
   +-----> Phase 1 (walking skeleton — boundary, sonnet-implementer)        \
   |          |                                                              \
   |          v                                                               \  parallel
   |       sonnet-phase-reviewer + gate                                       /
   |                                                                         /
   +-----> Phase 2 (deletion blueprint — architect, read-only)              /
                   |
                   v
   (both Phase 1 + Phase 2 green)
                   |
                   v
                Phase 3 (code migration to package — sonnet-implementer)
                   |
                   v
                Phase 4 (wire MCP tool surface — boundary, sonnet-implementer)
                   |
                   v
                sonnet-phase-reviewer + gate
                   |
                   v
                Phase 5 (delete in-IDE — boundary, sonnet-migration-executor)
                   |
                   v
                sonnet-phase-reviewer + gate
                   |
                   v
                Phase 6 (cross-project smoke — orchestrator + sonnet-smoke-runner)
                   |
                   v
                Phase 7 (docs + meta follow-ups — sonnet-implementer)
                   |
                   v
                Phase 8 (wave wrap — orchestrator)
```

Practical dispatch: Phase 0 already done; orchestrator dispatches Phase 1 and Phase 2 in parallel (single message, two Agent tool calls). On both gates green, Phase 3. On Phase 3 green, Phase 4 (after orchestrator authors acceptance test). On Phase 4 green, Phase 5 (the destructive phase — runs only AFTER the standalone path has proven its tool surface works). On Phase 5 green, Phase 6. Phases 6 and 7 can technically run in parallel (smoke vs docs) but the smoke output informs the docs' "known good cross-project surface" section — easier sequential.

## Risks

| Risk | Mitigation |
|------|------------|
| **Capability regression — terminal Claude Code sessions in the IDE lose auto-context injection.** Post-Wave-22, agents inside the IDE no longer get the contextInjector → repoMap → graph pipeline. They Grep/Read on demand instead. Acknowledged tradeoff per Decision 4 (A2). | Document the loss in CHANGELOG + `wave-22-result.md` "Lost capabilities" section + the rewritten root CLAUDE.md "Codebase Graph" section. A future wave can rewire context injection via standalone-MCP loopback if Cole's dogfood surfaces friction. NOT a wave-blocking risk — it's the locked tradeoff. |
| **Phase 5 deletion creates a broken build mid-wave.** Deleting `src/main/codebaseGraph/` without simultaneously stripping the import in main.ts breaks the typecheck and the build. | Phase 2 architect produces an ORDERED migration sequence — `sonnet-migration-executor` runs steps and verifies `npm run build` + `npx tsc --noEmit` after each step. Failures halt the migration before continuing. The blueprint identifies WHICH files to edit BEFORE WHICH deletes so the typecheck stays clean. |
| **Renderer-side IPC callers (frontend) that reference disappearing channels are missed by the architect's static analysis.** Channels in `ipc-handlers/{config,gitOperations,filesHelpers}.ts` may have hidden renderer callers — IPC is not statically traced like imports. | Phase 2 brief explicitly tells the architect: grep `src/renderer/` for the disappearing channel names (string-match, not import-based). Include all hits in the blueprint's MODIFY/DELETE classification. Phase 5 verifies via running the renderer (build + dev start) — if renderer console errors on missing channels, fix inline (Tier 2 self-fix per pipeline doctrine) or commit + file follow-up. |
| `better-sqlite3` prebuilt binary missing for a target platform causes `npm install` to fall back to source build (Python + C++ toolchain needed). | Pin `better-sqlite3` to `^12.x` (broad prebuilt coverage per research-22.md). Document in package README: "Requires Node 20+ LTS; prebuilt binaries included; if `npm install` fails on build, install build tools per `better-sqlite3` README." File a follow-up if it surfaces in real cross-project use. |
| **MCP SDK stdio protocol corruption — using `console.log()` anywhere in `packages/codebase-graph-mcp/src/` will inject characters into the protocol stream and break the connection.** | Phase 4 review specifically greps for `console.log` in the package — must be zero. ESLint rule `no-console` already errors on `console.log` project-wide (`renderer.md` rules). Document this loud + clear in the package README. Add to vendor-gotchas at wrap if a real bug emerges. |
| Cross-project graph storage path collision — multiple projects' standalone servers writing to the same path. | Server derives storage path from `--root` via hash (e.g., `~/.ouroboros-graph/<sha256(root)[:8]>/graph.db`). Documented convention; Phase 6 smoke verifies unique paths per project. |
| Phase 5 deletes test files that cover code surviving in MODIFY entries — test coverage gap not surfaced by green CI. | Phase 2 blueprint distinguishes "test files that go with deleted code" (delete) vs "test files that need updating because they exercise MODIFY code" (modify, don't delete). Executor brief enforces the distinction. Orchestrator diff-reviews Phase 5 to spot a deletion of a test that should have been modified. |
| Indexing time on Gamify exceeds the relief-valve threshold; Wave 22 lands with Gamify's graph empty. | Relief valve explicit in Phase 6 brief — defer indexing if > 4 hrs wall-clock. Wave 22 still ships the EXTRACTION (the wave's primary goal); cross-project indexing is the value-add demo and can complete in a follow-up. Settings block stays so the tool surfaces. |
| `web-tree-sitter` + WASM version pinning issue (Issue #5171 — v0.26.x incompatible with tree-sitter-cli v0.20.x WASM files) carries forward to the standalone path. | The package inherits the existing `web-tree-sitter@^0.26.x` + `@vscode/tree-sitter-wasm` versions from Agent IDE's lockfile. No version drift. Verify in Phase 4 by running the standalone indexer on a TS fixture as part of the acceptance test. |
| `sonnet-migration-executor` deviates from the Phase 2 blueprint and makes its own judgment calls during deletion. | Executor brief is explicit: "follow the blueprint exactly; do not improvise. If a step's verification fails, halt and surface to the orchestrator — do not skip ahead or apply alternative fixes." The executor's tier (Sonnet, not Opus) means it implements; the orchestrator (this session) handles deviation calls. |
| **npm publish friction during Phase 8** — `@hesnotsoharry` scope not registered, no publish auth set up, package name collision, etc. | Per Decision 7 — publish is best-effort. If first `npm publish` attempt fails, file follow-up at `roadmap/follow-ups/2026-05-26-codebase-graph-mcp-npm-publish.md` and ship the wave with tarball-only. Cross-project smoke (Phase 6) doesn't depend on npm publish — uses local file path / `npm pack` tarball. |
| Worktree-vs-main checkout drift during this wave's own implementation — a Haiku agent (if dispatched) writes to main checkout. | All Phase implementers are Sonnet-tier (per the dispatch table). M-17 pattern is Haiku-specific. If a Haiku is dispatched for sub-work (research, doc lookup), verify post-DONE via `git status --short` in both main + worktree. Already burned once this session (research-22.md landed in main — recovered to worktree). |
| Architect's blueprint (Phase 2) misses a transitive consumer that's not reachable via `import` (e.g., dynamic `require`, runtime IPC dispatch, service registry lookup). | Phase 2 brief tells the architect to do BOTH static import analysis AND a string-grep pass over `src/` for the key symbols (`getRepoMapWorkerClient`, `acquireContextLayer`, `contextInjector`, etc.). Phase 5 verifies via build + typecheck + `test:main` — three independent checks. If something's missed, surfaces as a runtime error in Phase 6 smoke, fixed inline or filed. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|-------|------|-------------|-------|
| 0 | n/a | n/a | ADR — no code. |
| 1 | New `packages/codebase-graph-mcp/src/index.test.ts` — `ping` tool handler returns the expected shape. | **Orchestrator-authored smoke test** at `packages/codebase-graph-mcp/tests/walking-skeleton.smoke.test.ts` — spawns `node dist/index.js`, sends MCP `tools/list` + `tools/call ping` over stdio, asserts response. | **Honeycomb** — boundary; stdio integration IS the contract. |
| 2 | n/a | n/a | Architect blueprint — read-only, no code, no tests written. Phase 5 executes against the blueprint. |
| 3 | Lifted unit tests from `src/main/codebaseGraph/*.test.ts` migrate to `packages/codebase-graph-mcp/src/` and re-pass under the package's vitest config. New `loggerInterface.test.ts` for the injected Logger shape contract. | `npm run test:codebase-graph-mcp` script added — runs the package's tests. `test:codebasegraph` (in-IDE) still runs against the UNTOUCHED in-IDE copy and passes. Both pass simultaneously. | **Pyramid** for the unit-test migration; integration is "package builds + package tests pass." |
| 4 | New `packages/codebase-graph-mcp/src/tools/*.test.ts` per tool — unit tests against mocked DB. Migrated `mcpToolHandler*.test.ts` re-pass against the new locations. | **Orchestrator-authored acceptance test** at `packages/codebase-graph-mcp/tests/tool-surface.acceptance.test.ts` — spawns compiled server, calls each of 6 tools over MCP JSON-RPC on a TS fixture, asserts golden shapes. | **Honeycomb** — cross-package + IPC boundary; integration tests carry the load. Cross-package contract discipline: in-IDE consumer (still exists at this point — not deleted until Phase 5) is NOT consuming the package yet (no loopback); the acceptance test runs against the package's own `dist/` per the test config. |
| 5 | Test files in the DELETE set (e.g., `src/main/codebaseGraph/*.test.ts`, `src/main/contextLayer/repoMap*.test.ts`) are deleted alongside the code. Test files covering MODIFY entries (e.g., `hooksLifecycleHandlers.test.ts`, `contextPacketBuilder.test.ts`) are UPDATED to assert the new non-graph behavior — graph-related assertions removed; non-graph assertions preserved. | The build + typecheck + `test:main` ARE the integration check. If `test:main` passes, the deletion didn't break anything that still has a test surface. | **Honeycomb** — build + typecheck + main-suite-pass IS the contract. Boundary phase. |
| 6 | n/a | Per-project smoke at `wave-22-smoke-report.md`: Agent IDE — standalone server re-indexes the project from scratch (in-IDE graph DELETED in Phase 5 so this is a clean run); `mcp__codebase-graph-mcp__search_graph` returns ≥ 1 row on a known symbol. Contractor App — same. Gamify — same (or relief-valve note if indexing deferred). | **Honeycomb** — boundary smoke; cross-project tool surfacing IS the verification. |
| 7 | n/a | n/a | Docs only. |
| 8 | n/a | n/a | Wrap. |

## Acceptance criteria

- [ ] **Phase 1**: `packages/codebase-graph-mcp/package.json` exists with `name: "@hesnotsoharry/codebase-graph-mcp"`, `bin`, `type: "module"`, `engines.node: ">=20.0.0"`, dependency on `@modelcontextprotocol/sdk` + `zod`.
- [ ] **Phase 1**: `packages/codebase-graph-mcp/dist/index.js` exists after `npm run build`.
- [ ] **Phase 1**: Orchestrator-authored smoke test at `packages/codebase-graph-mcp/tests/walking-skeleton.smoke.test.ts` passes — implementer did not modify it.
- [ ] **Phase 1**: From a live Agent IDE Claude Code session (after session restart), invoking `mcp__codebase-graph-mcp__ping` returns `pong`. Cole verifies in the IDE.
- [ ] **Phase 1**: `[trace:graph-mcp.server.start]` log line appears in stderr on server boot.
- [ ] **Phase 2**: `roadmap/wave-22-DRAFT/wave-22-architect-deletion-blueprint.md` (post-rename: `roadmap/wave-22-graph-standalone-mcp/wave-22-architect-deletion-blueprint.md`) exists with DELETE / MODIFY / KEEP classifications, IPC channel impact list, renderer-side caller list, ordered migration sequence.
- [ ] **Phase 2**: Blueprint identifies which test files go (with deleted code) vs need updating (cover MODIFY code).
- [ ] **Phase 3**: `packages/codebase-graph-mcp/src/` contains the migrated graph code (file count roughly matches `src/main/codebaseGraph/` minus internal-only stubs).
- [ ] **Phase 3**: `grep -rn "from '../logger'" packages/codebase-graph-mcp/src/` returns zero hits.
- [ ] **Phase 3**: `grep -n "require('electron')" packages/codebase-graph-mcp/src/graphDatabaseHelpers.ts` returns zero hits.
- [ ] **Phase 3**: `grep -rn "getIndexingWorkerClient" packages/codebase-graph-mcp/src/` — any hits are constructor parameter usage, not singleton import.
- [ ] **Phase 3**: `grep -rn "from '../../util/gitExec'" packages/codebase-graph-mcp/src/` returns zero hits.
- [ ] **Phase 3**: `grep -rn "internalMcpTypes" packages/codebase-graph-mcp/src/` returns zero hits.
- [ ] **Phase 3**: Inside `packages/codebase-graph-mcp/`: `npm run build` succeeds; package's own tests pass.
- [ ] **Phase 3**: `npm run test:codebasegraph` (in-IDE, untouched) still passes — original code intact.
- [ ] **Phase 4**: Orchestrator-authored acceptance test at `packages/codebase-graph-mcp/tests/tool-surface.acceptance.test.ts` passes — implementer did not modify it. All six tools (`search_graph`, `query_graph`, `trace_call_path`, `get_code_snippet`, `detect_changes`, `manage_adr`) return responses matching the golden shape.
- [ ] **Phase 4**: New `npm run test:codebase-graph-mcp` script added to root `package.json`.
- [ ] **Phase 4**: `grep -rn "console.log" packages/codebase-graph-mcp/src/` returns zero hits (stdio protocol safety).
- [ ] **Phase 4**: Per-tool files exist under `packages/codebase-graph-mcp/src/tools/` — no single file exceeds 300 lines.
- [ ] **Phase 5**: `ls src/main/codebaseGraph/` returns "no such directory" (the subsystem is deleted).
- [ ] **Phase 5**: `grep -rn "repoMap" src/main/` returns zero hits.
- [ ] **Phase 5**: `grep -rn "contextInjector" src/main/` returns zero hits.
- [ ] **Phase 5**: `grep -n "contextLayer" src/main/main.ts` returns zero hits.
- [ ] **Phase 5**: `npm run build` succeeds (electron-vite compiles main.ts cleanly).
- [ ] **Phase 5**: `npx tsc --noEmit` returns zero errors.
- [ ] **Phase 5**: `npm run test:main` passes (or any failures are pre-existing carryovers, not Wave 22 regressions).
- [ ] **Phase 5**: Renderer builds and starts cleanly via `npm run dev` (no console errors on missing IPC channels).
- [ ] **Phase 6**: `.claude/settings.local.json` updated in 3 project repos: Agent IDE, Contractor App, Gamify.
- [ ] **Phase 6**: Smoke report at `roadmap/wave-22-graph-standalone-mcp/wave-22-smoke-report.md` lists per-project: tool availability (yes/no), sample query + result row count, query latency, any errors. Relief-valve invocation (if any) named explicitly.
- [ ] **Phase 6**: Agent IDE: `mcp__codebase-graph-mcp__search_graph` returns ≥ 1 row on a known-existing symbol (the standalone server re-indexed the project; in-IDE graph is GONE).
- [ ] **Phase 6**: Contractor App: same.
- [ ] **Phase 6**: Gamify: `mcp__codebase-graph-mcp__*` tools surface in a fresh session; query returns ≥ 1 row OR (relief valve) returns 0 rows with a documented note.
- [ ] **Phase 7**: `roadmap/docs/standalone-mcp.md` exists with architecture diagram + consumption pattern.
- [ ] **Phase 7**: Root `CLAUDE.md` "Codebase Graph" section substantially rewritten — no longer claims an in-IDE graph; references the standalone path; documents the lost capability (terminal context injection).
- [ ] **Phase 7**: Root `CLAUDE.md` "Folder Map" no longer references `codebaseGraph/` or `contextLayer/repoMap*`; adds `packages/codebase-graph-mcp/`.
- [ ] **Phase 7**: `meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md` filed.
- [ ] **Phase 8**: `npm run lint` returns 0 errors.
- [ ] **Phase 8**: `npx tsc --noEmit` clean.
- [ ] **Phase 8**: `/review` mechanical PASS or FLAG-with-flags-addressed.
- [ ] **Phase 8**: `npm publish` attempted against `@hesnotsoharry/codebase-graph-mcp`; if friction, follow-up filed at `roadmap/follow-ups/2026-05-26-codebase-graph-mcp-npm-publish.md`.
- [ ] **Phase 8**: `wave-22-result.md` written, includes explicit "Lost capabilities" section documenting the terminal-context-injection removal.
- [ ] **Phase 8**: `CHANGELOG.md [unreleased]` entry appended — minor version per new cross-project capability + breaking removal of in-IDE graph (could be major per semver, but project pre-1.0 convention treats this as minor).
- [ ] **Phase 8**: `roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md` auto-closed by `/audit-followups` (or manually flipped to RESOLVED and moved to `_archived/follow-ups/`).
- [ ] **Phase 8**: Worktree merged to master and removed (per `memory/worktree-merge-and-close-discipline.md`).
- [ ] **Phase 8**: `HANDOFF.md` flipped to "Wave 22 SHIPPED."

## Verification

### Per-phase experiential observation

The data-shape probes below confirm the JSON / file-on-disk populates correctly. They do NOT confirm the user observes anything different — that's what this table is for. Each row anchors a phase to a concrete user-facing surface and the full path from change site to observation. See `~/.claude/notes/wave-process.md` "Site 2" for the rule.

| Phase | Observation point | Path to it | What "working" looks like there |
|-------|-------------------|------------|---------------------------------|
| 0 | Internal — no observation point | n/a | ADR was ratified inline during this planning session. Decisions are in `wave-22-decisions.md` post-validation. No user-facing surface at the ADR step itself; the picks surface through subsequent phases. |
| 1 | An agent's reply in a fresh Claude Code session in a live Agent IDE, where Cole asks "ping the codebase-graph MCP server" and the agent uses `mcp__codebase-graph-mcp__ping` tool | IDE → renderer chat → Claude Code CLI session (started after `.claude/settings.local.json` updated and Claude Code restart) → MCP client → stdio child process (`node packages/codebase-graph-mcp/dist/index.js`) → MCP server `ping` tool handler → response `{ content: [{ type: 'text', text: 'pong' }] }` → MCP client → agent's chat reply | The agent's reply mentions `pong` in the chat scrollback. Pre-Phase-1, no such tool exists. Post-Phase-1, the user sees `pong` returned in plain text in the agent's reply. Visual confirmation in the chat. |
| 2 | Internal — no observation point | n/a | Architect blueprint — read-only deliverable. No user surface; the document gates Phase 5's execution. Listed here to honor the per-phase row requirement. |
| 3 | Internal — no observation point | n/a | Code migration to the new package — original IDE behavior untouched at this phase (deletion is Phase 5). No user-facing change observable yet. |
| 4 | An agent's reply in a fresh Claude Code session in Agent IDE, where Cole asks "what does GraphControllerCompat implement?" and the agent uses `mcp__codebase-graph-mcp__query_graph` to answer — running through the STANDALONE server (in-IDE graph still alive at this phase, but the standalone path is the one being tested) | IDE → renderer chat → Claude Code CLI session → MCP client → standalone server child process (`node packages/codebase-graph-mcp/dist/index.js --root ${workspaceRoot}`) → `query_graph` tool handler with `MATCH (c:Class {name: 'GraphControllerCompat'})-[:IMPLEMENTS]->(i:Interface) RETURN i.name` → cypherEngine.execute (now in the package) → graphDatabase SELECT against the standalone server's own graph DB → JSON result → MCP response → agent's chat reply | The agent's reply mentions `GraphControllerLike` (or whatever real interfaces `GraphControllerCompat` implements) BY NAME in the chat. Cole verifies the tool prefix is `mcp__codebase-graph-mcp__*` (the standalone path) — confirms the tool surface is fully wired in the package. |
| 5 | A terminal Claude Code session inside Agent IDE post-deletion, where Cole gives the agent a task that previously would have benefited from auto-context injection — and observes that the agent reaches for Grep/Read on demand rather than having context pre-injected | terminal Claude Code spawn in IDE → hook events fire → hooksLifecycleHandlers (no longer calls contextInjector — deleted) → agent receives prompt with NO pre-injected context → agent's reply is "I'll read the relevant files first" + tool calls to Read/Grep | The agent's behavior changes visibly compared to pre-Wave-22: it Grep/Reads project files at session start rather than answering immediately from injected context. This IS the lost capability — the observation isn't "feature broken" but "feature deliberately gone." Cole's IDE terminal sessions feel like Claude Code in any other repo. **Secondary observation:** root CLAUDE.md "Codebase Graph" section reads differently (rewritten in Phase 7); the in-IDE auto-inject path is documented as removed. |
| 6 | An agent's reply in a fresh Claude Code session in **Gamify** (NOT Agent IDE), where Cole asks "what files are in this repo?" and the agent uses `mcp__codebase-graph-mcp__search_graph` to query the freshly-indexed Gamify graph | Gamify IDE session → renderer chat → Claude Code CLI session → MCP client (configured via `C:/Web App/Gamify/.claude/settings.local.json`) → standalone server child process with `--root C:/Web App/Gamify` → `search_graph` tool handler → SQLite query against the newly-created `~/.ouroboros-graph/<hash>/graph.db` → JSON result → MCP response → agent's chat reply | The agent's reply mentions real Gamify source files BY NAME (e.g., `apps/mobile/src/screens/...`) in the chat scrollback. Pre-Wave-22, Gamify sessions had no graph at all (Grep fallback only). Post-Wave-22, Gamify sessions get targeted graph queries. **Relief-valve case:** if Gamify indexing was deferred, the observation degrades to "the tool surfaces but `search_graph` returns 0 rows" — documented in the smoke report; follow-up filed. |
| 7 | `roadmap/docs/standalone-mcp.md` on disk + the rewritten root `CLAUDE.md` "Codebase Graph" section + the meta follow-up at `meta/roadmap/follow-ups/...` on disk | text editor → file on disk → markdown rendered in IDE preview pane (Cole reads it) | Cole reads the new doc and the rewritten root CLAUDE.md; the architecture diagram + consumption pattern read correctly; the "lost capability" section is honest about what's gone. The meta follow-up's frontmatter is `status: OPEN` and includes the `mcpServers` block + the `graph-tool-routing.md` rule update payload. |
| 8 | Wave wrap green; `wave-22-result.md` on master at the new tag; `HANDOFF.md` reflects SHIPPED; CI observable | terminal → repo state on master → `git log --oneline -5` shows wave commits including the wrap commit | All gates green per the §Acceptance criteria checklist. `HANDOFF.md`'s top entry reads "Wave 22 SHIPPED — standalone codebase-graph MCP server live across N projects; in-IDE graph deleted; terminal context injection regression acknowledged." Cole's next session opens to a current handoff document. |

### Data-shape probes

```bash
# Phase 1 — walking skeleton package surface
ls packages/codebase-graph-mcp/{package.json,tsconfig.json,src/index.ts,README.md}
# expect: all 4 files exist

# Phase 1 — package.json shape
node -e "const p=require('./packages/codebase-graph-mcp/package.json'); console.log(JSON.stringify({name:p.name, bin:p.bin, type:p.type, engines:p.engines, deps:Object.keys(p.dependencies||{})}, null, 2))"
# expect: name==='@hesnotsoharry/codebase-graph-mcp', bin defined, type==='module', engines.node>='20', deps include @modelcontextprotocol/sdk and zod

# Phase 1 — build artifact + smoke
(cd packages/codebase-graph-mcp && npm run build) && ls packages/codebase-graph-mcp/dist/index.js
npx vitest run packages/codebase-graph-mcp/tests/walking-skeleton.smoke.test.ts
# expect: dist/index.js exists; smoke green

# Phase 2 — architect blueprint
ls roadmap/wave-22-DRAFT/wave-22-architect-deletion-blueprint.md
# expect: file exists; contains DELETE/MODIFY/KEEP sections

# Phase 3 — code in package; in-IDE untouched
ls packages/codebase-graph-mcp/src/graphDatabaseHelpers.ts
ls src/main/codebaseGraph/graphDatabaseHelpers.ts  # ORIGINAL untouched
# expect: both exist (Phase 3 copies, Phase 5 deletes the original)

grep -rn "from '../logger'" packages/codebase-graph-mcp/src/
grep -n "require('electron')" packages/codebase-graph-mcp/src/graphDatabaseHelpers.ts
grep -rn "from '../../util/gitExec'" packages/codebase-graph-mcp/src/
grep -rn "internalMcpTypes" packages/codebase-graph-mcp/src/
# expect: all zero hits

# Phase 3 — both test suites pass
(cd packages/codebase-graph-mcp && npm run build && npm test)
npm run test:codebasegraph  # in-IDE untouched, still passes
# expect: green green

# Phase 4 — acceptance test + tool surface
npx vitest run packages/codebase-graph-mcp/tests/tool-surface.acceptance.test.ts
grep -rn "console.log" packages/codebase-graph-mcp/src/
ls packages/codebase-graph-mcp/src/tools/
grep -n "test:codebase-graph-mcp" package.json
# expect: acceptance green; zero console.log; per-tool files under src/tools/; root script wired

# Phase 5 — deletion: in-IDE graph + consumer chain GONE
ls src/main/codebaseGraph/ 2>&1
# expect: "No such file or directory" or equivalent

grep -rn "repoMap" src/main/
grep -rn "contextInjector" src/main/
grep -n "contextLayer" src/main/main.ts
grep -n "codebaseGraph" src/main/main.ts
# expect: all zero hits

# Phase 5 — build + typecheck + tests still green post-deletion
npm run build
npx tsc --noEmit
npm run test:main
# expect: all green (or pre-existing failures only — not regressions from Wave 22)

# Phase 5 — renderer boots cleanly
# manual: npm run dev → no console errors on disappearing IPC channels

# Phase 6 — per-project settings + smoke
ls "C:/Web App/AgentIDE/.claude/settings.local.json"
ls "C:/Web App/ContractorApp/.claude/settings.local.json"
ls "C:/Web App/Gamify/.claude/settings.local.json"
grep -l "codebase-graph-mcp" "C:/Web App/AgentIDE/.claude/settings.local.json" "C:/Web App/ContractorApp/.claude/settings.local.json" "C:/Web App/Gamify/.claude/settings.local.json"
# expect: 3 matches

ls roadmap/wave-22-graph-standalone-mcp/wave-22-smoke-report.md
# expect: file exists with per-project sections

# Phase 7 — docs + meta follow-up
ls roadmap/docs/standalone-mcp.md
ls meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md
grep -n "Codebase Graph" CLAUDE.md
# expect: docs exist; CLAUDE.md section present (substantially rewritten)

# Phase 8 — wave-end gates
npm run test:main
npm run test:codebase-graph-mcp
npm run lint
npx tsc --noEmit
(cd packages/codebase-graph-mcp && npm pack)
# expect: all green; tarball produced

# Phase 8 — publish attempt (best-effort per Decision 7)
(cd packages/codebase-graph-mcp && npm publish --dry-run)
# expect: dry-run reports the package would be published; if real publish fails, follow-up filed
```

## Files the next agent should read first

1. `roadmap/wave-22-DRAFT/research-22.md` — full grounding on better-sqlite3 ABI, MCP SDK skeleton, npm packaging, mcpServers config, web-tree-sitter Node compatibility. **Load-bearing for every implementation phase.**
2. `roadmap/wave-22-DRAFT/wave-22-decisions.md` (created on validation PASS) — 8 ratified decisions, all locked.
3. `roadmap/wave-22-DRAFT/wave-22-architect-deletion-blueprint.md` (created by Phase 2 — does NOT exist before Phase 2 runs) — Phase 5's source of truth for what to delete and modify.
4. `roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md` — source FU with the file-by-file portability survey.
5. `src/main/codebaseGraph/graphDatabaseHelpers.ts:29-37` — Phase 3 surgical site (`getDbPath` extraction).
6. `src/main/codebaseGraph/CLAUDE.md` — subsystem context; Wave 19 FK-fix gotchas + Wave 21's class_heritage notes.
7. `src/main/codebaseGraph/index.ts` — current in-IDE entry point; Phase 3's copy source.
8. `src/main/codebaseGraph/autoSync.ts` + `graphGc.ts` + `indexingWorkerClient.ts` — Phase 3 surgical sites.
9. `src/main/codebaseGraph/passes/gitCoChangePass.ts` — Phase 3 site; replace `gitExec` import.
10. `src/main/codebaseGraph/mcpToolHandlerSearch.ts` + `mcpToolHandlerValidation.ts` — Phase 4 tool surface migration sources.
11. `src/main/contextLayer/repoMapWorkerClient.ts` + `repoMapGenerator.ts` + sibling repoMap files — Phase 5 deletion targets; in-IDE graph consumers.
12. `src/main/contextLayer/contextInjector.ts` — Phase 5 deletion target; the consumer that ties repoMap → terminal context.
13. `src/main/main.ts` (lines 12, 13, 21, 43) — Phase 5 MODIFY site; remove graph + contextLayer imports.
14. `src/main/windowManager.ts` — Phase 5 MODIFY site; `acquireContextLayer` wiring.
15. `src/main/hooksLifecycleHandlers.ts` + `hooksSessionHandlers.ts` — Phase 5 MODIFY sites; remove contextInjector calls.
16. `src/main/orchestration/contextPacketBuilder.ts` — Phase 5 MODIFY site; remove repoMap-based packet building.
17. `src/main/ipc-handlers/{config,gitOperations,filesHelpers}.ts` — Phase 5 MODIFY sites; remove contextLayer IPC.
18. `src/main/mainStartupContextLayerTrigger.ts` — Phase 5 DELETE.
19. `src/main/internalMcp/internalMcpAutoInject.ts:113` — current Electron-bound "standalone" entry; NOT reused in Wave 22 (separate path).
20. `package.json` (root) — verify `workspaces` config presence; informs Phase 3 + Phase 4 monorepo strategy.
21. `roadmap/wave-21-ouroboros-graph-tier-2/waveplan-21.md` — exemplar wave shape, same subsystem.
22. `roadmap/wave-21-ouroboros-graph-tier-2/wave-21-result.md` — wrap context.
23. `.claude/vendor-gotchas/tree-sitter.md` — web-tree-sitter API + ABI.
24. `.claude/vendor-gotchas/better-sqlite3.md` — SQLite patterns.
25. `~/.claude/notes/wave-process.md` "Walking skeleton" + "Boundary phases — orchestrator-owned acceptance tests" rules.
26. `~/.claude/rules-deferred/walking-skeleton-first.md` — Phase 1 specification.
27. `~/.claude/rules-deferred/orchestrator-owned-acceptance-tests.md` — Phase 1 + Phase 4 + Phase 5 discipline.
28. `~/.claude/rules/development-pipeline.md` — Lane A Stage 4 dispatch reflex + project-meta boundary rule (relevant for Phase 6 + Phase 7).
29. `~/.claude/rules/agent-catalog.md` — `sonnet-architect` (Phase 2), `sonnet-implementer` (Phases 1, 3, 4, 7), `sonnet-migration-executor` (Phase 5), `sonnet-smoke-runner` (Phase 6) dispatch routing.
30. `~/.claude/rules/best-practice-spectrum.md` — ADR framing.

## Note to the implementer

This wave extracts the Ouroboros codebase graph from the IDE to a standalone npm-distributed MCP server AND deletes the in-IDE graph + its consumer chain. The spirit is "ship the extraction cleanly; complete the removal honestly; unlock cross-project value; accept the lost capability." It is bigger than a pure extraction — Cole picked A2 in the in-IDE-removal spectrum, which adds the deletion phases on top of the extraction work.

**Lost capability — read this first.** After Wave 22, terminal Claude Code sessions running inside the IDE NO LONGER get auto-context injection. They behave like Claude Code CLI sessions in any other project: Grep/Read on demand, no pre-built repo map. This is the intentional cost of "remove the graph from the IDE." If you find yourself in Phase 3, 4, or 5 thinking "but this breaks the IDE's value-add" — yes, it does, and that's the locked decision (Decision 4 / A2). Don't try to preserve the consumer chain via loopback; that's an explicitly out-of-scope future wave.

**Four temptations to resist.** First, do not migrate to native `tree-sitter` Node bindings — Decision 3 keeps `web-tree-sitter` + WASM. Perf migration is a separate wave. Second, do not preserve in-IDE context injection via "clever" rewiring — Decision 4 / A2 is aggressive removal. The blueprint (Phase 2) tells you what goes; follow it. Third, do not publish to public npm beyond best-effort — Decision 7 makes publish fail-soft. If `npm publish` errors on auth or scope-registration, file the follow-up and move on. Fourth, do not add new tools to the MCP surface — Wave 22 ships the existing tool set in a new transport. Tool evolution is post-extraction.

**Phase 1 is the walking skeleton.** Not "set up the package." It's: `packages/codebase-graph-mcp/` exists with one trivial `ping` tool, AND a Claude Code session in Agent IDE (via `.claude/settings.local.json`) actually invokes it and gets `pong` back. Integration risk first. If the smoke doesn't work, stop and fix it before Phase 3 or anything else proceeds.

**Phase 2 is the architect blueprint — do NOT skip the architect dispatch.** The deletion in Phase 5 is large blast radius (100+ files deleted, ~10 cross-cutting files modified, IPC channels removed). The blueprint is the difference between a clean Phase 5 and a multi-day debug cycle. The orchestrator must dispatch `sonnet-architect` for Phase 2 — not improvise the deletion list from grep results. The architect's job is to enumerate the consumer chain, classify each file, identify renderer-side callers of disappearing IPC, and produce an ordered migration sequence the executor follows step-by-step.

**Phase 4 is the load-bearing tool-surface phase.** Cross-package, IPC contract, full tool set. Orchestrator-authored acceptance test that the implementer may not modify. `sonnet-phase-reviewer` runs on the diff before the gate is declared green.

**Phase 5 is the destructive phase.** `sonnet-migration-executor` follows the Phase 2 blueprint exactly. After each ordered step: `npm run build` + `npx tsc --noEmit` MUST stay green. If a step breaks the build, halt and surface — do not skip ahead. The executor has Bash; it runs gates. But Tier 3 discoveries (unexpected consumer in the renderer, IPC channel with a hidden caller, missing test update) come back to the orchestrator for the call — the executor does not improvise. `sonnet-phase-reviewer` runs on the Phase 5 diff before the gate is declared green — large deletion = high mental-model-divergence risk.

**The `console.log` stdio-corruption trap.** Every log line in `packages/codebase-graph-mcp/src/` must use `console.error` (stderr), not `console.log` (stdout — reserved for MCP protocol). Verify zero `console.log` occurrences before Phase 4 gate green.

**Phase 6's relief valve is real, not theater.** If first-time indexing of Gamify exceeds 4 hrs wall-clock, defer it. The wave ships the EXTRACTION + the REMOVAL (the wave's primary deliverables); cross-project demo with populated graphs is the value-add that can land in a follow-up.

> Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

For Phase 1: the observation is NOT "the smoke test passes." It is "a live Claude Code session in Agent IDE, after `.claude/settings.local.json` is updated and the session restarted, sees the `mcp__codebase-graph-mcp__ping` tool listed and a chat reply mentions `pong` when the agent calls it."

For Phase 4: the observation is NOT "the acceptance test passes." It is "a live Cypher query via the STANDALONE server returns IMPLEMENTS edges naming real interfaces in Agent IDE's own graph — the standalone path is tool-complete."

For Phase 5: the observation is NOT "build + typecheck green." It is "open the IDE post-deletion, spawn a terminal Claude Code session, give it a task — the agent's behavior visibly shifted from pre-injected-context to Grep/Read-on-demand. The capability loss is observable." If the agent's behavior is unchanged, something is still wired and the deletion is incomplete.

For Phase 6: the observation is NOT "the smoke report file exists." It is "a Claude Code session in Gamify actually surfaces the tool and returns rows on a query." Relief-valve case degrades to "tool surfaces, query returns 0 rows" — document explicitly.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means the orchestrator dispatches the next phase in the same turn. The turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision the grounding doesn't determine, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR file** at `roadmap/wave-22-DRAFT/wave-22-decisions.md` exists with all 8 decisions RESOLVED (created on `/wave-plan` validation pass).
2. **Phase 0** — DONE. All decisions locked inline this session (2026-05-26). No dispatch needed.
3. **Orchestrator pre-flight for Phase 1** (boundary — orchestrator-owned smoke test): author `packages/codebase-graph-mcp/tests/walking-skeleton.smoke.test.ts`. Test spawns `node packages/codebase-graph-mcp/dist/index.js` as a child process, sends MCP `initialize` + `tools/list` + `tools/call ping` over stdio, asserts response contains `pong`. Run locally; confirm it FAILS against current code (no package yet). Then dispatch.
4. **Phase 1 + Phase 2 — DISPATCH IN PARALLEL** (single message, two Agent tool calls). Phase 1 (sonnet-implementer, walking skeleton) and Phase 2 (sonnet-architect, deletion blueprint) work on disjoint surfaces.
   - **Phase 1 brief**: exact file targets (`packages/codebase-graph-mcp/{package.json, tsconfig.json, src/index.ts, README.md}`), exact `package.json` shape (`name: "@hesnotsoharry/codebase-graph-mcp"`, bin, type, engines per research-22.md), exact stdio MCP skeleton (~30 lines per research-22.md §2), the `.claude/settings.local.json` block to add in Agent IDE root, the `[trace:graph-mcp.server.start]` log line shape, "you may not modify the smoke test." Worktree path explicit: `C:/Web App/AgentIDE/.worktrees/wave-22-graph-standalone-mcp/`.
   - **Phase 2 brief**: read-only deliverable at `roadmap/wave-22-DRAFT/wave-22-architect-deletion-blueprint.md`. Survey `src/main/codebaseGraph/` + `src/main/contextLayer/repoMap*` + `contextInjector*` + `mainStartupContextLayerTrigger.ts` + cross-cutting consumers in main.ts/windowManager.ts/hooks*/orchestration/ipc-handlers. Classify each as DELETE / MODIFY / KEEP. Identify IPC channels disappearing + renderer-side callers (string-grep, not import-based). Produce ordered migration sequence the executor follows. Explicit framing: "Cole picked A2 — capability loss accepted, do not suggest preservation paths." Worktree path explicit. **CRITICAL**: architect is a Haiku-or-Sonnet read-only task — verify catalog dispatch routes to `sonnet-architect`, not opus-architect (Decision 8 is locked, no multi-axis tension remains).
   - Gate Phase 1: smoke test passes; live ping→pong observable; `sonnet-phase-reviewer` dispatch on diff.
   - Gate Phase 2: blueprint document complete (DELETE/MODIFY/KEEP populated; IPC channels listed; ordered sequence provided).
5. **Phase 3** (sonnet-implementer) — code migration to package with IDE deps stripped. Brief includes: COPY (don't move) graph subsystem from `src/main/codebaseGraph/` to `packages/codebase-graph-mcp/src/` (original IDE code untouched — Phase 5 deletes it); strip `import log from '../logger'` → injected `Logger` interface; strip `require('electron')` in `graphDatabaseHelpers.ts:29-37` → `getDbPath` parameter; strip singleton imports (`getIndexingWorkerClient`, `../storage/database`); strip `../../util/gitExec` → direct `child_process.spawn`; replace `internalMcpTypes` import with new `packages/codebase-graph-mcp/src/types.ts`. Gate: package builds; package's own tests pass; in-IDE `test:codebasegraph` still passes (verifies untouched original); orchestrator diff glance.
6. **Orchestrator pre-flight for Phase 4** (boundary — orchestrator-owned acceptance test): author `packages/codebase-graph-mcp/tests/tool-surface.acceptance.test.ts`. Test spawns compiled server, calls each of 6 tools over MCP JSON-RPC on a TS fixture, asserts golden shapes. Run locally; confirm it FAILS against current code (only `ping` wired). Then dispatch.
7. **Phase 4** (sonnet-implementer) — wire full MCP tool surface. Brief includes: replace `ping` stub with full surface; per-tool files under `src/tools/` (300-line cap discipline); migrate `mcpToolHandlerSearch.ts` + `mcpToolHandlerValidation.ts` into the package; `[trace:graph-mcp.tool.<name>]` log line shape; "you may not modify the acceptance test." Verify cross-package contract: the test resolves the package to `dist/`, not source. Gate: acceptance test passes; data-shape probes pass; zero `console.log` in `packages/codebase-graph-mcp/src/`. **`sonnet-phase-reviewer` dispatch on diff before declaring gate green** — boundary phase.
8. **Phase 5** (sonnet-migration-executor) — execute deletion blueprint. Brief includes: read Phase 2 blueprint (`wave-22-architect-deletion-blueprint.md`); execute steps in order; after each step verify `npm run build` + `npx tsc --noEmit` green; halt on first failure and surface to orchestrator. Catalog routing per `~/.claude/rules/agent-catalog.md`: `sonnet-migration-executor` is the right shape (blueprint exists; step-by-step execution; gate after each step). Explicit "you may not improvise — if a step's verification fails, halt." Gate: `src/main/codebaseGraph/` does not exist; `src/main/contextLayer/repoMap*` + `contextInjector*` do not exist; main.ts boots cleanly; `npm run build` green; `npx tsc --noEmit` clean; `npm run test:main` passes; manual `npm run dev` shows no renderer console errors on disappearing IPC. **`sonnet-phase-reviewer` dispatch on diff before declaring gate green** — large deletion + critical-path edits = high mental-model-divergence risk.
9. **Phase 6** (orchestrator + sonnet-smoke-runner) — cross-project smoke. Install `mcpServers.codebase-graph-mcp` block in 3 project files (Agent IDE — refresh from Phase 1, Contractor App, Gamify). Verify `meta_boundary_enforce.mjs` hook denies meta-path writes (expected); file meta install as cross-boundary follow-up. For Gamify: invoke first-time indexing; capture wall-clock; if > 4 hrs invoke relief valve and file follow-up. Critical: Agent IDE smoke is the regression-validation step — the standalone server must re-index Agent IDE from scratch (in-IDE graph DELETED in Phase 5) and return valid query results. `sonnet-smoke-runner` may not fit Phase 6 cleanly (no UI surface); orchestrator may run the smoke directly as a `Bash`-driven exercise. Write smoke report. Gate: smoke report present; ≥ 2 projects have non-empty graph queries; per-project latency captured.
10. **Phase 7** (sonnet-implementer) — docs + meta follow-ups. Brief includes: `roadmap/docs/standalone-mcp.md` shape; root CLAUDE.md rewrite scope ("Codebase Graph" section + "Folder Map" + "Known Issues"); the meta follow-up at `meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md` with frontmatter + `mcpServers` block payload + `graph-tool-routing.md` rule update payload. Gate: docs render; markdown lint clean; orchestrator diff glance.
11. **Phase 8** (orchestrator) — wave wrap. Run scoped suites: `npm run test:main`, `npm run test:codebase-graph-mcp`. Full `npm run lint`, `npx tsc --noEmit`, formatter. Inside `packages/codebase-graph-mcp/`: `npm run build` + `npm pack` (local tarball). Attempt `npm publish` against `@hesnotsoharry/codebase-graph-mcp` per Decision 7; if friction (auth, scope-registration, naming collision), file follow-up at `roadmap/follow-ups/2026-05-26-codebase-graph-mcp-npm-publish.md`. `/review` mechanical gap-check — verdict gates merge. Orchestrator diff review of the whole wave — especially Phase 5 deletion blast radius. Run data-shape probes from §Verification. Write `wave-22-result.md` with explicit "Lost capabilities" section. `CHANGELOG.md [unreleased]` entry. `git push` per standing posture. `HANDOFF.md` flip. `/audit-followups wave-22-graph-standalone-mcp` — should auto-archive the source FU. `/promote-vendor-lessons 22` — surface MCP SDK + better-sqlite3 + npm-packaging + monorepo-workspaces lessons. **Merge worktree to master + remove**: `git checkout master && git merge wave-22-graph-standalone-mcp --no-ff -m "wave-22: …" && git worktree remove .worktrees/wave-22-graph-standalone-mcp && git branch -d wave-22-graph-standalone-mcp` (per `memory/worktree-merge-and-close-discipline.md`). Manual smoke gate: NOT required — no `src/renderer/components/Layout/**` changes (deletions are in main + IPC handlers, renderer-side updates are only to remove dead callers).
