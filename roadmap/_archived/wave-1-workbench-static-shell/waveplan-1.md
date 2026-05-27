---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 1
slug: workbench-static-shell
---

# Wave 1 — Workbench Static Shell

## Status

DRAFT · target v2.22.0 (minor — net-new experimental shell behind a default-off flag) · drafted 2026-05-21.

## Context — why this wave exists

Wave 0 (`v2.21.0`) shipped the token grammar — canon-name aliases + the opt-in tinted well — that the workbench overhaul authors against. This wave builds the **shell itself**: the canon's six-region layout (`design-system/canon.html` §02, §06–10, §17) as a static composition with mock data, so the structure exists and is reviewable before any live data, real terminals, or permissions are wired in (those are Waves 2/3/5).

It is a **new architectural surface** — a third top-level shell composition that does not exist today. The renderer currently picks exactly one of two shells in `InnerApp` (`src/renderer/App.helpers.tsx`): `ChatOnlyShellWrapper` (when `isChatWindow || immersiveFlag || isMobileWeb`) or `InnerAppLayout` (the IDE shell). This wave adds a **third branch behind a new flag**, leaving both existing shells untouched. The "replace everything" end state (reconciliation Decision 1) is reached at Wave 7 via parity-then-cutover — NOT now; in Wave 1 the canon workbench is additive and default-off.

Confirmed against the codebase: the shell-selection branch lives in `InnerApp` (renderer `CLAUDE.md`: "Branches between `<ChatOnlyShellWrapper>` … and `<InnerAppLayout>`"); the existing flags use both a window-mode (`useChatWindowMode` → `?mode=chat`) and a config flag (`useImmersiveChatFlag` → `config.layout.immersiveChat`). The new shell mirrors that pattern. All providers (`AgentEventsProvider`, etc.) sit **above** the branch in `ConfiguredApp`, so adding a branch does not re-mount contexts. The Wave-0 canon tokens (`--accent`, `--ink-*`, `--glass-*`, `--r-*`, `--term-bg`/`--terminal-canvas-opacity`) are live in `tokens.css`. Renderer-only; no main/IPC/schema change beyond one config-schema flag.

## Goal

