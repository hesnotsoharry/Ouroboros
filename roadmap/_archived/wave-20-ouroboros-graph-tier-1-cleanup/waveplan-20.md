---
status: SHIPPED
created: 2026-05-26
updated: 2026-05-26
wave: 20
slug: ouroboros-graph-tier-1-cleanup
type: fix-sweep
predecessor: wave-19-renderer-bundle-and-fk-fixes
severity: MED
---

# Wave 20 — Ouroboros Codebase Graph: Tier-1 Cleanup

## Context

Meta-session verification of `src/main/codebaseGraph/` on 2026-05-26 (report at `C:\Web App\meta\discovery\2026-05-26-ouroboros-verification-report.md`) found the subsystem unusually clean — zero TODO/FIXME/HACK markers, 45 test files, only 3 justified `any` usages — and surfaced one latent bug plus four small correctness/performance/honesty gaps. All items are file:line-specific, orthogonal to the deliberate "build custom Cypher engine" architectural direction documented in `wave-68-cypher-engine-quality/wave-68-decisions.md` and the `roadmap/follow-ups/cypher-engine-feature-additions.md` track. Source follow-up: `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-1-cleanup.md`.

Pre-flight grounding (this session) confirmed every target. The BFS cycle guard at `graphDatabaseTraversal.ts:47` and `cypherEngineVarpath.ts:104` uses `AND r.path NOT LIKE '%' || nextNode || '%'` inside a `WITH RECURSIVE reachable(id, depth, path)` block where `path` is a `>`-delimited string accumulator. The PageRank cache at `graphPageRank.ts:62` is module-level and unbounded; `buildPersonalizationVector()` at line 135 uses O(n) `nodeIds.includes(seed.id)` per seed. The `manage_adr` MCP tool advertises an `id` parameter in `mcpToolHandlerDefs.ts:138` that the handler at `mcpToolHandlerHelpers.ts:271-305` silently ignores — and the handler body already carries a comment (lines 276-278) saying "Current DB methods are project-level only; per-ID targeting deferred to a future wave that adds the storage support." That comment is direct evidence that Option A (implement) was the original intent, but Option B (remove from schema) is the simpler honest-surface fix; Wave 20 picks one in Phase 0.

This is a sanctioned fix-sweep wave per `~/.claude/rules/development-pipeline.md` Lane A — 5 small items, mostly mechanical, no single-feature unifying theme except "the graph subsystem is being cleaned up before extraction" (see `roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md` — Wave 22+ blocked on Wave 87 + this cleanup baseline).

## Goal

After Wave 20, the BFS cycle detector in `graphDatabaseTraversal.ts` and `cypherEngineVarpath.ts` uses a per-row JSON array `path` column with `json_each` membership lookup instead of a string-LIKE substring check — eliminating the latent prefix-collision bug and making the cycle invariant explicit and machine-verifiable. `graphPageRank.ts` uses `Set<string>` membership in `buildPersonalizationVector()` (O(1) per seed) and the module-level `_cache` is bounded to 20 entries with FIFO eviction. The `manage_adr` MCP tool's schema and handler agree: either the `id` parameter routes through to per-ID CRUD operations (Option A), or the parameter is removed from the schema and the project-level semantics are documented (Option B) — Phase 0 picks. A regression test in `cypherEngine.smoke.test.ts` (or sibling) exercises BFS correctness with prefix-collision node IDs (`src.a` vs `src.auth`). The `.claude/vendor-gotchas/` directory gains a new entry — or extends an existing one — capturing the SQLite JSON1 cycle-detection pattern as a documented invariant.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-20-ouroboros-graph-tier-1-cleanup/wave-20-decisions.md`.

