---
status: SHIPPED
created: 2026-05-26
updated: 2026-05-26
wave: 21
type: substantive
predecessor: wave-20-ouroboros-graph-tier-1-cleanup
---

# Wave 21 — Ouroboros Codebase Graph Tier-2 Improvements — RESULT

## What shipped

Two substantive items closing the Tier-2 gaps from the 2026-05-26 meta-verification report, scoped to `src/main/codebaseGraph/`. Source: `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-2-improvements.md`.

### Phase 1 — IMPLEMENTS + EXTENDS edges via tree-sitter `class_heritage`

**Files:**
- `src/main/codebaseGraph/treeSitterTypes.ts` — `ExtractedDefinition` gains `implements?: string[]` and `extendsClause?: string | null`. Both undefined for non-Class kinds; `extendsClause` is `null` for plain classes (no extends clause).
- `src/main/codebaseGraph/treeSitterParserDefs.ts` — new `extractClassHeritage` helper walks the `class_heritage` named-child node type on `class_declaration`, harvests identifiers from `extends_clause` (single) and `implements_clause` (comma-separated), populates the new fields.
- `src/main/codebaseGraph/indexingPipelineHeritage.ts` — **new file**. Helper module with `buildHeritageSymbols`, `resolveHeritageTarget`, `collectDefHeritage`, `collectHeritageEdges`, and exported `emitHeritageEdges`. Lifted out of `indexingPipelinePasses.ts` to keep that file under the 300-line lint cap. Worker-context-safe (only imports `logger`, `graphDatabase`, type-only modules).
- `src/main/codebaseGraph/indexingPipelinePasses.ts` — `definitionPass` calls `emitHeritageEdges` from BOTH chunked and non-chunked paths, AFTER all node + edge phases complete. Preserves Wave 19's two-phase FK-safe ordering.
- `src/main/codebaseGraph/passes/enrichmentPass.ts` — placeholder comment block removed (file header + function body); replaced with pointer to `definitionPass` as the source of truth for IMPLEMENTS/EXTENDS edges.
- `src/main/codebaseGraph/passes/CLAUDE.md` — stale gotcha at line 39 updated to current state; Key Files description for `enrichmentPass.ts` updated.
- `src/main/codebaseGraph/treeSitterParserDefs.test.ts` — **new file**. 6 unit tests across 4 heritage shapes (no heritage, extends only, implements only, extends + implements) plus Function/Interface regression coverage.
- `src/main/codebaseGraph/indexingPipelinePasses.test.ts` — extended with 5 new heritage-edge unit tests covering happy paths + skip-on-unresolved.
- `src/main/codebaseGraph/indexingPipeline.heritageEdges.acceptance.test.ts` — **new file** (committed at boundary commit f1faf9c6). Orchestrator-authored acceptance test pinning the contract: 1 EXTENDS edge Foo→Base, 2 IMPLEMENTS edges Foo→IA + Foo→IB, 0 dangling, no false positives on plain classes or external-implements targets. Implementer did not modify it.

**Why:** Closes the OOP completeness gap surfaced in `enrichmentPass.ts:64-65` ("IMPLEMENTS edges are a placeholder"). After Wave 21, Cypher queries like `MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface) RETURN c.name, i.name` return real rows over indexed TS/TSX projects. `trace_call_path` can follow interface→implementation relationships.

**Boundary discipline:** Per ADR Decision 6, this is a boundary phase (persistent storage, MCP/Cypher consumer surface). The acceptance test was orchestrator-authored at commit `f1faf9c6` BEFORE dispatching the implementer; implementer brief included "you may not modify it." `sonnet-phase-reviewer` ran on the post-implementation diff (verdict: FLAG only on the stale `passes/CLAUDE.md` doc — addressed inline by the orchestrator per the self-fix test).

**Critical research-grounding correction (worth carrying forward):** The pre-wave research extract (`research-21.md`) named `childForFieldName('class_heritage')` as the primary access pattern with `namedChildren.find` as fallback. The implementer verified during implementation that `class_heritage` is a NODE TYPE on `class_declaration`, NOT a field — `childForFieldName('class_heritage')` returns null. Correct access: `node.namedChildren.find(c => c.type === 'class_heritage')`. The implementer caught this; the inline function comment documents it. This is the SECOND wave running where the research grounding was partially wrong and architect/implementer caught it (Wave 19 was the first). The diagnostic-correction step is now reliably load-bearing.

