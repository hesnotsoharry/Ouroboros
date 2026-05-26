---
status: DRAFT
created: 2026-05-26
updated: 2026-05-26
wave: 21
---

# Wave 21 — Architecture Decision Record

Decisions ratified before any code is written. Decisions 2 and 3 require Cole's Phase 0 lock.

---

## Decision 1: Phase 1 extraction scope — TypeScript and TSX only

**Context:** The source follow-up (`roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-2-improvements.md`) names IMPLEMENTS edges as an OOP completeness gap. The tree-sitter ecosystem exposes class-heritage analogues in many OO languages: Java (`superclass`/`interfaces`), C++ (`base_class_clause`), C# (`base_type`), Python (`superclasses` field), Rust (impl items + traits), Go (interface embedding). Shipping all of them in one wave multiplies risk and scope.

**Options considered:**
- *Industry standard:* TS/TSX only this wave; defer other OO languages to a follow-up.
- *Emerging best practice:* TS/TSX + Java + Python this wave; defer C++/C#/Rust to a follow-up.
- *Experimental:* All OO languages with a per-language adapter pattern.

**Pick:** TS/TSX only — industry standard.

**Rationale:** Agent IDE's own codebase is TS/TSX; immediate value is here. Per-language heritage extraction has language-specific traps (Rust trait impls are syntactically distinct from inheritance; Go has implicit interface satisfaction with no grammar signal at the declaration site; Python bases can be arbitrary expressions). One wave per consumer-needed language is cheaper than one wave that covers all languages with edge cases.

**Consequences:** Other-language classes don't emit IMPLEMENTS/EXTENDS edges in Wave 21. A follow-up file will be created at wrap time listing the deferred languages so a future wave can pick up the next one.

---

## Decision 2: Edge emission site — `definitionPass` vs `enrichmentPass`

**Status:** PENDING — REQUIRES USER LOCK (Phase 0).

**Context:** Two viable sites for emitting IMPLEMENTS/EXTENDS edges: (a) inside `definitionPass` (`indexingPipelinePasses.ts`) where the class and interface nodes are already being inserted with the Wave 19 two-phase node-then-edge pattern; (b) inside `enrichmentPass` (`passes/enrichmentPass.ts`) where the existing placeholder comment lives (lines 64-65).

**Options considered:**
- *Industry standard:* `definitionPass` — co-locate edge emission with source node emission, reuse the FK-safe two-phase boundary.
- *Emerging best practice:* same as industry standard for this case; no genuinely emerging alternative.
- *Conservative variant:* `enrichmentPass` — minimal-touch to the load-bearing `definitionPass`; symmetry with the placeholder comment's current location.

**Pick (recommended):** `definitionPass` — industry standard.

**Rationale:** (a) The heritage data lives in `ExtractedDefinition`, which `definitionPass` already consumes; emitting the edges there is one extra loop over the same data. `enrichmentPass` would need a second DB scan to find heritage-bearing classes. (b) `definitionPass` already uses the Wave 19 two-phase node-then-edge pattern, which guarantees all source/target nodes for heritage edges are inserted before any heritage edge is inserted — no FK violations. (c) Heritage extraction and edge emission read as the same "definition" responsibility; splitting into two passes increases conceptual surface for no benefit.

**Consequences:** The placeholder comment in `enrichmentPass.ts:64-65` is removed and pointed at `definitionPass`. `enrichmentPass` keeps its existing entry-point-marking work but does not gain new edge emission this wave.

**REQUIRES USER LOCK** — Cole confirms `definitionPass` or picks `enrichmentPass`.

---

## Decision 3: testDetectPass cache shape and invalidation policy

**Status:** PENDING — REQUIRES USER LOCK (Phase 0).

**Context:** `testDetectPass.ts:142-144` calls `db.getNodesByLabel(projectName, 'Function').concat(db.getNodesByLabel(projectName, 'Method'))` on every reindex. Each call is index-backed (`idx_nodes_label`) but still reads every Function + Method row in the project. The follow-up suggests either (a) caching the index between reindexes with per-file invalidation, OR (b) accepting a `changedFunctionSet` parameter and running heuristics only for changed files' tests.

**Options considered:**
- *Industry standard:* Module-level cache inside `testDetectPass.ts`, keyed by `projectName`, with FIFO cap; invalidation policy is "if any changed file's relativePath would produce a QN prefix that intersects the cache's `functionsByName`, invalidate." Full-reindex paths invalidate unconditionally.
- *Emerging best practice:* Promote the Function+Method index to a shared abstraction on `GraphDatabase` (e.g., `getFunctionsByNameIndex(projectName)`) with internal caching; consumed by `testDetectPass` and any future pass that needs the same shape.
- *Aggressive variant:* Replace the "scan all Functions/Methods" model entirely with the FU's option (b) — only run TESTS heuristics for changed files' test functions, skip the project-wide scan altogether. Lower mechanical cost but may miss tests that reference changed production functions from unchanged test files.

**Pick (recommended):** Industry standard — module-level Map cache, FIFO at N=10 projects, per-file QN-prefix invalidation.

**Rationale:** (a) Local cache scope (premature generalization is the canonical pass-memoization anti-pattern; if a second consumer emerges, promote then). (b) FIFO at N=10 is comfortable headroom for Agent IDE's worst case (~3 concurrent project roots). (c) The full-rescan-on-changed-file path is "miss" cost; cache HIT path is the savings. The aggressive variant (skip the scan, only re-evaluate changed files) is a different semantic — it could miss the case where an unchanged test file's `it('foo', ...)` test references a now-renamed production function (the TESTS edge would dangle silently). Keeping the project-wide invariant ("every TESTS edge is recomputed when ANY change happens, but the index is cached when nothing has") preserves correctness with the perf win.

