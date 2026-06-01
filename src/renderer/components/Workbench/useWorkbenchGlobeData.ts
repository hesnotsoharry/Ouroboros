/**
 * useWorkbenchGlobeData — pane-aware primary-session adapter for the AgentGlobe.
 *
 * Wave 13 pane-aware fix: the globe now derives the active pane id from the same
 * useActiveWorkbenchFrame → useWorkbenchTabsContextSafe → activeTab.id chain that
 * AgentSidebar uses, then resolves the primary session via paneId-keyed lookup.
 *
 * This eliminates the "globe locks onto the outer/ambient session" bug caused by the
 * old pane-unaware selectPrimarySession global scan.
 *
 * Degradation contract:
 *   - When the WorkbenchTabsProvider is not mounted (test isolation, cold boot before
 *     provider), paneId resolves to null. The hook falls back to selectPrimarySession
 *     (global most-recently-active, internal sessions excluded) so the globe still
 *     shows live state rather than going blank.
 *   - This fallback preserves the existing AgentGlobe.acceptance.test.tsx contract,
 *     which mocks only useAgentEventsContext and does not wrap in WorkbenchTabsProvider.
 *   - When a paneId is resolved but no session with that paneId exists (tab spawned
 *     but claude not started, or project just switched), the globe shows idle/empty —
 *     it does NOT fall back to selectPrimarySession (Bug 2 fix: that surfaced ambient
 *     outer sessions from the ~100-session pool).
 *
 * Intentionally does NOT import from useWorkbenchAgentData — that module is vi.mock'd
 * in paneIdBinding.acceptance.test.tsx without exporting resolvePrimary. Importing from
 * it would make useWorkbenchGlobeData crash under that mock. The globe derives its own
 * pane-id resolution locally (matching the Wave 13 Phase 2.5 paneId-keyed contract).
 */

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';
import { useWorkbenchTabsContextSafe } from './Terminals/WorkbenchTabsProvider';
import { useActiveWorkbenchFrame } from './useActiveWorkbenchFrame';

// ── Re-export type for consumers (AgentGlobe.tsx) ────────────────────────────

export type WorkbenchAgentState =
  | 'fresh'
  | 'ready'
  | 'thinking'
  | 'running'
  | 'awaiting'
  | 'errored'
  | 'done';

// ── Self-contained pure helpers ───────────────────────────────────────────────

function lastActivityOf(session: AgentSession): number {
  const toolTs = session.toolCalls.reduce(
    (max, tc) => (tc.timestamp > max ? tc.timestamp : max),
    0,
  );
  return Math.max(session.completedAt ?? 0, toolTs, session.startedAt);
}

/**
 * Global most-recently-active session selector.
 * Used as fallback when the globe is outside a WorkbenchTabsProvider or when
 * paneId found but no matching session exists yet. Excludes internal sessions
 * (IDE-spawned: usage poller, summariser, CLAUDE.md generator).
 */
export function selectPrimarySession(sessions: AgentSession[]): AgentSession | null {
  const visible = sessions.filter((s) => !s.internal);
  if (visible.length === 0) return null;
  const running = visible.filter((s) => s.status === 'running');
  const pool = running.length > 0 ? running : visible;
  return pool.reduce((best, s) => (lastActivityOf(s) > lastActivityOf(best) ? s : best));
}

/**
 * Pane-aware session lookup (Wave 13 paneId-keyed contract, mirrored from
 * useWorkbenchAgentData's resolvePrimary). Matches session.paneId (stamped from
 * AGENT_START hook payload's OUROBOROS_PANE_ID). Returns null when no match.
 * Intentionally duplicated here — useWorkbenchAgentData is vi.mock'd in the
 * paneIdBinding acceptance test without exporting this helper.
 */
function resolveByPaneId(agents: AgentSession[], paneId: string): AgentSession | null {
  return agents.find((s) => s.paneId === paneId) ?? null;
}

// ── Pane-id derivation ────────────────────────────────────────────────────────

/**
 * Returns the OUROBOROS_PANE_ID for the currently active workbench tab, or null
 * when called outside a WorkbenchTabsProvider (safe-default for test isolation).
 */
function useGlobePaneId(): string | null {
  const { activeFrame } = useActiveWorkbenchFrame();
  const tabs = useWorkbenchTabsContextSafe(activeFrame);
  if (!tabs) return null;
  const activeTab = tabs.tabs.find((t) => t.id === tabs.activeTabId);
  return activeTab?.id ?? null;
}

