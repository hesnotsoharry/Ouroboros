---
status: DRAFT
created: 2026-05-26
updated: 2026-05-26
wave: 21
slug: ouroboros-graph-tier-2-improvements
type: substantive
predecessor: wave-20-ouroboros-graph-tier-1-cleanup
severity: MED
---

# Wave 21 — Ouroboros Codebase Graph: Tier-2 Improvements

## Status

DRAFT · target v2.20.1 (folds into next CHANGELOG `[unreleased]`) · drafted 2026-05-26.

## Context — why this wave exists

Wave 20 (Tier-1 cleanup) closed the polish items in `src/main/codebaseGraph/`. Two **substantive** items from the meta verification report (2026-05-26) remained out of scope: an OOP completeness gap and an incremental-indexing perf gap. Both are file:line-specific, orthogonal to the deliberate "build custom Cypher engine" direction locked in `wave-68-decisions.md`, and pre-flight-confirmed in this session's grounding pass.

**Pre-flight grounding (this session):**

- `src/main/codebaseGraph/passes/enrichmentPass.ts:64-65` carries the placeholder comment: *"IMPLEMENTS edges are a placeholder — tree-sitter extraction would need to expose implements/extends info from class_heritage nodes first."* Verified.
- `src/main/codebaseGraph/passes/testDetectPass.ts:142-144` calls `db.getNodesByLabel(projectName, 'Function').concat(db.getNodesByLabel(projectName, 'Method'))` on every reindex. The query is index-backed (`idx_nodes_label`) but still loads every Function + Method row in the project on each call. For a ~5k-function codebase this is ~10k row reads per save (autoSync triggers under a 300ms+3s debounce, but the cost still grows linearly with codebase size).
- `src/main/codebaseGraph/graphDatabaseTypes.ts` already declares both `IMPLEMENTS` (line 31) and `EXTENDS` (line 41) in the `EdgeType` union. **No schema migration required.** The gap is purely extraction-side: `ExtractedDefinition` has no fields for heritage info, and `treeSitterParserDefs.ts` does not walk `class_heritage` children.
- The tree-sitter TS/TSX grammar exposes `class_heritage` with named-child fields `extends_clause` and `implements_clause`, both accessible via `node.childForFieldName('extends_clause')` / `childForFieldName('implements_clause')`. `web-tree-sitter@^0.26.8` (current per `.claude/vendor-gotchas/tree-sitter.md`) supports ABI 13–15; the `@vscode/tree-sitter-wasm@0.3.x` grammars on ABI 15 cover TS/TSX cleanly. Full grounding extract at `research-21.md` in this folder.
- `testDetectPass` is invoked from a single call site at `indexingPipeline.ts:145` inside `runEnrichmentPasses()`. `enrichmentPass` is invoked at `indexingPipeline.ts:150` from the same parent. Both run on every index (incremental or full). `testDetectPass` receives the filtered `indexedFiles` list (changed files only on incremental); `enrichmentPass` does not receive any file list — it walks the DB.
- `definitionPass` (in `indexingPipelinePasses.ts`) uses Wave 19's two-phase node-then-edge insertion to avoid FK violations on multi-chunk runs. Any heritage edges Wave 21 emits MUST land in the edge-phase batch, not interleaved with node inserts.

**Companion context.** This wave precedes the standalone-MCP extraction (`roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md`) which is hard-blocked on Wave 87. Cole's stated plan: finish the Tier-2 cleanup before extraction so the extracted subsystem ships with these gaps closed.

## Goal

After Wave 21, the codebase graph's `class_heritage` extraction for TypeScript and TSX classes lands as IMPLEMENTS edges (class → interface) and EXTENDS edges (class → parent class) in the graph DB, populated by `definitionPass`, gated by target-node resolution against `symbolsByName` (Wave 19's filter-edge safety net). `trace_call_path` can follow interface → implementation relationships; the Cypher query `MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface) RETURN c, i` returns real rows over Agent IDE's own indexed graph. Separately, `testDetectPass` reads its Function+Method symbol index from a per-project module-level cache invalidated by changed-file QN prefix, eliminating the per-reindex full-label scan; observable via a new `[trace:testDetectPass.cache]` log line.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-21-DRAFT/wave-21-decisions.md` (renamed to `roadmap/wave-21-ouroboros-graph-tier-2-improvements/wave-21-decisions.md` on validation pass).

