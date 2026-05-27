---
status: RESOLVED
created: 2026-05-26
updated: 2026-05-26
wave: 20
---

# Wave 20 — Architecture Decisions

## Decision 1: BFS cycle detector replacement strategy

**Context:** `graphDatabaseTraversal.ts:47` and `cypherEngineVarpath.ts:104` both use `AND r.path NOT LIKE '%' || nextNode || '%'` as a cycle guard inside a `WITH RECURSIVE reachable(id, depth, path)` block where `path` is a `>`-delimited string accumulator. Currently safe because qualified names use `.` separators and `>` delimits, but silently fragile to (a) future node-ID format changes and (b) qualified-name substring collisions like `src.a` vs `src.auth`. We need a structurally correct cycle guard that doesn't rely on string-substring properties of node IDs. Multiple options exist with different tradeoffs against performance, code-clarity, and SQLite feature support.

**Options considered:**

- *Industry standard — per-row JSON1 visited set:* `path` column becomes a JSON array. Anchor uses `json_array(start_id)`; recursive step uses `json_insert(r.path, '$[#]', nextNode)`; guard becomes `NOT EXISTS (SELECT 1 FROM json_each(r.path) WHERE value = nextNode)`. Industry-standard SQLite pattern, JSON1 is compiled into better-sqlite3@12.8.0 by default (verified). Preserves depth-ordering semantic (path is per-row, not global dedup).
- *Industry standard — UNION dedup:* swap `UNION ALL` → `UNION` in the recursive CTE. SQLite docs literally name this as the cycle-prevention pattern. BUT: the row includes `depth`, so two paths to the same node at different depths both survive — does not actually dedup the node. Would require dropping `depth` from the row, breaking BFS shortest-path semantics. **Disqualifying.**
- *Emerging — separate visited-nodes parameter table:* maintain a `visited` table populated in lockstep with the recursion. Cleaner separation but requires multi-statement orchestration around the CTE (better-sqlite3's synchronous API supports it but the SQL gets longer). Same memory profile as the JSON path column.
- *Experimental — hash-prefixed node IDs:* normalize IDs at insertion time so no ID is a substring of another (e.g., prefix every ID with a length or a fixed delimiter that can't appear in names). Surface change with downstream consumer impact; out of scope.

**Pick:** Per-row JSON1 visited set — industry standard.

**Rationale:** JSON1 is available without extra setup in our pinned `better-sqlite3@12.8.0`. The transformation is local to the recursive CTE — no schema migration, no consumer-facing change, no multi-statement coordination. Memory profile is equivalent to the existing string accumulator (one path per row, bounded by max-depth). The new SQL reads cleanly to anyone with passing JSON1 knowledge. The pattern matches what cross-database guidance recommends (sqlfordevs.com cycle-detection, SQLite official docs).

**Consequences:** All current consumers of the `path` column treat it as opaque (verified) so the format change is transparent. Future query authors writing recursive traversals against `nodes`/`edges` should follow this pattern — documented in Decision 5. If a future SQLite version or `better-sqlite3` upgrade ships without JSON1 (extremely unlikely), the fallback is the separate-visited-CTE pattern.

## Decision 2: JSON array path schema

**Context:** Having picked Decision 1, we need to fix the exact SQL shape so Phase A's implementer doesn't have to redesign mid-implementation.

**Options considered:**

- Trivial decision — single defensible shape given Decision 1.

**Pick:** Initialize with `json_array(start_id)` in the anchor; accumulate with `json_insert(r.path, '$[#]', nextNode)` in the recursive step; guard with `NOT EXISTS (SELECT 1 FROM json_each(r.path) WHERE value = nextNode)`. Returned `path` column stays JSON-formatted text; downstream consumers either treat it as opaque or parse with their JSON parser of choice.

**Rationale:** `$[#]` is SQLite's "next array index" expression supported since 3.31.0 (2020) — well within `better-sqlite3@12.8.0`'s shipped SQLite version. `json_each` is the standard membership-iteration function. `NOT EXISTS` is the idiomatic negation; avoids the alternative `IFNULL(json_each(...), 0)` pattern which is awkward and less clear.

**Consequences:** The shape of the `path` column changes from `>`-delimited string to JSON array string. Any future debugging that visually inspects `path` will see `["src.a","src.b","src.c"]` instead of `src.a>src.b>src.c`. Downstream consumers (verified to treat it as opaque) need no change.

## Decision 3: PageRank cache eviction policy

**Context:** `graphPageRank.ts:62` declares a module-level unbounded `Map<string, CacheEntry>` with a 60s TTL on read. In long IDE sessions across many distinct seed sets (different active files), the cache could hold dozens of entries × `Map<string, number>` per project's node count. We need a bound on peak memory without compromising hit rate for the common-case access pattern.

**Options considered:**

- *Industry standard — FIFO at fixed cap N=20:* one-line eviction guard (`if (size >= N) cache.delete(cache.keys().next().value)`). Map iteration order in JavaScript is insertion order — FIFO is free. Simple, predictable.
- *Emerging — LRU at fixed cap N=20:* additional bookkeeping (move-to-end on every hit), modest memory overhead. Higher hit rate for hot seed sets that age past the FIFO boundary.
- *Industry standard — TTL-only with shorter TTL:* drop the 60s TTL to 15s; rely on time-based eviction. Doesn't bound peak — if 30 distinct seed sets are accessed in 15s, all 30 entries are live simultaneously. Doesn't solve the actual problem.
- *Experimental — adaptive size based on heap pressure:* monitor heap via `process.memoryUsage()` and shrink under pressure. Overengineered for the actual problem scope.

**Pick:** FIFO at N=20 — industry standard.

**Rationale:** N=20 is large enough to cover the typical IDE working set (a handful of recently-active files, each potentially being a seed for context ranking). FIFO is one-liner: insertion-order Map iteration. The 60s TTL stays in place — eviction is the second layer of defense. PageRank itself is a cheap computation (single matrix iteration over a graph of ~20k nodes completes in milliseconds), so on the rare cache-miss-after-FIFO-eviction case the recompute cost is unnoticeable. If telemetry later shows a high recompute rate for actually-hot seeds aging out of a FIFO queue, LRU upgrade is a follow-up.

**Consequences:** Peak `_cache` memory is bounded to ~20 × (avg CacheEntry size). The 60s TTL continues to clean up cold entries even before the FIFO cap fires. No observable behavior change in steady state.

## Decision 4: `manage_adr` `id` parameter — Option A vs Option B

**Context:** `mcpToolHandlerDefs.ts:138` advertises an `id` parameter in the `manage_adr` MCP tool's input schema: `id: { type: 'string', description: 'ADR identifier (when targeting a specific ADR).' }`. The handler implementation at `mcpToolHandlerHelpers.ts:271-305` ignores `args.id` entirely — only `mode` and `project` (with fallback to `ctx.projectName`) are consumed. The handler body carries a comment (lines 276-278): *"Wave 70 Phase B3: `adr_id` deprecated alias dropped from the schema. Current DB methods are project-level only; per-ID targeting deferred to a future wave that adds the storage support."* An agent reading the tool schema today would reasonably pass `id='some-adr'` and silently get project-level results. We must align schema with implementation. Two options, A and B.

**Options considered:**

- *Option A — Implement per-ID targeting:* add an `id` column to the ADR storage layer (or compose from `project` + `slug`); thread `id` through the handler's mode-switch (list/get/store/update/delete); add per-ID CRUD methods to `graphStore.ts` or the relevant storage helper; schema validation tests for the per-ID path. Closes the deferral path the in-code comment explicitly mentions. Effort: M. Larger blast radius (storage layer touched).
- *Option B — Remove `id` from the schema:* delete the `id` property from the `manage_adr` schema's `properties`; update the handler comment to drop "deferred to a future wave" language and document project-level-only semantics. Effort: S. Surface-honesty fix without committing to per-ID work that no consumer has demanded.

**Pick:** Option B (remove `id` from schema; document project-level-only) — industry standard.

**Rationale:** Five load-bearing reasons. (1) No consumer exists today; the handler has silently ignored `id` since Wave 70 Phase B3 and nothing has surfaced demanding per-ID targeting — building speculative storage is canonical YAGNI. (2) MCP schemas are contracts read by agents; a param advertised-but-ignored is an active footgun (agents pass it, get silent project-level results, debug confusion). Option B removes the footgun; Option A perpetuates a design no real consumer validated. (3) Scope discipline — this is a Tier-1 cleanup wave; M-effort storage work is the wrong shape here. File as its own FU if and when demand materializes. (4) The standalone MCP extraction wave (Phase 4 per Cole's plan, blocked on Wave 87) is the natural moment to revisit ADR addressability with real cross-project usage. Doing per-ID now in the in-IDE context and re-litigating during extraction is double work. (5) The in-code comment ("deferred to a future wave that adds the storage support") was authoritative-sounding but is intent without commitment; Option B closes the open-ended deferral rather than perpetuating it.

**Consequences:** The `manage_adr` schema's `properties` drops the `id` entry. Handler comment at `mcpToolHandlerHelpers.ts:276-278` rewritten to "ADR storage is project-level by design; per-ID targeting is not supported and was never wired through. If a consumer needs per-ID retrieval, file a focused follow-up with the use case." Any consumer that was passing `id` (no observed cases) loses the silent-drop behavior — under stricter MCP-schema validators, that input is now rejected. The standalone-MCP extraction wave reopens this question with cross-project context as input, not speculation.

## Decision 5: BFS cycle invariant documentation

**Context:** Decision 1 introduces a non-obvious JSON1 pattern at two SQL sites; we want future maintainers (or the standalone-MCP extraction wave's implementer) to understand the pattern and not "simplify" it back to a string-LIKE check.

**Options considered:**

- *Trivial decision — single defensible answer:* document at both the SQL sites (short comment block above the recursive CTE) AND in a project-level location (subsystem CLAUDE.md if a Gotchas section exists, or `.claude/vendor-gotchas/better-sqlite3.md` if not).

**Pick:** Both — SQL-site comment block AND project-level vendor-gotcha or CLAUDE.md entry.

**Rationale:** The SQL-site comment is right-there context; the project-level entry surfaces during preflight reading for any future wave touching graph SQL. Belt and suspenders is cheap (~10 lines of comment, ~1 paragraph of doc) and pays for itself the first time someone considers reverting.

**Consequences:** Two artifacts to maintain. If JSON1 pattern is changed in the future, both update. The vendor-gotcha file adds to the load-on-second-use vendor knowledge surfaced via `@import` per the global development-pipeline rule.

## Decision 6: Regression test for prefix-collision

**Context:** Decision 1's whole point is correctness under prefix-collision node IDs. We need a programmatic guarantee that the fix is correct and stays correct.

**Options considered:**

- Trivial decision — add a regression test case in the existing `cypherEngineRegression.test.ts` file (already present; verified this session).

**Pick:** New test case in `src/main/codebaseGraph/cypherEngineRegression.test.ts` named "BFS handles prefix-collision node IDs without substring confusion."

**Rationale:** Existing regression-test file is the canonical home for this kind of correctness assertion. Mirroring the file's existing test-fixture patterns reduces drift risk.

**Consequences:** One more test in the codebase-graph suite. Catches future regression if anyone "optimizes" the JSON1 guard back into a string check. Adds ~30s to `test:codebasegraph` runtime — negligible.