// ── Presentation-state derivation ─────────────────────────────────────────────

/**
 * Returns true when the session has received any activity that indicates a turn
 * is (or was) in progress: at least one conversation turn (user_prompt_submit /
 * elicitation arrived) OR at least one tool call (pre_tool_use arrived).
 *
 * A freshly-spawned session that has NEVER been prompted has neither — it is
 * idle/ready (not mid-turn) and must not be classified as 'thinking'.
 */
function hasActivity(session: AgentSession): boolean {
  return (session.conversationTurns?.length ?? 0) > 0 || session.toolCalls.length > 0;
}

/**
 * Resolves the non-active ("resting") states: terminal status, the confirmed
 * turn-end rest state, and the never-prompted spawned-idle state. Returns null
 * when the session is genuinely mid-turn (caller derives awaiting/running/thinking).
 */
function deriveRestingState(session: AgentSession): WorkbenchAgentState | null {
  if (session.status === 'idle') return 'fresh';
  if (session.status === 'error') return 'errored';
  if (session.status === 'complete') return 'done';
  // session_stop arrived: alive but resting between turns.
  if (session.lastTurnEndedAt !== undefined) return 'ready';
  // Never been prompted (zero turns, zero tool calls) — spawned but idle.
  // 'ready' → globe shows "Agent Ready" rather than the misleading 'thinking'
  // (Bug C fix: no turn is actually in progress yet).
  if (!hasActivity(session)) return 'ready';
  return null;
}

function deriveState(session: AgentSession | null): WorkbenchAgentState {
  if (!session) return 'fresh';
  const resting = deriveRestingState(session);
  if (resting) return resting;
  const perms = session.permissionEvents ?? [];
  if (perms.length > 0 && perms[perms.length - 1].type === 'request') return 'awaiting';
  // No turn-end signal but activity present — actively thinking ('thinking' is the
  // best-effort heuristic for running + no active tool; the wire has no signal).
  return session.toolCalls.some((tc) => tc.status === 'pending') ? 'running' : 'thinking';
}

/**
 * Returns the currently-executing tool name, or '' when nothing is pending.
 * Does NOT fall back to the last completed tool (that's history, not active).
 */
function deriveActiveTool(session: AgentSession | null): string {
  if (!session) return '';
  const pending = session.toolCalls.find((tc) => tc.status === 'pending');
  return pending?.toolName ?? '';
}

/**
 * Returns the input/target of the pending tool, or '' when idle.
 * Does NOT fall back to the last completed tool's input.
 */
function deriveTarget(session: AgentSession | null): string {
  if (!session) return '';
  const pending = session.toolCalls.find((tc) => tc.status === 'pending');
  return pending?.input ?? '';
}

function deriveElapsedSec(session: AgentSession | null): number {
  if (!session) return 0;
  return Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
}

function buildGlobeData(session: AgentSession | null): WorkbenchGlobeData {
  return {
    state: deriveState(session),
    model: session?.model ?? 'claude',
    activeTool: deriveActiveTool(session),
    target: deriveTarget(session),
    elapsedSec: deriveElapsedSec(session),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface WorkbenchGlobeData {
  state: WorkbenchAgentState;
  model: string;
  activeTool: string;
  target: string;
  elapsedSec: number;
}

/**
 * Pane-aware globe data hook.
 *
 * Primary path (inside WorkbenchTabsProvider): resolves paneId from the active tab
 * and looks up the matching session by session.paneId (Wave 13 paneId-keyed contract).
 * Reflects the same session as the AgentSidebar for the active pane.
 *
 * No-match path (paneId resolved but no session matches — tab spawned, claude not
 * started OR project just switched): shows idle/empty state. Does NOT fall back to
 * selectPrimarySession, which would surface an ambient/outer session (Bug 2 fix).
 *
 * Fallback path (paneId null — outside WorkbenchTabsProvider, e.g. test isolation or
 * cold boot before provider mounts): falls back to selectPrimarySession so the globe
 * shows live state rather than going blank when the provider is absent.
 */
export function useWorkbenchGlobeData(): WorkbenchGlobeData {
  const { agents } = useAgentEventsContext();
  const paneId = useGlobePaneId();

  let effective: AgentSession | null;
  if (paneId === null) {
    // Outside provider — use global fallback (test isolation / cold boot).
    effective = selectPrimarySession(agents);
  } else {
    // Provider present — only show the pane-matched session; never a global ambient pick.
    effective = resolveByPaneId(agents, paneId);
  }

  return buildGlobeData(effective);
}
