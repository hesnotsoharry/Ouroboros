---
status: DRAFT
created: 2026-05-20
updated: 2026-05-20
wave: 99
slug: agent-completion-rail-indicators
---

# Wave 99 — Agent-Completion Rail Indicators

## Context

The chat-workbench shell (Wave 89+ terminal-first pivot) presents a two-tier
rail: the 52px `OuterProjectRail` (one icon per project) and the inner
`WorkbenchRail` (session rows), plus the terminal dock with per-terminal tabs
(`DockSlotTabs`). Today none of these signal when a Claude Code agent has
*finished* — a user running agents across multiple projects has no way to know
which project, which terminal, or which session just completed without clicking
through each one. This wave closes that gap on three surfaces and, in doing so,
repairs a latent pipeline break.

**Diagnostic finding (sonnet-diagnostician, 2026-05-20) — the reason no
indicators show today.** The completion signal itself is alive and
chat-agnostic: Claude Code hooks are installed globally in
`~/.claude/settings.json` (`hookInstaller.ts:200`), so `agent_end` /
`agent_stop` / `session_stop` fire for interactive terminal `claude` sessions
identically to any other invocation. Those events DO create an `AgentSession`
(via `AGENT_START` → `startSession`, `useAgentEvents.helpers.ts:281`, marked
`external: true` for non-IDE-spawned) and DO flip its `status` to
`'complete'`/`'error'` with a `completedAt` stamp. **However**, the workbench
rail's existing attention system (`useWorkbenchAttention`) — including the
already-declared `'live'`, `'completed-unseen'`, and `'failed'` kinds — derives
attention from `AgentChatThreadRecord.status` (the **retired in-IDE chat**
thread status), reached via `SessionRecord → resolveSessionThread`. A
terminal-launched `claude` has no chat thread, so that path produces nothing.
The rail reads `SessionRecord[]` from the session-CRUD store; the live signal
lives in `AgentSession[]` in the `useAgentEvents` store; **the two were never
joined for terminal sessions.** That is the root cause of "no indicators
anywhere," including the dead "Live" chip during an active run.

So the verdict is **PARTIAL wiring gap**, not a dead signal — the chat
retirement removed the *callers* that populated attention, but left the rail
reading a now-empty thread-status path. Confirmed seams:
- `useAgentEventsContext()` exposes `agents: AgentSession[]`
  (`AgentEventsContext.tsx:57`) and is mounted above the workbench in
  `ConfiguredApp` — the populated terminal-session signal is already in scope.
- `useWorkbenchAttention`'s option-bag (`UseWorkbenchAttentionOptions`,
  `useWorkbenchAttention.ts:33`) is a clean seam to add an `agentSessions?:`
  input without breaking callers.
- `TerminalSession.claudeSessionId` is set by `useClaudeSessionCapture`
  (`useTerminalSessions.sync.ts:205`), giving terminal → `AgentSession.id`.
- `SessionRecord.activeTerminalIds` links a rail row → its terminals.
- `OuterProjectRail.tsx:64` (`ProjectIconButton`), mounted at
  `ChatWorkbenchBody.rails.tsx:205`, projects from `useWorkbenchProjects()`
  (`string[]`), select via `handleSelectOrAdd` (line ~106).
- `DockSlotTabs` / `TabBadges` already render per-tab badges (extend, don't
  invent).

Renderer-only. No main-process, IPC, or schema change. Target tag: `v2.20.0`
(minor — net-new user-facing surface, plus restoration of the Live indicator).

## Goal

After Wave 99, agent completion is visible at every tier of the workbench, and
the long-dead "Live" indicator works again for terminal sessions:

- **Outer rail:** each `OuterProjectRail` project icon shows a corner status dot
  — green (`status-success`) for an unseen clean finish, red (`status-error`)
  for an unseen error — derived directly from `AgentSession.status` by `cwd`,
  bypassing the broken attention path. Clears when the user selects the project.