After Wave 1, flipping a new flag (`layout.canonWorkbench`, default off) renders a complete static canon workbench in the live IDE: a 40px title bar with the app mark, project/branch chips, a centre Agent-Globe pill, and Windows controls; a 56px project rail and 256px inner rail (Running list + Files tree); a centre column with upper/lower terminal frames split ~62/38, each a tab bar over a translucent tinted-well body of mock lines; a 348px agent sidebar with the five canon panels (NOW, Context, Files Touched, Latest Hunk, Hook Timeline) populated from mock data; and a 24px status bar — all on the glass stage, authored entirely against canon tokens with no hardcoded hex. With the flag off, both existing shells render exactly as before.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-1-workbench-static-shell/wave-1-decisions.md`.

1. **Additive third shell behind a default-off flag.** New config key `layout.canonWorkbench` (boolean, default `false`, experimental) drives a third branch in `InnerApp` (`App.helpers.tsx`), alongside the chat-only and IDE shells. Existing shells are untouched; the end-state cutover is Wave 7. RESOLVED (reconciliation Decision 1 + parity-then-cutover).
2. **Static mock data only.** A single `workbenchMockData.ts` module (seeded from `design-system/workbench-data.jsx`) feeds every region. NO `useAgentEvents`/hook wiring (Wave 3), NO xterm mount (Wave 2), NO permission flow (Wave 5). RESOLVED (scope).
3. **Dual rail mode is the rendered default.** Both `ProjectRail`+`InnerRail` (dual) and `UnifiedRail` are built, but the shell renders dual mode (canon cover: "Default rail mode: Dual"). The unified toggle is wired structurally but dual is shown. RESOLVED (canon).
4. **AgentGlobe renders the `running` + `idle` states statically; `awaiting`/`errored` deferred.** The component takes a state prop; Wave 1 implements the `running` (default mock) and `idle` visuals. The `awaiting`/`errored` variants land in Wave 3 when hooks drive state. RESOLVED (scope — no live state source yet).
5. **File structure exactly per canon §17** under `src/renderer/components/Workbench/`. RESOLVED (canon).
6. **Tinted-well terminal frame is static.** `TerminalShell` renders the 30px tab bar + the glass tinted-well body with mock terminal lines (using the Wave-0 `--term-bg`/`--terminal-canvas-opacity` treatment via a styled container) — NOT an xterm instance. RESOLVED (scope; xterm is Wave 2).
7. **Settings → Appearance toggle for the shell — LOCKED (Cole, 2026-05-21).** Settings is not a dedicated overhaul wave; the canon reuses the existing Settings system (the §06 title-bar cog opens it). So the shell switch lives in the **existing** `Settings/` Appearance section (alongside the theme picker / material / glass-opacity controls): a toggle that writes `layout.canonWorkbench`. `useCanonWorkbenchFlag` reads the config key; the toggle flips it. No query param needed.

## Scope

**In scope:**
- New config flag `layout.canonWorkbench` (default `false`) in the config schema; a `useCanonWorkbenchFlag` hook reading it.
- A **Settings → Appearance toggle** (in the existing `src/renderer/components/Settings/` Appearance section) that writes `layout.canonWorkbench` (Decision 7) — the user-facing access to the experimental shell.
- Third branch in `InnerApp` (`src/renderer/App.helpers.tsx`) selecting `<Workbench>` when the flag is on; existing branches untouched.
- `src/renderer/components/Workbench/` tree per canon §17: `Workbench.tsx` (six-region grid assembly + glass stage); `TitleBar/{TitleBar,TitleChip,AgentGlobe,WindowControls}.tsx`; `Rails/{ProjectRail,InnerRail,UnifiedRail,FileNode}.tsx`; `Terminals/{CenterPane,TerminalShell}.tsx`; `AgentSidebar/{AgentSidebar,NowBlock,ContextBlock,FilesTouched,LatestHunk,HookTimeline}.tsx`; `StatusBar.tsx`.
- `src/renderer/components/shared/Icon.tsx` — the canon icon primitive (Lucide-style set named in §17), shared across regions.
- `workbenchMockData.ts` — static mock sessions/files/tools/diff/hook-events seeded from `design-system/workbench-data.jsx`.
- All authored against canon tokens + Tailwind utilities; dimensions from canon §02 (40/56/256/348/24px; 62/38 terminal split).
- Unit/render tests: shell mounts behind the flag; each region renders its mock content; flag-off leaves existing shells unchanged.
- CLAUDE.md: a new `src/renderer/components/Workbench/CLAUDE.md` (region map + the flag + the static-mock constraint).

**Out of scope:**
- Live hook data / `useAgentEvents` wiring → Wave 3.
- Real xterm terminals in the frames → Wave 2.
- Permission prompt overlay / sidebar takeover → Wave 5.
- Responsive collapse (§16 breakpoints / unified-at-1180 / HUD) → Wave 6 (themes + responsive).
- AgentGlobe `awaiting`/`errored` states → Wave 3.
- Deleting `DispatchScreen`, the chat shell, or the IDE shell → Wave 7 cutover.
- Any redesign of the Settings system itself — Wave 1 only adds one toggle to the existing Appearance section; the canon reuses today's Settings.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-1-decisions.md`, Decisions 1–6 RESOLVED + Decision 7 per Cole's lock. Gate to 1. |
| 1 | Walking skeleton — shell frame + flag + Settings toggle + Icon + mock data | sonnet-implementer | **Thinnest end-to-end slice (walking skeleton), runnable before any region is fleshed out.** Add `layout.canonWorkbench` to the config schema (default false) + `useCanonWorkbenchFlag` reading it + a **Settings → Appearance toggle** (existing `Settings/` Appearance section) that writes it (Decision 7); add the third branch in `App.helpers.tsx` → `<Workbench>`. `Workbench.tsx` renders the six-region CSS-grid on the glass stage (canon §02 dims) with a **labeled placeholder** in each region (title bar / project rail / inner rail / centre / agent sidebar / status bar). Create `shared/Icon.tsx` (canon icon set) and `workbenchMockData.ts` (seeded from `workbench-data.jsx`) as the substrate the later phases consume. Deliverable: toggling the Settings switch flips the live IDE between the old shell and the new six-region frame end-to-end. One render smoke. NOT polished regions — those are Phases 2–6. |
| 2 | Title bar region | sonnet-implementer | Replace the title-bar placeholder: `TitleBar` (40px) + `TitleChip` (project + branch chips) + `AgentGlobe` (centre pill, `running` mock + `idle` variant per Decision 4) + `WindowControls` (Win min/max/close, 46×40, `#e81123` close-hover is a sanctioned platform color). Canon §06. Tokens only. |
| 3 | Rails region | sonnet-implementer | Replace the rail placeholders: `ProjectRail` (56px, project chips + active glow), `InnerRail` (256px: Running session list + Files tree via `FileNode`), `UnifiedRail` (272px accordion, built but dual is default per Decision 3). Canon §07. Mock projects/sessions/files. |
| 4 | Centre terminal frame | sonnet-implementer | Replace the centre placeholder: `CenterPane` + two `TerminalShell`s split ~62/38 (canon §02/§08). Each `TerminalShell` = 30px tab bar + a **static tinted-well body** (Wave-0 `--term-bg`/`--terminal-canvas-opacity` styling on a container with mock terminal lines) — NO xterm (Decision 6). Canon §08. |
| 5 | Agent sidebar region | sonnet-implementer | Replace the sidebar placeholder: `AgentSidebar` (348px) + the five panels `NowBlock`/`ContextBlock`/`FilesTouched`/`LatestHunk`/`HookTimeline`, all from `workbenchMockData`. Canon §09 (incl. adaptive-cards treatment B for the timeline). Mind ESLint max-lines:300/file + max-lines-per-function:40 — five panels are five files. |
| 6 | Status bar region | sonnet-implementer | Replace the status-bar placeholder: `StatusBar` (24px) with the canon §10 slots (branch+adds/dels, model, context, tests-passing pill / cost, clock, connection dot) from mock data. |
| 7 | Wave wrap | orchestrator | `test:layout` + `test:renderer`, full lint + typecheck + formatter, orchestrator diff review, `/review` mechanical gap-check (Check 6 if stryker), `Workbench/CLAUDE.md`, `wave-1-result.md`, `CHANGELOG [2.22.0]`, `/ui-smoke 1` (UI-bearing), local `git tag v2.22.0` (push per bulletin), HANDOFF flip, `/promote-vendor-lessons 1` (no-op), `/audit-followups wave-1-workbench-static-shell`. |

