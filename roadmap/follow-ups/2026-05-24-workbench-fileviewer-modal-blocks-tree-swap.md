---
name: workbench-fileviewer-modal-blocks-tree-swap
status: OPEN
priority: LOW
created: 2026-05-24
surfaced-by: Wave 11 manual smoke
wave-target: undecided (UX call needed first)
---

# Workbench file-viewer modal blocks file-tree swap

## Observation

After Wave 11 wired file-tree-click → `WorkbenchFileViewerModal`, the modal covers the inner-rail file tree. While the modal is open, clicking a different file row in the tree to swap content is impractical — the tree isn't reachable. The only working path to view a different file is:

1. Close modal (click-outside)
2. Click next file in tree → new modal opens

OR

1. Modal open → Ctrl-K → search → click result → modal swaps

## Why it matters

The Wave 11 acceptance test asserts "clicking a file opens the modal." That's met. But the natural reading-flow (browse tree → click → read → click next file → read next) requires close-then-click rather than tree-stays-visible. For deep code exploration this is friction.

It is NOT a Wave 11 wiring defect — `setOpenFilePath` correctly updates on every click, and the modal does swap if you can reach the next click. The constraint is purely visual: the modal is full-screen, so the tree is occluded.

## Options (UX call needed before implementing)

| Option | Shape | Tradeoff |
|---|---|---|
| **A — Narrower / side-docked modal** | Modal becomes a right-side panel (e.g. 60% width), tree stays visible on left | Departs from the Wave 8 P3 "modal" decision; closer to a split-pane editor |
| **B — Accept Ctrl-K as canonical swap path** | Document in `Workbench/CLAUDE.md` that "open file from tree, swap files via Ctrl-K" | Zero work; UX expectation set by docs only |
| **C — In-modal file navigation** | Add back/forward arrows + file-history dropdown in modal header | Modal becomes its own mini-IDE; more code; closer to VS Code's tab strip |
| **D — Make modal dismissible-on-tree-click** | Click on the file tree (even occluded) closes modal AND opens the new file | Requires the click to pierce the modal backdrop; UX surprise risk |

Cole's call. Lean is **B** (cheap; lets the modal stay a modal) UNLESS deep-browse-flow becomes a primary user gesture.

## Acceptance for resolution

- One of A/B/C/D chosen + documented in `roadmap/decisions/` if architectural (A/C/D) or in `Workbench/CLAUDE.md` if doc-only (B)
- Implementation, if any, lands in a future workbench wave or as a standalone fix
- Smoke checklist updated to reflect chosen path

## Related

- `roadmap/wave-11-file-tree-viewer-modal/wave-11-smoke-report.md` — origin
- `roadmap/wave-11-file-tree-viewer-modal/wave-11-decisions.md` — Wave 11 D1 (click → modal via prop-chain callback) and D2 (defer keyboard nav / expand-all / git badges) — neither addressed this swap-flow case
- Wave 8 P3 modal-vs-inline decision in `roadmap/wave-8-workbench-canon-parity-2/wave-8-decisions.md`