- **Inner rail (WorkbenchRail rows):** the attention layer is rewired to read
  `AgentSession.status` (joined to each row via
  `SessionRecord.activeTerminalIds → TerminalSession.claudeSessionId →
  AgentSession.id`), so the existing `live` / `completed-unseen` / `failed`
  chips finally populate for terminal sessions. The Live chip lights during a
  run; a completion chip shows after, in the existing chip language; it clears
  when the user selects the session.
- **Terminal tabs (dock):** each `DockSlotTabs` tab carries a green/red
  completion dot via the existing `TabBadges`, looked up by the terminal's
  `claudeSessionId` against the agent-completion status — the most literal
  "which terminal finished." Clears when the user focuses that tab.
- A re-completion after the indicator was cleared re-lights it (timestamp-based
  dismiss: `completedAt > lastViewedAt`).

A single new hook `useAgentCompletionIndicators` owns the project/session join
from `AgentSession` plus viewed-timestamp bookkeeping. The inner-rail rewire is
the load-bearing repair: it reconnects the rail to the live agent store.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-99-agent-completion-rail-indicators/wave-99-decisions.md`.
All six RESOLVED (1-3 user direction, 4-6 from grounding + diagnosis).

1. **Trigger — completion + error, distinct colors.** Green (`status-success`)
   for `complete`, red (`status-error`) for `error`; idle/running never light a
   *completion* indicator (running drives the separate Live chip).
2. **Dismiss — clear on view, timestamp-based.** Per-session `lastViewedAt` vs
   `AgentSession.completedAt`; unseen iff `completedAt > lastViewedAt`; a newer
   completion re-lights. Outer dot clears on project select; inner chip + tab
   dot clear on session/tab focus.
3. **Style — reuse existing systems.** Inner rail uses the existing
   `completed-unseen`/`failed` `WorkbenchAttentionKind` chips; tabs use the
   existing `TabBadges`; outer dot uses `status-success`/`status-error` tokens.
4. **Project association — normalized `cwd` prefix match.** Session belongs to a
   project iff normalized `cwd` (backslash→slash, strip trailing slash,
   lowercase on win32) equals or nests under a normalized project path; longest
   match wins; undefined `cwd` → unassigned, no dot.
5. **Viewed-state lifetime — in-memory (renderer), window-lifetime.** No config
   persistence; restart clears indicators (agents are historical by then).
   Persistence punted to a follow-up.
6. **Inner attention source — add an `AgentSession` input path; keep the chat
   thread path additive.** `useWorkbenchAttention` gains an `agentSessions`
   (and a derived `agentStatusBySessionRecordId`) input; `live`/`completed`/
   `failed` derive from `AgentSession.status` when present, falling back to the
   legacy `AgentChatThreadRecord.status` path. This repairs terminal-session
   attention without removing the (now-dormant) chat path.

## Scope

**In scope:**
- New hook `src/renderer/hooks/useAgentCompletionIndicators.ts` — from
  `useAgentEventsContext().agents`, derives `statusByProject`
  (`Record<path,'complete'|'error'>`, unseen-only, cwd prefix-match) and
  `statusByClaudeSessionId` (`Record<agentSessionId,'complete'|'error'|'running'>`),
  owns `lastViewedAt` + `markProjectViewed(path)` / `markSessionViewed(id)`.
- **Outer rail (Phase 2):** `OuterProjectRail` `statusByProject` prop +
  `ProjectIconButton` dot + clear-on-select threading in
  `ChatWorkbenchBody.rails.tsx`.
- **Inner-rail attention rewire (Phase 3):** `useWorkbenchAttention` +
  `useWorkbenchAttention.helpers.ts` gain an `AgentSession` input; a join helper
  maps each `SessionRecord` → its terminals' `claudeSessionId` → `AgentSession`
  status; `live`/`completed-unseen`/`failed` populate from it; `markSessionViewed`
  fires on row select. **Revives the Live chip for terminal sessions.**
- **Terminal tabs (Phase 4):** `DockSlotTabs` / `TabBadges` render a completion
  dot keyed by the tab's `claudeSessionId`; clears on tab focus.
- Unit tests: hook derivation (cwd match, unseen/re-light, undefined-cwd,
  Windows normalization, mark-viewed); attention helper join + status→kind map.
- CLAUDE.md: `ChatOnlyShell/CLAUDE.md` (indicator flow + the attention-source
  repair); `Terminal/CLAUDE.md` if `TabBadges` semantics change.

**Out of scope:**
- Persisted "unread across restart" (Decision 5) — follow-up if requested.
- Fixing the heuristic `useClaudeSessionCapture` terminal↔session binding —
  pre-existing; this wave consumes it as-is and notes the caveat. The outer dot
  (cwd-based) does not depend on it.
- Removing the dormant chat-thread attention path — kept additive (Decision 6);
  a separate cleanup can retire it once chat removal is fully ratified.
- Any main-process / IPC / config-schema change — none needed.
- Sound / OS notification on completion — separate feature.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-99-decisions.md` with Decisions 1-6 RESOLVED. Gate to 1. |
| 1 | `useAgentCompletionIndicators` hook | sonnet-implementer | New `src/renderer/hooks/useAgentCompletionIndicators.ts`. Reads `useAgentEventsContext().agents`; input `projects: string[]`. Derives `statusByProject` (ADR 4 cwd prefix-match; unseen = `completedAt > lastViewedAt`; error outranks complete per project) and `statusByClaudeSessionId` (incl. `'running'` for the Live tie-in). Owns `lastViewedAt` + `markProjectViewed`/`markSessionViewed`. Extract pure `deriveCompletionStatus(agents, projects, lastViewed)` for unit test. Test shape: pyramid. Mind ESLint complexity:10 / max-lines-per-function:40 — split matcher / reducer / predicate. |
| 2 | Outer-rail dot + threading + clear-on-view | sonnet-implementer | Additive `statusByProject?` on `OuterProjectRailProps`; `ProjectIconButton` corner dot via `bg-status-success`/`bg-status-error` (no hex — renderer color rule). Thread hook through `ChatWorkbenchBody.rails.tsx` (mount near `useWorkbenchProjects`, prop at ~205, `markProjectViewed` in select handler ~106). Test shape: trophy. Independent of the broken attention path — clean. |
| 3 | Inner-rail attention rewire (AgentSession source) | sonnet-implementer | **Cross-store join — conceptually-risky; orchestrator authors a failing join test before dispatch; `sonnet-phase-reviewer` after.** Add `agentSessions?: AgentSession[]` (+ a precomputed `agentStatusBySessionRecordId`) to `UseWorkbenchAttentionOptions` (`useWorkbenchAttention.ts:33`). Join helper: `SessionRecord.activeTerminalIds → TerminalSession.claudeSessionId → AgentSession.status`. Map `running→live`, `complete→completed-unseen`, `error→failed`, honoring existing `rank`/`isSticky`/tone; legacy `AgentChatThreadRecord.status` path kept as fallback (ADR 6). Fire `markSessionViewed` on row select. **Revives Live for terminal sessions** — verify Live lights during a run. `WorkbenchSessionRow` chip rendering already supports the kinds — no row-component change expected. Test shape: honeycomb (the join is the failure surface). |
| 4 | Terminal-tab completion dot | sonnet-implementer | Extend `DockSlotTabs` / `TabBadges` with a completion dot keyed by the tab's `TerminalSession.claudeSessionId` looked up in `statusByClaudeSessionId` (direct binding — no cross-store join). Green/red token dot alongside the existing diamond/exited badges; clears via `markSessionViewed` on tab focus/activate. Test shape: trophy. Note: inherits the heuristic terminal-bind caveat for terminal-launched claude. |
| 5 | Wave wrap | orchestrator | `test:layout` + `test:renderer` + `useAgentCompletionIndicators.test.ts` (+ `test:agentchat` if attention touched there), full lint + typecheck + formatter, orchestrator diff review, `/review` mechanical gap-check (Check 6 mutation if stryker present), CLAUDE.md updates, `wave-99-result.md`, `CHANGELOG.md [2.20.0]`, `/ui-smoke 99` (UI-bearing — `Layout/**` + `Terminal/**`), `git tag v2.20.0` (HOLD push per 2026-05-19 bulletin — minutes exhausted to 2026-06-01), HANDOFF flip, `/promote-vendor-lessons 99` (no-op), `/audit-followups wave-99-agent-completion-rail-indicators`. |

