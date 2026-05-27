---
status: OPEN
severity: MED
created: 2026-05-27
updated: 2026-05-27
scheduled-for: wave-14-rails-ui-fix-sweep
---

# Bug: Inner rail compact/unified mode — collapse non-functional + placeholder file trees

## Symptom

Cole, 2026-05-27:

> The inner rail changes format based on the size of the app window, that is fine. The problem is, it is non functional right now. I can't collapse and uncollapse projects, and the file trees are currently placeholder in that view.

When the app window is narrow enough to trigger the smaller inner-rail format, two things are broken:

1. **Collapse/expand of project entries does not work.** Clicking the chevron / row header has no effect, or the toggle UI is missing entirely.
2. **File trees rendered inside the rail are placeholder mock data**, not the project's actual files.

The wider format works (file tree click → modal, etc. — that's Wave 11's surface).

## Which breakpoint mode

Per `src/renderer/components/Workbench/useWorkbenchBreakpoint.ts` (per Workbench CLAUDE.md):
- `>1760px` → **full** layout (separate outer + inner rails)
- `1440–1760px` → **compact** layout (inner rail compressed but separate from outer)
- `<1440px` → **unified** layout (inner + outer merge into UnifiedRail)

Cole's symptom could be either compact or unified — both are below the full breakpoint and both have known mock-data leftovers per Workbench CLAUDE.md (the `UnifiedRail.parts` file-tree body explicitly still uses `MOCK_FILE_TREE`). Diagnostic will confirm which mode triggers.

## Code surface

- `src/renderer/components/Workbench/useWorkbenchBreakpoint.ts` — breakpoint detection
- `src/renderer/components/Workbench/Rails/InnerRail.tsx` — compact mode rendering
- `src/renderer/components/Workbench/Rails/UnifiedRail.tsx` — unified mode rendering (likely `.parts.tsx` for the file-tree subcomponent)
- `src/renderer/components/Workbench/workbenchMockData.rails.ts` — `MOCK_FILE_TREE` export (the placeholder source)
- Whatever provides real file-tree data in full mode (likely `useFileTree` hook or similar) — needs to be threaded through compact/unified rails

## Suspected root causes (to be confirmed)

### For the placeholder file trees

UnifiedRail / compact InnerRail was scaffolded with `MOCK_FILE_TREE` for layout development; the cutover to live data (`useFileTree` or equivalent) was never wired. Wave 11 fixed the full-mode file tree but the compact/unified-mode wiring was out of scope.

### For non-functional collapse

Either (a) the click handler was never wired (mock-only scaffold), or (b) the collapse state hook exists but the toggle button is rendering in a state that swallows clicks (z-index / overlay issue), or (c) the per-project `collapsed` state isn't being read/written from the right store.

## Reproduction

1. Launch the IDE.
2. Resize the window to <1760px wide (or <1440px for unified mode).
3. Observe inner rail: shows file trees that don't match the actual project files.
4. Try clicking a project's collapse chevron / row header — nothing happens.

## Fix direction

Two distinct fixes likely bundled in one phase:

1. **Wire real file-tree data into compact/unified rails.** Replace `MOCK_FILE_TREE` reference with the live `useFileTree(activeProjectRoot)` (or whichever hook full-mode uses). Project context is already available via `useProjects` / `ProjectContext`.
2. **Wire the collapse toggle.** If the state hook exists, fix the handler. If it doesn't, add it — `useState<Record<projectId, boolean>>` keyed by project root, persisted via existing config layer if Wave 12's per-project state pattern applies.

## Severity rationale

MED because the wider format (full mode) works and Cole can use it as a workaround by widening the window. But the compact/unified mode is broken across both file-tree display and collapse interaction, so any user on a smaller display effectively has no working inner rail.

## Related

- Wave 11 (file-tree-viewer-modal) — fixed full-mode file tree but didn't touch compact/unified
- Wave 12 ADR D-anything (rails CRUD chrome) — didn't touch compact/unified mode
- Workbench CLAUDE.md should be updated to remove the "Still static: UnifiedRail.parts file-tree body" note once this fix lands
