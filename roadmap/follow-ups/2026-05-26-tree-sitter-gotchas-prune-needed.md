---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
priority: LOW
source: wave-21
---

# `.claude/vendor-gotchas/tree-sitter.md` exceeds 150-line cap — prune in next tree-sitter-touching wave

## What

After Wave 21 added the "Grammar node access — fields vs named-child node types" section (the `class_heritage` lesson), `.claude/vendor-gotchas/tree-sitter.md` is at **194 lines** — over the 150-line hard cap from the `/promote-vendor-lessons` doctrine.

## Why this isn't pruned this wave

The doctrine says "prune lowest-signal entries (preferred) or split by sub-domain." The most prunable content is the 0.25.0 → 0.26.x migration history (~30 lines), which is a year+ old at this point — most consumers are on 0.26.x already. But pruning that content at wave-end risks losing a load-bearing reference if some downstream consumer still references the migration path. Better evaluated when the next wave touches tree-sitter and can verify what's still consulted.

## Recommendation

In the next wave that touches `tree-sitter*` (parser config, grammar wasm bump, or anything calling `web-tree-sitter` APIs):

1. Audit which sections of `tree-sitter.md` are still referenced (grep for cross-references in the codebase + commits + result briefs).
2. Prune low-signal sections — most likely candidates:
   - "0.25.0 — breaking changes from 0.22 → 0.25+" (31 lines) — historical migration; can be condensed to a 3-line "Major version migrations have happened at 0.25 and 0.26; see git history for migration patterns."
   - "0.26.0 — WASM resolution change" (24 lines) — can be condensed similarly if no current consumer references the pre-0.26 pattern.
3. Target post-prune length: **≤ 120 lines** (the warning threshold).
4. If pruning is insufficient, split by sub-domain:
   - `tree-sitter.md` — API surface, grammar node access, current usage patterns.
   - `tree-sitter-migration.md` — version migration history.

## Priority

LOW. The 150-line cap is a context-efficiency heuristic, not a correctness gate. The file is readable as-is; the doctrine flags it but doesn't block.
