---
status: DRAFT
created: 2026-05-21
wave: 3
slug: workbench-hook-pipeline-state-machine
type: recon
---

# Wave 3 — Hook Pipeline + Workbench Live-Data Recon

Read-only reconnaissance captured 2026-05-21 (one `sonnet-explorer` pass) to ground the Wave 3
phase briefs. Cite file:line. Where this diverges from
`roadmap/discovery/workbench-overhaul-reconciliation.md` §11/§12, the divergence is flagged —
**this recon supersedes the reconciliation doc's idealized claims where they conflict.**

## 1. AgentStatus enum + state machine

- **`AgentStatus`** is a 4-value type alias at `src/renderer/components/AgentMonitor/types.ts:10`:
  `'idle' | 'running' | 'complete' | 'error'`. **No `thinking`, `awaiting`, `errored`, `done`, or `fresh`.**
  Consumed across the ~48-file `AgentMonitor/**` subsystem — mutating it is a wide ripple.
- Status is set by **direct assignment in the reducer**, not a `deriveStatus()` helper:
  - `AGENT_START` (new) → `'running'` (`useAgentEvents.helpers.ts:295`, `startSession`)
  - `AGENT_START` (resume) → `'running'` (`helpers.ts:252`, `updateExistingSession`)
  - `SESSION_REGISTER` → `'idle'` (`session-utils.ts`, `registerSpawnedSession`)
  - `AGENT_END` / `AGENT_STOP` / `SESSION_STOP` → `'complete'` | `'error'` (`endSession.ts`)
- Wire-type → action map in `useAgentEvents.ts:233–261` (`dispatchLifecycleEvent`):
  `session_start`/`agent_start` → AGENT_START; `agent_end`/`agent_stop`/`session_stop` → AGENT_END.
- **`running` absorbs "thinking".** There is no wire event that signals a thinking phase. `running`
  covers the whole `agent_start`→`agent_end` span. The only mid-session granularity is per-tool-call
  `status: 'pending' | 'success' | 'error'` on `ToolCallEvent` (`types.ts:92`).
- Deferred-end: when child subagents are still live, the parent stays `'running'` with a stored
  `pendingEnd` until the last child finishes — no intermediate status (`endSession.ts`).
- **Divergence:** the reconciliation doc's `awaiting`/`errored` states **do not exist** in the live
  enum. `awaiting` (permission pending) is a mock-only concept (`MockSession.status: 'warn'`,
  `workbenchMockData.rails.ts:48`) with no `AgentSession` backing — it must be derived from
  `AgentSession.permissionEvents`.

## 2. Event envelope + wire types

- Authoritative type: `src/renderer/types/electron-agent-events.d.ts`. **`AgentEventType`**
  (`:1–30`) is a **29-member** union (recon doc said ~28):
  `session_start, session_end, session_stop, stop_failure, setup, pre_tool_use, post_tool_use,
  post_tool_use_failure, agent_start, agent_end, agent_stop, teammate_idle, task_created,
  task_completed, user_prompt_submit, elicitation, elicitation_result, notification, cwd_changed,
  file_changed, worktree_create, worktree_remove, config_change, pre_compact, post_compact,
  instructions_loaded, permission_request, permission_denied, diff_review_ready`.
- **Envelope (`HookPayload`)** at `electron-agent-events.d.ts:56–77`: `{ type, sessionId, timestamp }`
  always present; optional `toolName, toolCallId, input, output, prompt, error, parentSessionId,
  usage, model, requestId, cwd, internal, ideSpawned, costUsd, parentToolCallId, taskLabel, data`.
- **`transcript_path` is absent** from the envelope (confirmed). Wave 3 does NOT plumb it (ADR D2).
- **Two `HookPayload` defs in flight:** `electron-agent-events.d.ts:56` (canonical, used by preload +
  `useAgentEvents.ts` via the `../types/electron` barrel) and a legacy near-identical one at
  `AgentMonitor/types.ts:121` (adds `external?`). Functionally identical for Wave 3; note the drift.

## 3. The Agent Globe

- **File:** `src/renderer/components/Workbench/TitleBar/AgentGlobe.tsx`. **Mock-driven.**
- Imports `MOCK_CONTEXT_STATS`, `MOCK_HOOK_EVENTS` (`:16–17`); reads model/tool/target/duration
  directly from those constants at `:191–195`. Only prop: `state?: 'running' | 'idle'` (`GlobeState`).
- `TitleBar.tsx:196` wires it hardcoded: `<AgentGlobe state="running" />`.
- Workbench `CLAUDE.md` already annotates `AgentGlobe.tsx` with "`awaiting` / `errored` — Wave 3".

## 4. workbenchMockData — shapes are canon-idealized, NOT wire-matching

- Files: `workbenchMockData.ts` (barrel re-export `:1–61`), `.rails.ts` (Projects/Sessions/Branch/
  FileTree/TerminalTabs), `.sidebar.ts` (HookEvents/FilesTouched/DiffHunk/ContextStats/NowToolCall/
  TerminalLines/StatusBar).