### Phase ordering

```
Phase 0 (ADR + Decision 7 lock)
   |
   v
Phase 1 (walking skeleton: frame + flag + Icon + mock data)  ← blocks all
   |
   ├──> Phase 2 (title bar)
   ├──> Phase 3 (rails)
   ├──> Phase 4 (centre terminals)
   ├──> Phase 5 (agent sidebar)
   └──> Phase 6 (status bar)
            |
            v
        Phase 7 (wrap)
```

- Phase 1 is the substrate (grid, flag, Icon, mock data) — blocks 2–6.
- Phases 2–6 each replace one region's placeholder and touch **disjoint files** (separate region folders) — fully parallelizable once Phase 1 lands. The only shared file is `Workbench.tsx` (each phase swaps its placeholder for the real region import); sequence the placeholder→real swaps, or have one implementer own the `Workbench.tsx` edits while regions are built in parallel.
- Phase 7 blocks on 1–6.

## Risks

| Risk | Mitigation |
|---|---|
| Adding the third `InnerApp` branch breaks the existing shell selection (chat / IDE) | Phase 1's flag defaults false → the new branch is unreachable unless explicitly enabled; a render test asserts flag-off still mounts the prior shell. The branch is additive (`if (canonWorkbench) return <Workbench/>` before the existing checks, or after — ordered so existing conditions are evaluated unchanged). |
| Glass tinted-well terminal frame is illegible / wrong over mica (static mock lines) | Reuses the Wave-0 treatment already validated by tokens; `/ui-smoke 1` visually checks the centre frame. Static mock lines use `--ink`/`--ink-3` tokens for contrast. |
| Hardcoded hex creeps in while matching the mockup's literal colors | Renderer no-hex rule + pre-commit hook; author against Wave-0 canon tokens (`--accent`, `--ink-*`, `--glass-*`). Sanctioned exceptions only: Win close `#e81123`, brand/logo. Each phase gate runs lint. |
| Component files blow ESLint max-lines:300 / max-lines-per-function:40 (the shell is large) | Canon §17 already decomposes into many small files; briefs mandate one component per file and helper extraction. Lint at each phase gate. |
| Mock-data shape diverges from what Wave 3's hooks will produce, forcing a rewrite | `workbenchMockData.ts` types are shaped to the canon §11 hook schemas (the reconciliation's mapping target) so Wave 3 swaps the source, not the shape. Documented in the mock module. |
| `Workbench.tsx` becomes a merge contention point across parallel region phases | One implementer owns `Workbench.tsx` placeholder→real swaps; region components are built in their own files and imported. Or sequence the swaps 2→3→4→5→6. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | `useCanonWorkbenchFlag` resolves flag/param correctly | Render: flag on → `Workbench` mounts with six region testids; flag off → existing shell mounts (no `Workbench`). | Trophy — the flag branch + frame render is the seam. `test:layout`. |
| 2 | AgentGlobe state prop → running/idle variant classes | Render: title bar shows app mark + chips + globe + window controls. | Trophy. `test:layout`. |
| 3 | FileNode depth indent; active-row token class | Render: project rail chips + inner rail Running list + Files tree render mock entries. | Trophy. `test:layout`. |
| 4 | TerminalShell tab/active-indicator render | Render: two terminal frames at ~62/38 with tinted-well bodies + mock lines. | Trophy. `test:layout`. |
| 5 | Each panel renders its mock slice (NOW/Context/Files/Hunk/Timeline) | Render: agent sidebar shows all five panels with mock data. | Trophy. `test:layout`. |
| 6 | StatusBar slot rendering from mock | Render: 24px status bar shows left + right slot groups. | Trophy. `test:layout`. |
| 7 | n/a | Scoped suites green, `/review` PASS/FLAG-addressed, `/ui-smoke 1` written | Wrap. |

