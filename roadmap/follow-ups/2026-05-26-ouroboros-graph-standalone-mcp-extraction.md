---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
priority: HIGH
source: meta-verification-2026-05-26
blocker: wave-87-completion
---

# Ouroboros codebase graph — Standalone MCP extraction

**Status:** OPEN
**Source:** Meta verification report 2026-05-26 + cross-project tooling investigation
**Filed:** 2026-05-26
**Suggested wave shape:** Architectural wave via `/wave-plan` (Phase 1 plan + Phase 2-N execution)
**Estimated effort:** 3-5 dev days
**Prerequisite (HARD BLOCKER):** Wave 87 chat orchestration rework completion (current "Ouroboros overhaul" per `meta/projects/agent-ide.md:25-26`)
**Prerequisite (SOFT):** Tier-1 + Tier-2 waves shipped (clean baseline)

## Background

Currently the Ouroboros codebase graph is internal to Agent IDE — accessed by Claude Code only when running inside the IDE via `internalMcpAutoInject`. This means:
- Only Agent IDE + Contractor App are indexed (per `graph-tool-routing.md:57-58`)
- Gamify + meta-framework sessions fall back to Grep/Read for symbol queries (significantly degraded)
- The 60% context budget gate is harder to honor in those sessions because graph queries that would return targeted results are unavailable

Extracting the graph subsystem as a standalone MCP server unlocks cross-project value. Configuration would live in `~/.claude/settings.json` `mcpServers` block so every project session benefits.

**Why this is feasible (code-grounded):** Sonnet-explorer read of `src/main/codebaseGraph/` on 2026-05-26 confirmed ~80% of files are already portable (no Electron, no IDE-specific deps). Only the coupling-boundary files need rewrites, and those are mechanical (inject parameters instead of singletons).

## Scope

### Lift-and-shift (no rewrite, ~80% of files)

- All 6 Cypher engine files (`cypherEngine.ts` + companions)
- `graphDatabaseSchema.ts`, `graphDatabaseMigrations.ts`, `graphDatabaseTraversal.ts`
- `treeSitterLanguageConfigs.ts`, `treeSitterTypes.ts`, all `treeSitterParser*.ts`
- All 4 pass files (`enrichmentPass`, `testDetectPass`, `httpLinkPass`, `gitCoChangePass`)
- `graphPageRank.ts`, `parseAnomalyDetection.ts`, `concurrency.ts`
- `mcpToolHandlerValidation.ts`, `mcpToolHandlerSearch.ts`
- `indexingPipelineStructure.ts`, `indexingPipelineTypes.ts`
- `detectChangesForSessionTypes.ts`

### Rewrites / shim replacements (~20% of files)

