/**
 * useWorkbenchAgentData — Workbench-local agent adapter (Wave 3, Phase 1).
 *
 * Consumes `useAgentEventsContext()` (the live pipeline shared with AgentMonitor)
 * and derives a workbench-local presentation state + canon-shaped display fields.
 *
 * Key design decisions (ADR D1–D4):
 *   D1 — WorkbenchAgentState is separate from the canonical AgentStatus; do NOT
 *        extend AgentMonitor/types.ts.
 *   D3 — This hook is the single adapter; mock interfaces are its output contract.
 *   D4 — Primary session = most-recently-active across all sessions; null when empty.
 */

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';

// ── Presentation state ────────────────────────────────────────────────────────

export type WorkbenchAgentState =
  | 'fresh'
  | 'thinking'
  | 'running'
  | 'awaiting'
  | 'errored'
  | 'done';

// ── Adapter output ────────────────────────────────────────────────────────────

export interface WorkbenchAgentData {
  state: WorkbenchAgentState;
  model: string;
  activeTool: string;
  target: string;
  elapsedSec: number;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns the "last activity" timestamp for a session (used for primary selection). */
function lastActivityOf(session: AgentSession): number {
  const toolTs = session.toolCalls.reduce(
    (max, tc) => (tc.timestamp > max ? tc.timestamp : max),
    0,
  );
  return Math.max(session.completedAt ?? 0, toolTs, session.startedAt);
}

/**
 * Picks the primary session using a two-tier rule (ADR D4):
 *   Tier 1 — if any session is running, pick the most-recently-active running one.
 *   Tier 2 — otherwise, pick the most-recently-active session from the full list.
 * Returns null only when the list is empty.
 */
export function selectPrimarySession(sessions: AgentSession[]): AgentSession | null {
  if (sessions.length === 0) return null;
  const running = sessions.filter((s) => s.status === 'running');
  const pool = running.length > 0 ? running : sessions;
  return pool.reduce((best, s) =>
    lastActivityOf(s) > lastActivityOf(best) ? s : best,
  );
}

/**
 * Derives the six-state workbench presentation state from a single session.
 *
 * Derivation (in precedence order for the 'running' status):
 *   null | 'idle'    → 'fresh'
 *   'error'          → 'errored'
 *   'complete'       → 'done'
 *   'running' + latest permissionEvent.type === 'request' → 'awaiting'  (checked first)
 *   'running' + a pending toolCall                        → 'running'
 *   'running' (no pending toolCall)                       → 'thinking'
 */
export function deriveWorkbenchAgentState(
  session: AgentSession | null,
): WorkbenchAgentState {
  if (!session || session.status === 'idle') return 'fresh';
  if (session.status === 'error') return 'errored';
  if (session.status === 'complete') return 'done';

  // status === 'running' from here on
  const perms = session.permissionEvents ?? [];
  if (perms.length > 0 && perms[perms.length - 1].type === 'request') {
    return 'awaiting';
  }
  const hasPendingTool = session.toolCalls.some((tc) => tc.status === 'pending');
  return hasPendingTool ? 'running' : 'thinking';
}

// ── Display-field derivation ──────────────────────────────────────────────────

const FALLBACK_MODEL = 'claude';

function deriveModel(session: AgentSession | null): string {
  return session?.model ?? FALLBACK_MODEL;
}

function deriveActiveTool(session: AgentSession | null): string {
  if (!session) return '';
  const pending = session.toolCalls.find((tc) => tc.status === 'pending');
  if (pending) return pending.toolName;
  const last = session.toolCalls.at(-1);
  return last?.toolName ?? '';
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkbenchAgentData(): WorkbenchAgentData {
  const { agents } = useAgentEventsContext();
  const primary = selectPrimarySession(agents);
  const state = deriveWorkbenchAgentState(primary);
  return {
    state,
    model: deriveModel(primary),
    activeTool: deriveActiveTool(primary),
    target: deriveTarget(primary),
    elapsedSec: deriveElapsedSec(primary),
  };
}