## Phase ordering

```
Phase 0 (ADR)
   |
   v
Phase 1 (useAgentCompletionIndicators) ── statusByProject + statusByClaudeSessionId
   |                 |                                  |
   v                 v                                  v
Phase 2          Phase 3 (attention rewire +      Phase 4 (terminal-tab dot)
(outer dot)       Live revival; cross-store join)
   |                 |                                  |
   +─────────────────┴──────────────────────────────────+
                         v
                   Phase 5 (wrap)
```

- Phase 1 is the shared substrate — blocks 2, 3, 4.
- 2, 3, 4 are largely independent (outer rail / attention layer / terminal tabs
  are different files). **Caveat:** 2 and 3 both edit `ChatWorkbenchBody.rails.tsx`
  (2 threads `statusByProject` + select-handler; 3 threads `agentSessions` into
  the attention input). Sequence 2 → 3 on that shared file, or one implementer
  takes both. 4 is fully independent (dock files).
- Phase 5 blocks on 1-4.

## Risks

| Risk | Mitigation |
|---|---|
| **The cross-store join (Phase 3) is the wave's hardest part** — `SessionRecord → activeTerminalIds → TerminalSession.claudeSessionId → AgentSession` spans three stores with a heuristic middle link | Orchestrator authors a failing join test BEFORE dispatch (per orchestrator-owned-acceptance-tests rule) expressing the contract from synthetic fixtures: given a SessionRecord with terminal T, T bound to claude session S, S's AgentSession status `complete` → row attention is `completed-unseen`. Phase 3 gets a `sonnet-phase-reviewer` pass. |
| The `completed-unseen`/`failed`/`live` kinds were dead for terminal sessions — implementer might "fix" the wrong path (rework the chat-thread branch instead of adding the AgentSession branch) | Diagnosis is in the plan: the chat-thread path is intentionally kept as fallback (ADR 6); the new AgentSession branch is additive. Brief states this explicitly. |
| Heuristic terminal↔session binding can attach the inner indicators (rail row + tab) to the wrong terminal for background-launched claude | Pre-existing, out of scope to fix. The outer dot (cwd-based) is the reliable signal and is independent of the bind. Caveat documented in result brief; tab surface is the most-direct binding available. |
| `cwd` undefined for some external/terminal sessions silently drops them from the outer dot | ADR 4 makes undefined-cwd explicit (unassigned, no error); Phase 1 unit test covers it; documented in CLAUDE.md. |
| Path-normalization mismatch (Windows backslash, trailing slash, case) → cwd never matches a project | Normalize both sides before prefix-compare; Phase 1 unit test asserts a Windows-style cwd matches a Windows-style project path. |
| Re-render churn deriving on every `agents` change | `useMemo` keyed on `agents`/`projects`/`lastViewedAt`; viewed updates are coarse (per select/focus). |
| ESLint complexity/line caps on the derivation + join reducers | Briefs mandate helper extraction; lint runs at each phase gate on touched files. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | `deriveCompletionStatus`: complete→green, error→red, error-outranks-complete, unseen logic, re-light on newer `completedAt`, undefined-cwd dropped, Windows path normalization; mark-viewed updates `lastViewedAt` | n/a | Pyramid — pure logic. Synthetic `AgentSession[]`. |
| 2 | `ProjectIconButton` dot token class per status; no dot when absent | OuterProjectRail renders dots on right icons; project select calls `markProjectViewed`, dot clears next derive | Trophy. `test:layout`. |
| 3 | join helper maps SessionRecord→terminal→agent status correctly (incl. unbound→none, multi-terminal→worst); status→kind map | **Orchestrator-owned join acceptance test** + WorkbenchRail row shows Live during run and completion chip after; select clears it | Honeycomb — the join boundary is where failures live. `test:layout` + `test:agentchat`. |
| 4 | `TabBadges` renders completion dot per status keyed by claudeSessionId; no dot when unbound/none | Dock tab shows green/red dot after its claude session completes; focusing the tab clears it | Trophy. `test:layout`. |
| 5 | n/a | Scoped suites green, `/review` PASS/FLAG-addressed, `/ui-smoke 99` written | Wrap. |

