---
status: SHIPPED
created: 2026-05-21
updated: 2026-05-21
wave: 3
slug: workbench-hook-pipeline-state-machine
tag: v2.24.0
---

# Wave 3 — Workbench Hook Pipeline + Live Agent State · Result

Made the canon workbench's non-terminal regions react to **real agent activity** instead of
`workbenchMockData`. A new workbench-local presentation-state machine + adapter
(`useWorkbenchAgentData`) derives a six-state agent status (`fresh/thinking/running/awaiting/
errored/done`) from the live `AgentEventsContext`, without mutating the canonical 4-value
`AgentStatus` (which ~48 AgentMonitor files depend on). The Agent Globe, inner-rail session list,
agent-sidebar header, title-bar project chips, branch name, clock, and status-bar context stats are
all live. Renderer-only, no IPC/schema change. Behind the default-off `layout.canonWorkbench` flag.

## Per-phase outcomes

| Phase | Outcome |
|---|---|
| 0 — ADR | `wave-3-decisions.md` (7 decisions; D1 best-practice spectrum; D5/D6 scope boundaries Cole-locked) + `recon-3.md` grounding. Plan validated (Gate A N/A · B/C PASS · D advisory pass). |
| 1 — State machine + adapter + Agent Globe live | `useWorkbenchAgentData` (`WorkbenchAgentState`, pure `deriveWorkbenchAgentState` + two-tier `selectPrimarySession`); `AgentGlobe` rewired off mock to the hook, exposes `data-state`, six-state visuals; `TitleBar` drops the hardcoded `state="running"`. Orchestrator-owned acceptance test (9 cases). Phase-reviewer FLAG → fixed: `selectPrimarySession` made two-tier (prefer running; fall back to most-recent finished for done/errored) — also corrected the ADR D4 wording, which had been self-contradictory with the acceptance test. |
| 2 — Project chips + branch + clock live | New `useWorkbenchProjects` (derives from `ProjectContext` + `recentProjects`, deterministic per-path hsl color); `useGitBranch` for the live branch name; live `setInterval` clock. TitleBar active chip + ProjectRail + StatusBar + InnerRail footer wired. Git **+adds/−dels** and per-project **dirty** badges deferred (no renderer-only source) → follow-up. |
| 3 — Sessions list + sidebar header + context stats live | Extended the *same* adapter (D3) with `sessions: WorkbenchSession[]` (status-dot mapping: running→live, running+pending-permission→warn, idle→idle; complete/error excluded; primary marked active) + `contextStats`. InnerRail sessions list, AgentSidebar header, StatusBar context slots wired. Orchestrator-owned mapping acceptance test (5 cases). Phase-reviewer PASS (its one max-lines flag was a false positive — eslint with `skipComments` is clean). |
| 4 — Dead-mock sweep + wrap | Deleted the 6 Wave-2-orphaned terminal-line mock symbols + barrel re-exports (dead-export audit corrected the recon's over-broad list — `MOCK_TERM_TABS_*` still used by `TerminalShell`; `MOCK_SESSIONS`/`MOCK_PROJECTS`/`MOCK_BRANCH` by `UnifiedRail`; `MOCK_HOOK_EVENTS`/`MOCK_CONTEXT_STATS` by the Wave-4 panels). Full lint (0 errors), tsc clean, prettier, Workbench suite 134; CLAUDE.md, this brief, CHANGELOG [2.24.0], `/review` PASS, tag v2.24.0. |

## Verification

- **Tests:** orchestrator-owned acceptance tests 9/9 (Globe state machine) + 5/5 (session mapping);
  unit 20 (`deriveWorkbenchAgentState`/`selectPrimarySession`/`deriveSessionStatus`/contextStats);
  full Workbench suite **134** green; tsc + full `eslint src/` (0 errors) + prettier clean.
- **`/review` mechanical gap-check: FLAG** (one non-fatal flag; no structurally-fatal flags).
  Checks 1/2/3 clean (all new symbols reach production consumers; no narrowed universals; no dead
  exports); Check 4 N/A (no schema removals); Check 5 N/A (no cross-boundary phases — conceptually-
  risky phases carry orchestrator-owned tests anyway). **Check 6 mutation score = 31.72%** — below
  /review's generic 40% line but **above the project's calibrated `break: 21` gate** (passed). The
  survivors skew toward UI-render constructs (Regex/StringLiteral/Conditional in inline-style/JSX),
  not the wave's core logic, which is strongly asserted. FLAG with written justification + a bounded
  pre-merge task: review `reports/mutation/mutation.html` Wave-3-file survivors in the adapter logic
  before the June merge (see `wave-3-mechanical-review.md`).
- **One phase-reviewer fix folded in (not a separate phase):** Phase 1 `selectPrimarySession`
  running-preference (a stale completed session could outrank a live running one → Globe showed
  `done` while an agent worked). Caught by the reviewer; fixed two-tier + locked with a new
  acceptance case + ADR D4 correction.
- **One orchestrator self-fix:** Phase 1 broke 15 existing `Workbench.test.tsx` tests (full-Workbench
  render now needs `AgentEventsProvider`); fixed by mocking `useAgentEventsContext` in the test +
  rewriting the one stale "mock model" assertion. Gotcha recorded in `Workbench/CLAUDE.md`.
- **NOT done — live UI smoke deferred.** `/ui-smoke 3` was NOT run as a live smoke (Cole is not using
  the app until the overhaul is done; per the Wave 0/1/2 posture). Behavior verified at the
  jsdom/component boundary (mocked `AgentEventsContext`/`useGitBranch`/`ProjectContext`), not in a
  running IDE. **Next dev session:** enable Settings → Appearance → "Canon workbench", run a `claude`
  session in a terminal, and confirm: the Agent Globe lights up with the real model/tool and returns
  to idle; the inner rail lists running sessions with green/amber dots; the title bar/status bar show
  the real project + branch + clock + token/cost.

## Decisions (ADR `wave-3-decisions.md`)

Workbench-local derived presentation state, not mutating canonical `AgentStatus` (D1) · skip
`transcript_path` (D2) · single `useWorkbenchAgentData` adapter is the source of truth (D3) ·
two-tier primary-session selection — prefer running, fall back to most-recent finished (D4,
corrected mid-wave) · AgentSidebar header live this wave, 5 panel bodies → Wave 4 (D5, Cole-locked) ·
Claude auto-launch decoupled/deferred — Globe reads ambient events (D6, Cole-locked) · sweep the
Wave-2 dead mocks (D7).

## Follow-ups / deferrals

- `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (NEW) — live git **+adds/−dels**
  (needs a new main-process `git diff --stat` op + IPC) and per-project **dirty** badges (per-project
  `useGitStatus` fan-out). Omitted, not faked. Not agent-reactive data → correctly lowest-priority.
- `roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md` — **RESOLVED** by Phase 4's sweep.
- `/ui-smoke 3` live smoke (above) — confirm next dev session.
- `contextStats.maxTokens` hard-codes `200_000` (no per-model live source) — wire a per-model window
  lookup when a source exists.
- The five AgentSidebar panel bodies + their 5-panel re-layout + Latest-Hunk diff source → **Wave 4**.

## Ship

Phases 0–4 on `master` (commits `5e68fcb5` plan/ADR, `228df297` phase 1, `5a9b687b` phase 2,
`5ba50b87` phase 3, `3fdfc6fb` phase 4 sweep, + wrap), tag `v2.24.0`. Push per the 2026-05-19
bulletin (workflows won't run; merges wait for CI minutes 2026-06-01 — at which point Check 6's
mutation score must be green before merge).