## Acceptance criteria

- [ ] `layout.canonWorkbench` exists in the config schema (boolean, default `false`); `useCanonWorkbenchFlag` reads it.
- [ ] A Settings → Appearance toggle writes `layout.canonWorkbench` and is visible in the existing Settings UI.
- [ ] `App.helpers.tsx` has a third `InnerApp` branch rendering `<Workbench>` when the flag is on; with it off, `ChatOnlyShellWrapper`/`InnerAppLayout` selection is byte-unchanged (render test proves it).
- [ ] All canon §17 files exist under `src/renderer/components/Workbench/` (Workbench, TitleBar/{TitleBar,TitleChip,AgentGlobe,WindowControls}, Rails/{ProjectRail,InnerRail,UnifiedRail,FileNode}, Terminals/{CenterPane,TerminalShell}, AgentSidebar/{AgentSidebar,NowBlock,ContextBlock,FilesTouched,LatestHunk,HookTimeline}, StatusBar) + `shared/Icon.tsx` + `workbenchMockData.ts`.
- [ ] With the flag on, the shell renders all six regions at canon §02 dimensions (title bar 40px, project rail 56px, inner rail 256px, agent rail 348px, status bar 24px, terminals ~62/38).
- [ ] AgentGlobe renders `running` (default) and `idle` variants; `awaiting`/`errored` are not implemented (deferred).
- [ ] Terminal frames render a static tinted-well body (no xterm instance) using `--term-bg`/`--terminal-canvas-opacity`.
- [ ] Zero new hardcoded hex in `Workbench/**` except sanctioned platform/brand colors (lint clean).
- [ ] No `useAgentEvents`/hook import, no xterm import, no permission component in `Workbench/**`.
- [ ] `src/renderer/components/Workbench/CLAUDE.md` documents the region map, the flag, and the static-mock constraint.
- [ ] `wave-1-result.md`, `CHANGELOG [2.22.0]`, `/ui-smoke 1` report, local tag `v2.22.0`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR is the orchestrator's planning artifact — Cole reviews it; nothing renders. |
| 1 | The new workbench shell in a live IDE (Settings toggle on) | flip Settings → Appearance toggle → `config.layout.canonWorkbench` → `useCanonWorkbenchFlag` → `InnerApp` third branch (`App.helpers.tsx`) → `Workbench.tsx` → six-region CSS grid → labeled placeholder per region | Flipping the Settings toggle, the user sees the IDE switch to the new six-region workbench frame end-to-end — a top title strip, two stacked left rails, a centre area, a right sidebar, and a bottom strip, each a labeled glass placeholder on the glass stage; toggling back shows the prior shell unchanged. |
| 2 | The workbench title bar in a live IDE (flag on) | flag on → `Workbench` → `TitleBar` region → `TitleChip`/`AgentGlobe`/`WindowControls` render | The title bar shows the indigo app mark, project + branch chips, a centre "agent globe" pill reading a model · tool · duration (static `running`), and Windows minimize/maximize/close at the far right. |
| 3 | The left rails in the workbench (flag on) | flag on → `Workbench` → `ProjectRail` + `InnerRail` → `FileNode` rows | The 56px project rail shows project icon chips (active one glowing); the 256px inner rail shows a Running-sessions list and an indented Files tree of mock entries, active rows carrying the accent tint. |
| 4 | The centre terminal frame in the workbench (flag on) | flag on → `Workbench` → `CenterPane` → two `TerminalShell`s | The user sees an upper and lower terminal pane split ~62/38, each with a 30px tab bar and a translucent tinted-well body of mock terminal lines — glass wash faintly visible behind the text; no real terminal yet. |
| 5 | The agent sidebar in the workbench (flag on) | flag on → `Workbench` → `AgentSidebar` → the five panel components | The 348px right sidebar shows the NOW tool card, a Context token donut + counts, a Files-Touched list, a Latest-Hunk mock diff with accept/reject, and a Hook Timeline of mock events. |
| 6 | The status bar in the workbench (flag on) | flag on → `Workbench` → `StatusBar` → slot groups | The 24px bottom strip shows branch + adds/dels, model, context, and a tests-passing pill on the left; cost, a clock, and a connection dot on the right. |
| 7 | Internal — no observation point | n/a | Wrap phase — gates, brief, CHANGELOG, tag are build artifacts; the product surface is Phases 1–6, re-verified by `/ui-smoke 1`. |