**Consequences:** `testDetectPass` signature changes from `(db, projectName, indexedFiles)` to `(db, projectName, indexedFiles, changedFiles?: Set<string>)`. Caller `indexingPipeline.ts:145` updated to pass `changedFiles`. New `[trace:testDetectPass.cache] hit|miss projectName=X durationMs=N` log line emitted on every call.

**REQUIRES USER LOCK** — Cole confirms module-local + per-file QN-prefix invalidation, or picks promoted-to-DB, or picks the aggressive changed-functions-only variant.

---

## Decision 4: IMPLEMENTS/EXTENDS target resolution policy — skip on unresolved

**Context:** When a class implements an interface from an external library (`implements EventEmitter` from `node:events`), the interface name has no corresponding node in the project graph. Emitting an edge with that bare name as `target_id` would violate the `edges.target_id → nodes(id)` FK constraint introduced in Wave 19.

**Options considered:**
- *Industry standard:* Skip the edge — mirror Wave 19's `callResolutionPass` filterEdges safety net.
- *Emerging best practice:* Synthesize a stub external-interface node (`__external__::EventEmitter`) and emit the edge against it; document the convention.
- *Conservative:* Emit the edge with a `confidence: 0.5` and the bare name; let downstream queries filter — but this fights the FK constraint.

**Pick:** Skip the edge — industry standard, matches Wave 19's pattern.

**Rationale:** The graph is project-internal by design. Synthesizing external nodes opens a separate scope (which externals get nodes? all? only `implements` references? lib version pinning? deduplication?) that would derail Wave 21. The conservative option fights the schema. Skipping is honest: "the graph doesn't know about that interface."

**Consequences:** Classes implementing third-party interfaces produce no IMPLEMENTS edge in the graph. Future work could add external-stub nodes if a consumer needs cross-package heritage — file as a follow-up.

---

## Decision 5: Include EXTENDS edges (class → parent class) in Phase 1

**Context:** The source FU literally names IMPLEMENTS but not EXTENDS. The tree-sitter walk for `class_heritage` exposes both `extends_clause` and `implements_clause` in the same pass; emitting EXTENDS alongside IMPLEMENTS costs ~5 lines of code.

**Options considered:**
- *Industry standard:* Ship both edge types this wave. EXTENDS is already in `EdgeType`; the parser walks `class_heritage` once and harvests both clauses.
- *Conservative variant:* Ship only IMPLEMENTS to match the FU literally; EXTENDS in a later wave.

**Pick:** Ship both.

**Rationale:** Same code path, same FK-safety analysis, same target-resolution model. Shipping only IMPLEMENTS and then re-touching `treeSitterParserDefs.ts` for EXTENDS later is pure friction. The FU's spirit is OOP completeness, not pedantic literal scope.

**Consequences:** `definitionPass` emits both IMPLEMENTS and EXTENDS. Acceptance test asserts both edge counts.

---

## Decision 6: Phase 1 boundary classification — boundary phase

**Context:** Phase 1 changes a parser extraction path (no IPC, no cross-package), emits new edge types into the graph DB. The downstream consumer surface — `trace_call_path`, `query_graph` MCP tool, `searchGraph` — reads these edges.

**Options considered:**
- *Industry standard:* Boundary phase per `~/.claude/rules-deferred/orchestrator-owned-acceptance-tests.md` — orchestrator authors the failing acceptance test before dispatch; implementer cannot modify it.
- *Conservative variant:* Treat as a non-boundary phase, rely on the implementer's own tests + post-DONE `sonnet-phase-reviewer`.

**Pick:** Boundary phase — industry standard.

**Rationale:** Persistent storage with non-trivial schema is the canonical boundary-phase trigger per the rule. The acceptance test pins the contract (1 EXTENDS, 2 IMPLEMENTS, 0 dangling for the fixture) from the consumer's perspective, not the implementer's mental model. Wave 19 (FK violations) demonstrated the cost of letting an implementer own both the change AND the verification on a persistent-storage surface.

**Consequences:** Orchestrator pre-flight step before Phase 1 dispatch: author the acceptance test, verify it fails against current code. Implementer's brief includes "you may not modify this test."

---

## Phase 0 ratification log

| Decision | Status | Pick | Date |
|----------|--------|------|------|
| 1 | RESOLVED | TS/TSX only | 2026-05-26 (planner) |
| 2 | RESOLVED | `definitionPass` | 2026-05-26 (Cole delegated; orchestrator picked recommended on technical merits — co-location with `ExtractedDefinition` consumer, FK-safety inherited from Wave 19 two-phase pattern, semantic fit for the standalone-MCP extraction roadmap) |
| 3 | RESOLVED | Module-local Map, FIFO N=10, per-file QN-prefix invalidation | 2026-05-26 (Cole delegated; orchestrator picked recommended on technical merits — aggressive variant trades correctness for perf and is rejected; module-local is YAGNI-correct since no second consumer exists today) |
| 4 | RESOLVED | Skip on unresolved | 2026-05-26 (planner) |
| 5 | RESOLVED | Ship both | 2026-05-26 (planner) |
| 6 | RESOLVED | Boundary phase | 2026-05-26 (planner) |

All decisions ratified. Phase 1 dispatch can proceed (after orchestrator authors the boundary acceptance test); Phase 2 can dispatch in parallel.