1. **BFS cycle detector replacement: per-row JSON array path column with `json_each` membership lookup.** Industry standard. SQLite JSON1 is compiled into `better-sqlite3@12.8.0` by default (verified — research extract this session). The recursive-select aggregate restriction means `json_group_array()` cannot be used, but the scalar `json_insert(r.path, '$[#]', nextNode)` pattern works per-row. NOT chosen: `UNION` dedup (loses depth-ordering BFS semantic because depth is part of the row); NOT chosen: separate visited-nodes parameter table (more verbose for marginal benefit when the existing CTE already carries a path column).
2. **JSON array path schema:** `json_array(starting_node_id)` initialization in the anchor, `json_insert(r.path, '$[#]', nextNode)` accumulator in the recursive step, `NOT EXISTS (SELECT 1 FROM json_each(r.path) WHERE value = nextNode)` guard. The SELECT clause continues to return `path` as the final column; downstream consumers either parse JSON or treat it as opaque. Verified: only `path` consumers in `graphDatabaseTraversal.ts` and downstream callers do not introspect the string format — they return paths to the caller intact.
3. **PageRank cache eviction policy: FIFO at 20 entries.** Industry standard for small bounded caches on per-seed inputs. NOT LRU (additional bookkeeping for marginal benefit at this size); NOT TTL-only (TTL already exists at 60s but does not bound peak memory across many distinct seed sets in a 4-hour session). 20 entries × ~1 MB max per CacheEntry (the `scores: Map<string, number>` is bounded by node count) gives a soft 20 MB ceiling — acceptable.
4. **`manage_adr` `id` parameter — pending Phase 0 decision (Option A vs B).** Surface to Cole before Phase D dispatches. Option A (implement per-ID targeting) commits Wave 20 to schema + storage changes in `graphStore.ts` ADR table CRUD path; effort grows to M. Option B (remove `id` from schema; document project-level-only) is S and finalizes the existing intent. Default recommendation: **Option B** — the in-code comment ("deferred to a future wave that adds the storage support") plus the fact that no consumer is observably passing `id` today makes B the honest fix; per-ID targeting can ship as its own follow-up if/when a real consumer needs it. Cole's call.
5. **BFS cycle invariant documentation:** A short comment block at the top of the new visited-set SQL in both files explaining the JSON1 pattern + why `LIKE` was abandoned, plus a one-paragraph entry in `src/main/codebaseGraph/CLAUDE.md` (if exists) or `.claude/vendor-gotchas/better-sqlite3.md` (create if absent) capturing the pattern for future maintainers. Lands regardless of Option A/B in Decision 4.
6. **Regression test for prefix-collision cycle detection:** New test file `src/main/codebaseGraph/cypherEngineRegression.test.ts` already exists (verified); the new test case lives there. Asserts BFS over a synthetic graph where one node ID is a strict prefix of another (`src.a` and `src.auth`) still returns both nodes in the traversal — proving the visited-set guard isn't substring-matching.

## Scope

**In scope:**

- **Phase A** — Replace string-LIKE cycle guard with JSON1 per-row visited set in both files (`graphDatabaseTraversal.ts:39-52` `runBfsTraversal()` and `cypherEngineVarpath.ts:92-115` `buildVarpathSqlTemplate()`). Add prefix-collision regression test in `cypherEngineRegression.test.ts`. Add the invariant comment block at both SQL sites. Add the vendor-gotcha / CLAUDE.md doc entry.
- **Phase B** — Two micro-optimizations in `graphPageRank.ts`: (1) replace `nodeIds.includes(seed.id)` with a `Set<string>` constructed once at `buildPersonalizationVector()` entry; (2) add FIFO eviction to `_cache` when size > 20. Update existing `graphPageRank.test.ts` if it asserts on cache shape; otherwise add minimal coverage for the eviction path.
- **Phase C** — `manage_adr` schema honesty fix per Phase 0 Decision 4 (Option A or B). If Option B (default): delete `id` from the `properties` object in `mcpToolHandlerDefs.ts:138`, update the handler's comment block at `mcpToolHandlerHelpers.ts:276-278` to confirm project-level semantics (drop "deferred to a future wave" language). If Option A: thread `id` through the handler's mode-switch, add per-ID CRUD methods to the ADR storage layer (likely `graphStore.ts`), schema + handler tests. **Boundary phase — MCP tool contract surface visible to external agents.** Orchestrator authors failing acceptance test before subagent dispatch.
- **Phase D** — Wave wrap: scoped tests (`test:codebasegraph`, `test:main`), full lint + typecheck + formatter, `/review` mechanical gap-check, `wave-20-result.md`, `CHANGELOG.md [unreleased]` entry (no version tag — this is a maintenance wave, fold into next minor), `HANDOFF.md` flip, `/promote-vendor-lessons 20` (better-sqlite3 + SQLite JSON1 patterns).

**Out of scope:**

