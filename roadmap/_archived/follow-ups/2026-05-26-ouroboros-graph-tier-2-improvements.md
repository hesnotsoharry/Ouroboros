---
status: RESOLVED
resolved-during: wave-21-ouroboros-graph-tier-2
created: 2026-05-26
updated: 2026-05-26
priority: MED
source: meta-verification-2026-05-26
---

# Ouroboros codebase graph — Tier-2 improvements

**Status:** OPEN
**Source:** Meta verification report 2026-05-26
**Filed:** 2026-05-26
**Suggested wave shape:** Substantive wave via `/wave-plan` (each item is a phase)
**Estimated effort:** ~2-3 dev days
**Prerequisite:** Tier-1 cleanup wave shipped first

## Background

Two substantive items surfaced during meta verification. Both are real feature/perf gaps that don't conflict with the deliberate "build custom" architectural direction. Distinct from Tier-1 (polish) and Phase 4 (standalone extraction).

## Items

### 1. Implement IMPLEMENTS edges via tree-sitter `class_heritage`

**Files:** `passes/enrichmentPass.ts:59` (current placeholder comment), `treeSitterParserDefs.ts` (extraction), graph schema (edge type if not present)
**Effort:** M
**Severity:** Known OOP completeness gap

Current state per `enrichmentPass.ts:59` comment: *"IMPLEMENTS edges are a placeholder — tree-sitter extraction would need to expose implements/extends info from class_heritage nodes first."*

The `class_heritage` node IS available in the TypeScript tree-sitter grammar (and similar nodes exist in other OO languages). Implementing the extraction would:
- Close a real call-graph completeness gap for OOP code
- Enable `trace_call_path` to follow interface→implementation relationships
- Unlock Cypher queries like `MATCH (cls:Class)-[:IMPLEMENTS]->(iface:Interface) RETURN cls, iface`

### 2. testDetectPass incrementality

**File:** `passes/testDetectPass.ts:142-145`
**Effort:** M
**Severity:** Performance — degrades with codebase scale

`testDetectPass.ts:142-145` calls `db.getNodesByLabel(projectName, 'Function')` + `db.getNodesByLabel(projectName, 'Method')` on EVERY incremental reindex — full table scans regardless of how many files changed. For a 50k-function codebase, this is a per-keystroke cost (gated by the 300ms+3s debounce chain so not catastrophic, but degrades with scale).

**Recommended fix:** Either (a) cache the Function+Method index between reindexes and invalidate per-file on change, OR (b) accept a `changedFunctionSet` parameter and only re-run the heuristics for changed files' tests.

## Phase shape

Two phases, one item each. Sonnet-implementer for both — both require judgment on extraction shape (item 1) or invalidation strategy (item 2).

## Out of scope

- **Wave 77-B (`WITH` clause support)** — stays where it is, gated on agent-usage telemetry from `traceBatcher`. Tracked in `roadmap/follow-ups/cypher-engine-feature-additions.md` (Wave B).
- **Standalone MCP extraction** — separate wave (see `2026-05-26-ouroboros-graph-standalone-mcp-extraction.md`)

## References

- Meta verification report: `C:\Web App\meta\discovery\2026-05-26-ouroboros-verification-report.md` (improvement opportunities table)

## Resolution (wave-21-ouroboros-graph-tier-2)

Closed by `haiku-followup-auditor` during wave audit on 2026-05-26.

Evidence: Both items shipped in Wave 21. Phase 1 implemented IMPLEMENTS + EXTENDS edges via tree-sitter `class_heritage` extraction (files: treeSitterTypes.ts, treeSitterParserDefs.ts, indexingPipelineHeritage.ts, indexingPipelinePasses.ts, enrichmentPass.ts, treeSitterParserDefs.test.ts, indexingPipeline.heritageEdges.acceptance.test.ts). Phase 2 implemented testDetectPass cache with per-file QN-prefix invalidation (files: testDetectPass.ts, indexingPipeline.ts, testDetectPass.test.ts). All 6 decisions ratified. Gates: 743 codebaseGraph tests passed; 6604 main tests passed (1 pre-existing failure unrelated to wave). See `wave-21-result.md` § Verification.
