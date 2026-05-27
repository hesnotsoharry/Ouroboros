---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 3
slug: workbench-hook-pipeline-state-machine
---

# Wave 3 — Workbench Hook Pipeline + Live Agent State

## Status

DRAFT · target v2.24.0 (minor — net-new live capability inside the experimental, default-off canon shell) · drafted 2026-05-21.

## Context — why this wave exists

Wave 1 (`v2.22.0`) shipped the canon workbench as a static six-region shell behind the default-off
`layout.canonWorkbench` flag, every region fed from `workbenchMockData`. Wave 2 (`v2.23.0`) made the
centre terminal frames real (live xterm + draggable divider). The shell now looks right and the
terminals work, but **every non-terminal region is still static mock data** — the Agent Globe in the
title bar spins on a hardcoded `state="running"` (`TitleBar/AgentGlobe.tsx`, `TitleBar.tsx:196`), the
inner-rail sessions list shows invented sessions, and the status bar shows a fake branch/clock. This
wave makes the **shell react to real agent activity**.

This is **not a new architectural surface** — the agent-event pipeline (`useAgentEvents` +
`AgentEventsContext`, provider mounted at `App.tsx:41` above the Workbench branch) and the approval
pipeline already exist and already feed the legacy AgentMonitor. The work is **mapping the canon's
idealized hook model onto the real wire and swapping the data source for the regions that map cleanly**,
not building a pipeline from zero. The reconciliation doc's §11/§12 hook schema is **idealized fiction**
in three confirmed ways (recon §1–4, `recon-3.md`): (a) the live `AgentStatus` is a 4-value enum
(`idle|running|complete|error`, `AgentMonitor/types.ts:10`) with no `thinking/awaiting/errored/done/fresh`;
(b) `transcript_path` is absent from the envelope (`electron-agent-events.d.ts:56–77`); (c) the
`workbenchMockData` shapes are canon-idealized, NOT wire-matching — `MockSession.status` is
`'live'|'warn'|'idle'` against the live enum, so every region needs an adapter, not a source rebind.

Two scope boundaries were locked with Cole before drafting (see Locked decisions 5 + 6): the
AgentSidebar's **five panel bodies stay mock until Wave 4** (which re-lays them out and resolves the
Latest-Hunk diff source — reconciliation §09 + Open Q2); and **Claude auto-launch in the upper terminal
frame is decoupled and stays deferred** (the Globe is driven from ambient agent events, not a
workbench-bound session). Renderer-only; no main-process, IPC-contract, or config-schema change.

## Goal

