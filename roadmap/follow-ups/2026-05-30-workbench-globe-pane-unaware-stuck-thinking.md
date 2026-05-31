---
status: RESOLVED
created: 2026-05-30
updated: 2026-05-30
resolved: 2026-05-30
priority: LOW
---

> **RESOLVED 2026-05-30 — commit `6cc20e45`** (pane-awareness, the primary bug).
> `useWorkbenchGlobeData` now derives the active pane id via
> `useActiveWorkbenchFrame → useWorkbenchTabsContextSafe → activeTab.id` and resolves
> the session whose `paneId` matches — the same binding the AgentSidebar uses. Falls
> back to `selectPrimarySession` (internal-excluded) only outside the provider or
> before a pane session exists. Confirmed live in production (globe is mounted under
> `WorkbenchTabsProvider` + `ActiveFrameProvider` in `Workbench.tsx`). Acceptance test
> updated to the pane-aware contract.
> **The thinking-vs-idle half is DEFERRED** (no idle signal on the wire) →
> `2026-05-30-workbench-globe-idle-heuristic.md`.

# AgentGlobe is pane-unaware and gets stuck on "thinking"

## Symptom (live-verified 2026-05-30)
The title-bar AgentGlobe shows "claude · thinking" and never changes — even when the pane is idle, and even when it should reflect a different session than the one shown. It does not track the session you are actually working in.

## Root cause
- `src/renderer/components/Workbench/useWorkbenchGlobeData.ts` → `selectPrimarySession` picks the most-recently-active **running** session across ALL sessions (pane-UNAWARE). With ~100 ambient/restored sessions in the pool it locks onto the perpetually-running outer IDE session (the IDE-runs-in-itself claude) or another ambient one — not the active pane's session.
- `deriveWorkbenchAgentState` maps `running` + no pending tool call → `'thinking'` (a best-effort heuristic; **the wire has no real thinking/idle signal**, per the Workbench CLAUDE.md gotcha). So a freshly-spawned, idle-at-prompt claude reads `'thinking'` forever.

## Fix shape
- Make the globe pane-aware (bind to the active pane's session like the sidebar does via `useActivePaneId` → `resolvePrimary(paneId)`), OR at minimum exclude internal/outer/ambient sessions from `selectPrimarySession` more aggressively.
- Separately, the thinking-vs-idle heuristic needs a real idle signal — e.g. treat "running with no tool activity for N seconds" as idle, or derive idle from the absence of a pending turn. Lower priority / cosmetic.

## Source
Surfaced during live verification of commit `d4fc7318`. Pre-existing — the globe selector was not touched by the tab-state refactor.
