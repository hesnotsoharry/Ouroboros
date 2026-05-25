---
name: canon-workbench-window-controls-shipped-as-stubs
status: RESOLVED
created: 2026-05-25
resolved: 2026-05-25
resolved-by: commit f5ea8763 (fix(workbench): wire window controls onClick to existing IPC)
priority: HIGH
discovered: wave-13-smoke-prep
---

# Canon workbench window controls (close/min/max) shipped as no-op stubs

## Symptom

In canon workbench shell, clicking the close (X), minimize, or maximize buttons in the title bar did nothing. There was no in-app way to close a workbench window (had to use Task Manager / quit the whole app).

## Root cause

`src/renderer/components/Workbench/TitleBar/WindowControls.tsx` shipped with a comment:

> IPC wiring is deferred until electronAPI.app.minimize/maximize/close is added to the IPC contract; buttons are no-op stubs this wave per spec.

The deferral assumption was wrong — the IPC was already wired end-to-end:
- Main handlers `window:minimize` / `window:maximize-toggle` / `window:close-self` in `src/main/miscRegistrarsHelpers.ts`
- Preload exposed them as `app.minimizeWindow` / `toggleMaximizeWindow` / `closeWindow`
- `electron.d.ts` had the types

The renderer just never called any of them.

## Fix

Added `onClick` prop to `WinBtn` + three handlers in `WindowControls` calling the existing `window.electronAPI.app.*Window()` methods.

Renderer-only — no IPC contract changes needed.

Committed as `f5ea8763` on `wave-11-plan`.

## Process lesson

When a "deferred until X is wired" comment claims a dependency, **verify the dependency before reproducing the deferral**. In this case the deferral persisted long after the dep was satisfied — possibly because the original phase that wrote WindowControls shipped before the IPC was added, and nobody revisited.

Action: when the orchestrator encounters a "deferred-until-X" stub, dispatch a quick `haiku-explorer` to check if X exists yet — if it does, fix the stub immediately rather than carrying it forward.

## Discovery context

Surfaced during Wave 13 smoke prep when Cole couldn't close two extra restored windows (driven by the separate `sessionsData` leak bug — `2026-05-25-window-close-leaks-session-entry.md`). That this had shipped to main since the UI redesign without anyone flagging it suggests:
- Manual smoke checklists don't currently test window chrome
- Users who restart the IDE rarely (Cole) won't notice broken close buttons until forced

Recommend adding window-controls verification to the manual smoke checklist template at `roadmap/docs/manual-smoke-gate-checklist.md`.
