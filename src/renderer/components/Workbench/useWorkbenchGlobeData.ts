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
 *   - When a paneId is resolved but no session with that paneId exists yet (tab spawned
 *     but claude not started), the hook also falls back to global selection.
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

function deriveState(session: AgentSession | null): WorkbenchAgentState {
  if (!session || session.status === 'idle') return 'fresh';
  if (session.status === 'error') return 'errored';
  if (session.status === 'complete') return 'done';
  const perms = session.permissionEvents ?? [];
  if (perms.length > 0 && perms[perms.length - 1].type === 'request') return 'awaiting';
  return session.toolCalls.some((tc) => tc.status === 'pending') ? 'running' : 'thinking';
}

function deriveActiveTool(session: AgentSession | null): string {
  if (!session) return '';
  const pending = session.toolCalls.find((tc) => tc.status === 'pending');
  return pending?.toolName ?? session.toolCalls.at(-1)?.toolName ?? '';
}

function deriveTarget(session: AgentSession | null): string {
  if (!session) return '';
  const pending = session.toolCalls.find((tc) => tc.status === 'pending');
  const ref = pending ?? session.toolCalls.at(-1);
  return ref?.input ?? '';
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
 * Fallback path (paneId null — outside provider OR paneId resolved but no matching
 * session yet — tab spawned, claude not started): falls back to selectPrimarySession
 * (global most-recently-active, internal excluded) so the globe degrades gracefully
 * rather than going blank.
 */
export function useWorkbenchGlobeData(): WorkbenchGlobeData {
  const { agents } = useAgentEventsContext();
  const paneId = useGlobePaneId();

  // Pane-aware lookup: find the session whose paneId matches the active tab.
  const paneSession = paneId != null ? resolveByPaneId(agents, paneId) : null;

  // Graceful degrade: fall back to global selection when no pane-matched session.
  const effective = paneSession ?? selectPrimarySession(agents);

  return buildGlobeData(effective);
}