### Data-shape probes

```bash
# Phase 1 — flag + branch + substrate
# Grep config schema for `canonWorkbench`; App.helpers.tsx for the third branch.
# Confirm Workbench/Workbench.tsx + shared/Icon.tsx + workbenchMockData.ts exist.
npx vitest run src/renderer/components/Workbench

# Phases 2–6 — region files exist + render tests
# Confirm each canon §17 file exists; grep Workbench/** for new bare `#` hex (expect only #e81123 / brand).
npx vitest run src/renderer/components/Workbench src/renderer/components/Layout

# Wrap
npm run lint && npm run typecheck
npx vitest run src/renderer/components/Workbench
```

## Files the next agent should read first

1. `roadmap/wave-1-workbench-static-shell/wave-1-decisions.md` — ADR; Decision 7 (flag access) + the static-only scope decisions.
2. `roadmap/discovery/workbench-overhaul-reconciliation.md` — the overhaul map; §06–10 component intents + the wave sequence.
3. `design-system/canon.html` — the spec: §02 (dimensions), §06–10 (each region's contract), §17 (the file tree this wave creates).
4. `design-system/workbench-hero.jsx` — the rendered hero shell (visual fidelity reference for every region).
5. `design-system/workbench-data.jsx` — mock data + the inline icon set (seed for `workbenchMockData.ts` + `Icon.tsx`).
6. `design-system/workbench-states.jsx` — state artboards (AgentGlobe running/idle, panel states).
7. `src/renderer/styles/tokens.css` — the Wave-0 canon alias block + tinted-well tokens to author against.
8. `src/renderer/App.helpers.tsx` — the `InnerApp` shell-selection branch to extend (third branch).
9. `src/renderer/CLAUDE.md` — the three-layer bootstrap + the existing shell-branch pattern (`isImmersive`).
10. The config schema file (`src/main/config*.ts` / `configSchema*`) — where `layout.canonWorkbench` is added.
11. The existing Settings Appearance section (`src/renderer/components/Settings/` — the appearance/theme controls) — where the shell toggle is added.

## Note to the implementer

The spirit of this wave is **build the canon shell as a static, reviewable layout — structure first, life later.** You are composing presentational React against the Wave-0 token grammar and the mockup; you are NOT wiring data. Resist three temptations: (a) don't reach for `useAgentEvents` or any hook data — every region reads from `workbenchMockData.ts` (live data is Wave 3); (b) don't mount a real xterm in the terminal frame — it's a static tinted-well container with mock lines (Wave 2 mounts xterm); (c) don't touch the existing IDE or chat shells, or `DispatchScreen` — this shell is additive behind a default-off flag, and deletions are Wave 7. Match the canon dimensions and use tokens, never hex (except the sanctioned Windows close `#e81123` and brand marks). Shape `workbenchMockData.ts` to the canon §11 hook schemas so Wave 3 swaps the source, not the shape.

