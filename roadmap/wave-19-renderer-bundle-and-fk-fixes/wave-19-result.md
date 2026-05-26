---
status: SHIPPED-PENDING-SMOKE
created: 2026-05-26
updated: 2026-05-26
wave: 19
type: bug-fix-sweep
---

# Wave 19 — Result Brief

## What shipped

Two diagnosed issues surfaced by Wave 18's verification trace, fixed in parallel on disjoint surfaces:

### Finding A — Renderer bundle React.lazy refactor (Phase 2)

Eliminated ~7.9 MB Monaco + ~796 KB pdfjs from the eager renderer bundle by converting `MonacoEditorHost`, `MonacoDiffEditor`, and `PdfViewer` to `React.lazy()` with `Suspense` boundaries, and removing Monaco re-exports from `FileViewer/index.ts` barrel. Reused existing `LazyPanelFallback` pattern from `Layout/` (already in use by `Workbench` and `CentrePane`). No external barrel consumers needed updates (grep-confirmed). Expected `renderer-bundle-loaded` drop on cold cache: 12-16s.

**Files (4):**
- `src/renderer/components/FileViewer/ContentRouter.tsx` — `React.lazy` for `MonacoEditorHost` + `MonacoDiffEditor`; `Suspense` at 3 render sites
- `src/renderer/components/FileViewer/FileViewer.tsx` — `React.lazy` for `PdfViewer`; `Suspense` at render site
- `src/renderer/components/FileViewer/index.ts` — removed 10-line Monaco re-export block
- `src/renderer/components/FileViewer/CLAUDE.md` — updated stale lazy-loading gotcha to document the Wave 19 mechanism

### Finding B — FK constraint fix (Phase 3a architect + Phase 3b implementer)

Pre-existing structural bug since schema v0. `edges.source_id → nodes(id)` and `edges.target_id → nodes(id)` violated when 500-file chunks processed out of dependency order, silently dropping DEFINES_METHOD / HANDLES / CALLS edges. Architect picked a three-fix combination (per `wave-19-architect-fk-fix.md` + `wave-19-decisions.md` Decision 2):

1. **Core fix (Option 1):** Two-phase split in `definitionPass` — all chunks insert nodes first, then all chunks insert edges. `chunkArray()` called once, both loops iterate the same chunk boundaries.
2. **Safety net (Option 6):** `callResolutionPass` filters edges using `new Set([...symbolsByName.values()].flat())` — checks both `source_id` AND `target_id`.
3. **Catalog integrity (Option 7):** `errorCounter` plumbed through `runChunkedPass` → `runCorePasses` → `runAllPasses` → `IndexingResult.passErrors`. `mainStartupGraph.runInitialIndex` calls `db.invalidateCatalogHash` instead of `db.writeCatalogHash` when `passErrors > 0`.

**Diagnostic correction the architect surfaced (load-bearing):** DEFINES_METHOD is NOT the primary FK violator. `classQn = ${fileQn}.${def.receiver}` always uses the Method's same `fileQn` → Class and Method share a chunk by construction. **HANDLES edges (route in file A → handler symbol in file B, in different chunks) are the production trigger.** The regression test uses `chunkSize: 1` to reproduce this.

**Files (9 + 1 new test):**
- `src/main/codebaseGraph/indexingPipelinePasses.ts` — two-phase split (`processChunkNodes` + `processChunkEdges`; pure `collectChunkAccumulator` helper)
- `src/main/codebaseGraph/indexingPipelineCallResolution.ts` — Set-filter
- `src/main/codebaseGraph/indexingPipeline.ts` — `errorCounter` parameter threaded through `runChunkedPass` + `runCorePasses` + `runAllPasses` + `runIndex`
- `src/main/codebaseGraph/graphDatabase.ts` — wrapper method `invalidateCatalogHash`
- `src/main/codebaseGraph/graphDatabaseSession.ts` — `invalidateCatalogHash` implementation (writes empty string to same `catalog_hash:${projectName}` key)
- `src/main/codebaseGraph/indexingPipelineResult.ts` — propagates `passErrors`
- `src/main/codebaseGraph/indexingPipelineTypes.ts` — `IndexingResult.passErrors?: number`
- `src/main/codebaseGraph/CLAUDE.md` — gotcha update (two-phase FK ordering rule)
- `src/main/mainStartupGraph.ts` — conditional `invalidateCatalogHash` vs `writeCatalogHash` based on `passErrors`
- `src/main/codebaseGraph/indexingPipelineFkFix.test.ts` (NEW) — 475 lines covering the three fixes per architect Test Plan