- The barrel comment (`workbenchMockData.ts:4–9`) *claims* the shapes match canon §11 "so Wave 3 can
  swap the data source without changing component contracts" — **aspirational, not technically true.**
  Concrete adapter gaps:
  1. `MockSession.status = 'live'|'warn'|'idle'` (`rails.ts:49`) ≠ live `'idle'|'running'|'complete'|'error'`.
     `'warn'` requires inspecting `AgentSession.permissionEvents`. **Adapter required.**
  2. `MockHookEvent` (`'prompt'|'tool'|'think'`) ≠ live: live splits `ToolCallEvent[]` and
     `ConversationTurn[]` on `AgentSession`. `MockThinkEvent` ('think') has **no live equivalent**.
  3. `MockContextStats` (usedTokens/maxTokens/costUsd/model/elapsedSec) — no single live object;
     derive from `AgentSession.inputTokens + outputTokens`, `costUsd`, `model`, `startedAt`.
  4. `MockNowToolCall` (tool/target/description/elapsedSec/progress) ≈ `ToolCallEvent` but
     `description`/`progress`/`elapsedSec` are mock-only.
  5. `MockFileTouched` (path/adds/dels/status) — **no live backing**; must scan `toolCalls` for
     Edit/Write/Read. (Wave 4.)
- **Verdict:** every region needs an adapter `AgentSession[] → mock shape`. The mock interfaces are
  the adapter's *output contract* — keep them.

## 5. Region mock-consumption points (swap sites)

| Region | File | Mock import |
|---|---|---|
| TitleBar (outer) | `TitleBar/TitleBar.tsx:17` | `MOCK_PROJECTS` |
| Agent Globe | `TitleBar/AgentGlobe.tsx:16` | `MOCK_CONTEXT_STATS, MOCK_HOOK_EVENTS` |
| ProjectRail | `Rails/ProjectRail.tsx:18` | `MOCK_PROJECTS` |
| InnerRail | `Rails/InnerRail.tsx:19–25` | `MOCK_BRANCH, MOCK_FILE_TREE, MOCK_PROJECTS, MOCK_SESSIONS` |
| AgentSidebar (header) | `AgentSidebar/AgentSidebar.tsx:15` | `MOCK_SESSIONS` |
| NowBlock | `AgentSidebar/NowBlock.tsx` | `MOCK_NOW_TOOL_CALL` (Wave 4) |
| ContextBlock | `AgentSidebar/ContextBlock.tsx` | `MOCK_CONTEXT_STATS` (Wave 4) |
| FilesTouched | `AgentSidebar/FilesTouched.tsx` | `MOCK_FILES_TOUCHED` (Wave 4) |
| LatestHunk | `AgentSidebar/LatestHunk.tsx` | `MOCK_DIFF_HUNK_META` (Wave 4) |
| HookTimeline | `AgentSidebar/HookTimeline.tsx` | `MOCK_HOOK_EVENTS` (Wave 4) |
| StatusBar | `StatusBar.tsx:15` | `MOCK_BRANCH, MOCK_CONTEXT_STATS, MOCK_STATUS_BAR` |

Projects (`MOCK_PROJECTS`) are NOT agent data — live source is `ProjectContext` / `useWorkbenchProjects`
(Wave 99). Branch (`MOCK_BRANCH`) is git, not agent data — confirm the existing git-status source feeding
the real `Layout/StatusBar.tsx`'s dead `gitBranch` prop ("Wave 82.1 — not yet rendered", reconciliation §10).

## 6. Dead terminal-line mock constants (Wave 2 orphans — sweep in Wave 3)

In `workbenchMockData.sidebar.ts`: `MOCK_CC_TUI_LINES` (:317), `MOCK_SHELL_LINES` (:339),
`MOCK_CC_STATUS_LINE` (:310), `MOCK_CC_PROMPT_PLACEHOLDER` (:314), type `MockTerminalLine` (:120),
type `TermLineTone` (:111). In `.rails.ts`: `MOCK_TERM_TABS_UPPER` (:150), `MOCK_TERM_TABS_LOWER` (:162),
type `MockTerminalTab` (:21). All re-exported through `workbenchMockData.ts:27–31` (types) + `:50–61`
(values) — trim the barrel too. Tracked: `roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md`.

## 7. Live AgentEventsContext consumption pattern

- Provider: `<AgentEventsProvider>` at `App.tsx:41`, above `ApprovalProvider` → `ProjectProvider` →
  `InnerApp` (which mounts the Workbench). **Always above the Workbench branch — no re-mount concern.**
- `UseAgentEventsReturn` (`useAgentEvents.ts:41–51`): `agents: AgentSession[]`, `activeCount` (running),
  `currentSessions` (running + idle, `filter(isLiveSession)`), `historicalSessions` (complete | error),
  `clearCompleted`, `dismiss`, `updateNotes`, `registerChatSession`.
- Representative consumers: `AgentMonitor/AgentMonitorManager.tsx:3,124` and
  `SubagentPanelHost.tsx:213` both `useAgentEventsContext()`.
- **Pattern for Wave 3:** a workbench adapter hook calls `useAgentEventsContext()`, selects a primary
  session, derives the canon shapes. Globe/header use the primary session; InnerRail iterates
  `currentSessions`; context stats derive from the primary session's token/cost fields.

## Open questions resolved at plan time (now ADR decisions)

1. AgentStatus extension → **workbench-local derived presentation state** (ADR D1), not mutating the
   canonical enum.
2. Primary-session selection for Globe/header → **most-recently-active running session; idle/fresh when
   none** (ADR D4).
3. HookTimeline / NowBlock / FilesTouched / LatestHunk / ContextBlock live data → **Wave 4** (panel bodies
   stay mock this wave; ADR D5).
4. Git branch source for StatusBar → confirm the existing git-status hook/prop at Phase 2 (files-to-read).
