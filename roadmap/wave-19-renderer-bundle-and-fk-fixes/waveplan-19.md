---
status: SHIPPED-PENDING-SMOKE
created: 2026-05-26
updated: 2026-05-26
type: bug-fix-sweep
predecessor: wave-18-multi-window-perf
severity: HIGH
---

# Wave 19 — Renderer Bundle Lazy-Load + FK Constraint Fix

## Status

SHIPPED-PENDING-SMOKE — see `wave-19-result.md` for full wrap. Architect plan + ADR finalized; both fixes implemented + scoped gates green. Diagnostics already complete in `roadmap/bugs/`:
- `2026-05-26-single-window-renderer-bundle-19s.md`
- `2026-05-26-fk-constraint-failures-on-cold-index.md`

Cole reviewed Wave 18's post-merge trace (2026-05-26 00:18-00:20), confirmed Wave 18 fixes are firing as designed, and surfaced 2 outstanding issues. Both have clear diagnostics with code-cited root causes. This wave addresses both.

## What this wave fixes

### Finding A — Renderer bundle 19s on cold-cache single-window load

**The Wave 18 1C diagnostic OVERGENERALIZED multi-window as the cause.** Single-window is now confirmed at 26s `first-render` (window-ready=7048ms → renderer-bundle-loaded=26097ms). The 19s gap is independent of window count.

**Root cause** (per `2026-05-26-single-window-renderer-bundle-19s.md`):
- 24.7 MB Vite pre-bundle in `node_modules/.vite/deps/` (549 files)
- Two largest chunks are Monaco: 5.7 MB + 2.2 MB = ~7.9 MB Monaco
- pdfjs adds ~796 KB
- All in the EAGER static import graph with no `React.lazy` boundary
- `src/renderer/components/FileViewer/ContentRouter.tsx:15,18` static-imports `MonacoEditorHost` + `MonacoDiffEditor`
- `src/renderer/components/FileViewer/FileViewer.tsx:13` static-imports `PdfViewer` (which transitively imports `* as pdfjsLib from 'pdfjs-dist'`)
- `src/renderer/components/FileViewer/index.ts:35-44` barrel re-exports Monaco symbols, so any consumer importing from the barrel pulls Monaco eagerly

**Wave 18 W2 (`partition: 'persist:shared'`) was correct for what it targeted** — multi-window HTTP cache sharing — but it never addressed the single-window cold-start cost. The cost was always there; the diagnostic just blamed the wrong layer.

### Finding B — FK constraint failures in indexer pipeline

**Pre-existing structural bug since schema v0.** Wave 18 W3 didn't introduce it; W3 just made it visible (Gamify cold-indexed 3 times per startup = 3 visible occurrences in the trace).

**Root cause** (per `2026-05-26-fk-constraint-failures-on-cold-index.md`):
- FK constraints `edges.source_id → nodes(id)` and `edges.target_id → nodes(id)` enforced via `foreign_keys = ON` (`graphDatabase.ts:70`)
- `definitionPass.processDefinitionChunk` inserts `DEFINES_METHOD` edges where `source_id` references a Class node
- If that Class node is in a DIFFERENT 500-file chunk that hasn't been processed yet, FK violates
- Recurs in `callResolutionPass` when a symbol was dropped by a rolled-back definition chunk → dangling `source_id` in CALLS edges
- "Isolating" catch in `runPass()` means the violation rolls back the chunk's transaction and the pipeline continues — but **data is silently dropped**

**The graph for any large project (Gamify, Agent IDE, Contractor App) is missing definitions + call edges** wherever this fires. Wave 19 fixes the structural mechanism so future cold indexes produce a complete graph.

## Locked decisions