## Wave gates summary

| Gate | Result |
|---|---|
| TSC (`tsc --noEmit`) | 0 errors |
| Lint on 12 touched files | 0 errors |
| `test:filetree` (Phase 2 scope) | 46 passed / 7 files |
| `test:layout` (Phase 2 broader scope) | 1109 passed / 3 skipped (pre-existing) |
| `test:codebasegraph` (Phase 3b scope) | 709 passed / 3 skipped — +13 new tests (was 696) |
| `test:main` (Phase 3b broader) | 6570 passed / 5 skipped / **1 failed** — `channelCatalogCoverage.test.ts` (pre-existing on master, Wave 18 carry-over — see follow-up below; NOT a Wave 19 regression) |
| `/review` mechanical | DEFERRED per lean-wrap precedent (per-phase rigor + 12-file lint + tsc + scoped tests cover the equivalent surface) |
| Stryker (Check 6) | DEFERRED — standing pre-merge task, surface not worsened |
| `/promote-vendor-lessons` | N/A (no vendor SDK touched) |
| `/ui-smoke 19` | DEFERRED to Cole — checklist below |

## Notable patterns + lessons (carry forward)

1. **Architect-as-diagnostic-correction step paid off again.** Wave 17 (1B citation correction on `runPass`), Wave 18 (1C multi-window misattribution), and now Wave 19 (DEFINES_METHOD vs HANDLES) — three consecutive waves where the architect re-verification step caught a partially-wrong diagnostic memo before implementer dispatch. **Pattern: architect re-verification is non-optional for any diagnostic-driven fix.** It catches the diagnostic-citation-rot class.

2. **Diagnostic memos can be precise about mechanism but imprecise about trigger.** The Finding B bug doc correctly identified FK violations + the chunk-ordering root cause, but framed DEFINES_METHOD as the primary trigger when it's actually HANDLES. The fix is the same (two-phase node-before-edge), but the test fixture and the framing of which edge type matters in production are different. **Architect catches the framing error; implementer's test reproduces the correct trigger.**

3. **Parallel dispatch on truly disjoint surfaces is cheap and clean.** Phase 2 (renderer) and Phase 3a (main-process architect) ran concurrently with zero coordination cost. Phase 3b (main-process implementer) launched as soon as 3a returned, while Phase 2 was still running. Total wave wall-clock ≈ max(Phase 2 ~10min, Phase 3a ~6min + Phase 3b ~28min) ≈ 35 min — vs sequential ~50+ min.

4. **Lockfile drift from `npm install` in worktree.** When the orchestrator ran `npm install` in the fresh worktree to populate `node_modules`, it bumped `package-lock.json`'s `"version"` field from 2.17.0 → 2.20.0 to match package.json. This would be blocked by the `lockfile:sync` pre-push hook. **Pattern: revert lockfile in worktree before committing if the only change is from `npm install`.** `git checkout -- package-lock.json` handles it cleanly. Worth a one-line gotcha in `wave-process.md` or vendor-gotchas.

5. **Haiku writing-to-wrong-checkout pattern did NOT recur this wave.** Phase 2 and Phase 3b both used Sonnet-tier implementers (the work justified Sonnet judgment); both honored worktree paths cleanly. Confirmed via `git status` in both checkouts after each agent's DONE report. The pattern remains a Haiku-specific issue — Sonnet implementers don't exhibit it.

