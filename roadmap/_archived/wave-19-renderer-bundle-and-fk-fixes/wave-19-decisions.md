---
status: COMPLETE
created: 2026-05-26
updated: 2026-05-26
wave: 19
---

# Wave 19 — Decisions (ADR)

## Decision 1: Finding A fix shape — React.lazy + barrel surgery

**Context:** `MonacoEditorHost`, `MonacoDiffEditor`, and `PdfViewer` are statically imported in `FileViewer/ContentRouter.tsx` and `FileViewer/FileViewer.tsx`, with Monaco re-exported from `FileViewer/index.ts`. ~7.9 MB Monaco + ~796 KB pdfjs lands in the eager bundle, causing 19s of V8 cold-parse on first window.

**Options considered:**
- *Industry standard:* `React.lazy()` + `Suspense` boundaries. Established React pattern for code-splitting heavy editors. `Workbench/CLAUDE.md:190-191` documents the codebase precedent.
- *Emerging best practice:* Module-federation / dynamic imports with explicit chunk hints. Overkill for Electron renderer.
- *Experimental:* Preact-style ESM resolution. N/A — locked to React + Vite + Electron stack.

**Pick:** Industry standard — `React.lazy()` + `Suspense`.

**Rationale:** Codebase already uses this pattern in `Workbench/`. Mirrors existing convention; lowest cognitive load for review. Expected impact (12-16s reduction) matches the heavy chunk's contribution.

**Consequences:**
- Direct consumers of `MonacoEditorHost` etc. must accept Suspense fallbacks (loading state visible briefly during first open).
- The `FileViewer/index.ts` barrel loses Monaco re-exports — confirmed no external consumers; only `FileViewer/` internal files used those exports.
- Fallback component: reused existing `Layout/LazyPanelFallback` (already the established pattern in `WorkbenchFileViewerModal.tsx` and `CentrePaneConnected.parts.tsx`).

## Decision 2: Finding B fix shape — two-phase node-before-edge + Set-filter safety net + catalog-hash invalidation

**Context:** `edges.source_id → nodes(id)` and `edges.target_id → nodes(id)` FK violations during `definitionPass` and `callResolutionPass` when 500-file chunks process out of dependency order. Pre-existing structural bug since schema v0. Wave 18 W3 made it visible (3× cold-index per startup) but didn't introduce it. Data is silently dropped — graph completeness degraded for any project spanning multiple chunks.

**Options considered (per architect plan `wave-19-architect-fk-fix.md`):**
- *Industry standard #1:* Two-phase node-before-edge split in `definitionPass` (Option 1). Canonical pattern for bulk graph loading with FK enforcement; cited Neo4j bulk import, TigerGraph loader, [SQLite FK docs](https://sqlite.org/foreignkeys.html).
- *Industry standard #2:* Pre-insert existence check in `callResolutionPass` (Option 6 — Set-filter using already-in-scope `symbolsByName`). Defensive programming at the write boundary.
- *Industry standard #3:* Hash invalidation on partial success (Option 7). "Don't commit a hash for a partial result" — universal principle for content-addressable stores.
- *Rejected — Option 2 (sorted single-pass):* Requires dependency analysis pre-chunking; fragile on parse-result completeness.
- *Rejected — Option 3 (INSERT OR IGNORE):* Silent data loss; conflicts with UNIQUE constraint deduplication semantics.
- *Rejected — Option 4 (`PRAGMA defer_foreign_keys`):* Deferral fires at COMMIT of CURRENT transaction, not across N chunk transactions. Architecturally wrong for this problem; verified via [SQLite PRAGMA docs](https://www.sqlite.org/pragma.html).
- *Rejected — Option 5 (single outer transaction):* Defeats chunking's event-loop yielding; ~3× peak memory.

**Pick:** Option 1 (core) + Option 6 (safety net) + Option 7 (catalog integrity) — combined fix.

**Rationale:** Option 1 addresses the structural root cause without touching FK enforcement. Option 6 is cheap (~5-10ms for 5K call sites) defense-in-depth against any future definition failure mode. Option 7 prevents the next session from accepting a partial index as complete. All three are industry-standard patterns; none introduce new dependencies or schema changes.

**Consequences:**
- `processDefinitionChunk` split into `processChunkNodes` + `processChunkEdges`; `definitionPass` runs two sequential loops over `chunkArray()` (called once, reused).
- Edge accumulation is re-iterated per chunk during phase 2 (~1ms per 500 files — acceptable, not cached).
- `callResolutionPass` filters edges using `new Set([...symbolsByName.values()].flat())` — checks BOTH `source_id` AND `target_id` per architect risk register #2.
- New `GraphDatabase.invalidateCatalogHash(projectName)` method writes empty string to `catalog_hash:${projectName}` key.
- `IndexingResult` gains optional `passErrors?: number`; `mainStartupGraph.runInitialIndex` conditionally invalidates vs writes the hash.
- `indexingPipelinePasses.ts` grew from 277 → 311 lines (still under 300 significant after `skipBlankLines+skipComments`). If a future change exceeds the cap, extract `collectChunkAccumulator` to a helper module.

**Diagnostic correction surfaced by architect:** The original diagnostic framed DEFINES_METHOD as the primary FK violator, but `classQn = ${fileQn}.${def.receiver}` always uses the Method's same file → DEFINES_METHOD cross-chunk fires only for rare cross-file class/method patterns. **The primary FK violator is HANDLES edges** (route in file A → handler symbol in file B, in a different chunk). The regression test uses `chunkSize: 1` with a route file + separate handler file to reproduce the HANDLES case, which is the dominant production trigger.

**Diagnostic claim closed:** Section 9 item 7 of the bug doc asked whether `triggerContextLayerRebuildAfterGraphReady` (line 100 of `mainStartupGraph.ts`) fires a third cold reindex — confirmed it does NOT. The trigger rebuilds context layers (CLAUDE.md enrichment), not the graph itself. "Run 3" in the three-runs analysis is likely a second window acquiring the Gamify root, not this trigger.

---

## Notes carried forward

- Wave 18 W3 was NOT the cause of the FK violation; the worker offload + queue serialization are correct and remain in place.
- `importPass` was audited and confirmed FK-safe (File nodes are committed by `structurePass` before importPass runs; Package nodes are created inline in the same chunk transaction).
- The CHUNK=500 constant was not re-evaluated. The fix works correctly for any chunk size ≥ 1.
- `runPass` (single non-chunked path, used by `structurePass`) does NOT receive the `errorCounter` parameter — only `runChunkedPass` does. structurePass failures would still write the catalog hash. Acceptable: structurePass is a single transaction over Project + Folder + File nodes; failure there blocks all subsequent passes regardless. If this gap matters in practice, file a follow-up.