### Phase 2 — testDetectPass cache eliminates per-keystroke full-label scan

**Files:**
- `src/main/codebaseGraph/passes/testDetectPass.ts` — module-level `Map<string, FunctionIndexEntry>` cache, FIFO-capped at 10 projects. New signature: `testDetectPass(db, projectName, indexedFiles, changedFiles?: Set<string>)`. Invalidation: `undefined` = full reindex (unconditional rebuild); empty Set = nothing changed (hit); populated Set = per-file QN-prefix intersection check against cached symbols. Helpers extracted (`qnIntersectsPrefix`, `computeInvalidationReason`, `evictOldestIfFull`) to keep the pass body under the 40-line lint cap. New `[trace:testDetectPass.cache]` log line with status (`hit | miss-cold | miss-full | miss-invalidated`) + durationMs. `_functionIndexCache` exported with leading-underscore convention for test inspection only.
- `src/main/codebaseGraph/indexingPipeline.ts` — `runEnrichmentPasses` and `runAllPasses` ctx objects gain `isIncrementalRun: boolean`; `changedFiles` computed from `indexedFiles.map(f => f.relativePath)` on incremental, `undefined` on full reindex. No new flag introduced — uses the upstream `isIncrementalRun` already in scope at line 258.
- `src/main/codebaseGraph/passes/testDetectPass.test.ts` — **new file**. 9 tests covering cold miss + warm hit, QN-prefix invalidation, no-invalidation on disjoint changedFiles, full-reindex unconditional invalidation, FIFO eviction at N=10, project isolation. Uses `vi.spyOn(db, 'getNodesByLabel')` to assert the cache hit path doesn't re-query the DB.

**Why:** Pre-Wave-21, `testDetectPass.ts:142-144` did `db.getNodesByLabel(projectName, 'Function').concat(db.getNodesByLabel(projectName, 'Method'))` on EVERY incremental reindex. Index-backed but still O(k) row reads per save — ~10k rows for a 5k-function codebase, growing linearly with codebase size. After Wave 21, the cache hits on every save where no changed file's QN prefix intersects the cached symbol index; full-reindex paths invalidate unconditionally to preserve correctness.