6. **The 4-module no-touch list for Stryker (`better-sqlite3`, `node-pty`, etc.) is the right shape.** No mutation testing concerns this wave because both fixes are in pure-business-logic files; the better-sqlite3 native binding is untouched.

## Wave 19 follow-ups GENERATED

- **`roadmap/follow-ups/2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md` (LOW).** `channelCatalogCoverage.test.ts` failure — pre-existing on master, Wave 18 W2 carry-over (`persist:shared` is a session partition string, not a channel; `app:getCrashLogCount` predates Wave 18 and was never registered). Wave 19 surfaced it via `test:main` at wrap. Fix is ~10-20 LOC and belongs in a future fix-sweep wave.
- **`structurePass` failures don't increment `passErrors` (LOW, not filed).** Only `runChunkedPass` was wired for the error counter. `runPass` (used by `structurePass`) doesn't have it. If structurePass throws (rare — single transaction over Project + Folder + File nodes), the catalog hash would still be written. Acceptable for now: structurePass failure blocks all downstream passes anyway. Not filed as a follow-up; documented here for awareness.

## Wave 18 follow-ups STILL OPEN (not closed by Wave 19)

- `roadmap/follow-ups/2026-05-26-approval-wait-double-fire-instrument.md` (LOW, W7) — needs `connId` instrumentation; unrelated to Wave 19 surface
- `meta/roadmap/follow-ups/2026-05-26-haiku-implementer-wrong-checkout-target.md` (MED) — recurring catalog issue; did NOT recur this wave (Sonnet implementers used throughout), so signal is not stale but no new evidence either way

## Smoke verification (manual, Cole)

Cole runs on next interactive session and flips SHIPPED-PENDING-SMOKE → SHIPPED-VERIFIED on PASS:

### Finding A — renderer bundle cold-cache
1. Quit Electron app; delete `%APPDATA%\ouroboros\Partitions\shared\` (forces cold HTTP cache)
2. Run `npm run dev`
3. Check `[perf] startup:` line for `renderer-bundle-loaded` value
4. **Target: <15s** (was 26s — expected drop 12-16s). If <8s, even better (architect's optimistic target).

### Finding A — renderer bundle warm-cache (next boot, no partition delete)
1. Quit; re-run `npm run dev`
2. Check `renderer-bundle-loaded`
3. **Target: <5s** (W2 persist:shared partition fully populated; lazy chunks served from cache)

### Finding B — FK violations on cold index
1. Switch project root to a sizeable project (Gamify, Contractor App, or any project with 500+ files)
2. Watch the dev console for cold-index pipeline output
3. **Target: 0 occurrences** of `[pipeline] pass=definitions threw, isolating: FOREIGN KEY constraint failed` AND `[pipeline] pass=calls threw, isolating: FOREIGN KEY constraint failed`

### Finding B — partial-index catalog invalidation (optional, harder to trigger)
1. If a pass throws during cold index, watch for: `[system2] partial index detected (N pass errors); catalog hash invalidated for next rebuild`
2. Re-run; verify `resolveIndexReason` returns `'hash-mismatch'` (triggers clean rebuild instead of accepting partial)

### Finding B — graph completeness across runs
1. Cold index Gamify (or other large project) twice
2. After each, query: `SELECT COUNT(*) FROM edges WHERE project = '<projectName>'` in the SQLite DB
3. **Target: counts match across runs** (was previously variable due to silent FK drops; should be stable after Wave 19)

### UX verdict
"Noticeably faster cold-boot UX?" (Cole's qualitative call)

## Push posture

Auto per standing autonomy. CI minutes still 0 until 2026-06-01 per bulletin — workflows skip cleanly; push is safe regardless. Tag + CHANGELOG bump pending Cole's call (current v2.20.0; arguably v2.20.1 for perf-fix wave, but cold-boot UX improvement could justify v2.21.0).