Phase 1 is the walking skeleton: get the six-region frame rendering end-to-end behind the flag with placeholders BEFORE building any region. If the frame doesn't render end-to-end first, stop and fix that — the later phases just swap placeholders for real regions.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

A green gate with nothing Tier 3 means the orchestrator dispatches the next phase in the same turn — the turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** with Decisions 1–6 RESOLVED + Decision 7 per Cole's lock.
2. **Phase 1 — sonnet-implementer (walking skeleton).** Brief: config flag + `useCanonWorkbenchFlag` (+ `?shell=canon`), third `InnerApp` branch, `Workbench.tsx` six-region grid with placeholders, `shared/Icon.tsx`, `workbenchMockData.ts`. Gate: `test:layout` green (flag-on mounts Workbench, flag-off mounts prior shell), lint + typecheck clean, manual: frame renders end-to-end with flag on.
3. **Phases 2–6 — sonnet-implementer (one region each).** Parallelizable; sequence the `Workbench.tsx` placeholder→real swaps (one implementer owns that file) while region folders are built independently. Per-phase gate: `test:layout` green, lint (incl. no-hex) + typecheck clean, manual: that region renders its mock content. Each region phase is conceptually-routine (presentational); no phase-reviewer unless a region's diff surprises the orchestrator's diff glance.
4. **Phase 7 — wave wrap.** `npm run lint`, `npm run typecheck`, `npx vitest run src/renderer/components/Workbench src/renderer/components/Layout` (+ full suite in background). `/review` mechanical gap-check. Author `Workbench/CLAUDE.md` + `wave-1-result.md`. Append `CHANGELOG [2.22.0]`. Run `/ui-smoke 1`. Local tag `v2.22.0` (push per 2026-05-19 bulletin — pushing safe, merges wait). Update `HANDOFF.md`. `/promote-vendor-lessons 1` (no-op). `/audit-followups wave-1-workbench-static-shell`.
