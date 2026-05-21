---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 1
---

# Wave 1 — Architecture Decision Record

> Scaffold. Phase 0 fills each decision using the `Context / Pick / Rationale / Consequences` shape. Decisions 1–6 flow from the canon + the reconciliation doc's resolved upstream decisions; Decision 7 (Settings-toggle access) was locked by Cole. The waveplan (`waveplan-1.md` → "Locked decisions") carries the one-line summaries.

## Decision 1: Additive third shell behind a default-off flag

**Pick:** New `layout.canonWorkbench` config key (default false) drives a third `InnerApp` branch alongside the chat-only and IDE shells; existing shells untouched; cutover is Wave 7.

**Rationale:**

**Consequences:**

## Decision 2: Static mock data only (no live wiring)

**Pick:** A single `workbenchMockData.ts` feeds every region; no hooks, xterm, or permissions this wave.

**Rationale:**

**Consequences:**

## Decision 3: Dual rail mode is the rendered default

**Pick:** Build both dual (ProjectRail+InnerRail) and UnifiedRail; render dual (canon default).

**Rationale:**

**Consequences:**

## Decision 4: AgentGlobe renders `running` + `idle` statically; `awaiting`/`errored` deferred

**Pick:** State-prop component; implement running (default mock) + idle; defer awaiting/errored to Wave 3.

**Rationale:**

**Consequences:**

## Decision 5: File structure exactly per canon §17

**Pick:** `src/renderer/components/Workbench/` tree as specified in canon §17.

**Rationale:**

**Consequences:**

## Decision 6: Static tinted-well terminal frame (no xterm)

**Pick:** `TerminalShell` = 30px tab bar + styled tinted-well container with mock lines; xterm is Wave 2.

**Rationale:**

**Consequences:**

## Decision 7: Settings → Appearance toggle for the shell — LOCKED (Cole, 2026-05-21)

**Context:** Settings is not a dedicated overhaul wave; the canon reuses the existing Settings system (the §06 title-bar cog opens it). Cole reviews every wave's progress and wants an easy way to switch into the experimental shell.

**Pick:** Add a toggle to the **existing** `Settings/` Appearance section that writes `layout.canonWorkbench`. `useCanonWorkbenchFlag` reads the key. No query param, no Settings redesign.

**Rationale:** Lowest-friction access for hands-on review across the multi-wave build; reuses the existing Appearance controls (theme/material/glass-opacity already live there); satisfies the frontend-wiring check (the flag has a real UI control).

**Consequences:** An unfinished surface is reachable from user-facing Settings during the overhaul — acceptable because it's default-off and clearly experimental. The toggle stays through cutover (Wave 7), at which point the old-shell option is removed.
