---
status: OPEN
created: 2026-05-22
severity: LOW
wave: 6
slug: workbench-forceunified-no-autoclear
---

# Workbench `forceUnified` does not auto-clear on window widen

## What

Wave 6 Phase 3 added a manual "collapse to unified rail" affordance: the `ProjectRail`/`InnerRail`
collapse-handle buttons set a `forceUnified` flag in `Workbench.tsx`, forcing the single `UnifiedRail`
regardless of window width. It clears **only** when the user clicks `UnifiedRail`'s expand button —
NOT when the window is widened back into full/compact territory.

## Symptom

A user on a wide display who manually collapses to the unified rail, then widens the window further,
stays in the unified layout until they explicitly click expand. Mildly surprising — the responsive
breakpoint says "full," but the manual override wins.

## Why deferred

Not a contract violation (the frozen acceptance test exercises width-driven behavior only; the manual
toggle is a bonus affordance). Both the Phase 3 implementer and the `sonnet-phase-reviewer` flagged it
as acceptable-with-follow-up rather than a bug. The "manual choice persists until manually undone" model
is defensible; the alternative (auto-clear when breakpoint leaves unified) is arguably nicer UX.

## Candidate fix

In `Workbench.tsx`, add an effect: when `breakpointMode !== 'unified'` and `forceUnified` is true,
clear `forceUnified` (so widening past 1440 restores dual rails). One `useEffect`, ~3 lines. Decide the
intended UX with Cole — or fold into Wave 7 (cutover), which revisits the shell anyway.

## Pointers

- `src/renderer/components/Workbench/Workbench.tsx` — `forceUnified` state + `handleExpandToDual`.
- `roadmap/wave-6-workbench-themes-responsive/waveplan-6.md` — Phase 3.