After Wave 3, flipping `layout.canonWorkbench` on renders a workbench whose **Agent Globe, inner-rail
session list, agent-sidebar header, title-bar project chips, and status bar all reflect real runtime
state** instead of mock constants: the Globe shows the actual primary agent session (idle when nothing
is running; the live tool name + model + elapsed when a `claude` session is active anywhere), driven by
a workbench-local derived presentation state machine (`fresh/thinking/running/awaiting/errored/done`)
computed from `AgentSession` + `permissionEvents` + tool-call activity. The inner-rail sessions list
shows the real running sessions with correct status dots; the title bar shows the open project + branch;
the status bar shows the real git branch, token/cost, and a live clock. The five deep agent-sidebar
panels (NOW / Context / Files Touched / Latest Hunk / Hook Timeline) still render mock bodies (Wave 4).
The dead terminal-line + terminal-tab mock constants orphaned by Wave 2 are gone. With the flag off,
every existing shell renders byte-identically to before.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-3-workbench-hook-pipeline-state-machine/wave-3-decisions.md`.

1. **Workbench-local derived presentation state — do NOT mutate the canonical `AgentStatus`.** Introduce
   a workbench-only `WorkbenchAgentState` type (`fresh|thinking|running|awaiting|errored|done`) derived in
   the adapter from the live `AgentSession.status` (`idle|running|complete|error`) + `permissionEvents`
   (→ `awaiting`) + tool-call activity (→ `thinking` vs `running`). Rationale (best-practice spectrum in
   the ADR): the *industry-standard* "extend the domain enum" would ripple through the ~48-file
   `AgentMonitor/**` subsystem that depends on the 4-value `AgentStatus`; the *emerging best practice* —
   a presentation state machine separate from domain state — contains the blast radius to the workbench
   and matches the canon's richer display needs. RESOLVED — planner's call (technical seam).
2. **Do NOT plumb `transcript_path`.** It is absent from the wire envelope and its only consumer (Hook
   Timeline "view transcript") is a Wave 4 surface. Skip. RESOLVED.
3. **Single adapter hook is the source of truth for the swap.** A new `useWorkbenchAgentData` hook
   consumes `useAgentEventsContext()`, selects the primary session, and returns the canon-shaped data
   (presentation state, model, active tool/target, elapsed, context stats, mapped sessions list). The
   `workbenchMockData` interfaces become the adapter's **output contract** (kept as types, not data).
   RESOLVED — planner's call.
4. **Primary-session selection rule.** The Globe + sidebar header reflect the **most-recently-active
   running session** from `currentSessions`; when none is running, the Globe is `idle`/`fresh`. (No
   pty↔`AgentSession` binding exists yet — auto-launch deferred, D6 — so selection is activity-based,
   not terminal-frame-bound.) RESOLVED — planner's call.
5. **AgentSidebar: header live this wave; the five panel bodies stay mock → Wave 4.** Wave 3 swaps only
   the sidebar **header** (active-session label/sub). NOW / Context / Files Touched / Latest Hunk / Hook
   Timeline keep their mock constants until Wave 4 re-lays-them-out. Files Touched (no live backing) and
   Latest Hunk (no diff source) are explicitly Wave 4. RESOLVED — Cole locked.
6. **Claude auto-launch in the upper frame stays deferred / decoupled.** The Globe is driven from ambient
   agent events (any running `claude` session, including the always-on terminal one), NOT a
   workbench-bound session. Auto-launching `claude` in the upper frame + pty→`AgentSession` binding ships
   as a separate later slice. RESOLVED — Cole locked.
7. **Sweep the Wave-2 dead mocks as part of this wave.** Delete the orphaned terminal-line + terminal-tab
   constants and their barrel re-exports (recon §6; follow-up
   `2026-05-21-wave-2-dead-terminal-line-mocks.md`). RESOLVED.

## Scope

**In scope:**
- New `WorkbenchAgentState` derived type + a pure `deriveWorkbenchAgentState(session, ...)` function
  (`fresh|thinking|running|awaiting|errored|done` from `AgentSession.status` + `permissionEvents` +
  pending-tool-call presence).
- New `useWorkbenchAgentData` hook (under `Workbench/` or `src/renderer/hooks/`): consumes
  `useAgentEventsContext()`, selects the primary session (D4), returns canon-shaped
  `{ state, model, activeTool, target, elapsedSec, contextStats, sessions }`.
- Drive `Workbench/TitleBar/AgentGlobe.tsx` from the hook: replace the `MOCK_CONTEXT_STATS`/
  `MOCK_HOOK_EVENTS` reads (`:191–195`) + the hardcoded `state` prop (`TitleBar.tsx:196`); extend
  `GlobeState` to the six states (workbench-local).
- Swap `TitleBar` project chips + `Rails/ProjectRail` to the live project source
  (`ProjectContext`/`useWorkbenchProjects`); `Rails/InnerRail` sessions list to the adapter's mapped
  sessions (status-dot mapping); `AgentSidebar` **header** to the adapter's primary session.
- Swap `Workbench/StatusBar.tsx`: real git branch + adds/dels (un-stub from the existing git-status
  source — reconciliation §10), context stats (tokens/cost) from the adapter, a live clock.
- Delete the Wave-2 dead mock constants + barrel re-exports (recon §6, D7).
- Orchestrator-owned acceptance test for the state-derivation + adapter (Phase 1). Render/integration
  tests per the table; `test:layout`/`test:renderer` scope.
- Update `Workbench/CLAUDE.md` (Wave 3 line: Globe/regions live; presentation-state machine; Decisions 1–7).

**Out of scope:**
- The five deep AgentSidebar **panel bodies** (NOW/Context/Files Touched/Latest Hunk/Hook Timeline) going
  live, the 5-panel re-layout, Files-Touched derivation, Latest-Hunk diff source → **Wave 4** (D5).
- Auto-launching `claude` in the upper terminal frame; pty→`AgentSession` binding → later slice (D6).
- Mutating the canonical `AgentStatus` enum / touching `AgentMonitor/**` status consumers → not this wave (D1).
- Plumbing `transcript_path` → skipped (D2).
- Permission overlay / sidebar takeover re-skin → Wave 5 (the file-poll protocol + `ApprovalDialog` are untouched here).
- Theme treatment / responsive collapse of the regions → Wave 6.
- Cutover / deleting the legacy shells → Wave 7.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-3-decisions.md`, Decisions 1–7 (Decision 1 carries the best-practice spectrum per `~/.claude/rules/best-practice-spectrum.md`: extend-canonical-enum vs workbench-local presentation state). Gate to 1. |
| 1 | Presentation state machine + agent-data adapter + **Agent Globe live** (thinnest end-to-end live slice) | sonnet-implementer | **Conceptually-risky boundary phase — orchestrator authors the failing acceptance test first; subagent may not modify it.** Build the pure `deriveWorkbenchAgentState(session, permissionEvents, pendingToolCall)` (→ `fresh/thinking/running/awaiting/errored/done`) + `useWorkbenchAgentData` (consumes `useAgentEventsContext()`, primary-session selection per D4, returns canon-shaped data). Rewire `AgentGlobe.tsx` to read the hook instead of `MOCK_CONTEXT_STATS`/`MOCK_HOOK_EVENTS` (`:191–195`) and `TitleBar.tsx:196` to pass the derived state instead of `"running"`; extend `GlobeState` to the six states. Deliverable: with the flag on, the Globe is **idle when no agent runs and shows the real tool/model/elapsed when a `claude` session is active anywhere** — driven by live `AgentEventsContext`, end-to-end. Acceptance test: synthetic `AgentSession[]` + events → asserts each derived state + the canon-shaped stats. Gets a `sonnet-phase-reviewer` pass (state-derivation is where a wrong mental model hides — `thinking` heuristic, `awaiting` from `permissionEvents`, primary-session selection). |
| 2 | Shell-chrome live: project chips + git branch + clock | sonnet-implementer | Swap `TitleBar` project chips + `Rails/ProjectRail` from `MOCK_PROJECTS` to the live project source (`ProjectContext`/`useWorkbenchProjects` — confirm exact hook first, files-to-read #6). Un-stub `Workbench/StatusBar.tsx`'s git branch + adds/dels from the existing git-status source (reconciliation §10: the real `Layout/StatusBar.tsx` has `gitBranch` plumbed-but-dead — find that source); render a live clock for `MOCK_STATUS_BAR.clock`. Lowest-risk swaps (project + git are existing live sources, not the agent adapter). Render tests; no acceptance test needed (no novel contract). |
| 3 | Sessions list + sidebar header + status-bar context stats live | sonnet-implementer | `Rails/InnerRail` sessions list: map `currentSessions` → the `MockSession[]` shape via the adapter, with the status-dot mapping (`running`→live, `awaiting`(permission pending)→warn, `idle`/none→idle, `complete`/`error`→done/error). `AgentSidebar` **header** (active-session label/sub) from the adapter's primary session. `Workbench/StatusBar.tsx` context stats (tokens/cost) from the adapter. **The five panel bodies stay mock (D5) — scope guard.** Status-dot mapping is non-trivial (`'warn'` needs `permissionEvents`) → small orchestrator-owned mapping test. Gets a `sonnet-phase-reviewer` pass (the status-dot mapping is the conceptual-divergence risk). |
| 4 | Dead-mock sweep + wave wrap | orchestrator | Delete the Wave-2 dead constants + barrel re-exports (recon §6, D7) + any constant fully orphaned by Phases 1–3; confirm `tsc`/`eslint` dead-export clean. `test:layout` + `test:renderer`, full lint + typecheck + prettier, orchestrator diff review, `/review` mechanical gap-check (Check 6 if stryker), update `Workbench/CLAUDE.md`, `wave-3-result.md`, `CHANGELOG [2.24.0]`, `/ui-smoke 3` (UI-bearing; live smoke deferred per the Wave 0/1/2 posture — Cole not using the app until the remake is done — written + queued for next dev session), local `git tag v2.24.0` (push per bulletin; merges wait), HANDOFF flip, `/promote-vendor-lessons 3` (likely no-op — no vendor SDK), `/audit-followups wave-3-workbench-hook-pipeline-state-machine`. |

### Phase ordering

```
Phase 0 (ADR)
   |
   v
Phase 1 (state machine + adapter + Globe live)  ← builds the adapter the rest consume; blocks 2/3 on the adapter
   |
   +--> Phase 2 (project chips + branch + clock)   ┐ 2 and 3 are independent of each other
   |                                                 │ (different regions, different live sources);
   +--> Phase 3 (sessions list + sidebar header +    ┘ both depend only on Phase 1's adapter.
                  context stats)                        Run sequentially (same Workbench tree, small)
   |                                                     unless parallelized — no shared files between
   v                                                     2 and 3 beyond the adapter import.
Phase 4 (dead-mock sweep + wrap)
```

Phase 1 establishes `useWorkbenchAgentData` + `WorkbenchAgentState`; Phases 2 and 3 consume it (Phase 3
directly via the sessions/context output, Phase 2 only the project/git sources which are independent —
Phase 2 could technically precede Phase 1, but ordering it after keeps the adapter as the established
spine). Phases 2 and 3 touch disjoint region files, so they have no inter-dependency; default to
sequential (the wave is small and same-subtree), parallelize only if convenient. Phase 4's sweep runs
last so it can also catch anything Phases 1–3 orphaned.

## Risks

| Risk | Mitigation |
|---|---|
| Extending the canonical `AgentStatus` enum to add the canon states would ripple through ~48 `AgentMonitor/**` consumers and break compilation | D1: do NOT touch the canonical enum — derive a workbench-local `WorkbenchAgentState` in the adapter. The implementer is told explicitly (Note) not to edit `AgentMonitor/types.ts:10`. |
| `thinking` has no wire signal — deriving it from "running but no pending tool call" flickers as tool calls start/stop | Document `thinking`↔`running` as a best-effort heuristic in the ADR; derive from pending-`ToolCallEvent` presence; if flicker is visible in smoke, debounce the transition. Don't over-promise a state the wire can't cleanly support. |
| Multiple concurrent running sessions → ambiguous "primary" for the Globe/header | D4: explicit rule — most-recently-active running session; idle/fresh when none. The acceptance test asserts the selection with a 2-running-session fixture. |
| Adapter output drifts from the `workbenchMockData` interfaces → component contract breaks silently | D3: the mock interfaces ARE the adapter's typed output contract; the adapter returns those exact types so `tsc` catches drift at the swap site. |
| Implementer over-reaches into the five deep sidebar panels (Wave 4 work) while "swapping the sidebar" | D5 + Note + scope guard in the Phase 3 brief: header only; the panel bodies keep their mock imports. Phase-reviewer checks the diff doesn't touch `NowBlock`/`ContextBlock`/`FilesTouched`/`LatestHunk`/`HookTimeline` data. |
| Git-branch live source is unconfirmed (explorer couldn't find which hook feeds the dead `gitBranch` prop) | Files-to-read #6: Phase 2 confirms the existing git-status source (`useGitStatus`/IPC/prop on `Layout/StatusBar.tsx`) BEFORE writing the swap; if none exists, file a Tier-3 follow-up rather than building a new git-status pipeline (out of scope). |
| `'warn'`/`awaiting` status-dot mapping needs `permissionEvents`, not a status field → naive field-rename is wrong | Phase 3 brief + small orchestrator-owned mapping test: the dot mapping derives `awaiting` from the session's latest unresolved `permission_request`, not from `status`. |
| Dead-mock sweep removes a constant still referenced somewhere | Phase 4 runs the dead-export audit + `tsc`/`eslint`; only removes symbols with zero remaining importers (recon §6 lists the exact six + two-type set + barrel lines). |
| Flag-off regression — a swap leaks into the legacy shells | Render test asserts flag-off renders the existing shells byte-unchanged; all edits are inside `Workbench/**` (gated by `layout.canonWorkbench`). |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | `deriveWorkbenchAgentState`: each of the six states from synthetic inputs (incl. `awaiting` from a pending `permission_request`, `thinking` from running-no-pending-tool). | **Orchestrator-owned acceptance test** (honeycomb — the event→presentation seam): synthetic `AgentSession[]` + events through `useWorkbenchAgentData`; assert primary-session selection (incl. 2-running fixture), derived state, and canon-shaped `contextStats`; assert `AgentGlobe` renders the derived state (not `"running"`). | Honeycomb — the derivation + selection is the failure surface. `test:layout`/`test:renderer`. |
| 2 | Clock formatting; project-chip mapping from the live project source. | Render: TitleBar/ProjectRail show the live project; StatusBar shows the resolved git branch (mocked git source). | Trophy. `test:layout`. |
| 3 | Status-dot mapping (`running/awaiting/idle/complete/error` → dot tone); sidebar-header field mapping. | Render: InnerRail lists `currentSessions` with correct dots; sidebar header names the primary session; **the five panel bodies still render mock** (assert mock imports intact). | Honeycomb (mapping) + Trophy (render). `test:layout`. |
| 4 | n/a | Dead-export audit clean; scoped suites green; `/review` PASS/FLAG-addressed; `/ui-smoke 3` written. | Wrap. |

## Acceptance criteria

- [ ] `WorkbenchAgentState` (`fresh|thinking|running|awaiting|errored|done`) + a pure
  `deriveWorkbenchAgentState(...)` exist; the canonical `AgentStatus` at `AgentMonitor/types.ts:10` is **unchanged**.
- [ ] `useWorkbenchAgentData` consumes `useAgentEventsContext()`, selects the primary session per D4, and
  returns the canon-shaped data (state, model, activeTool/target, elapsedSec, contextStats, sessions).
- [ ] `Workbench/TitleBar/AgentGlobe.tsx` reads the hook — no `MOCK_CONTEXT_STATS`/`MOCK_HOOK_EVENTS`
  imports remain in it; `TitleBar.tsx` passes the derived state, not `state="running"`.
- [ ] With the flag on and no agent running, the Globe reads idle/`fresh`; with a live `claude` session
  active, it shows the real tool name + model + elapsed.
- [ ] `TitleBar` project chips + `Rails/ProjectRail` render the live open project(s); no `MOCK_PROJECTS`
  import remains in either.
- [ ] `Workbench/StatusBar.tsx` renders the real git branch + adds/dels and a live clock; context stats
  (tokens/cost) come from the adapter; no `MOCK_BRANCH`/`MOCK_CONTEXT_STATS`/`MOCK_STATUS_BAR` data
  remains in it.
- [ ] `Rails/InnerRail` sessions list maps `currentSessions` with correct status dots (`awaiting` derived
  from `permissionEvents`); `AgentSidebar` header names the primary session.
- [ ] The five AgentSidebar panel bodies (NOW/Context/Files Touched/Latest Hunk/Hook Timeline) **still
  render mock data** — unchanged this wave (D5).
- [ ] The Wave-2 dead constants are deleted (`MOCK_CC_TUI_LINES`, `MOCK_SHELL_LINES`, `MOCK_CC_STATUS_LINE`,
  `MOCK_CC_PROMPT_PLACEHOLDER`, `MockTerminalLine`, `TermLineTone`, `MOCK_TERM_TABS_UPPER`,
  `MOCK_TERM_TABS_LOWER`, `MockTerminalTab`) + their barrel re-exports; `tsc`/`eslint` dead-export clean.
- [ ] Flag-off leaves the existing shells byte-unchanged (render test).
- [ ] The orchestrator-owned Phase 1 acceptance test passes against the implementation.
- [ ] Zero new hardcoded hex in `Workbench/**` except sanctioned platform/brand colors (lint clean); tsc clean.
- [ ] `Workbench/CLAUDE.md` updated; `wave-3-result.md`, `CHANGELOG [2.24.0]`, `/ui-smoke 3` report, local tag `v2.24.0`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR is the orchestrator's planning artifact — Cole reviews it; nothing renders. |
| 1 | The Agent Globe pill in the title bar of a live IDE (flag on) | a running `claude` session emits hook events → main `hooksNet` → preload `onAgentEvent` → `AgentEventsContext` → `useWorkbenchAgentData` selects the primary session + `deriveWorkbenchAgentState` → `AgentGlobe` renders | Cole sees the Globe sit idle when nothing is running, then — when a `claude` session is active in a terminal — light up showing the real model name and the actual tool it's running (e.g. "Edit"), with the elapsed timer ticking; it returns to idle when the session ends. No more permanently-spinning hardcoded "running". |
| 2 | The title bar project chip + the status bar's left slot in a live IDE (flag on) | open/switch project → `ProjectContext`/`useWorkbenchProjects` → `TitleBar`/`ProjectRail` chips; git-status source → `Workbench/StatusBar` branch slot; clock tick → StatusBar | Cole sees the title bar name the project he actually has open (not "Gamify"-style mock), the status bar show his real current git branch with real +/- counts, and the clock show the real current time advancing — not the frozen mock string. |
| 3 | The inner rail's sessions list + the agent-sidebar header + the status-bar token readout (flag on) | running sessions → `AgentEventsContext.currentSessions` → `useWorkbenchAgentData` (status→dot mapping, primary selection) → `InnerRail` list / `AgentSidebar` header / `StatusBar` context stats render | Cole sees the inner rail list the sessions that are actually running with a green dot, an amber dot when one is waiting on a permission prompt, and the sidebar header naming the active session; the status bar shows the real token/cost for that session. The five panels below the header still show their mock placeholder content (expected — Wave 4). |
| 4 | Internal — no observation point | n/a | Wrap phase — dead-mock sweep, gates, brief, CHANGELOG, tag are build artifacts; the product surface is Phases 1–3, re-verified by `/ui-smoke 3`. |

### Data-shape probes

```bash
# Phase 1 — derivation + adapter + Globe
npx vitest run src/renderer/components/Workbench src/renderer/hooks
# Confirm AgentGlobe no longer imports the mock constants; canonical AgentStatus unchanged:
#   grep -n "MOCK_CONTEXT_STATS\|MOCK_HOOK_EVENTS" src/renderer/components/Workbench/TitleBar/AgentGlobe.tsx  → no matches
#   git diff src/renderer/components/AgentMonitor/types.ts  → empty

# Phases 2/3 — region swaps
npx vitest run src/renderer/components/Workbench

# Phase 4 — dead-export sweep + wrap
npm run lint && npm run typecheck
npx vitest run src/renderer/components/Workbench
# Confirm the dead constants are gone:
#   grep -rn "MOCK_CC_TUI_LINES\|MOCK_SHELL_LINES\|MOCK_TERM_TABS_" src/renderer/components/Workbench  → no matches
```

## Files the next agent should read first

1. `roadmap/wave-3-workbench-hook-pipeline-state-machine/recon-3.md` — the seam map (state machine,
   envelope, mock shapes, swap sites, dead mocks, consumption pattern), file:line-cited. Read first.
2. `roadmap/wave-3-workbench-hook-pipeline-state-machine/wave-3-decisions.md` — the ADR (Decisions 1–7).
3. `roadmap/discovery/workbench-overhaul-reconciliation.md` — §11/§12 + "Hook schema: canon vs reality"
   (the idealized model `recon-3.md` corrects).
4. `src/renderer/hooks/useAgentEvents.ts` (+ `useAgentEvents.helpers.ts`, `endSession.ts`) — the live
   pipeline + `UseAgentEventsReturn` (`:41–51`) the adapter consumes.
5. `src/renderer/components/AgentMonitor/types.ts` — `AgentStatus` (`:10`, do NOT edit), `ToolCallEvent`,
   `HookPayload`; the `AgentSession` shape the adapter maps from.
6. The existing live project source (`ProjectContext` / `useWorkbenchProjects`) and the git-status source
   feeding `Layout/StatusBar.tsx`'s dead `gitBranch` prop — confirm both before the Phase 2 swap.
7. `src/renderer/components/Workbench/TitleBar/AgentGlobe.tsx` — the headline rewire (mock reads `:191–195`,
   `GlobeState` extension).
8. `src/renderer/components/Workbench/{Rails/InnerRail,Rails/ProjectRail,AgentSidebar/AgentSidebar,StatusBar}.tsx`
   — the four swap-site components (recon §5 table).
9. `src/renderer/components/Workbench/workbenchMockData.{ts,rails.ts,sidebar.ts}` — the mock shapes (=
   adapter output contract) + the dead constants to sweep.
10. `src/renderer/components/AgentMonitor/AgentMonitorManager.tsx` — the reference live-consumption pattern.
11. `roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md` — the dead-mock sweep list (D7).
12. `src/renderer/components/Workbench/CLAUDE.md` — the static-mock constraint this wave relaxes for the
    four regions (Globe/Rails/Sidebar-header/StatusBar).

## Note to the implementer

The spirit of this wave is **make the workbench shell react to real agent activity by adapting the existing
event pipeline — not by inventing a new one or by widening the domain model.** The pipeline
(`useAgentEvents`/`AgentEventsContext`) and the approval flow already work and already feed the legacy
AgentMonitor; you build a thin workbench-local adapter on top and point the regions at it. Resist five
temptations: (a) do NOT extend the canonical `AgentStatus` enum at `AgentMonitor/types.ts:10` to add the
canon states — that ripples through ~48 files; derive a workbench-local `WorkbenchAgentState` instead
(D1); (b) do NOT plumb `transcript_path` — it's not on the wire and its consumer is Wave 4 (D2); (c) do
NOT make the five deep AgentSidebar panels live or re-lay-them-out — Wave 3 is the header only; the panel
bodies stay mock (D5); (d) do NOT auto-launch `claude` in the upper terminal frame or build pty→session
binding — the Globe reads ambient agent events (D6); (e) do NOT build a new git-status pipeline — find the
existing source feeding the dead `gitBranch` prop; if there isn't one, file a follow-up rather than
expanding scope. The mock interfaces are your adapter's output contract — return those exact types so the
type checker catches drift. `thinking` is a best-effort heuristic (the wire has no thinking signal) — don't
over-engineer it.

Before declaring a phase complete, restate the observation point from the Verification table in your own
words and describe what you actually observed there. If you could not observe it directly — no live IDE,
no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for
runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

When a phase's gate is green and nothing Tier 3 surfaced, the orchestrator dispatches the next phase in
the same turn — it does not end the turn to summarize or ask. The turn ends between phases only for a
Tier 3 discovery needing a user call, a genuine user-judgment decision, or wave-end. See the
Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-3-workbench-hook-pipeline-state-machine/wave-3-decisions.md`
   with Decisions 1–7 (Decision 1 carrying the best-practice spectrum). Gate to Phase 1.
2. **Author the Phase 1 acceptance test first (orchestrator).** Per
   `~/.claude/rules/orchestrator-owned-acceptance-tests.md`: a failing test expressing the event→presentation
   contract — synthetic `AgentSession[]` + events through `useWorkbenchAgentData`; assert primary-session
   selection (incl. a 2-running fixture), each derived `WorkbenchAgentState` (incl. `awaiting` from a pending
   `permission_request`, `thinking` from running-no-pending-tool), the canon-shaped `contextStats`, and that
   `AgentGlobe` renders the derived state rather than `"running"`. Confirm it FAILS before dispatch.
3. **Phase 1 — sonnet-implementer (thinnest end-to-end live slice).** Brief: `deriveWorkbenchAgentState` +
   `useWorkbenchAgentData` + rewire `AgentGlobe`/`TitleBar` + extend `GlobeState`. Implement against the
   acceptance test (may not modify it). Gate: acceptance test passes + derivation unit test green +
   `test:layout`/`test:renderer` green + lint/tsc clean + **`sonnet-phase-reviewer` pass** (state-derivation
   conceptual risk) + manual: Globe reflects real agent activity. Orchestrator cross-phase check: does the
   adapter's output shape match what Phases 2/3's consumers assume?
4. **Phase 2 — sonnet-implementer.** Brief: project chips + ProjectRail → live project source; StatusBar git
   branch (un-stub) + live clock. **Confirm the project + git sources exist before swapping** (files-to-read
   #6). Gate: render tests green + `test:layout` green + lint/tsc clean + manual: title bar shows the real
   project, status bar the real branch + clock.
5. **Phase 3 — sonnet-implementer.** Brief: InnerRail sessions list (status-dot mapping) + sidebar header +
   StatusBar context stats from the adapter; **panel bodies stay mock (scope guard)**. Gate: status-dot
   mapping test + render test (panels still mock) green + `test:layout` green + lint/tsc clean +
   **`sonnet-phase-reviewer` pass** (dot-mapping conceptual risk) + manual: rail dots + header reflect real
   sessions.
6. **Phase 4 — wave wrap.** Sweep the dead mocks (recon §6, D7) + dead-export audit. `npm run lint`,
   `npm run typecheck`, prettier, `npx vitest run src/renderer/components/Workbench src/renderer/hooks`
   (+ full suite in background). Orchestrator full-wave diff review. `/review` mechanical gap-check (Check 6
   if stryker). Update `Workbench/CLAUDE.md` + author `wave-3-result.md`. Append `CHANGELOG [2.24.0]`. Run
   `/ui-smoke 3` (UI-bearing; live smoke deferred per Wave 0/1/2 posture — written + queued for next dev
   session). Local tag `v2.24.0` (push per the 2026-05-19 bulletin — pushing safe, merges wait for CI
   minutes). Update `HANDOFF.md`. `/promote-vendor-lessons 3` (likely no-op — no vendor SDK touched).
   `/audit-followups wave-3-workbench-hook-pipeline-state-machine` (should close the dead-terminal-line-mocks
   follow-up).
