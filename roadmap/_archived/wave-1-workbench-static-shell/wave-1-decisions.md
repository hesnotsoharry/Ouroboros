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

**Rationale:** Parity-then-cutover beats big-bang: building additively behind a flag means the overhaul ships in reviewable increments with the working shells as a fallback, and nothing user-facing breaks until the new shell is proven at parity.

**Consequences:** Three shells coexist until Wave 7. The flag + branch are throwaway scaffolding the cutover removes. Providers stay above the branch (per renderer `CLAUDE.md`) so toggling shells never re-mounts contexts.

## Decision 2: Static mock data only (no live wiring)

**Pick:** A single `workbenchMockData.ts` feeds every region; no hooks, xterm, or permissions this wave.

**Rationale:** Separating layout from data lets us nail the visual structure without entangling the hook-pipeline rework (Wave 3) or terminal mount (Wave 2). Shaping the mock types to the canon §11 hook schemas means Wave 3 swaps the data source, not the component contracts.

**Consequences:** The shell looks complete but is inert this wave. The mock module is the single seam Wave 3 replaces.

## Decision 3: Dual rail mode is the rendered default

**Pick:** Build both dual (ProjectRail+InnerRail) and UnifiedRail; render dual (canon default).

**Rationale:** The canon cover sets "Default rail mode: Dual." Building unified too (but not showing it) keeps the toggle structurally real without spending visual-polish budget on a non-default state this wave.

**Consequences:** UnifiedRail exists but is lightly exercised until a later wave wires the toggle interaction fully.

## Decision 4: AgentGlobe renders `running` + `idle` statically; `awaiting`/`errored` deferred

**Pick:** State-prop component; implement running (default mock) + idle; defer awaiting/errored to Wave 3.

**Rationale:** Running + idle cover the two static looks worth validating now; awaiting/errored only have meaning once live hook state drives them (Wave 3), so building their visuals now would be guessing against an unwired state machine.

**Consequences:** The globe's full state set lands in Wave 3 alongside the session state machine; Wave 1 proves the pill's layout and the running treatment.

## Decision 5: File structure exactly per canon §17

**Pick:** `src/renderer/components/Workbench/` tree as specified in canon §17.

**Rationale:** The canon already decomposed the shell into small files; following it verbatim keeps each component under the ESLint size caps and gives later waves (terminal mount, hook wiring) obvious seams to plug into.

**Consequences:** ~22 files created this wave. The structure is the contract later waves build against.

## Decision 6: Static tinted-well terminal frame (no xterm)

**Pick:** `TerminalShell` = 30px tab bar + styled tinted-well container with mock lines; xterm is Wave 2.

**Rationale:** The frame's job this wave is layout + the glass well treatment (now proven via the v2.21.1 DOM-renderer work); mounting real xterm is a separate integration concern (Wave 2) with its own fit/lifecycle complexity.

**Consequences:** The terminal area looks right but runs nothing until Wave 2 mounts xterm into the frame.

## Decision 7: Settings → Appearance toggle for the shell — LOCKED (Cole, 2026-05-21)

**Context:** Settings is not a dedicated overhaul wave; the canon reuses the existing Settings system (the §06 title-bar cog opens it). Cole reviews every wave's progress and wants an easy way to switch into the experimental shell.

**Pick:** Add a toggle to the **existing** `Settings/` Appearance section that writes `layout.canonWorkbench`. `useCanonWorkbenchFlag` reads the key. No query param, no Settings redesign.

**Rationale:** Lowest-friction access for hands-on review across the multi-wave build; reuses the existing Appearance controls (theme/material/glass-opacity already live there); satisfies the frontend-wiring check (the flag has a real UI control).

**Consequences:** An unfinished surface is reachable from user-facing Settings during the overhaul — acceptable because it's default-off and clearly experimental. The toggle stays through cutover (Wave 7), at which point the old-shell option is removed.
