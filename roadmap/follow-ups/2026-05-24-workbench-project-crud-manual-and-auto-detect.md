---
status: OPEN
severity: HIGH
created: 2026-05-24
updated: 2026-05-24
scheduled-for: wave-12-terminal-and-project-crud-chrome
---

# Workbench project CRUD — manual remove + auto-detect stale paths

## Surfaced

Wave 11 Phase 1 manual smoke (2026-05-24, Cole). Cole renamed two repos on disk
(`Contractor App` → `ContractorApp`, `Agent IDE` → `AgentIDE`); the IDE's
`projectRoots` + `config.recentProjects` still held the OLD paths. When he
opened those projects in the canon Workbench, the file tree was sparse/empty
(invalid `readDir` on non-existent paths). He had to **manually re-add the
corrected paths** AND noticed there's **no UI to remove the stale old ones**.

His verbatim:
> Additionally, there is no way to remove projects currently. I re-added my
> corrected repos, but I feel that should have been automatic, but also I
> can't remove the old ones from the outer rail or drop downs in title or
> inner

## Two distinct gaps

### Gap 1 — Auto-detect stale paths (Cole's "should have been automatic")

When a path stored in `projectRoots` or `recentProjects` no longer exists on
disk (rename, deletion, mount unavailable), the IDE should detect this on
launch (or on project-list render) and offer to remove the stale entry.

**Suggested approach:**
- Main-process IPC: `window.electronAPI.files.pathExists(path): Promise<boolean>`
  (likely already exists; check `src/main/ipc-handlers/files.ts`).
- Renderer: `useWorkbenchProjects` checks each path on derivation; mark
  stale entries with `exists: false` flag in the returned list.
- UI: stale chips/rows render dimmed + with a remove affordance; or a
  one-time launch prompt ("3 projects no longer exist on disk — remove?").

### Gap 2 — Manual remove (no UI ever calls `removeProjectRoot`)

`ProjectContext.removeProjectRoot(path)` is implemented at
`src/renderer/contexts/ProjectContext.tsx:124-128` but **no UI surface calls
it**. Even without auto-detect, the user needs a manual cleanup mechanism.

**Suggested approach:**
- Right-click context menu on outer-rail chips → "Remove from workbench"
- Right-click context menu on title-bar / inner-rail dropdown rows → same
- Or hover-X button (less discoverable; pattern-y but adds UI clutter)

## Origin

Pre-existing Wave 10 omission. Wave 10 scope explicitly covered:
- `setActiveProjectRoot` (switch active)
- `addProjectRoot` (via "+" button → directory picker)
- Display: chips + dropdowns

But NOT remove (and NOT stale-path detection). The functionality wasn't a
deferred item — it was just out of Wave 10's "project-switching wiring" scope.

## Why this should go in Wave 12

Wave 12's existing scope is "terminal CRUD + chrome" per `roadmap/HANDOFF.md`.
Project CRUD is the same shape of work (CRUD + chrome adjacent to the chip /
tab surfaces). Bundling project-CRUD into Wave 12 produces a "rail CRUD" wave
that covers all the remaining UI hygiene gaps Wave 10-11 left:
- Terminal tabs: spawn / delete / rename / + / split / maximize (Wave 12 scope)
- Project chips: remove / auto-detect-stale (added per this follow-up)
- Tab header text overlap (Wave 12 scope)

## NOT to do in Wave 11

Cole made the explicit call 2026-05-24: defer this to Wave 12. Wave 11 keeps
its narrow scope (file-tree click → modal + scroll/collapse). Manual remove +
auto-detect are out-of-scope for Wave 11 Phase 2/3.

## Related

- `src/renderer/contexts/ProjectContext.tsx:124-128` — existing `removeProjectRoot` API
- `src/renderer/components/Workbench/useWorkbenchProjects.ts` — derived list (where stale detection would attach)
- `src/renderer/components/Workbench/Rails/ProjectRail.tsx` — outer rail chips
- `src/renderer/components/Workbench/TitleBar/TitleBarProjectDropdown.tsx` — title bar dropdown
- `src/renderer/components/Workbench/Rails/InnerRailProjectDropdown.tsx` — inner rail dropdown
- `roadmap/HANDOFF.md` — Wave 12 row should be updated when this follow-up triggers planning
