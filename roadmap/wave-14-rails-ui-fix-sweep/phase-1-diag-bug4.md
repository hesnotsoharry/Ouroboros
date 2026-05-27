---
status: COMPLETE
created: 2026-05-27
wave: 14
phase: 1b
---

# Phase 1b Diagnostic — Bug #4 (compact/unified rail non-functional)

## Affected modes

**Unified only** — compact mode does NOT share the defects. Evidence:

- `Workbench.tsx:119–125`: the `isUnified` branch mounts `<UnifiedRail>` and the dual branch mounts `<ProjectRail>` + `<InnerRail>`. Both breakpoints share the same binary: unified path (forceUnified OR breakpoint=unified) vs dual path (breakpoint=full OR compact).
- `InnerRail.tsx`: compact and full modes both render the same `InnerRail` component. The `FilesSection` at line 274 calls `<WorkbenchFileTree rootPath={projectRoot} />` directly — no mock involved. InnerRail uses real data at all breakpoints, including compact.
- The only `MOCK_FILE_TREE` consumer under `Workbench/` is `UnifiedRail.parts.tsx:271` inside `AccordionBody`.

---

## Defect 1: Placeholder file trees

### MOCK_FILE_TREE consumers

- `src/renderer/components/Workbench/Rails/UnifiedRail.parts.tsx:271` — `AccordionBody` renders `MOCK_FILE_TREE.slice(0, 10).map(...)` as the "Files" section inside each expanded project accordion.
- Import at line 9: `import { MOCK_FILE_TREE, type MockProject, type MockSession } from '../workbenchMockData';`

### Full-mode real-data reference

- Hook: `useWorkbenchFileTree`, located at `src/renderer/components/Workbench/Rails/useWorkbenchFileTree.ts`
- Wrapper component: `WorkbenchFileTree`, at `src/renderer/components/Workbench/Rails/WorkbenchFileTree.tsx:50`
- Used in: `src/renderer/components/Workbench/Rails/InnerRail.tsx:284` — `<WorkbenchFileTree rootPath={projectRoot} onSelectFile={onSelectFile} />` inside `FilesSection`.

`WorkbenchFileTree` takes a `rootPath: string` prop and calls `useWorkbenchFileTree(rootPath)` which uses `window.electronAPI.files.readDir` with lazy directory expansion via `toggleDir`.

### Proposed fix

In `UnifiedRail.parts.tsx`, replace the `MOCK_FILE_TREE` render block in `AccordionBody` with a call to `<WorkbenchFileTree rootPath={project.id} />`. The `project.id` field is already set to `p.path` (the full project path) in `UnifiedRail.tsx:31` via `adaptProject`. `AccordionBody` currently receives `project: MockProject` — `project.id` is the path string. `WorkbenchFileTree` needs `rootPath: string`, which maps directly. Remove the `MOCK_FILE_TREE` import from `UnifiedRail.parts.tsx` entirely.

---

## Defect 2: Collapse non-functional

### Current state

Handler **wired but fires a no-op** — the toggle handler exists on the DOM element, but the state owner is absent. Specifically:

- `UnifiedRail.parts.tsx:123`: `AccordionHeader` renders `<div onClick={() => undefined} ...>`. The click handler is explicitly stubbed out to `() => undefined`.
- `UnifiedRail.tsx:90–97`: `ProjectAccordion` is rendered with `expanded={activeProject ? p.id === activeProject.id : false}`. The `expanded` value is derived from `useWorkbenchProjects()` active state — it is read-only from the accordion's perspective. There is no `onToggle` prop passed to `ProjectAccordion`, and `ProjectAccordionProps` (line 280) has no toggle callback defined.
- The accordion component chain is: `ProjectAccordion` renders `AccordionHeader` and conditionally `AccordionBody`. `AccordionHeader` receives `project`, `expanded`, `hasRunning` — no callback prop. So even if `AccordionHeader`'s `onClick` were connected, there is nothing to call up the tree.

