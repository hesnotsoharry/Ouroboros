---
status: OPEN
severity: LOW
created: 2026-05-27
updated: 2026-05-27
revises: wave-12 ADR D2 (inline X)
scheduled-for: wave-14-rails-ui-fix-sweep
---

# Project remove: replace inline X with right-click context menu

## Surfaced

Cole, 2026-05-27 (post-Wave-100 UI walkthrough):

> Right now, projects on the outer rail have a tiny X on them to remove, it should be a right click drop down to remove.

## What Wave 12 shipped (the surface being revised)

Wave 12 (SHIPPED 2026-05-24, ADR D2) implemented project remove via an **inline X button**: always-visible on stale chips, hover-only on healthy chips, on three switcher surfaces:

- `src/renderer/components/Workbench/Rails/ProjectRail.tsx` — outer rail chips
- `src/renderer/components/Workbench/TitleBar/TitleBarProjectDropdown.tsx` — title-bar dropdown rows
- `src/renderer/components/Workbench/Rails/InnerRailProjectDropdown.tsx` — inner-rail dropdown rows

`useProjectCRUDActions` is the shared hook all three surfaces use.

## The revision

Cole prefers right-click → context menu ("Remove from workbench") on all three surfaces. The inline X is too small to discover reliably and visually noisy on the outer rail in particular. Context menu is the canonical desktop pattern for "actions on this item" and matches how IDEs (VS Code, JetBrains) handle workspace-item removal.

### Behavior

- Right-click on any project chip / dropdown row opens a context menu.
- Menu item: "Remove from workbench" (mirrors current X behavior — calls `useProjectCRUDActions.remove(path)`).
- Stale chips still need a visible affordance (the dimmed style alone won't tell the user they CAN remove it). Options:
  - (A) Keep the inline X **only on stale chips** (always-visible, hover-only on healthy goes away). Right-click works on both stale and healthy.
  - (B) Remove the inline X entirely; rely on the dimmed style + tooltip + right-click everywhere.
- Cole's preference between A/B is open — A is the safer/discoverable pick.

### Future menu items (not in scope but worth keeping the menu extensible)

Future natural additions: "Reveal in Explorer / Finder", "Copy path", "Rename project label" (display name distinct from path), "Open in new window".

## Related surfaces

- The ContextMenu primitive: check whether `src/renderer/components/` has one already (e.g. used in FileTree right-click). Reuse if available; build a thin one if not.
- The hover-X CSS in ProjectRail / dropdown rows needs to come out cleanly without breaking the stale-chip presentation.

## NOT in scope

- The `excludedPaths` mechanism in ProjectContext (Wave 12) stays — it's the correct way to prevent `config.recentProjects` from resurrecting removed entries.
- Auto-detect-stale logic stays.
- No change to the `removeProjectRoot` IPC.

## Why LOW severity

The current inline-X works (Wave 12 verified it). This is a UX refinement, not a defect. Bundles cleanly with the higher-severity rail bugs (sessions leak, top-terminal cwd, compact mode broken) in a single Wave 14 fix-sweep.