## Acceptance criteria

- [ ] `src/renderer/hooks/useAgentCompletionIndicators.ts` exists, returns
      `{ statusByProject, statusByClaudeSessionId, markProjectViewed, markSessionViewed }`.
- [ ] Pure `deriveCompletionStatus(agents, projects, lastViewed)` is unit-testable in isolation and covered.
- [ ] Unseen `complete` agent (cwd under project) → `statusByProject[path]==='complete'`; unseen `error` → `'error'`; error outranks complete per project.
- [ ] `completedAt <= lastViewedAt` → not shown; a newer `completedAt` → re-shown.
- [ ] Undefined-cwd sessions excluded without error; Windows-style cwd matches a Windows-style project path.
- [ ] `OuterProjectRailProps.statusByProject?` additive; `ProjectIconButton` dot uses `bg-status-success`/`bg-status-error` (no hex); project select invokes `markProjectViewed` and the dot clears.
- [ ] `UseWorkbenchAttentionOptions` gains `agentSessions?` (or `agentStatusBySessionRecordId`); the join helper resolves `SessionRecord → activeTerminalIds → claudeSessionId → AgentSession.status`.
- [ ] A running terminal `claude` session lights the **Live** chip on its WorkbenchRail row (regression repair); a completed session shows `completed-unseen` (success tone) / `failed` (error tone); selecting the row clears it.
- [ ] The legacy `AgentChatThreadRecord.status` path remains as fallback (no removal).
- [ ] `DockSlotTabs`/`TabBadges` render a completion dot for a tab whose `claudeSessionId` has an unseen completion; focusing the tab clears it.
- [ ] Orchestrator-owned join acceptance test exists, fails pre-implementation, passes post.
- [ ] `ChatOnlyShell/CLAUDE.md` documents the indicator flow + the attention-source repair; `Terminal/CLAUDE.md` updated if `TabBadges` semantics changed.
- [ ] `CHANGELOG.md [2.20.0]` entry; `wave-99-result.md` with per-phase outcomes + the terminal-bind caveat; `/ui-smoke 99` report; local tag `v2.20.0`; HANDOFF deferred-push reminder.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like |
|---|---|---|---|
| 0 | ADR file on disk | n/a | `wave-99-decisions.md` with Decisions 1-6 RESOLVED. |
| 1 | Internal — no observation point | n/a | Hook + helper exist, unit tests pass; no standalone surface. |
| 2 | OuterProjectRail icon in running chat-workbench | agent finishes in project X → `agent_end` hook → `useAgentEvents` `status='complete'`+`completedAt` → `useAgentEventsContext().agents` → `useAgentCompletionIndicators` → `statusByProject` → `ChatWorkbenchBody.rails.tsx` → `OuterProjectRail` → `ProjectIconButton` dot | A green dot appears on project X's icon without the user being in X; an errored agent shows red. Clicking X's icon clears the dot. |
| 3 | WorkbenchRail session row in active project | agent run/finish → `AgentSession.status` → join (`SessionRecord.activeTerminalIds → claudeSessionId → AgentSession`) → `useWorkbenchAttention` → `WorkbenchSessionRow` chip/`AttentionMark` | During the run the row shows the **Live** chip (works again); after, a "Done" (green) / "Failed" (red) chip; selecting the row clears it. |
| 4 | Terminal tab in the dock | agent finish in tab T's claude session → `statusByClaudeSessionId[T.claudeSessionId]` → `DockSlotTabs`/`TabBadges` dot | Tab T shows a green/red dot next to its label; focusing T clears it. The dot tracks the actual terminal that ran the agent. |
| 5 | `/ui-smoke 99` report + result brief + tag | orchestrator runs gates, smoke walk, brief, local tag | Smoke report: rail + tabs render cleanly, no console errors; `wave-99-result.md` exists; `git tag v2.20.0` local. |

