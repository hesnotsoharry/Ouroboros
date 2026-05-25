/**
 * useWorkbenchGlobeData — global primary-session adapter for the AgentGlobe.
 *
 * Unlike `useWorkbenchAgentData(paneId)`, which is pane-scoped and returns
 * D4 empty state when no matching session exists, this hook uses
 * `selectPrimarySession` to pick the most-recently-active session across ALL
 * sessions — the Wave 3 globe contract (global workbench state indicator).
 *
 * Wave 13 Phase 2.6: extracted to its own module so that tests mocking
 * `useWorkbenchAgentData` (paneIdBinding.acceptance.test.tsx) do not inadvertently
 * break AgentGlobe, which needs the global contract rather than the pane-scoped one.
 *
 * Intentionally self-contained — no imports from useWorkbenchAgentData — so that a
 * vi.mock('../useWorkbenchAgentData', ...) in test code cannot affect this module.
 *
 * The AgentGlobe acceptance test mocks useAgentEventsContext; this hook routes through
 * the same boundary so the existing test mock continues to work.
 */

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';

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

function selectPrimarySession(sessions: AgentSession[]): AgentSession | null {
  if (sessions.length === 0) return null;
  const running = sessions.filter((s) => s.status === 'running');
  const pool = running.length > 0 ? running : sessions;
  return pool.reduce((best, s) => (lastActivityOf(s) > lastActivityOf(best) ? s : best));
}

function deriveWorkbenchAgentState(session: AgentSession | null): WorkbenchAgentState {
  if (!session || session.status === 'idle') return 'fresh';
  if (session.status === 'error') return 'errored';
  if (session.status === 'complete') return 'done';
  const perms = session.permissionEvents ?? [];
  if (perms.length > 0 && perms[perms.length - 1].type === 'request') {
    return 'awaiting';
  }
  const hasPendingTool = session.toolCalls.some((tc) => tc.status === 'pending');
  return hasPendingTool ? 'running' : 'thinking';
}

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

export interface WorkbenchGlobeData {
  state: WorkbenchAgentState;
  model: string;
  activeTool: string;
  target: string;
  elapsedSec: number;
}

export function useWorkbenchGlobeData(): WorkbenchGlobeData {
  const { agents } = useAgentEventsContext();
  const primary = selectPrimarySession(agents);
  const activeTool = deriveActiveTool(primary);
  const target = deriveTarget(primary);
  const elapsedSec = deriveElapsedSec(primary);
  return {
    state: deriveWorkbenchAgentState(primary),
    model: deriveModel(primary),
    activeTool,
    target,
    elapsedSec,
  };
}