The collapse state is also wrong-scoped: `expanded` is derived purely from which project is "active" in `useWorkbenchProjects`. A user click would need to (a) propagate through a missing callback chain, and (b) mutate local per-accordion toggle state that doesn't currently exist. Neither is implemented.

### Files implicated

- `src/renderer/components/Workbench/Rails/UnifiedRail.parts.tsx:111–147` — `AccordionHeader` has no `onToggle` prop; `onClick={() => undefined}` at line 123.
- `src/renderer/components/Workbench/Rails/UnifiedRail.parts.tsx:280–302` — `ProjectAccordionProps` has no toggle callback; `ProjectAccordion` has no local expanded state.
- `src/renderer/components/Workbench/Rails/UnifiedRail.tsx:88–97` — passes no toggle callback to `ProjectAccordion`.

No z-index / event-swallowing issue. The click reaches the handler; the handler does nothing.

### Proposed fix

Add a `useState<string | null>` in `UnifiedRail.tsx` to track which project id is manually expanded (defaulting to `activeProject?.id`). Pass an `onToggle: (id: string) => void` callback through `ProjectAccordion` → `AccordionHeader`. Wire `AccordionHeader`'s `onClick` to call `onToggle(project.id)`. Replace `expanded` derivation from active-project lookup with the local toggle state.

---

## Combined fix scope

Two edits in two files:

1. `UnifiedRail.parts.tsx` — (a) replace `MOCK_FILE_TREE` block in `AccordionBody` with `<WorkbenchFileTree rootPath={project.id} />`; (b) add `onToggle: (id: string) => void` to `AccordionHeaderProps` and `ProjectAccordionProps`; (c) wire `onClick` in `AccordionHeader` to call the prop; (d) remove `MOCK_FILE_TREE` import.
2. `UnifiedRail.tsx` — add `useState<string | null>` for expanded project id, initialize from `activeProject?.id`, pass `onToggle` down to `ProjectAccordion`.

Estimated LOC change: ~15–20 lines added/modified, ~5 removed (the mock render block). Both defects are fixed in a single phase with no new files required.

---

## Cross-contamination risk

LOW. `InnerRail.tsx` is not touched. The fix is entirely within `UnifiedRail.tsx` + `UnifiedRail.parts.tsx`. The only sharing between modes is `WorkbenchFileTree` (called by both after the fix) — that component is already tested and working in full/compact mode.

Required acceptance tests to prevent regression:

1. Full/compact rail: assert `data-testid="workbench-innerrail"` renders `data-testid="workbench-filetree"` (no mock filenames appear) — this test already exists in `WorkbenchFileTree.test.tsx:130`.
2. Unified rail — file tree: assert no MOCK_FILE_TREE names appear inside `data-testid="workbench-unifiedrail"` when a project root is set.
3. Unified rail — collapse toggle: assert clicking `AccordionHeader` for project B (when project A is active) toggles the expanded body on/off.

---

## ADR D5 lock recommendation

The diagnosis confirms the "replace `MOCK_FILE_TREE` + add `onToggle` callback" option from D5's stub — a contained two-file edit with no new state-management surface. D5 should be locked on this path: `useState<string | null>` in `UnifiedRail.tsx` for expanded id, `onToggle` prop thread through parts, `WorkbenchFileTree` in `AccordionBody`.

---

## Confidence

HIGH. Both defects are structurally visible in the code:

- `MOCK_FILE_TREE` at `UnifiedRail.parts.tsx:271` is not ambiguous — it's the only consumer, it's in `AccordionBody`, and the fix path (swap with `WorkbenchFileTree`) is already proven by `InnerRail.tsx`.
- `onClick={() => undefined}` at `UnifiedRail.parts.tsx:123` + the absent callback prop chain is not a timing/runtime question — it's a structural gap in the component API. No instrumentation needed; the code is its own evidence.

No runtime evidence was gathered (no dev server, no click-trace logs). However, both defects fall into the "cause is structurally visible" category per the Iron Law: the no-op click handler is literal; the mock import is literal. Instrumentation would be theater here.
