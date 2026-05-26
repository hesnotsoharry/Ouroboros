---
status: DRAFT
created: 2026-05-26
wave: 19
---

# Wave 19 — Decisions (ADR)

## Decision 1: Finding A fix shape — React.lazy + barrel surgery

**Context:** `MonacoEditorHost`, `MonacoDiffEditor`, and `PdfViewer` are statically imported in `FileViewer/ContentRouter.tsx` and `FileViewer/FileViewer.tsx`, with Monaco re-exported from `FileViewer/index.ts`. ~7.9 MB Monaco + ~796 KB pdfjs lands in the eager bundle, causing 19s of V8 cold-parse on first window.

**Options considered:**
- *Industry standard:* `React.lazy()` + `Suspense` boundaries. Established React pattern for code-splitting heavy editors. Workbench/CLAUDE.md:190-191 documents the codebase precedent.
- *Emerging best practice:* Module-federation / dynamic imports with explicit chunk hints. Overkill for Electron renderer.
- *Experimental:* Preact-style ESM resolution. N/A — locked to React + Vite + Electron stack.

**Pick:** Industry standard — `React.lazy()` + `Suspense`.

**Rationale:** Codebase already uses this pattern in `Workbench/`. Mirrors existing convention; lowest cognitive load for review. Expected impact (12-16s reduction) matches the heavy chunk's contribution.

**Consequences:**
- Direct consumers of `MonacoEditorHost` etc. must accept Suspense fallbacks (loading state visible briefly during first open).
- The `FileViewer/index.ts` barrel loses Monaco re-exports — any consumer importing from the barrel for those symbols needs to switch to direct imports.

## Decision 2: Finding B fix shape — pending architect dispatch (Phase 3a)

**Context:** `edges` table FK violations during `definitionPass` and `callResolutionPass` when 500-file chunks process out of dependency order. Pre-existing structural bug since schema v0.

**Options considered:** See `wave-19-architect-fk-fix.md` (to be authored by Phase 3a's `sonnet-architect`).

**Pick:** TBD — architect dispatch pending.

**Rationale + Consequences:** TBD per architect plan.

---

## Decision log entries to add post-wave

When the wave wraps:
- Decision 2 finalized with architect's pick + rationale
- Any in-flight pivots from the implementer phases
- Any test-strategy decisions (e.g., regression test for FK fix)