- **Tier-2 items** (IMPLEMENTS edges via `class_heritage`; testDetectPass incrementality) — separate follow-up `2026-05-26-ouroboros-graph-tier-2-improvements.md`; runs as Wave 21+.
- **Standalone MCP extraction** — separate follow-up `2026-05-26-ouroboros-graph-standalone-mcp-extraction.md`; hard-blocked on Wave 87.
- **Wave 77-B `WITH` clause support** — separate track, gated on `traceBatcher` telemetry per `roadmap/follow-ups/cypher-engine-feature-additions.md`.
- **OSS extraction spike (Wave 77-C)** — separate follow-up; decoupled from this wave.
- **Schema migration of historic `path` strings to JSON arrays** — N/A. The `path` column is a runtime-only accumulator inside the recursive CTE; it is not persisted to disk. The new JSON shape is computed fresh on every query.
- **Migrating away from `better-sqlite3`** — vendor switch out of scope.
- **Re-evaluating Kuzu / tree-sitter-graph / Neo4j as engine replacements** — decision already locked per `wave-68-decisions.md`; don't re-litigate.

## Phases

| Phase | Topic | Implementer | Notes |
| ----- | ----- | ----------- | ----- |
| 0 | ADR — finalize Decision 4 (manage_adr Option A vs B) | orchestrator + Cole | Read this plan + the FU; surface A vs B with the in-code "deferred to a future wave" comment as evidence. Default recommendation **Option B**. Update `wave-20-decisions.md` to reflect Cole's pick. No code changes. Test shape: **n/a**. |
| A | BFS cycle detector — JSON1 visited-set rewrite (+ invariant doc + regression test) | sonnet-implementer | Edit `src/main/codebaseGraph/graphDatabaseTraversal.ts` lines 39-52: change `path` initialization from `?` (string) to `json_array(?)`, change accumulator from `r.path \|\| '>' \|\| ${nextNode}` to `json_insert(r.path, '$[#]', ${nextNode})`, replace `r.path NOT LIKE '%' \|\| ${nextNode} \|\| '%'` with `NOT EXISTS (SELECT 1 FROM json_each(r.path) WHERE value = ${nextNode})`. Apply same transformation to `src/main/codebaseGraph/cypherEngineVarpath.ts` lines 92-115. Add a 6-10 line comment block at the top of each block explaining the JSON1 pattern and the prefix-collision hazard the old LIKE was vulnerable to. Add a new test case in `src/main/codebaseGraph/cypherEngineRegression.test.ts` named "BFS handles prefix-collision node IDs without substring confusion" that builds a synthetic graph with nodes `src.a` and `src.auth` connected via edges, runs `trace_call_path` (or equivalent BFS-using primitive), and asserts both nodes are reachable. Add or extend `.claude/vendor-gotchas/better-sqlite3.md` (or `src/main/codebaseGraph/CLAUDE.md` if a Gotchas section exists there — verify before writing). Test shape: **pyramid** (pure SQL/logic with strong unit test coverage at the cypher engine seam). Run `npm run test:codebasegraph` post-edit. |
| B | PageRank Set membership + cache FIFO cap | haiku-implementer | Edit `src/main/codebaseGraph/graphPageRank.ts` line 128-146 (`buildPersonalizationVector()`): construct `const nodeIdSet = new Set(nodeIds);` once at function entry; replace `nodeIds.includes(seed.id)` (line 135) with `nodeIdSet.has(seed.id)`. Separately, at the `_cache` declaration (line 62) and at every `_cache.set(...)` call site, add a FIFO eviction guard: before `set`, if `_cache.size >= 20`, delete the oldest entry (`_cache.delete(_cache.keys().next().value)`). Map iteration order is insertion order — FIFO is one-liner. Verify with grep: find all `_cache.set` sites in the file; add the same guard pattern at each. Brief explicitly: "Your tools are Read/Edit/Write. You CANNOT run tests, lint, or git. After editing, report DONE — the orchestrator runs gates." Test shape: **pyramid** (the unit test for the eviction path lives with the existing `graphPageRank.test.ts`; orchestrator may extend it post-edit if coverage is missing). |
| C | `manage_adr` schema honesty (Option A or B per Phase 0) | sonnet-implementer | **Boundary phase — MCP tool contract.** Orchestrator authors failing acceptance test BEFORE dispatch (see Orchestrator dispatch checklist). If **Option B** (default): edit `src/main/codebaseGraph/mcpToolHandlerDefs.ts:138` — delete the `id: { ... }` property line. Update `src/main/codebaseGraph/mcpToolHandlerHelpers.ts:276-278` comment to read something like "ADR storage is project-level by design; per-ID targeting would require schema + handler work and is out of scope here. Re-open via a separate follow-up if a consumer needs it." If **Option A**: design + thread `id` through; add per-ID CRUD to `graphStore.ts` ADR table; update handler mode-switch; add schema validation tests. Acceptance test (orchestrator-authored): asserts that the `manage_adr` MCP tool input schema's `properties` shape matches the handler's parameter usage — programmatically, no orphan declared params. Test shape: **honeycomb** (boundary phase — MCP surface; integration test catches schema/handler drift). |
| D | Wave wrap | orchestrator | Run scoped suites: `npm run test:codebasegraph` (Phases A + B + C), `npm run test:main` (broader catch). Full `npm run lint`, `npm run typecheck`, formatter. `/review` mechanical gap-check — verdict gates merge. Orchestrator diff review of the whole wave. Run the data-shape probes from §Verification. Write `wave-20-result.md`. `CHANGELOG.md` entry (no separate version tag — folds into next release). `git push` per standing posture; CI is observable but not gating. `HANDOFF.md` flip (Wave 20 SHIPPED; next candidate Wave 21 Tier-2 improvements or wait for Wave 87 + then Wave 22 extraction). `/audit-followups wave-20-ouroboros-graph-tier-1-cleanup` to auto-close the Tier-1 FU. `/promote-vendor-lessons 20` — extract better-sqlite3 / SQLite JSON1 cycle-detection pattern. Test shape: **n/a**. |