See `wave-19-decisions.md` (sidecar — pending architect dispatch for Finding B's option pick).

**Upfront constraints:**
- Worktree isolation locked upfront. Touches hot paths (FileViewer barrel, indexer schema-adjacent code).
- Two fixes are on disjoint surfaces (renderer vs main process) — Phase 2 and Phase 3 can run in parallel.

## Phase plan

| # | Phase | Status | Shape | Notes |
|---|---|---|---|---|
| 0 | Wave plan + ADR stub | DONE | This document. | |
| 1 | Diagnose | DONE | 2 bug docs in `roadmap/bugs/` | No Phase 1 dispatch needed — diagnostics already complete from the post-Wave-18 trace analysis. |
| 2 | Finding A — Renderer bundle React.lazy refactor | PENDING | `sonnet-implementer` | Well-spec'd. See "Finding A — implementer brief" below. |
| 3a | Finding B — Architect dispatch for FK fix option pick | PENDING | `sonnet-architect` | Multi-option spectrum (defer-FK / two-pass / chunk-sort / INSERT-OR-IGNORE / etc.); ADR-worthy. |
| 3b | Finding B — Implementer applies architect plan | PENDING | `sonnet-implementer` | After 3a returns. |
| 4 | Smoke + wrap | PENDING | Orchestrator | Cole runs trace to verify (a) cold-cache `renderer-bundle-loaded` drops from 26s to ~12s, (b) no `[pipeline] pass=X threw, isolating: FOREIGN KEY` lines in cold index. Worktree merge-to-master + remove per standing directive. |

Phase 2 and Phase 3a can run in parallel (disjoint surfaces). Phase 3b waits for 3a. Phase 4 sequential.

## Finding A — implementer brief (for Phase 2)

**Spec is tight enough to dispatch directly without architect.**

Convert these to `React.lazy()` with Suspense fallbacks:
1. `MonacoEditorHost` and `MonacoDiffEditor` in `src/renderer/components/FileViewer/ContentRouter.tsx:15,18`
2. `PdfViewer` in `src/renderer/components/FileViewer/FileViewer.tsx:13`

Remove Monaco symbols from the barrel:
- `src/renderer/components/FileViewer/index.ts:35-44` — currently re-exports `MonacoEditor`, `MonacoEditorHost`, `MonacoDiffEditor` and related symbols. Drop these re-exports so consumers that import from `../FileViewer` don't pull Monaco eagerly. Direct consumers of those Monaco components import the modules directly (already work via React.lazy resolution).

Add Suspense fallbacks that match the existing loading-state aesthetic in the project (check `FileViewer.tsx` or nearby for the loading pattern; mirror it).

Verify the pattern against `src/renderer/components/Workbench/CLAUDE.md:190-191` — that subsystem already applied this exact hazard mitigation for the Workbench shell context. Mirror its approach.

**Files to touch:**
- `src/renderer/components/FileViewer/ContentRouter.tsx`
- `src/renderer/components/FileViewer/FileViewer.tsx`
- `src/renderer/components/FileViewer/index.ts`
- Possibly callers if they reference the dropped barrel exports — verify before editing

**Gate:** test:filetree + test:renderer (broad — covers all renderer changes). Expected `renderer-bundle-loaded` drop: 12-16s.

## Finding B — architect brief (for Phase 3a)

The diagnostic in `2026-05-26-fk-constraint-failures-on-cold-index.md` lays out the mechanism + several fix options. The architect should:

1. **Verify the diagnostic against current code** (Wave 18 lesson: diagnostic memos can be partially wrong; architect re-verifies).
2. **Evaluate the option spectrum** from the diagnostic:
   - Two-pass insertion: all nodes first across all chunks, then all edges. Pros: clean. Cons: doubles memory/iteration for large projects.
   - Chunk sort by parent-class membership: ensure classes come before their methods. Pros: minimal change. Cons: requires dependency analysis between chunks.
   - `INSERT OR IGNORE` + post-pass cleanup: skip violating rows, sweep at end. Pros: simple. Cons: silent data loss if cleanup fails.
   - Defer FK constraints during pipeline (`PRAGMA defer_foreign_keys`): if better-sqlite3 supports it. Pros: minimal change. Cons: depends on driver support.
   - Single-pass with batched insert ordering: process chunks in dependency order; require parent class chunks before method/edge chunks.

3. **Pick one option** with rationale (industry standard / emerging / experimental).
4. **Write the architect plan** to `roadmap/wave-19-renderer-bundle-and-fk-fixes/wave-19-architect-fk-fix.md` with the chosen option's integration shape, file map, and risks. Mirror the structure of `wave-18-architect-w3-indexer-offload.md`.

## Files the next agent should read first

The diagnostic bug docs are the authoritative source. Read both before dispatching:
- `roadmap/bugs/2026-05-26-single-window-renderer-bundle-19s.md`
- `roadmap/bugs/2026-05-26-fk-constraint-failures-on-cold-index.md`

Plus:
- `roadmap/HANDOFF.md` — overall orientation
- `~/.claude/rules/development-pipeline.md` — Lane B B1-B5 + cross-cutting rules
- `~/.claude/rules/agent-catalog.md` — dispatch routing

## Acceptance criteria

| Surface | Target |
|---|---|
| `renderer-bundle-loaded` on cold-cache single-window boot | <15s (was 26s; expected drop 12-16s) |
| `renderer-bundle-loaded` on warm-cache subsequent boots | <5s (W2's persist:shared cache fully populated) |
| `[pipeline] pass=definitions threw, isolating: FOREIGN KEY constraint failed` lines in cold index | 0 (was N per cold index) |
| `[pipeline] pass=calls threw, isolating: FOREIGN KEY constraint failed` | 0 |
| Graph node count for Gamify cold index | Stable across runs (was variable due to silent FK drops) |
| Cole's verdict on cold-boot UX | "noticeably faster" |

## Operational notes for the next session

1. **Wave 18's outstanding follow-ups** (filed during Wave 18 wrap) are NOT closed by this wave:
   - `roadmap/follow-ups/2026-05-26-approval-wait-double-fire-instrument.md` (LOW, W7 from Wave 18)
   - `meta/roadmap/follow-ups/2026-05-26-haiku-implementer-wrong-checkout-target.md` (MED, recurring catalog issue)

2. **Wave 18 W2 is now considered "correct for multi-window only."** The fix shipped + works for what it targeted. Don't revisit W2 in Wave 19; the renderer-bundle fix is independent and complements W2 (lazy-load reduces cold-cache cost; shared partition handles warm-cache multi-window).

3. **The pre-push hook regenerates `src/renderer/generated/changelog.ts`** via `node tools/build-changelog.js`. Wave 18's wrap session ran this manually post-merge; Wave 19's wrap should do the same OR ensure the codegen runs as part of pre-merge gates.

4. **Worktree creation per standing directive.** Cole's standing rule (`memory/worktree-merge-and-close-discipline.md`): every worktree-using wave merges to master + removes worktree before declaring done. Wave 18 honored this; Wave 19 should too.

5. **Catalog agent reliability:** previous waves saw `haiku-followup-auditor` and `haiku-implementer` write to MAIN checkout instead of worktree. Verify file location with `git status --short` in both locations after any haiku write that targets a specific path.

## Note to the implementer

Both findings have code-cited root causes. **Do not re-diagnose; the work is in implementing the fixes correctly.** The renderer bundle fix has a code-pattern precedent in `Workbench/`. The FK fix needs the architect's option pick before implementer dispatch.

If during implementation you discover the diagnostic was wrong (Wave 17/18 lesson — diagnostic memos can be partially wrong), surface to Cole; don't silently re-scope.