### Data-shape probes

```bash
# Phase 1
npx vitest run src/renderer/hooks/useAgentCompletionIndicators.test.ts
# Grep new file for `export function deriveCompletionStatus`.

# Phase 2 — threading + token-only dot
# Grep ChatWorkbenchBody.rails.tsx for `statusByProject` + `markProjectViewed`.
# Grep OuterProjectRail.tsx for `status-success`/`status-error`; expect zero new `#` hex.

# Phase 3 — AgentSession input + join + Live revival
# Grep useWorkbenchAttention.ts (+ .helpers.ts) for `agentSessions` / `agentStatus`
# and for the running→live mapping referencing AgentSession status.
npx vitest run src/renderer/components/Layout/ChatOnlyShell  # incl. join acceptance test

# Phase 4 — tab dot
# Grep DockSlotTabs / TabBadges for `claudeSessionId` lookup against completion status.

# Wrap
npm run lint && npm run typecheck
npx vitest run src/renderer/hooks/useAgentCompletionIndicators.test.ts \
  src/renderer/components/Layout/ChatOnlyShell src/renderer/components/Terminal
```

## Files the next agent should read first

1. `roadmap/wave-99-agent-completion-rail-indicators/wave-99-decisions.md` — ADR; 6 locked decisions, esp. Decision 6 (attention source).
2. `src/renderer/contexts/AgentEventsContext.tsx` + `src/renderer/hooks/useAgentEvents.ts` / `.helpers.ts` — `agents: AgentSession[]`, `startSession`/`endSession`, `external` flag, `status`/`completedAt`.
3. `src/renderer/components/AgentMonitor/types.ts` — `AgentSession` / `AgentStatus` fields.
4. `src/renderer/components/Layout/ChatOnlyShell/useWorkbenchAttention.ts` + `useWorkbenchAttention.helpers.ts` — the attention derivation to rewire (Phase 3); the dead chat-thread-status path (~helpers line 107) and the `UseWorkbenchAttentionOptions` seam (line 33).
5. `src/renderer/components/Layout/ChatOnlyShell/useWorkbenchSessions.ts` — `SessionRecord`/`WorkbenchSessionItem`, `activeTerminalIds` (the join's left side).
6. `src/renderer/components/Terminal/useTerminalSessions.sync.ts` — `useClaudeSessionCapture`, `claudeSessionId` binding (the join's middle link + the heuristic caveat).
7. `src/renderer/components/Layout/ChatOnlyShell/ChatWorkbenchBody.rails.tsx` — rail mount/threading (Phases 2 & 3); `useWorkbenchProjects`, `handleSelectOrAdd` (~106), OuterProjectRail (~205).
8. `src/renderer/components/Layout/ChatOnlyShell/OuterProjectRail.tsx` — `ProjectIconButton` dot site (Phase 2).
9. `src/renderer/components/Layout/ChatOnlyShell/DockSlotTabs.tsx` + `src/renderer/components/Terminal/TerminalTabs.tsx` (`TabBadges`) — tab dot site (Phase 4).
10. `src/renderer/components/Layout/ChatOnlyShell/WorkbenchSessionRow.tsx` — chip rendering (already supports the kinds; reference).
11. `src/main/hooks.ts` + `src/main/hookInstaller.ts` — confirm the signal source (read-only; do NOT change).
12. `src/renderer/components/Layout/ChatOnlyShell/CLAUDE.md` — doc to update (Phase 5).

## Note to the implementer

The spirit of this wave is **reconnect a signal that already exists to three
places that should show it.** The diagnosis is done and is in the Context
section — internalize it: the completion signal is alive in `AgentSession`
(hook-driven, works for terminal `claude`); the rail was reading a dead
chat-thread path. Do NOT (a) touch the main process or add IPC — the signal is
already in the renderer; (b) rework the chat-thread attention branch — add the
`AgentSession` branch alongside it (ADR 6); (c) "fix" the heuristic terminal
binding — out of scope; (d) rebuild chips/badges — reuse the attention kinds and
`TabBadges`.

Phase 3 is the load-bearing one and the riskiest: the cross-store join spans
`SessionRecord → terminal → AgentSession`. The orchestrator authors a failing
join acceptance test before you start — implement against it, do not modify it.
A satisfying tell that you got it right: the **Live** chip starts working again
during an active terminal run — it has been dead since chat retirement. If Live
doesn't light, the join isn't reaching `AgentSession.status`. The outer dot
(Phase 2) and tab dot (Phase 4) bind more directly and are simpler — but the tab
dot still inherits the heuristic terminal bind, so note any wrong-tab behavior in
the result brief rather than papering over it.

Before declaring a phase complete, restate the observation point from the
Verification table in your own words and describe what you actually observed
there. If you could not observe it directly — no live IDE, no triggered chat
session, no rendered panel — say so explicitly. Do not substitute "tests pass"
for runtime observation. Tests passing at the unit boundary is necessary but not
sufficient.

## Orchestrator dispatch checklist

A green gate with nothing Tier 3 means the orchestrator dispatches the next
phase in the same turn — the turn ends between phases only for a Tier 3
discovery needing a user call, a genuine user-judgment decision, or wave-end.
See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** with Decisions 1-6 RESOLVED.
2. **Phase 1 — sonnet-implementer.** Brief: new hook + pure helper, ADR 4 normalization, ADR 2 unseen/re-light, ADR 5 in-memory state, `'running'` included in `statusByClaudeSessionId` for the Live tie-in, ESLint helper-extraction. Author the unit tests (pure logic — no orchestrator-owned boundary test needed here). Gate: `useAgentCompletionIndicators.test.ts` green, lint + typecheck clean.
3. **Phase 2 — sonnet-implementer.** Brief: additive prop, token-only dot, threading at `ChatWorkbenchBody.rails.tsx` (~205 / ~106). Gate: `test:layout` green, lint (incl. renderer color rule) + typecheck clean, manual: dot appears + clears on select.
4. **Phase 3 — sonnet-implementer (boundary/cross-store join).** **Orchestrator authors the failing join acceptance test BEFORE dispatch** (synthetic SessionRecord+terminal+AgentSession fixtures; row attention reflects agent status). **`sonnet-phase-reviewer` pass after implementation** (spec-alignment + integrity axes — the dead-path trap). Brief: add `agentSessions` input per ADR 6, the join chain, the running→live / complete→completed-unseen / error→failed map, fire `markSessionViewed` on select, keep chat-thread fallback. Sequenced after Phase 2 (shared `ChatWorkbenchBody.rails.tsx`). Gate: join acceptance test passes, `test:layout`+`test:agentchat` green, phase-reviewer PROCEED, manual: **Live lights during a run** + completion chip after + clears on select.
5. **Phase 4 — sonnet-implementer.** Brief: extend `TabBadges`/`DockSlotTabs` with the completion dot keyed by `claudeSessionId`, clear on tab focus. Independent of Phases 2/3 files. Gate: `test:layout` green, lint + typecheck clean, manual: tab dot appears + clears on focus.
6. **Phase 5 — wave wrap.** `npm run lint`, `npm run typecheck`, scoped vitest (`useAgentCompletionIndicators.test.ts`, `test:layout`, `test:renderer`, `test:agentchat`), full suite in background if available. `/review` mechanical gap-check (Check 6 if stryker present). Update `ChatOnlyShell/CLAUDE.md` (+ `Terminal/CLAUDE.md` if needed). Author `wave-99-result.md`. Append `CHANGELOG.md [2.20.0]`. Run `/ui-smoke 99`. Create local tag `v2.20.0` (HOLD push per 2026-05-19 bulletin). Update `HANDOFF.md`. `/promote-vendor-lessons 99` (no-op). `/audit-followups wave-99-agent-completion-rail-indicators`.
