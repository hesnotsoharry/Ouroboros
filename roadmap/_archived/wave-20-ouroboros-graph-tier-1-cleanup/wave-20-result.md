---
status: SHIPPED
created: 2026-05-26
updated: 2026-05-26
wave: 20
type: fix-sweep
predecessor: wave-19-renderer-bundle-and-fk-fixes
---

# Wave 20 — Ouroboros Codebase Graph Tier-1 Cleanup — RESULT

## What shipped

Five-item fix-sweep against `src/main/codebaseGraph/`. Source: meta verification report 2026-05-26 + `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-1-cleanup.md`.

### Phase A — BFS cycle detector JSON1 rewrite + invariant doc + regression test

**Files:**
- `src/main/codebaseGraph/graphDatabaseTraversal.ts` — `runBfsTraversal()` recursive CTE: anchor uses `json_array(?)`, recursive step uses `json_insert(r.path, '$[#]', nextNode)`, guard uses `NOT EXISTS (SELECT 1 FROM json_each(r.path) WHERE value = nextNode)`. Outer query parses `r.path` via `JSON.parse(r.path) as string[]` (was `r.path.split('>')`).
- `src/main/codebaseGraph/cypherEngineVarpath.ts` — same transformation in `buildVarpathSqlTemplate()`. Outer query start-node recovery: `json_extract(r2.path, '$[0]')` replaces the old `SUBSTR`/`INSTR` extraction (forced by the path-column format change; in-scope per implementer's report).
- `src/main/codebaseGraph/cypherEngineRegression.test.ts` — new `describe` block with `seedPrefixCollision` fixture + test case `"BFS handles prefix-collision node IDs without substring confusion"`. Synthetic 4-node graph where `src.auth` is a strict prefix of `src.a`; asserts both nodes appear at correct depths (pre-fix would have suppressed `src.a` via the substring match).
- `.claude/vendor-gotchas/better-sqlite3.md` — **new file**. Captures the JSON1 cycle-detection pattern (anchor / recursive-step / guard / why-not-LIKE) with cross-reference to Wave 20.

**Why:** The old `path NOT LIKE '%' || nextNode || '%'` guard was currently safe but silently fragile to (a) node-ID format changes and (b) qualified-name substring collisions. The fix is structurally correct under any node-ID shape and eliminates the latent bug.

**Decision tier:** Industry standard per Wave 20 Decision 1 — `better-sqlite3@12.8.0` ships JSON1 by default; `$[#]` array-append supported since SQLite 3.31.0 (2020).

### Phase B — PageRank Set membership + FIFO cache cap

**File:** `src/main/codebaseGraph/graphPageRank.ts`

- Line 135: `const nodeIdSet = new Set(nodeIds);` constructed once at `buildPersonalizationVector()` entry.
- Line 137: `nodeIdSet.has(seed.id)` replaces `nodeIds.includes(seed.id)` (O(n) → O(1) per seed).
- Lines 266-269: FIFO eviction guard before `_cache.set(...)` — when size ≥ 20, delete the oldest entry (Map iteration order is insertion order; one-liner). One call site identified and guarded.
- Line 62: comment annotation referencing Wave 20 Decision 3.

**Why:** `_cache` was module-level and unbounded — long IDE sessions across distinct seed sets could accumulate dozens of entries. FIFO at N=20 caps peak memory; 60s TTL stays as the second layer of defense. `.includes` → `.has` is a free O(1) win.

### Phase C — `manage_adr` schema honesty (Option B)

**Files:**
- `src/main/codebaseGraph/mcpToolHandlers.ts:138` — deleted the orphan `id: { type: 'string', description: 'ADR identifier (when targeting a specific ADR).' }` line from the `manage_adr` `TOOL_SCHEMAS` entry.
- `src/main/codebaseGraph/mcpToolHandlerHelpers.ts:276-278` — comment rewritten from "Wave 70 Phase B3: per-ID targeting deferred to a future wave that adds the storage support" to "ADR storage is project-level by design (see Wave 20 Decision 4). Per-ID targeting is not supported and was never wired through. If a consumer needs per-ID retrieval, file a focused follow-up with the use case."
- `src/main/codebaseGraph/mcpToolHandlerSchemaContract.test.ts` — **new file**. Orchestrator-authored acceptance test (per boundary-phase rule). Asserts (1) `manage_adr.inputSchema.properties` keys are exactly `['content', 'mode', 'project', 'sections']` and (2) `properties` does NOT have an `id` key. Failed against pre-fix code; passes against post-fix code. Implementer was forbidden from modifying it.

**Why:** Schema/handler drift is silently harmful — agents pass params the handler ignores, get unexpected results, debug confusion. The "deferred to a future wave" framing was authoritative-sounding intent without commitment; no consumer materialized in the intervening waves. Decision 4 picked schema honesty over speculative per-ID implementation. Door reopens via a focused follow-up if a real consumer surfaces.

**Decision tier:** Industry standard (YAGNI + honest contract surface).

## What didn't ship

Per the wave plan's "Out of scope" section, nothing was de-scoped during execution. Wave 20 = exactly the 5 items in the source FU, no more no less.

## Verification

### Gates (run at wave wrap)

- `npm run test:codebasegraph` — **712 tests pass**, 3 skipped (includes Phase A's prefix-collision regression test + Phase C's schema-contract acceptance test).
- `npm run test:main` — **6573 pass / 1 fail / 5 skipped**. The 1 failure is `channelCatalog missing` (`channelCatalog.test.ts`), a pre-existing issue filed independently today at `roadmap/follow-ups/2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md`. Confirmed unrelated to Wave 20's surface (channelCatalog is IPC-layer; Wave 20 touched only codebaseGraph + a renderer-side comment).
- `npm run lint` — **0 errors, 4 pre-existing warnings** (3 in `FileViewer`/`HtmlPreview`, 1 in `delegationCoach/patterns.test.ts` `detect-unsafe-regex`). None new from Wave 20.
- `npx tsc --noEmit` — **clean**.

### Phase-level observation

- **Phase A** — Live `trace_call_path` over a real graph with prefix-related symbols NOT triggered in this session (no live IDE available during wrap). Unit-boundary verification (regression test on synthetic graph) confirms SQL correctness; live verification remains for next interactive session if Cole wants to observe.
- **Phase B** — Live IDE PageRank invocation NOT triggered in this session. Unit-boundary verification confirms Set+eviction semantics; no behavioral change observable in steady state, only memory profile.
- **Phase C** — MCP tool invocation NOT triggered in this session (would require running IDE + agent calling `manage_adr` with `id` param to see schema-validation rejection). The acceptance test is the contract surface; both assertions pass post-fix.

Per the wave plan: tests passing at the unit boundary is necessary but not sufficient. The three runtime observations above are deferred to the next live-IDE session — none are gates blocking ship, all are confirmation work.

## Decisions ratified

All 6 decisions in `wave-20-decisions.md` shipped as locked:

1. BFS cycle detector → per-row JSON1 visited set (industry standard).
2. JSON array path schema → `json_array(start) + json_insert($[#]) + NOT EXISTS json_each`.
3. PageRank cache eviction → FIFO at N=20.
4. `manage_adr` `id` parameter → **Option B** (remove from schema; document project-level-only). Cole's call, ratified 2026-05-26.
5. BFS invariant doc → both at SQL site (comment block, 8-9 lines) AND project-level (created `.claude/vendor-gotchas/better-sqlite3.md` since `codebaseGraph/CLAUDE.md` didn't have a Gotchas section dedicated to this pattern).
6. Regression test → `cypherEngineRegression.test.ts` new describe block with `seedPrefixCollision` fixture.

## Surprises / mid-wave discoveries

- **Phase A: `cypherEngineVarpath.ts` had an outer-query dependency on the string path format.** The path-column shape change from `>`-delimited string to JSON array string forced an in-scope fix to `buildVarpathSqlTemplate()`'s outer query — `json_extract(r2.path, '$[0]')` replaced `SUBSTR`/`INSTR` for start-node recovery. The wave plan didn't call this out explicitly; the implementer correctly identified it as a direct consequence of the transformation and fixed in-scope rather than punting to a follow-up. Good judgment.
- **Phase C: implementer surfaced a false-alarm Tier-3.** The implementer flagged `src/main/codebaseGraph/CLAUDE.md`'s `manageAdr(action, id?)` row as stale doc. Orchestrator verified — that row describes the internal `GraphControllerLike.manageAdr` interface (separate surface from the MCP tool we fixed), and the interface signature DOES still take `id?` per `graphControllerSupport.ts:48`. The CLAUDE.md doc is accurate to that interface. Whether `GraphControllerLike.manageAdr`'s `id?` is actually consumed by its implementation is a deeper orphan question — filed as `2026-05-26-graphcontrollerlike-manageadr-id-orphan-check.md`.

## Lessons (vendor + pattern)

- **SQLite JSON1 is the cycle-detection pattern for recursive CTEs.** Per-row `json_array` + `json_insert($[#])` + `json_each` membership check. Documented at `.claude/vendor-gotchas/better-sqlite3.md`. Will surface as preflight context for any future wave touching graph SQL via the global rules' `@import` mechanism.
- **`json_group_array` is prohibited in recursive-select.** Caught during planning research; would have been a footgun if we'd tried it. The scalar `json_insert($[#])` pattern is the workaround.
- **`$[#]` array-append jsonpath is SQLite 3.31.0+ (2020).** Well within `better-sqlite3@12.8.0` ABI range; no compatibility risk.
- **MCP schema honesty matters.** A param advertised-but-ignored is worse than absent — agents read schemas as contracts. Phase C demonstrated the pattern: catch the drift at schema-shape level, not at "the handler doesn't crash."

## Operational notes for the next session

1. **Tier-1 cleanup complete.** Next candidate per the meta extraction plan:
   - **Wave 21 — Tier-2 improvements** (`roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-2-improvements.md`): IMPLEMENTS edges via `class_heritage` + testDetectPass incrementality. ~2-3 dev days. No prereqs.
   - **Wave 22 — Standalone MCP extraction** (`roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md`): hard-blocked on Wave 87 chat orchestration overhaul completion. ~3-5 dev days when Wave 87 lands.
2. **Open Tier-3 surfaced this wave:** `2026-05-26-graphcontrollerlike-manageadr-id-orphan-check.md` — is `GraphControllerLike.manageAdr(action, id?)`'s `id?` parameter actually consumed downstream, or is it a parallel orphan to the one we just removed from the MCP schema? Likely 30-min investigation; LOW priority.
3. **Pre-existing test failure unrelated to Wave 20:** `channelCatalog.test.ts` fails on `test:main`. Filed at `roadmap/follow-ups/2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md` earlier today. Not a Wave 20 regression — confirmed via diff inspection.
4. **No worktree used.** Wave 20 was small enough (5 files touched + 2 new files) to run on master directly. The standing rule (`memory/worktree-merge-and-close-discipline.md`) applies when worktrees ARE used — it doesn't mandate them.
5. **No version bump.** Per wave plan: this is a maintenance wave; entry in CHANGELOG `[Unreleased]` rather than a separate patch tag. Folds into next minor or patch on the natural cadence.

## Files the next agent should read first

1. `roadmap/HANDOFF.md` — flipped to reflect Wave 20 SHIPPED.
2. `roadmap/wave-20-ouroboros-graph-tier-1-cleanup/wave-20-decisions.md` — 6 ratified decisions.
3. `roadmap/follow-ups/2026-05-26-ouroboros-graph-tier-2-improvements.md` — next candidate.
4. `roadmap/follow-ups/2026-05-26-ouroboros-graph-standalone-mcp-extraction.md` — Wave 22, blocked.
5. `.claude/vendor-gotchas/better-sqlite3.md` — pattern reference for future graph-SQL waves.