**Decision tier:** Industry standard per ADR Decision 3 — aggressive variant (skip the project-wide scan, only re-evaluate changed files' tests) was REJECTED because it would silently dangle TESTS edges when a target production function is renamed in a file unrelated to the test file. Module-local cache is YAGNI-correct — no second consumer exists today; promote to `GraphDatabase` if one emerges.

## What didn't ship

Per the wave plan's "Out of scope" section, nothing was de-scoped during execution:

- **Other OO languages** (Java, Python, C++, Rust, Go) — deferred per Decision 1; file as follow-up if needed.
- **Method overrides** (DEFINES_METHOD vs OVERRIDES) — not in the FU.
- **External interface stub nodes** — deferred per Decision 4.
- **Standalone MCP extraction** — Wave 22+, hard-blocked on Wave 87.
- **Promoting testDetectPass cache to `GraphDatabase`** — YAGNI; revisit if a second consumer emerges.
- **Schema changes** — N/A (IMPLEMENTS + EXTENDS already in `EdgeType`).

## Verification

### Gates (run at wave wrap)

- `npm run test:codebasegraph` — **743 passed**, 3 skipped, 0 failures. Includes the Phase 1 acceptance test (11 assertions GREEN), 6 new heritage parser tests, 5 new heritage edge tests, 9 new testDetectPass cache tests.
- `npm run test:main` — **6604 passed, 1 failed, 5 skipped** in 210.91s. The 1 failure is the pre-existing `channelCatalog.test.ts` (Wave 20 baseline; filed at `roadmap/follow-ups/2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md`). Wave 21 added 31 new passing tests across heritage extraction, heritage edge emission, acceptance contract, and cache invalidation — no regressions.
- `npm run lint` — **0 errors, 4 warnings**, all pre-existing carry-overs from Wave 19/20 (chatOrchestrationSingletons, patterns.test.ts, FileViewerChrome, HtmlPreview).
- `npx tsc --noEmit` — **clean**.

### Data-shape probes (from §Verification)

All probes green. Key file:line evidence:

- `treeSitterParserDefs.ts:222,229` — `class_heritage` walk via `namedChildren.find(c => c.type === 'class_heritage')` with inline comment documenting it as a node type, not a field name.
- `treeSitterTypes.ts:31` — `implements?: string[]`.
- `treeSitterTypes.ts:32` — `extendsClause?: string | null` with corrected semantics comment.
- `indexingPipelineHeritage.ts:80,83` — EXTENDS + IMPLEMENTS edge emission with `symbolsByName` resolution.
- `indexingPipelineHeritage.ts:126` — `[trace:definitionPass.heritage]` log line emission.
- `passes/enrichmentPass.ts` — placeholder removed (zero grep hits for "IMPLEMENTS edges are a placeholder").
- `passes/testDetectPass.ts:37` — `_functionIndexCache` declared.
- `passes/testDetectPass.ts:201` — `changedFiles?: Set<string>` parameter.
- `passes/testDetectPass.ts:227` — `[trace:testDetectPass.cache]` log line.
- `indexingPipeline.ts:149` — `testDetectPass(this.db, projectName, indexedFiles, changedFiles)` call site updated.

### Phase-level observation

- **Phase 1** — Live `query_graph` MCP call asking "what does GraphControllerCompat implement?" NOT triggered in this session (no live IDE available during wrap). Unit-boundary verification: the acceptance test runs the real `TreeSitterParser` + real `IndexingPipeline` on a real tmpdir fixture and asserts exact edge counts. Live observation deferred to the next interactive Cole session.
- **Phase 2** — Live `[trace:testDetectPass.cache] hit` log line NOT triggered in this session (no save-cascade in a running IDE). Unit-boundary verification: 9 cache tests including spy assertions on `db.getNodesByLabel` calls confirm the hit path doesn't re-query. The log line will be observable on the next IDE startup post-merge.

Per the wave plan: tests passing at the unit boundary is necessary but not sufficient. Both runtime observations above are deferred to the next live-IDE session — neither is a gate blocking ship; both are confirmation work.

## Decisions ratified

All 6 decisions in `wave-21-decisions.md` shipped as locked:

1. **Phase 1 extraction scope: TS/TSX only** — industry standard; Java/Python/C++/Rust/Go deferred to a follow-up.
2. **Edge emission site: `definitionPass`** — Cole delegated; orchestrator picked recommended on technical merits (co-location with `ExtractedDefinition` consumer, FK-safety inheritance from Wave 19, semantic fit for standalone-MCP extraction).
3. **testDetectPass cache: module-local Map + FIFO N=10 + per-file QN-prefix invalidation** — Cole delegated; orchestrator picked recommended (YAGNI; aggressive variant rejected for correctness).
4. **Heritage target resolution: skip on unresolved** — mirrors Wave 19's `callResolutionPass.filterEdges` pattern.
5. **Ship both IMPLEMENTS and EXTENDS** — same code path, one heritage walk.
6. **Phase 1 = boundary phase** — orchestrator-authored acceptance test before dispatch; `sonnet-phase-reviewer` on the post-implementation diff.

## Surprises / mid-wave discoveries

- **Research grounding error caught by implementer.** The `research-21.md` extract named `childForFieldName('class_heritage')` as the primary API access pattern (with `namedChildren.find` as fallback). The implementer verified during work that `class_heritage` is a node type on `class_declaration` (named child), not a field — `childForFieldName('class_heritage')` returns null. Correct pattern: `node.namedChildren.find(c => c.type === 'class_heritage')`. The implementer documented this inline. **Same pattern as Wave 19's diagnostic citation rot** (architect caught it). For boundary phases, the architect/implementer's verification-before-implementation step is now reliably load-bearing — make it explicit in future briefs.
- **Helper extraction to keep files under 300 LOC.** Phase 1's heritage emission logic naturally grew to ~120 LOC; the implementer extracted it to `indexingPipelineHeritage.ts` to keep `indexingPipelinePasses.ts` under the 300-line lint cap. Clean factoring. The helper module is worker-context-safe (imports only logger + type-only modules).
- **`passes/CLAUDE.md` stale gotcha.** `sonnet-phase-reviewer` (Axis 1 FLAG) surfaced that line 39 still claimed "IMPLEMENTS edges are a placeholder." The Wave 21 doctrine on gotcha maintenance (root `CLAUDE.md`) says gotcha entries must be updated in the same change that obsoletes them. Orchestrator applied inline self-fix per the four-part test (diagnosed, ~5 lines, in-context, no second-bug risk). Worth carrying forward: implementer briefs for waves that obsolete gotchas should explicitly call out the relevant CLAUDE.md update.
- **No haiku-wrong-checkout drift this wave.** Both implementers were sonnet-tier and honored worktree paths cleanly (verified via `git status` in both checkouts post-DONE). The M-17 backstop didn't trigger. Sonnet tier remains the right choice for any work that targets a specific path.
- **npm install postinstall failed in worktree** (`electron-rebuild -f -w better-sqlite3,node-pty && node tools/build-changelog.js && node tools/apply-patches.mjs` returned exit code -1). Native modules built fine (better-sqlite3 + node-pty `install` steps returned code 0); the failure was downstream in electron-rebuild or build-changelog or apply-patches. Tests run cleanly despite this (98 tests in graphDatabase.test.ts passed in 1.21s on the worktree), so the postinstall issue is orthogonal to wave work. Filed as follow-up — would block push if changelog.ts wasn't regenerable. Investigated independently.

## Lessons (vendor + pattern)

- **`class_heritage` is a node type, not a field.** In `tree-sitter-typescript`'s grammar, `class_heritage` is a named child node on `class_declaration`. Use `node.namedChildren.find(c => c.type === 'class_heritage')`, NOT `childForFieldName('class_heritage')` (returns null). Its children are `extends_clause` and `implements_clause`, themselves nodes whose first named child is the heritage target identifier (or for generic types, the inner type identifier). Documented inline at `treeSitterParserDefs.ts:222-229`.
- **Wave 19's filterEdges pattern is reusable.** Any new edge emission with a target that may not exist in the project graph (external library imports, types not in `node_modules`, cross-package references) should use `symbolsByName.get(name)?.[0]` resolution + skip-on-unresolved. Wave 21's heritage edges adopted it cleanly; future waves emitting any cross-symbol edge type should follow.
- **Per-pass module-local cache is the right shape for first-consumer perf gaps.** Promoting to `GraphDatabase` is premature when there's only one consumer. The discipline: module-local Map with FIFO cap + observable trace line; promote to shared abstraction if a second consumer emerges. Wave 21's `_functionIndexCache` shape is the reference pattern.
- **Diagnostic citation rot is a real and recurring class.** Three consecutive waves (Wave 17, Wave 18, Wave 19) had architect catches on incorrect diagnostic citations; Wave 21 had the implementer catch a research-grounding error. The next-step doctrine: any wave with a "use this API" claim from research grounding should have an explicit verification step in the implementer's first action ("read the actual node-types JSON / grammar / API surface and confirm the claim before writing code").

## Operational notes for the next session

1. **Wave 21 complete.** Next candidate per the meta extraction roadmap: **Wave 22 — Standalone MCP extraction** (`roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md`) — hard-blocked on Wave 87 chat orchestration overhaul completion.
2. **Pre-existing test failure unchanged:** `channelCatalog.test.ts` still fails on `test:main`. Filed at `roadmap/follow-ups/2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md`. NOT a Wave 21 regression.
3. **Open Tier-3 from Wave 20 still active:** `2026-05-26-graphcontrollerlike-manageadr-id-orphan-check.md` — LOW priority; natural during Wave 22 extraction.
4. **Worktree merge discipline applied.** Wave 21 used worktree `.worktrees/wave-21-ouroboros-graph-tier-2/` per `memory/worktree-merge-and-close-discipline.md`. Merged to master + worktree removed at wave wrap.
5. **No version bump.** Per wave plan: maintenance wave; CHANGELOG entry in `[Unreleased]`. Folds into next minor or patch on natural cadence (current v2.20.0).
6. **Postinstall worktree friction** filed at `roadmap/follow-ups/2026-05-26-worktree-postinstall-electron-rebuild-failure.md` — does not block wave work, but should be investigated if recurring.

## Files the next agent should read first

1. `roadmap/HANDOFF.md` — flipped to reflect Wave 21 SHIPPED.
2. `roadmap/wave-21-ouroboros-graph-tier-2/wave-21-decisions.md` — 6 ratified decisions.
3. `roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md` — Wave 22 (blocked).
4. `src/main/codebaseGraph/indexingPipelineHeritage.ts` — new helper module; reference pattern for cross-symbol edge emission.
5. `src/main/codebaseGraph/passes/testDetectPass.ts` — reference pattern for per-pass module-local cache + per-file invalidation.
6. `src/main/codebaseGraph/passes/CLAUDE.md` — updated gotchas + key files description.