1. **Phase 1 extraction scope: TypeScript and TSX only.** Industry standard YAGNI: Agent IDE's own codebase is TS/TSX; immediate value here. Java, C++, C#, Python, Ruby — separate follow-up. Rust traits and Go interface embedding are explicitly out (research-21.md notes both have weak inheritance signals that wouldn't justify the extraction cost). NOT chosen: ship all OO languages at once (multiplies surface for marginal value; each language has its own heritage-node-name conventions).
2. **Edge emission site: `definitionPass` in `indexingPipelinePasses.ts`, NOT `enrichmentPass`.** REQUIRES USER LOCK. Recommended: `definitionPass`. Rationale: (a) the heritage data is in the `ExtractedDefinition` produced by the parser, so the edge insert is co-located with the source class/interface node insert; (b) `definitionPass` already uses the Wave 19 two-phase node-then-edge pattern — heritage edges naturally land in the edge phase, with the FK constraint protected by the existing `runChunkedPass` boundary; (c) `enrichmentPass` runs AFTER `definitionPass` and would require a second DB scan to find heritage-bearing classes. The placeholder comment in `enrichmentPass.ts:64-65` will be removed and pointed at `definitionPass`. NOT chosen: keep IMPLEMENTS in `enrichmentPass` for symmetry with the existing comment — symmetry doesn't beat one extra scan + duplicate data flow.
3. **testDetectPass cache shape: module-level `Map<projectName, FunctionIndex>` inside `testDetectPass.ts`.** Industry standard for per-pass memoization. NOT chosen: cache inside `GraphDatabase` (premature generalization — no other pass needs this index yet; if a second consumer emerges, promote then); NOT chosen: an LRU with size cap (FIFO at N=10 projects is enough — Agent IDE's worst case is ~3 concurrent project roots). Invalidation policy: caller passes `changedFiles: Set<string>` derived from the incremental file list; if any changed file's relativePath would produce a QN prefix present in the cache's index, that project's entry is invalidated and rebuilt. Full reindex paths invalidate unconditionally.
4. **IMPLEMENTS/EXTENDS target resolution policy: skip edges whose target_id doesn't resolve in the project's `symbolsByName`.** Industry standard (mirrors Wave 19's `callResolutionPass` filterEdges pattern). Classes implementing third-party interfaces (`implements EventEmitter` where `EventEmitter` is from `node:events`) produce no graph edge — the interface isn't a node in the project graph. This is honest behavior: the graph is project-internal. Future work could synthesize external-interface stub nodes if a real consumer needs cross-package heritage; out of scope here.
5. **EXTENDS edge for class-extends-class: in scope.** The FU only names IMPLEMENTS but the work to extract `extends_clause` is in the same code path, and EXTENDS is already in `EdgeType`. Shipping both is cheaper than shipping IMPLEMENTS alone and then re-touching `treeSitterParserDefs.ts` for EXTENDS in a later wave. NOT chosen: ship only IMPLEMENTS to match the FU literally — the FU's spirit is OOP completeness, not pedantic scope-matching.
6. **Phase 1 boundary classification: boundary phase.** Rationale: emits new edge types into a persisted schema; downstream Cypher queries and the `trace_call_path` MCP tool consume the result. The orchestrator authors a failing acceptance test BEFORE dispatching the implementer (per `~/.claude/rules-deferred/orchestrator-owned-acceptance-tests.md`). Phase 2 is NOT a boundary phase — pure-logic perf refactor with same I/O contract.

## Scope

**In scope:**

- **Phase 1** — TS/TSX `class_heritage` extraction → IMPLEMENTS + EXTENDS edges via `definitionPass`. Files: `treeSitterParserDefs.ts` (heritage child walk), `treeSitterTypes.ts` (extend `ExtractedDefinition` with `implements?: string[]` and `extends_?: string | null` — note name mangling because `extends` is a JS keyword; the field name will need an underscore or different identifier per implementer judgment), `indexingPipelinePasses.ts` (`definitionPass` consumes the new fields and emits edges with FK-safe target resolution), `passes/enrichmentPass.ts` (remove placeholder comment block, point at `definitionPass`). New unit tests in `treeSitterParserDefs.test.ts` (or sibling); new integration test in `indexingPipelinePasses.test.ts` (or new file). Acceptance test (orchestrator-authored) lives at `src/main/codebaseGraph/indexingPipeline.heritageEdges.acceptance.test.ts` (or similar) — implementer may not modify it.
- **Phase 2** — `testDetectPass` incrementality via module-level cache. Files: `passes/testDetectPass.ts` (new cache module-state, signature change to accept `changedFiles: Set<string>`, invalidation logic, `[trace:testDetectPass.cache]` log line), `indexingPipeline.ts:145` (pass `changedFiles` to the call). New tests in `testDetectPass.test.ts` (cache hit/miss/invalidation).
- **Phase 3** — Wave wrap: scoped suites (`test:codebasegraph`, `test:main`), full lint + typecheck + formatter, `/review` mechanical, `wave-21-result.md`, `CHANGELOG.md [unreleased]` entry, `HANDOFF.md` flip, `/promote-vendor-lessons 21`, `/audit-followups wave-21-ouroboros-graph-tier-2-improvements`. Merge worktree to master + remove (per `memory/worktree-merge-and-close-discipline.md`).

**Out of scope:**

- **Other OO languages** (Java, C++, C#, Python, Ruby, Swift, Kotlin, Scala). Separate follow-up if/when a real consumer emerges. Document the language matrix in the result brief so the next wave has the breadcrumb.
- **Method overrides** (DEFINES_METHOD vs OVERRIDES) — not in the source FU; not a meaningful gap for the consumer surface in the standalone-MCP extraction roadmap.
- **External interface stub nodes** (synthesizing nodes for third-party interfaces like `node:events.EventEmitter`). Defer per Decision 4.
- **Standalone MCP extraction** — `roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md`; hard-blocked on Wave 87.
- **Wave 77-B `WITH` clause support** — separate track.
- **Promoting the `testDetectPass` cache to `GraphDatabase` as a shared symbol-index abstraction.** Premature; revisit when a second pass needs it.
- **`enrichmentPass` extension to walk more entry-point heuristics** — Decision 2 only removes the IMPLEMENTS placeholder; doesn't expand the pass otherwise.
- **Schema changes / DDL migrations** — N/A. `IMPLEMENTS` + `EXTENDS` already in `EdgeType`; the edge `type` column is `TEXT` without a CHECK constraint.

## Phases

| Phase | Topic | Implementer | Notes |
|-------|-------|-------------|-------|
| 0 | ADR — ratify Decisions 2 (emission site) and 3 (cache shape). Default recommendation: `definitionPass` + module-level Map. Cole's call. | orchestrator + Cole | Read this plan + research-21.md; surface Decision 2 with the FK-safety rationale + co-location argument as the case for `definitionPass`. Update `wave-21-decisions.md` PENDING→RESOLVED. No code. Test shape: **n/a**. |
| 1 | TS/TSX class_heritage extraction → IMPLEMENTS + EXTENDS edges in `definitionPass` | sonnet-implementer | **Boundary phase.** Orchestrator authors failing acceptance test FIRST at `src/main/codebaseGraph/indexingPipeline.heritageEdges.acceptance.test.ts`: builds a small TS fixture with `class Foo extends Base implements IA, IB { }` + corresponding `class Base { }` + `interface IA { }` + `interface IB { }` in the same project; runs the full pipeline; asserts the resulting DB contains exactly 1 EXTENDS edge (Foo→Base), 2 IMPLEMENTS edges (Foo→IA, Foo→IB), and 0 dangling edges. Test fails against current code. Implementer brief includes "you may not modify the acceptance test." Implementer changes: (a) `treeSitterTypes.ts` — extend `ExtractedDefinition` with `implements?: string[]` and `extendsClause?: string | null` (avoid the `extends` keyword as a field name); (b) `treeSitterParserDefs.ts` — in the class-handling path, find `class_heritage` via `node.childForFieldName('class_heritage')` (or walk `namedChildren` per research-21.md guidance), then read `extends_clause`/`implements_clause` children and extract identifier names; (c) `indexingPipelinePasses.ts` `definitionPass` — for each `ExtractedDefinition` of kind `Class` with heritage data, emit IMPLEMENTS / EXTENDS edges resolving target via `symbolsByName.get(name)?.[0]` (same lookup style as the existing call-resolution pass); skip edges with unresolved targets; insert as part of the existing edge-phase batch (no new chunked pass); (d) `passes/enrichmentPass.ts` — remove the placeholder comment block at lines 12-13 + 64-65, replace with a short note pointing at `definitionPass` as the IMPLEMENTS source. Add `[trace:definitionPass.heritage]` log line summarizing extracted+emitted+filtered counts per project to keep observability in line with the rest of the pass. Test shape: **honeycomb** (boundary; integration test at the indexer→DB seam is the contract verification). Gate: acceptance test passes; `npm run test:codebasegraph` passes; orchestrator dispatches `sonnet-phase-reviewer` on the diff before declaring the gate green. |
| 2 | testDetectPass incrementality — module-level cache with per-file invalidation | sonnet-implementer | NOT a boundary phase (pure-logic refactor with same I/O contract). Implementer changes: (a) `passes/testDetectPass.ts` — declare a module-level `Map<projectName, { allFunctions: GraphNode[]; functionsByName: Map<string, string[]>; }>`; FIFO cap at 10 projects (Agent IDE worst-case is ~3 concurrent roots; 10 is comfortable headroom); extend `testDetectPass`'s signature to `testDetectPass(db, projectName, indexedFiles, changedFiles?: Set<string>)`; if `changedFiles === undefined` (full reindex) OR ANY entry of `changedFiles` would produce a QN prefix that intersects the cached `functionsByName`, invalidate and rebuild; otherwise use the cache. Emit a `[trace:testDetectPass.cache]` log line on every call (`hit projectName=X durationMs=N` or `miss reason=R durationMs=N`); (b) `indexingPipeline.ts:145` — compute `changedFiles` from `indexedFiles` (set of relativePaths of files that have parsed defs) and pass to the call; (c) extend `testDetectPass.test.ts` to cover: cache hit (subsequent call with empty `changedFiles` reuses), cache miss on changed file (rebuild observable), full-reindex path (cache invalidated unconditionally), FIFO eviction at N=10. Test shape: **pyramid** (pure logic; unit tests carry the load). Gate: `npm run test:codebasegraph` passes; new tests pass; `[trace:testDetectPass.cache]` log line observable when running indexer manually on a fixture. |
| 3 | Wave wrap | orchestrator | Run scoped suites (`npm run test:codebasegraph`, `npm run test:main`), full `npm run lint`, `npx tsc --noEmit`, `npm run format` (or prettier `--write` on touched files). `/review` mechanical gap-check — verdict gates merge. Orchestrator diff review of the whole wave. Run the data-shape probes from §Verification. Write `wave-21-result.md`. `CHANGELOG.md [unreleased]` entry. `git push` per standing posture; CI observable but not gating (bulletin: GH minutes exhausted through 2026-06-01). `HANDOFF.md` flip. `/audit-followups wave-21-ouroboros-graph-tier-2-improvements` — should auto-archive the source FU. `/promote-vendor-lessons 21` — extract any web-tree-sitter / SQLite gotchas surfaced during the wave. Merge worktree to master + delete worktree (per `memory/worktree-merge-and-close-discipline.md`). Test shape: **n/a**. |

### Phase ordering

Phase 0 gates Phases 1 and 2 (ADR ratification). Phases 1 and 2 are on **disjoint file surfaces**:

- Phase 1 touches: `treeSitterTypes.ts`, `treeSitterParserDefs.ts`, `indexingPipelinePasses.ts`, `passes/enrichmentPass.ts`, new acceptance + unit tests.
- Phase 2 touches: `passes/testDetectPass.ts`, `indexingPipeline.ts`, extends `testDetectPass.test.ts`.

No shared files between the two. Safe to dispatch in parallel. Phase 3 (wrap) blocks on both.

```
Phase 0 (ADR ratification)
   |
   +---> Phase 1 (heritage edges — boundary phase, sonnet-implementer)
   |        |
   |        v
   |     orchestrator: sonnet-phase-reviewer dispatch
   |        |
   |        v
   |     gate green
   |
   +---> Phase 2 (testDetectPass cache — sonnet-implementer)
                                 |
                                 v
                       Phase 3 (wrap, orchestrator)
```

Practical dispatch: orchestrator surfaces Decision 2 + Decision 3 to Cole in Phase 0; on ratification, dispatches Phases 1 and 2 in parallel in the same turn. Phase 1's acceptance test is orchestrator-authored BEFORE dispatch.

## Risks

| Risk | Mitigation |
|------|------------|
| `class_heritage` extraction breaks the existing class-definition path for classes WITHOUT heritage (the common case). | Implementer adds test cases for all four shapes: no heritage, extends only, implements only, extends + implements. Existing `treeSitterParserDefs.test.ts` cases for classes must continue to pass. Acceptance test fixture includes a "class with no heritage" assertion (the existing DEFINES edge still fires; no spurious IMPLEMENTS/EXTENDS). |
| Resolving heritage target names via `symbolsByName` produces wrong targets when two interfaces share a name across different project sub-packages. | `symbolsByName.get(name)?.[0]` returns the FIRST match — same selection as the existing call-resolution pass. Document the tradeoff in the result brief: same-name interfaces in different packages map to one of them arbitrarily. Future work could disambiguate via import scope; out of scope here. |
| FK violations on IMPLEMENTS/EXTENDS edges if the interface node hasn't been inserted yet in the same `definitionPass` chunk. | The Wave 19 two-phase node-then-edge insertion in `definitionPass` covers this: nodes for ALL chunks complete before any edge for any chunk runs. Heritage edges land in the edge phase by construction. The `symbolsByName` filter is the second-line defense for unresolved targets (third-party interfaces). |
| Module-level cache in `testDetectPass` leaks memory across projects on long IDE sessions. | FIFO cap at 10 projects (Decision 3). Each entry's payload is bounded by Function+Method count; for a 50k-symbol project this is ~5 MB — at N=10 the soft ceiling is ~50 MB, acceptable. Add an explicit eviction unit test. |
| `changedFiles` plumbing changes the worker protocol or breaks the worker import graph (per the gotcha in `codebaseGraph/CLAUDE.md` line 121). | `testDetectPass` runs in the SAME context as `indexingPipeline.ts:145` — both are inside the worker's `IndexingPipeline.runIndex()` call path. No IPC, no protocol change. The new `changedFiles: Set<string>` parameter stays within worker context. Verify via grep that the new parameter doesn't surface in any worker message types. |
| The `extends` field name in `ExtractedDefinition` is a JS reserved word and would parse-fail or trigger lint warnings. | Decision: use `extendsClause: string \| null` (no underscore, no keyword conflict). Or `parentClass`. Implementer picks one; the acceptance test references the chosen name. |
| Cypher engine's variable-path traversal doesn't handle new edge types correctly (e.g., depth limits, cycle detection). | IMPLEMENTS and EXTENDS are stored as opaque type strings — the cypher engine handles all edge types uniformly. No engine change needed. Verify by running an existing varpath query against the new edges as part of Phase 1's integration test. |
| `[trace:definitionPass.heritage]` and `[trace:testDetectPass.cache]` log lines accumulate noise in normal IDE sessions. | Both use the project's standard logger at `info` level (per `~/.claude/rules/debug-before-fix.md` proactive-debug-coverage doctrine); they're greppable and gated by the logger's runtime level. Not noise — observability for a feature whose behavior is otherwise invisible. |
| Phase 2's cache invalidation logic misses an edge case (changed file outside the cached project's QN namespace), silently returning stale data. | Phase 2 unit test explicitly covers: change a file in `projectA/src/foo.ts` while project B's cache exists — project A's cache invalidates, project B's stays. Plus the full-reindex path always invalidates unconditionally. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|-------|------|-------------|-------|
| 0 | n/a | n/a | ADR — no code. |
| 1 | New cases in `treeSitterParserDefs.test.ts` (or a sibling) covering: class without heritage (existing behavior preserved), class extends only, class implements one, class implements multiple, class extends + implements multiple. `definitionPass` unit cases for: heritage edges emitted with resolvable targets, heritage edges SKIPPED with unresolvable targets, no edges for classes without heritage. | **Orchestrator-authored acceptance test** at `src/main/codebaseGraph/indexingPipeline.heritageEdges.acceptance.test.ts` runs the full pipeline on a TS fixture project; asserts exact edge set in DB (1 EXTENDS, 2 IMPLEMENTS, 0 dangling). Plus existing `indexingPipelinePasses.test.ts` re-runs to catch DEFINES regressions. | **Honeycomb** — boundary phase, MCP/DB seam; integration test IS the contract verification. |
| 2 | New cases in `testDetectPass.test.ts`: (a) two consecutive calls with identical `indexedFiles` and empty `changedFiles` — second call hits cache, no `db.getNodesByLabel` invocation (verify via spy); (b) call with non-empty `changedFiles` whose QN prefix intersects cache — cache rebuild observable; (c) full-reindex path (changedFiles undefined) — cache always invalidated; (d) FIFO eviction at N=11 — oldest project entry evicted; (e) cache miss on first call (cold). | Existing `indexingPipelinePasses.test.ts` (or wherever testDetectPass is exercised in pipeline) re-runs unchanged — proves I/O contract preserved. | **Pyramid** — pure logic, mocked DB; cheap unit tests carry the load. |
| 3 | n/a | n/a | Wrap. |

## Acceptance criteria

- [ ] **Phase 1**: `grep -n "childForFieldName('class_heritage')" src/main/codebaseGraph/treeSitterParserDefs.ts` returns ≥ 1 hit, OR `grep -n "class_heritage" src/main/codebaseGraph/treeSitterParserDefs.ts` returns ≥ 1 hit (allowing implementer choice of access pattern per research-21.md).
- [ ] **Phase 1**: `grep -nE "implements\??:" src/main/codebaseGraph/treeSitterTypes.ts` returns ≥ 1 hit in `ExtractedDefinition`.
- [ ] **Phase 1**: `grep -nE "extendsClause\??:|parentClass\??:" src/main/codebaseGraph/treeSitterTypes.ts` returns ≥ 1 hit in `ExtractedDefinition` (the implementer-chosen name for the extends field).
- [ ] **Phase 1**: After running `definitionPass` on a fixture project with `class Foo extends Base implements IA, IB {}` + corresponding `class Base {}` + `interface IA {}` + `interface IB {}` definitions in the same project, querying the DB yields exactly: 1 EXTENDS edge (Foo→Base), 2 IMPLEMENTS edges (Foo→IA, Foo→IB), 0 dangling edges.
- [ ] **Phase 1**: For a class with `implements ExternalLib.Foo` where `ExternalLib.Foo` is NOT a node in the project graph, no IMPLEMENTS edge is emitted (skipped via `symbolsByName` resolution).
- [ ] **Phase 1**: Existing class-without-heritage tests in `treeSitterParserDefs.test.ts` all pass.
- [ ] **Phase 1**: Orchestrator-authored acceptance test at `src/main/codebaseGraph/indexingPipeline.heritageEdges.acceptance.test.ts` (or implementer-renamed equivalent declared by orchestrator) passes; implementer did not modify the test file.
- [ ] **Phase 1**: Live Cypher query against Agent IDE's own indexed graph — `MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface) RETURN c.name, i.name LIMIT 10` — returns ≥ 1 real row (the project has IMPLEMENTS-bearing classes; e.g., `GraphControllerCompat implements GraphControllerLike`).
- [ ] **Phase 1**: `[trace:definitionPass.heritage]` log line appears once per project per index run, with extracted/emitted/filtered counts.
- [ ] **Phase 2**: `grep -nE "getNodesByLabel\(projectName, 'Function'\)" src/main/codebaseGraph/passes/testDetectPass.ts` returns zero hits outside the cache-miss rebuild block.
- [ ] **Phase 2**: `testDetectPass`'s signature accepts `changedFiles?: Set<string>` and `indexingPipeline.ts` line ~145 passes it through.
- [ ] **Phase 2**: `[trace:testDetectPass.cache]` log line emitted on every call with `hit` or `miss` keyword + durationMs.
- [ ] **Phase 2**: On a fixture project, two consecutive `testDetectPass` calls with empty `changedFiles` — second call's `[trace:testDetectPass.cache] hit` durationMs is materially smaller (≤ 1/10) than the first call's `miss` durationMs.
- [ ] **Phase 2**: FIFO eviction at N=10 verified by unit test (`testDetectPass.test.ts` synthesizes 11 distinct project keys, asserts oldest is evicted).
- [ ] **Phase 3**: `npm run test:codebasegraph` passes (full subsystem suite).
- [ ] **Phase 3**: `npm run test:main` passes (or any failures are pre-existing and filed separately — channelCatalog from Wave 20 remains the known carry-over).
- [ ] **Phase 3**: `npm run lint` returns 0 errors (4 pre-existing warnings from Wave 20 carry over and are not Wave 21's responsibility).
- [ ] **Phase 3**: `npx tsc --noEmit` clean.
- [ ] **Phase 3**: `/review` mechanical PASS or FLAG-with-flags-addressed.
- [ ] **Phase 3**: `wave-21-result.md` written; `CHANGELOG.md [unreleased]` entry appended.
- [ ] **Phase 3**: `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-2-improvements.md` auto-closed by `/audit-followups` (or manually flipped to RESOLVED and moved to `_archived/follow-ups/`).
- [ ] **Phase 3**: Worktree merged to master (`git checkout master && git merge wave-21-ouroboros-graph-tier-2 --no-ff`) and removed (`git worktree remove .worktrees/wave-21-ouroboros-graph-tier-2 && git branch -d wave-21-ouroboros-graph-tier-2`).
- [ ] **Phase 3**: `HANDOFF.md` flipped to "Wave 21 SHIPPED" with Wave 22 (standalone-MCP extraction, blocked on Wave 87) as next candidate.

## Verification

### Per-phase experiential observation

The data-shape probes below confirm the JSON / SQL row shape. They do NOT confirm the user observes anything different — that's what this table is for. Each row anchors a phase to a concrete user-facing surface and the full path from change site to observation.

| Phase | Observation point | Path to it | What "working" looks like there |
|-------|-------------------|------------|---------------------------------|
| 0 | The ADR file `wave-21-decisions.md` on disk reflecting Cole's pick for Decisions 2 and 3 | local edit → `wave-21-decisions.md` → Decision 2 and Decision 3 sections flipped from PENDING to RESOLVED | Cole reads the plan in the IDE, replies in chat ratifying Option `definitionPass` + module-level Map. The file's Pick/Rationale/Consequences blocks show non-stub content. |
| 1 | An agent's reply in a fresh Claude Code session in a live Agent IDE, where Cole asks "what does GraphControllerCompat implement?" and the agent uses `mcp__ouroboros__query_graph` to answer | IDE → renderer chat → Claude Code session → `mcp__ouroboros__query_graph` MCP tool with `MATCH (c:Class {name: 'GraphControllerCompat'})-[:IMPLEMENTS]->(i:Interface) RETURN i.name` → main process IPC → `cypherEngine.execute` → `graphDatabase` SELECT on edges where type='IMPLEMENTS' → JSON result → MCP response → agent's chat reply | The agent's reply mentions `GraphControllerLike` (or whatever real interfaces `GraphControllerCompat` implements) BY NAME in the chat. Pre-Wave-21, the same query returned zero rows; post-Wave-21, the user sees the interface name in plain text in the agent's response. Visual confirmation in the chat scrollback. |
| 2 | A main-process log line `[trace:testDetectPass.cache] hit projectName=<name> durationMs=<small N>` visible in dev-tools console (or Agent IDE's startup log panel) during a live IDE session, after Cole has saved a file and triggered an incremental reindex | save in editor → `@parcel/watcher` event → `AutoSyncWatcher.handleFileChange` → `IndexingPipeline.runIndex` (incremental path) → `runEnrichmentPasses` → `testDetectPass(db, projectName, indexedFiles, changedFiles)` → cache lookup → log emission → console output | The user observes the `[trace:testDetectPass.cache] hit` line on the second and subsequent saves of the same project (first save is a `miss`). The durationMs on `hit` lines is materially smaller than on `miss` lines. Practical effect: the IDE's incremental-save loop is slightly faster on large projects; not directly user-perceivable as latency reduction, but observable in the log as a structural marker that the optimization is taking effect. |
| 3 | Wave wrap green; `wave-21-result.md` on master at the new tag; `HANDOFF.md` reflects SHIPPED status; CI status (if running) observable | terminal → repo state on master → `git log --oneline -5` shows wave commits | All gates green per the §Acceptance criteria checklist. `HANDOFF.md`'s top entry reads "Wave 21 SHIPPED." Cole's next session opens to a current handoff document. |

### Data-shape probes

```bash
# Phase 1 — heritage extraction surface
grep -nE "class_heritage|implements_clause|extends_clause" src/main/codebaseGraph/treeSitterParserDefs.ts
# expect: ≥ 2 hits (one or more for class_heritage, one or more for the clause walks)

grep -nE "implements\??: string\[\]" src/main/codebaseGraph/treeSitterTypes.ts
# expect: ≥ 1 hit (in ExtractedDefinition)

grep -nE "(extendsClause|parentClass)\??: string \\| null" src/main/codebaseGraph/treeSitterTypes.ts
# expect: ≥ 1 hit (in ExtractedDefinition)

# Phase 1 — edge emission in definitionPass
grep -nE "type: ['\"]IMPLEMENTS['\"]" src/main/codebaseGraph/indexingPipelinePasses.ts
# expect: ≥ 1 hit

grep -nE "type: ['\"]EXTENDS['\"]" src/main/codebaseGraph/indexingPipelinePasses.ts
# expect: ≥ 1 hit

# Phase 1 — observability
grep -nE "trace:definitionPass\.heritage" src/main/codebaseGraph/indexingPipelinePasses.ts
# expect: ≥ 1 hit

# Phase 1 — placeholder removed
grep -n "IMPLEMENTS edges are a placeholder" src/main/codebaseGraph/passes/enrichmentPass.ts
# expect: zero hits

# Phase 1 — acceptance test exists
ls src/main/codebaseGraph/indexingPipeline.heritageEdges.acceptance.test.ts
# expect: file exists

# Phase 2 — cache machinery
grep -nE "const \\w+Cache = new Map" src/main/codebaseGraph/passes/testDetectPass.ts
# expect: ≥ 1 hit (cache declaration)

grep -nE "changedFiles\??: Set<string>" src/main/codebaseGraph/passes/testDetectPass.ts
# expect: ≥ 1 hit

grep -nE "trace:testDetectPass\.cache" src/main/codebaseGraph/passes/testDetectPass.ts
# expect: ≥ 2 hits (one for hit, one for miss)

# Phase 2 — call-site updated
grep -nE "testDetectPass\(this\.db, projectName, indexedFiles, " src/main/codebaseGraph/indexingPipeline.ts
# expect: ≥ 1 hit (now passes changedFiles as the 4th argument)

# Phase 3 — gates
npm run test:codebasegraph
npm run lint
npx tsc --noEmit
```

## Files the next agent should read first

1. `roadmap/wave-21-DRAFT/research-21.md` (or `wave-21-ouroboros-graph-tier-2-improvements/research-21.md` post-rename) — full grounding extract on `class_heritage` API and per-language scope for OO heritage extraction.
2. `roadmap/wave-21-DRAFT/wave-21-decisions.md` — 6 locked decisions; Decision 2 and Decision 3 require Phase 0 ratification.
3. `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-2-improvements.md` — source FU with both items.
4. `src/main/codebaseGraph/treeSitterParserDefs.ts` — Phase 1 surgical site. Extend with heritage extraction.
5. `src/main/codebaseGraph/treeSitterTypes.ts` — `ExtractedDefinition` (lines 14-29) gets new fields.
6. `src/main/codebaseGraph/treeSitterLanguageConfigs.ts` — confirm TS/TSX `classNodes` are the right set; no edits expected.
7. `src/main/codebaseGraph/indexingPipelinePasses.ts` — `definitionPass` (the file's main pass body); new heritage edge emission lives here.
8. `src/main/codebaseGraph/passes/enrichmentPass.ts` — Phase 1 housekeeping; remove placeholder.
9. `src/main/codebaseGraph/passes/testDetectPass.ts` — Phase 2 surgical site. New cache, signature change.
10. `src/main/codebaseGraph/indexingPipeline.ts` line ~145 — Phase 2 call-site update.
11. `src/main/codebaseGraph/graphDatabaseTypes.ts` — confirm `IMPLEMENTS` and `EXTENDS` exist in `EdgeType` (lines 31, 41); no edits expected.
12. `src/main/codebaseGraph/CLAUDE.md` — subsystem context, especially the Wave 19 FK-fix gotchas (lines 122-124) — defines the safety net Phase 1 inherits.
13. `roadmap/wave-20-ouroboros-graph-tier-1-cleanup/waveplan-20.md` — exemplar wave shape, same subsystem.
14. `roadmap/wave-19-renderer-bundle-and-fk-fixes/wave-19-result.md` — context for the two-phase node-then-edge insertion + filterEdges safety net.
15. `.claude/vendor-gotchas/tree-sitter.md` — `web-tree-sitter@^0.26.8` API and ABI compatibility.
16. `.claude/vendor-gotchas/better-sqlite3.md` — JSON1 cycle-detection pattern (Wave 20's lesson; not directly applicable here but adjacent context).
17. `~/.claude/rules/development-pipeline.md` — Lane A dispatch reflex + orchestrator self-fix test.
18. `~/.claude/rules/agent-catalog.md` — boundary-phase dispatch routing for Phase 1.
19. `~/.claude/rules-deferred/orchestrator-owned-acceptance-tests.md` — Phase 1 acceptance-test discipline.
20. `~/.claude/rules/best-practice-spectrum.md` — ADR framing for Phase 0.

## Note to the implementer

This wave closes two real gaps in a high-quality subsystem: an OOP completeness gap (IMPLEMENTS/EXTENDS edges) and a per-keystroke perf gap (`testDetectPass` full-label scan). Neither is a refactor — both add behavior or change behavior in observable ways. The spirit is "ship the missing capability; don't expand the surface."

Three temptations to resist. First, do not expand Phase 1 to additional OO languages mid-flight. Decision 1 picks TS/TSX deliberately; Java's `extends`/`implements` fields, C++'s `base_class_clause`, etc., are listed in research-21.md as known shapes for the next wave. If you see "while I'm here, let me add Java" — stop, file a follow-up, move on. Second, do not promote the `testDetectPass` cache to `GraphDatabase` for "future reuse." YAGNI; Decision 3 keeps it module-local; if a second consumer emerges, promote then. Third, do not redesign the call-resolution / symbolsByName pipeline. Phase 1's filter-edges pattern mirrors what `callResolutionPass` already does; that pattern is correct as-is. Heritage edges with unresolved targets are SKIPPED, not given placeholder nodes.

Phase 1 is the load-bearing phase. It changes a tree-sitter extraction path that touches every TS/TSX class in every indexed project, and it adds two new edge types into a shared schema. The boundary discipline is non-optional: orchestrator authors the acceptance test BEFORE the implementer is dispatched, and the implementer may not modify it. `sonnet-phase-reviewer` runs on the diff before the gate is declared green.

Phase 2 is mechanically simpler but has a real correctness trap: cache invalidation. Get the QN-prefix intersection right — a changed file in project A must not invalidate project B's cache, but it MUST invalidate project A's. The unit tests should make this concrete with two project keys.

> Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

For Phase 1 specifically: the observation is NOT "the acceptance test passes." It is "a Cypher query against the live IDE's indexed graph returns IMPLEMENTS edges naming real interfaces, and an agent's chat reply references them by name when asked." If you cannot trigger that in this session — no live IDE, no current indexed graph — say so, and surface the live verification for the wave-end smoke.

For Phase 2 specifically: the observation is NOT "the cache unit tests pass." It is "a `[trace:testDetectPass.cache] hit` log line appears in the main-process log during a live save-cascade in the IDE." Tests prove the cache machinery works in isolation; the log line proves it's being exercised at runtime in the path that matters. Trigger an actual save in a live IDE if possible; if not, say so.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means the orchestrator dispatches the next phase in the same turn. The turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision the grounding doesn't determine (Phase 0 here is one), or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR scaffold exists at `roadmap/wave-21-DRAFT/wave-21-decisions.md`** (post-rename: `roadmap/wave-21-ouroboros-graph-tier-2-improvements/wave-21-decisions.md`) with all 6 decisions present. Decisions 2 and 3 are PENDING until Phase 0.
2. **Phase 0** (orchestrator + Cole) — surface Decisions 2 (emission site: `definitionPass` vs `enrichmentPass`) and 3 (cache shape: module-local vs DB-promoted, invalidation strategy) to Cole with the spectrum framing per `~/.claude/rules/best-practice-spectrum.md`. Default recommendations: `definitionPass` + module-local Map. Update the ADR with Cole's pick. Turn-ending event: yes — these are user-judgment decisions the grounding does not unilaterally determine. Resume same session on Cole's reply.
3. **Orchestrator pre-flight for Phase 1** (boundary phase — orchestrator-owned acceptance test): author `src/main/codebaseGraph/indexingPipeline.heritageEdges.acceptance.test.ts`. Test builds a TS fixture project with `class Foo extends Base implements IA, IB {}` + the supporting class/interface definitions, runs `IndexingPipeline.runIndex` on it, asserts the resulting `edges` table contains exactly 1 EXTENDS edge (Foo→Base), 2 IMPLEMENTS edges (Foo→IA and Foo→IB), and 0 dangling edges. Run the test locally; confirm it FAILS against current code (no heritage extraction → 0 IMPLEMENTS, 0 EXTENDS edges → 3 missing edges). Then proceed to dispatch.
4. **Phase 1** (sonnet-implementer) — boundary phase. Brief includes: exact file targets (`treeSitterTypes.ts`, `treeSitterParserDefs.ts`, `indexingPipelinePasses.ts`, `passes/enrichmentPass.ts`), exact `ExtractedDefinition` field shapes (`implements?: string[]`, `extendsClause?: string \| null` — implementer picks the extends field name to avoid the JS-keyword collision), the `childForFieldName('class_heritage')` access pattern (or `namedChildren` walk per research-21.md), the FK-safe target resolution via `symbolsByName.get(name)?.[0]` mirroring `callResolutionPass`, the placeholder-comment removal in `enrichmentPass.ts`, the `[trace:definitionPass.heritage]` log line shape, and the acceptance-test path with "you may not modify it." Worktree path: `C:\Web App\AgentIDE\.worktrees\wave-21-ouroboros-graph-tier-2\` — explicit in brief; verify post-DONE per the M-17 haiku-wrong-checkout backstop (does NOT recur for Sonnet per Wave 19's evidence, but cheap to verify). Gate: acceptance test passes; `npm run test:codebasegraph` passes; data-shape probes pass. **`sonnet-phase-reviewer` dispatch on diff before declaring gate green** — boundary phase, mental-model divergence risk on the parser-extraction surface is real.
5. **Phase 2** (sonnet-implementer) — NOT boundary. Brief includes: exact file targets (`passes/testDetectPass.ts`, `indexingPipeline.ts`), the module-level cache shape (`Map<string, { allFunctions: GraphNode[]; functionsByName: Map<string, string[]> }>`), the FIFO cap at N=10, the signature change (`changedFiles?: Set<string>` as the 4th parameter), the invalidation logic (full-reindex = always invalidate; otherwise QN-prefix intersection check), the `[trace:testDetectPass.cache]` log line shape (`hit projectName=X durationMs=N` / `miss reason=R durationMs=N`), the call-site update at `indexingPipeline.ts:145`, and the new unit tests in `testDetectPass.test.ts`. **Can dispatch in parallel with Phase 1 — disjoint files.** Gate: `npm run test:codebasegraph` passes; data-shape probes pass; new tests pass. **Trivial-shape phase — no `sonnet-phase-reviewer` dispatch; orchestrator diff glance.**
6. **Phase 3** (orchestrator) — wave wrap. Run scoped suites: `npm run test:codebasegraph` (covers both phases), `npm run test:main` (broader catch). Full `npm run lint`, `npx tsc --noEmit`, formatter. `/review` mechanical gap-check — verdict gates merge. Orchestrator diff review of the whole wave. Run the data-shape probes from §Verification. Write `wave-21-result.md`. `CHANGELOG.md [unreleased]` entry. `git push` per standing posture. `HANDOFF.md` flip. `/audit-followups wave-21-ouroboros-graph-tier-2-improvements` — should auto-archive the source FU. `/promote-vendor-lessons 21` — surface any web-tree-sitter / better-sqlite3 lessons captured during the wave. **Merge worktree to master + remove**: `git checkout master && git merge wave-21-ouroboros-graph-tier-2 --no-ff -m "wave-21: …" && git worktree remove .worktrees/wave-21-ouroboros-graph-tier-2 && git branch -d wave-21-ouroboros-graph-tier-2` (per `memory/worktree-merge-and-close-discipline.md`). Manual smoke gate: NOT required — no `src/renderer/components/Layout/**` changes; all edits are in main-process graph subsystem.