1. **`graphDatabaseHelpers.ts:29-37`** — Extract `getDbPath()` into an injected parameter on `GraphDatabase` constructor. Currently does `require('electron')` in a try-catch. (~30 min)
2. **Logger** — Replace `import log from '../logger'` with an injected `Logger` interface in ~8 files. Mechanical. (~1 hour)
3. **`indexingWorkerClient.ts`** — Replace IDE-specific `__dirname` worker path resolution. (~30 min)
4. **`gitCoChangePass.ts`** — Replace `../../util/gitExec` with direct `child_process.spawn` or injected `runGit` function. (~30 min)
5. **`autoSync.ts`** — Remove `getIndexingWorkerClient()` singleton import; accept worker client as constructor parameter. (~1 hour)
6. **`graphGc.ts`** — Same singleton removal. (~30 min)
7. **`graphStore.ts`** — Replace `../storage/database` import with direct `better-sqlite3` call. (~1 hour)
8. **MCP handler files** — Replace `internalMcpTypes` import with standalone types file. (~1 hour)
9. **`internalMcpAutoInject.ts`** — Replace with simple static `.mcp.json` generator (or skip — standalone server doesn't need auto-inject). (~2 hours)

### New work

- **Standalone MCP server entry point** (`ouroboros-mcp.js` or similar). Note: a standalone exists per `internalMcpAutoInject.ts:113`; verify it doesn't carry IDE deps. (~1 day)
- **`better-sqlite3` ABI handling** — current standalone runs under Electron with `ELECTRON_RUN_AS_NODE=1`. A truly standalone Node extraction needs a separate Node-ABI-compiled binding. **This is the biggest unknown** — if rebuild infrastructure doesn't exist, could add 0.5–1 day. (variable)
- **Packaging** — npm package OR standalone binary via `pkg` / similar. Decision required.
- **`~/.claude/settings.json` `mcpServers` configuration** — meta-side, lives in the meta repo. Coordinate with meta session.
- **Index Gamify + meta repos** — first-run indexing for the two codebases not currently covered.
- **Smoke tests against all 4 codebases** — verify the graph tools work in each project's session.

## Phase shape (suggested)

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | sonnet-implementer | Capture: packaging choice (npm vs binary), ABI handling decision, deprecation plan for `internalMcpAutoInject` |
| 1 | Inject `getDbPath` + Logger interface | sonnet-implementer | Mechanical — but verify all consumer paths still compile |
| 2 | Decouple worker client singleton | sonnet-implementer | `autoSync` + `graphGc` + `indexingWorkerClient` |
| 3 | Decouple gitExec | haiku-implementer | Mechanical |
| 4 | Standalone server entry point | sonnet-implementer | Verify the existing standalone path; remove `ELECTRON_RUN_AS_NODE` dependency |
| 5 | Packaging + ABI rebuild | sonnet-implementer | The unknown — may need build pipeline work |
| 6 | Smoke test across 4 codebases | orchestrator + sonnet-smoke-runner | Index Gamify + meta; query in each project's session |
| 7 | Meta-side `~/.claude/settings.json` config + docs | (meta session) | Cross-boundary handoff |

## Risks

| Risk | Mitigation |
|---|---|
| `better-sqlite3` ABI rebuild requires changes to build pipeline | Spike before committing to wave: try `npm install better-sqlite3 --build-from-source` against system Node and see if existing pipeline produces a working binding |
| Standalone server diverges from in-IDE behavior over time | Treat the standalone path as the primary; in-IDE wraps it (or shares the codebase). Avoid two parallel maintenance trees. |
| Indexing performance differs under standalone (no shared event loop with IDE) | Smoke-test against Agent IDE's own graph first; compare query latency before/after |
| Wave 87 changes the surface area significantly | Defer this wave until Wave 87 lands. This FU is gated explicitly. |

## Acceptance criteria

- [ ] Standalone MCP server runs `npx @ouroboros/codebase-graph-mcp` (or equivalent) from any working directory
- [ ] `~/.claude/settings.json` `mcpServers` entry added; tools surface in fresh project sessions
- [ ] `mcp__ouroboros__*` tools available in Gamify session, meta session, and Contractor App session
- [ ] Gamify repo indexed; `search_graph` returns results
- [ ] meta repo indexed; `search_graph` returns results
- [ ] Agent IDE behavior unchanged (the in-IDE auto-inject path either still works or is cleanly deprecated)
- [ ] No regression in existing Ouroboros graph tests
- [ ] Cross-project graph queries observed working in real Claude Code sessions

## Out of scope

- **OSS publication** — separate decision per `roadmap/follow-ups/cypher-engine-feature-additions.md` (Wave 77-C spike). This wave produces a standalone server for internal cross-project use; OSS release is a follow-on decision.
- **Cypher engine improvements** — handled in the Tier-1 / Tier-2 cleanup waves and Wave 77-B (`WITH` support).
- **Other languages / SCIP / LSIF export** — future direction; file separate FU if/when desired.

## References

- Meta verification report (with code-grounded extraction analysis): `C:\Web App\meta\discovery\2026-05-26-ouroboros-verification-report.md` (section "IDE coupling vs portable" — file-by-file categorization)
- Best-practice scan: `C:\Web App\meta\discovery\2026-05-26-codebase-graph-best-practice.md`
- Wave 87 status: `meta/projects/agent-ide.md:25-26` ("Codebase-graph integration with rules — ADOPT. graph MCP is partially overhauled (Wave 87 chat orchestration rework in progress)")
- Existing standalone path reference: `src/main/internalMcp/internalMcpAutoInject.ts:113`
- Cross-project gap evidence: `~/.claude/rules-deferred/graph-tool-routing.md:57-58` (Agent IDE + Contractor App indexed; Gamify + meta not)
