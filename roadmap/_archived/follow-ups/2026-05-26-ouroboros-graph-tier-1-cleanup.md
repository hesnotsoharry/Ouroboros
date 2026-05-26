---
status: RESOLVED
created: 2026-05-26
updated: 2026-05-26
resolved: 2026-05-26
resolved_by: wave-20-ouroboros-graph-tier-1-cleanup
priority: MED
source: meta-verification-2026-05-26
---

# Ouroboros codebase graph — Tier-1 cleanup

**Status:** OPEN
**Source:** Meta verification report 2026-05-26 (`C:\Web App\meta\discovery\2026-05-26-ouroboros-verification-report.md`)
**Filed:** 2026-05-26
**Suggested wave shape:** Fix-sweep wave (5 bundled items) via `/wave-plan-lite`
**Estimated effort:** ~1 dev day

## Background

Orchestrator verification of `src/main/codebaseGraph/` on 2026-05-26 found the implementation unusually clean (zero TODO/FIXME/HACK markers, 45 test files, only 3 justified `any` usages). One latent bug plus several small correctness/perf opportunities surfaced. All five items are file:line-specific and orthogonal to architectural decisions.

## Items

### 1. BFS cycle detection — replace string-LIKE with proper visited-set

**Files:** `graphDatabaseTraversal.ts:47`, `cypherEngineVarpath.ts:104`
**Effort:** M
**Severity:** Latent bug

The cycle guard uses `AND r.path NOT LIKE '%' || nextNode || '%'` on a string path accumulator. Currently safe because qualified names use `.` separators and the `>` delimiter prevents substring matches across node boundaries — but **silently fragile** to:
1. Future change to node-ID format (e.g., switching delimiter to `/`)
2. Any qualified name that becomes a substring of another (e.g., `src.a` AND `src.auth`)

If either happens, BFS produces wrong results — missing nodes in traversal, not an error. This is the most-used traversal primitive (`trace_call_path` + all variable-length Cypher queries depend on it).

**Recommended fix:** Replace the string-LIKE path accumulator with a JSON array (`json_each` / `json_insert` in SQLite) or a separate `visited` CTE. Add a regression test in `cypherEngine.smoke.test.ts` (or sibling) that asserts BFS correctness when one qualified name is a prefix/substring of another.

### 2. PageRank `.includes()` → `Set` membership

**File:** `graphPageRank.ts:134`
**Effort:** S (~2 lines)

`nodeIds.includes(seed.id)` iterates the full node list per seed. For a 50k-node graph with 10 seeds, that's 500k comparisons on each PageRank call. Convert `nodeIds` to a `Set<string>` for O(1) membership.

### 3. PageRank cache — add eviction or cap

**File:** `graphPageRank.ts:57-58`
**Effort:** S

The module-level `const _cache = new Map<string, CacheEntry>()` is never size-bounded. Each distinct seed-set hash produces a new entry. In long IDE sessions where PageRank is called with varied seeds (different active files), the cache accumulates unbounded entries. TTL is 60s so entries expire, but the working set across a 4-hour session could hold dozens of entries × `Map<string, number>` per project's node count.

**Recommended fix:** Add LRU eviction or hard cap (e.g., 20 entries max) on `_cache`. Simple FIFO eviction when size > N would suffice.

### 4. `manage_adr` schema honesty — implement or remove `id` parameter

**File:** `mcpToolHandlerHelpers.ts:276-279` (handler) + `mcpToolHandlerDefs.ts` (schema)
**Effort:** M
**Decision required**

The `manage_adr` tool's input schema advertises an `id` parameter with description "ADR identifier (when targeting a specific ADR)", but the implementation ignores it and operates project-wide only. An agent reading the schema would reasonably try to pass `id='some-adr-id'` and silently get project-level results.

**Two options — pick one:**

- **Option A — Implement per-ID targeting.** Add an `id` column to ADR storage (or compose from project + slug), thread through CRUD operations. Effort: M.
- **Option B — Remove `id` from schema.** Make the tool surface match its actual behavior; document that ADRs are project-level only. Effort: S.

Option B is safer if the per-ID design hasn't been thought through. Option A is right if per-ID was always the intent and the implementation lag is the bug.

### 5. Document the cycle-detection invariant

**File:** `graphDatabaseTraversal.ts:47` (top of the function containing the LIKE pattern)
**Effort:** S
**Goal:** prevent future maintainers from accidentally breaking the LIKE assumption

Add a comment block explaining:
- Why the LIKE pattern is safe under current node-ID format (`.` separators, `>` delimiter, qualified names don't have `>` chars)
- What would break it (format change, qualified-name substring collisions)
- Pointing to item #1 above if/when the fix lands, this becomes obsolete

This is doctrine; lands even if item #1 ships in the same wave.

## Suggested phase ordering

5 items, mostly independent:

```
Phase A: Item 1 (BFS cycle fix) + Item 5 (doc invariant) — same files, one dispatch
Phase B: Item 2 + Item 3 (PageRank micro-opts) — same file, one dispatch
Phase C: Item 4 (manage_adr decision + implementation) — surface to Cole first for the decision
```

`haiku-implementer` works for items 2, 3, 5 (mechanical). Item 1 needs `sonnet-implementer` (load-bearing SQL with test design). Item 4 needs Cole's decision first.

## Verification

- All five items have existing test coverage paths (`cypherEngine.smoke.test.ts`, `cypherEngine.test.ts`, `graphPageRank.test.ts`)
- Item 1 needs a NEW regression test covering substring-prefix node IDs
- Item 4 needs schema validation tests if Option A
- Full graph DB integration test must stay green

## Risks

| Risk | Mitigation |
|---|---|
| Item 1 fix changes SQL plan; perf regression on `trace_call_path` | Benchmark before/after on Agent IDE's 21k-node / 48k-edge graph; if JSON array approach is slower, fall back to `visited` CTE pattern |
| Item 4 Option A turns out larger than M | Split into its own follow-up; ship Option B in this wave to close the schema-honesty gap |

## References

- Meta verification report: `C:\Web App\meta\discovery\2026-05-26-ouroboros-verification-report.md` (sections "Latent bug found" + "Other improvement opportunities")
- Existing test files: `src/main/codebaseGraph/cypherEngine.smoke.test.ts`, `graphPageRank.test.ts`