### Phase ordering

Phase 0 (ADR) gates Phase C only — Phases A and B don't depend on the Option A vs B decision. Phase A and Phase B are on disjoint surfaces (different files, no shared imports) and can dispatch in parallel. Phase C blocks on Phase 0's resolution. Phase D blocks on A, B, and C.

```
Phase 0 (ADR resolution)
   |
   +---> Phase A (BFS cycle fix — disjoint surface, independent)
   |
   +---> Phase B (PageRank micro-opts — disjoint surface, independent)
   |
   +---> Phase C (manage_adr — needs Phase 0 decision)
                          |
                          v
                Phase D (wave wrap)
```

Practical dispatch: orchestrator surfaces Phase 0 decision to Cole, then dispatches A + B in parallel (same turn), then dispatches C once Phase 0 is resolved (may be same turn if Cole answers immediately). Phase D after all three.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| JSON1 functions inside the recursive-select have unexpected query-plan implications on large graphs (Agent IDE's own graph: ~18k nodes / ~13k edges; Gamify and others larger). | Benchmark before/after on Agent IDE's own indexed graph using `trace_call_path` on a deep call chain. If the new SQL is >2x slower, fall back to a separate visited-CTE pattern (still industry standard) or carry a hash-prefixed node ID column for cheaper string equality. Surface as a Tier 3 follow-up if it emerges mid-phase; don't ship a perf regression. |
| `json_insert(r.path, '$[#]', nextNode)` semantics rely on `$[#]` resolving to "next array index" — version-specific to SQLite. | better-sqlite3@12.8.0 ships SQLite 3.53.x (verified) which supports `$[#]` since 3.31.0 (2020). Well within the supported range. Phase A's regression test exercises the accumulator path end-to-end; if `$[#]` semantics drift, the test fails. |
| The new comment block at the SQL site grows beyond `max-lines-per-function: 40` and triggers ESLint on the surrounding TS function. | ESLint counts logical TS lines, not template-string content. The SQL template lives inside a `return \`…\`` template literal that counts as ~1-2 logical lines. Comments outside the template (above the function) are skipped per `skipComments` in the rule. No risk in practice — but Phase A's lint run catches it. |
| Phase C Option B drops a schema property and breaks a consumer that's been silently passing `id` (no schema validation upstream). | Grep `mcp__ouroboros__manage_adr` usage across all four codebases (Agent IDE, Contractor App, Gamify, meta) before dropping the property. The handler already ignores `id` so dropping it from the schema is observably a no-op for consumers — but it tightens the contract. If a consumer in fact passes `id`, current behavior is "silently ignored"; new behavior under Option B is "schema validation rejects." Surface to Cole as part of Phase 0 if this surfaces. |
| Phase C Option B leaves the in-code "deferred" comment partially correct (the original deferral path is now explicitly closed; reopening would need a new wave + ADR). | Update the comment unambiguously to "project-level by design; reopen via FU if needed." No load-bearing language about a "future wave" remains. |
| FIFO eviction picks the oldest seed-set rather than the least-recently-used; if a hot seed set ages out, the next call recomputes (60s TTL was already doing this — eviction makes it more aggressive). | FIFO at N=20 is the safest default — and `PageRank` is a cheap computation relative to typical IDE response times. If recompute cost shows up in telemetry, LRU upgrade is a follow-up. Phase 0 Decision 3 locks FIFO; revisit only on evidence. |
| Phase A's regression test relies on a synthetic graph fixture that doesn't match the production indexer's node-ID format and gives false confidence. | The test should build the graph via the same DB primitives the production indexer uses (`db.insertNode`, `db.insertEdge` — verify exact API), with node IDs in the same `pkg.module.symbol` shape. Mirror an existing test fixture pattern from `cypherEngineRegression.test.ts` rather than inventing a new one. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
| ----- | ---- | ----------- | ----- |
| 0 | n/a | n/a | ADR resolution — no code. |
| A | New test case in `cypherEngineRegression.test.ts` exercising prefix-collision node IDs over BFS. Existing `cypherEngine.smoke.test.ts` + `cypherEngine.test.ts` + `cypherEngineNewFeatures.test.ts` + `cypherEngineSqlHelpers.test.ts` + `cypherEngine.propsAndIn.test.ts` re-run to catch regression in the cycle-guard mechanics. | The smoke + full cypher suite exercises real recursive CTE paths end-to-end against a temp DB; that IS the integration coverage. | Pyramid shape — pure SQL logic; unit + suite coverage is the safety net. |
| B | Extend `graphPageRank.test.ts` to cover (1) Set membership equivalence (existing assertions on personalization vector content should already pass; verify), (2) FIFO eviction triggers at N=20 — synthesize 21 distinct seed keys, assert oldest is gone after the 21st insert. | Existing PageRank integration tests re-run unchanged. | Pyramid shape — pure JS logic, unit tests carry the load. |
| C | If Option A: schema validation tests for the per-ID code path (list/get/store/update/delete by id). If Option B: orchestrator-authored acceptance test asserting `manage_adr` schema's `properties` keys ⊆ handler's `args` consumption. | Integration test invokes the MCP tool handler via its registered name with both valid and (under Option B) now-invalid inputs. | Honeycomb shape — MCP boundary; the integration test is the contract verification. |
| D | n/a | n/a | Wrap phase. Full scoped suite runs are the safety net. |

## Acceptance criteria

- [ ] `grep -n "NOT LIKE '%' || nextNode" src/main/codebaseGraph/graphDatabaseTraversal.ts` returns zero hits.
- [ ] `grep -n "NOT LIKE '%' || nextNode" src/main/codebaseGraph/cypherEngineVarpath.ts` returns zero hits.
- [ ] `grep -n "json_each(r.path)" src/main/codebaseGraph/graphDatabaseTraversal.ts` returns ≥ 1 hit.
- [ ] `grep -n "json_each(r.path)" src/main/codebaseGraph/cypherEngineVarpath.ts` returns ≥ 1 hit.
- [ ] `grep -n "json_array" src/main/codebaseGraph/graphDatabaseTraversal.ts` returns ≥ 1 hit.
- [ ] A regression test case named "BFS handles prefix-collision node IDs" exists in `src/main/codebaseGraph/cypherEngineRegression.test.ts` and passes.
- [ ] `npm run test:codebasegraph` passes (full subsystem suite).
- [ ] `grep -n "nodeIds.includes" src/main/codebaseGraph/graphPageRank.ts` returns zero hits.
- [ ] `grep -n "new Set(nodeIds)" src/main/codebaseGraph/graphPageRank.ts` returns ≥ 1 hit.
- [ ] `grep -n "_cache.size" src/main/codebaseGraph/graphPageRank.ts` returns ≥ 1 hit (eviction guard present).
- [ ] PageRank test suite (`graphPageRank.test.ts`) passes and includes an explicit FIFO eviction assertion.
- [ ] If Option B chosen in Phase 0: `grep -n "id:" src/main/codebaseGraph/mcpToolHandlerDefs.ts` does not return a hit inside the `manage_adr.properties` block (verified by line-context).
- [ ] If Option A chosen in Phase 0: `manage_adr` with `mode='get'` + `id=<existing>` returns a single ADR; with `id=<missing>` returns a structured "not found" envelope.
- [ ] `npm run lint`, `npm run typecheck`, full `npm run test:codebasegraph` and `npm run test:main` all pass at wrap.
- [ ] `/review` mechanical gap-check returns PASS or FLAG-with-flags-addressed.
- [ ] `wave-20-result.md` written; `CHANGELOG.md [unreleased]` entry appended.
- [ ] `HANDOFF.md` flipped to "Wave 20 SHIPPED" with the Tier-2 / extraction follow-ups listed as next-candidate paths.
- [ ] `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-1-cleanup.md` is auto-archived by `/audit-followups` or manually flipped to `RESOLVED` and moved to `_archived/follow-ups/`.
- [ ] `.claude/vendor-gotchas/better-sqlite3.md` exists (or `src/main/codebaseGraph/CLAUDE.md`'s Gotchas section has) an entry capturing the JSON1 cycle-detection pattern.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
| ----- | ----------------- | ---------- | ------------------------------- |
| 0 | Updated ADR file on disk reflecting Cole's pick | local edit → `wave-20-decisions.md` Decision 4 section → status flipped from PENDING to RESOLVED | The file shows Decision 4's Pick/Rationale/Consequences blocks filled in with either "Option A" or "Option B" — not a stub. Cole's reply in chat ratifies the pick. |
| A | A `trace_call_path` query in the live IDE traversing a real call chain in a project where one symbol name is a strict prefix of another (e.g., a `parse` function and a `parseConfig` function in the same module) | IDE → renderer chat → Claude Code session → `mcp__ouroboros__trace_call_path` tool call → main process → `graphDatabaseTraversal.runBfsTraversal()` → updated SQL with json_each membership → both `parse` and `parseConfig` nodes appear in the result set with correct depth | The user observes the trace result includes BOTH symbols (not one accidentally suppressed by substring collision). If they ran the same query against pre-fix code on a graph fixture designed to trigger collision, they'd see ONE symbol; post-fix shows BOTH. Visual confirmation in the chat reply structure. |
| B | A real PageRank invocation in a long-running IDE session (e.g., during context ranking when chat sessions are switched repeatedly), via the main-process logs OR a `mcp__ouroboros__query_graph` call that returns a personalization vector | renderer triggers ranker → context-ranker calls PageRank → `buildPersonalizationVector` iterates seeds against the new Set → `_cache.set` triggers eviction when size > 20 → log line emitted or visible in next ranker output | The user opens the IDE, switches between several chat sessions over several minutes, observes the dev-tools console or main-process log for `[pageRank] cache eviction` (or equivalent log line if one exists; if not, inspect via test). No memory bloat over time; no observable behavior difference in ranking output. |
| C | A real `mcp__ouroboros__manage_adr` invocation in the live IDE — agent calls `manage_adr` with `mode='list'` and either omits `id` (Option B) or passes `id=<actual-id>` (Option A) | Claude Code session → MCP tool call → main process handler → response back to renderer chat | **Option B**: The agent attempting to pass `id` gets a schema-validation error (or, under more lenient validators, the param is silently dropped — either way, no orphan param in the schema). Listing ADRs returns project-level. **Option A**: passing `id=<existing>` returns just that ADR; passing `id=<missing>` returns a not-found envelope. Visible in the agent's reply text in chat. |
| D | `npm run test:codebasegraph` + `npm run lint` + `npm run typecheck` all green; `/review` PASS; `wave-20-result.md` on master | terminal → repo state | All gates green. PR (if one is opened) goes to merge. `HANDOFF.md` reflects Wave 20 SHIPPED. The Tier-1 FU is archived. |

### Data-shape probes

```bash
# Phase A — SQL transformation correctness
grep -nE "NOT LIKE '%' \|\| (nextNode|\\$\\{nextNode\\}) \|\| '%'" src/main/codebaseGraph/
# expect: zero

grep -nE "json_each\(r\.path\)" src/main/codebaseGraph/
# expect: ≥ 2 (one per file)

grep -nE "json_insert\(r\.path" src/main/codebaseGraph/
# expect: ≥ 2

# Phase A — regression test exists
grep -n "prefix-collision" src/main/codebaseGraph/cypherEngineRegression.test.ts
# expect: ≥ 1 hit (test name match)

# Phase B — Set + eviction
grep -nE "new Set\(nodeIds\)" src/main/codebaseGraph/graphPageRank.ts
# expect: 1

grep -nE "_cache\.size\s*>=?\s*20" src/main/codebaseGraph/graphPageRank.ts
# expect: ≥ 1 (eviction guard)

grep -nE "nodeIds\.includes" src/main/codebaseGraph/graphPageRank.ts
# expect: zero

# Phase C — schema/handler honesty
# Option B chosen:
node -e "const s = require('./src/main/codebaseGraph/mcpToolHandlerDefs.ts').inputSchemas.manage_adr; console.log(Object.keys(s.properties))"
# expect: ['mode', 'project', 'content', 'sections']  (no 'id')

# Option A chosen:
# (manual integration test via running IDE; mcp__ouroboros__manage_adr mode='get' id='some-adr')

# Phase D — gate validation
npm run test:codebasegraph
npm run lint
npm run typecheck
```

## Files the next agent should read first

1. `roadmap/wave-20-ouroboros-graph-tier-1-cleanup/wave-20-decisions.md` — ADR with 6 locked decisions; read first. Decision 4 may be PENDING — gate Phase C on it.
2. `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-1-cleanup.md` — source follow-up with all 5 items.
3. `C:\Web App\meta\discovery\2026-05-26-ouroboros-verification-report.md` — full verification context (read for grounding; not load-bearing for implementation).
4. `src/main/codebaseGraph/graphDatabaseTraversal.ts` — Phase A target. The `runBfsTraversal()` function (lines 25-61) and the recursive CTE block (lines 39-52) are the surgical site.
5. `src/main/codebaseGraph/cypherEngineVarpath.ts` — Phase A target. The `buildVarpathSqlTemplate()` function (lines 92-115) is the second surgical site; same transformation as #4.
6. `src/main/codebaseGraph/cypherEngineRegression.test.ts` — Phase A target for the new regression test case. Mirror existing test-fixture patterns.
7. `src/main/codebaseGraph/cypherEngine.smoke.test.ts` — re-runs in Phase A's gate; confirms the BFS primitive still covers the smoke surface.
8. `src/main/codebaseGraph/graphPageRank.ts` — Phase B target. `buildPersonalizationVector()` (lines 128-146) + cache declaration (lines 56-62).
9. `src/main/codebaseGraph/graphPageRank.test.ts` — Phase B target for extending coverage.
10. `src/main/codebaseGraph/mcpToolHandlerDefs.ts` — Phase C target. `manage_adr` schema lives near line 133-143.
11. `src/main/codebaseGraph/mcpToolHandlerHelpers.ts` — Phase C target. `handleManageAdr()` handler (lines 271-305); note the existing comment at 276-278.
12. `roadmap/wave-93-fix-sweep-drift-and-cleanups/waveplan-93.md` — exemplar wave shape; reference for any ambiguity about section structure.
13. `~/.claude/rules/development-pipeline.md` — Lane A fix-sweep mechanics + dispatch reflex + orchestrator self-fix test.
14. `~/.claude/rules/agent-catalog.md` — dispatch routing for sonnet-implementer vs haiku-implementer choice per phase.
15. `~/.claude/rules/best-practice-spectrum.md` — ADR framing for Phase 0.

## Note to the implementer

This is a fix-sweep wave — five small items bundled because each is too small to justify a wave on its own. The spirit: close real gaps in a high-quality subsystem before the standalone-MCP extraction begins. Leave the codebase one notch cleaner than you found it.

Three temptations to resist. First, do not re-litigate the architecture. The Cypher engine is deliberately custom (Kuzu archived Oct 2025; no maintained JS-pluggable alternative — locked in `wave-68-decisions.md`). Do not suggest swapping to Neo4j, tree-sitter-graph, or any other engine; that conversation has been had. Second, do not "improve" the surrounding `runBfsTraversal()` or `buildVarpathSqlTemplate()` functions while editing the cycle guard. The functions are working; the bug is local to one SQL fragment. If you find genuine adjacent issues, file Tier 3 follow-ups — do not in-scope them. Third, do not let the `manage_adr` Phase 0 decision drift into "let's redesign the ADR storage layer." The original FU offers Options A or B; Option B is the default for a reason. If Cole picks Option A, scope is tightly bounded to threading one parameter through one handler and one storage method — not redesigning the storage model.

Phase A is the most load-bearing. The BFS cycle detector is used by every variable-length Cypher path query plus the `trace_call_path` MCP tool. Get the SQL right; get the regression test right; then the rest of the wave is downhill.

The boundary phase is Phase C (MCP tool contract). The orchestrator authors the acceptance test BEFORE dispatching the subagent. Under Option B the acceptance test is "schema `properties` keys do not advertise params the handler ignores." Under Option A it is the per-ID CRUD round-trip. Subagent cannot modify the test.

> Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

For Phase A specifically: the observation is not "the prefix-collision test passes." It is "a `trace_call_path` query in a live IDE session traversing a real graph returns both prefix-related symbols." If you cannot trigger that in this session — no live IDE, no indexed graph at hand — say so, and surface it for the wave-end smoke.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means the orchestrator dispatches the next phase in the same turn. The turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision the grounding doesn't determine (Phase 0 here is one), or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists at `roadmap/wave-20-ouroboros-graph-tier-1-cleanup/wave-20-decisions.md`** with all 6 decisions present. Decision 4 (Option A vs B for `manage_adr`) may be PENDING — that's Phase 0.
2. **Phase 0** (orchestrator + Cole) — surface Decision 4 to Cole with the in-code "deferred to a future wave" evidence and Option B as the default recommendation. Wait for Cole's reply. Update the ADR. Turn-ending event: yes, this is a user-judgment decision the grounding does not unilaterally determine. Resume same session on Cole's answer.
3. **Phase A** (sonnet-implementer) — BFS cycle fix in both files + regression test + invariant doc. Brief includes: exact line ranges in both files, the JSON1 transformation pattern verbatim, the test-case name and assertion shape, and the doc-entry location to update. Gate: `npm run test:codebasegraph` passes; `grep` data-shape probes pass. **Boundary classification: NOT a cross-boundary phase** (pure internal SQL, no IPC / cross-package / external API touch). No `sonnet-phase-reviewer` dispatch — orchestrator diff glance only.
4. **Phase B** (haiku-implementer) — PageRank Set + cache cap. Brief explicitly: "Your tools are Read/Edit/Write. You CANNOT run tests, lint, or git. After editing, report DONE — the orchestrator runs gates." Gate: `npm run test:codebasegraph` passes; grep confirms Set + eviction present, includes call gone. **Can dispatch in parallel with Phase A — no shared files.** Trivial phase — no `sonnet-phase-reviewer` dispatch.
5. **Phase C** (sonnet-implementer) — `manage_adr` schema honesty. **Boundary phase — MCP tool contract.** Before dispatch: orchestrator authors a failing acceptance test in `src/main/codebaseGraph/mcpToolHandlerSchemaContract.test.ts` (or similar) that under Option B asserts the `manage_adr` schema's `properties` set matches the handler's consumed `args`. Run the test locally; confirm it FAILS against current code (id is in schema, ignored by handler). Then dispatch with the brief naming the test path and "you may not modify it." Gate: acceptance test passes; `npm run test:codebasegraph` + `npm run typecheck` pass. **`sonnet-phase-reviewer` dispatch on the diff before declaring the gate green** — boundary phase, MCP contract, mental-model divergence risk is real.
6. **Phase D** (orchestrator) — wave wrap. Run scoped suites (`test:codebasegraph`, `test:main`), `npm run lint`, `npm run typecheck`, formatter. `/review` mechanical gap-check — verdict gates merge. Orchestrator diff review of the whole wave. Run the data-shape probes from §Verification. Write `wave-20-result.md`. `CHANGELOG.md [unreleased]` entry. `git push` per standing posture. `HANDOFF.md` flip. `/audit-followups wave-20-ouroboros-graph-tier-1-cleanup` — auto-archives the source FU. `/promote-vendor-lessons 20` — extract better-sqlite3 / SQLite JSON1 cycle-detection pattern into `.claude/vendor-gotchas/`. Manual smoke gate: NOT required — no `src/renderer/components/Layout/**` changes; all edits are in main-process graph subsystem.
