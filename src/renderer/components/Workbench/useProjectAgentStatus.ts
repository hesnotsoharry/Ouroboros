/**
 * useProjectAgentStatus — derives per-project agent notification status.
 *
 * Pure helpers (deriveProjectStatus, isAsking, pendingAskId) are exported for
 * unit testing. The React hooks (useAllProjectAgentStatus, useProjectAgentStatus)
 * consume AgentEventsContext.
 */

import { useMemo } from 'react';

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';
import type { SeenKey } from './useProjectNotificationStore';
import type { WorkbenchProject } from './useWorkbenchProjects';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChipBorderMode = 'working' | 'ready-green' | 'asking-yellow' | 'none';

export interface ProjectAgentStatusSummary {
  workingCount: number;
  unseenFinished: number;
  unseenAsking: number;
  borderMode: ChipBorderMode;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns true when the session has a pending AskUserQuestion tool call. */
export function isAsking(session: AgentSession): boolean {
  return session.toolCalls.some(
    (tc) => tc.toolName === 'AskUserQuestion' && tc.status === 'pending',
  );
}

/** Returns the toolCallId of the pending AskUserQuestion, or undefined. */
export function pendingAskId(session: AgentSession): string | undefined {
  return session.toolCalls.find(
    (tc) => tc.toolName === 'AskUserQuestion' && tc.status === 'pending',
  )?.id;
}

function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? filePath;
}

function isProjectSession(s: AgentSession, projectBasename: string): boolean {
  return s.status === 'running' && !s.internal && s.cwd !== undefined
    && basename(s.cwd) === projectBasename;
}

function deriveBorderMode(
  workingCount: number,
  unseenAskingCount: number,
  unseenFinishedCount: number,
): ChipBorderMode {
  if (workingCount > 0) return 'working';
  if (unseenAskingCount > 0) return 'asking-yellow';
  if (unseenFinishedCount > 0) return 'ready-green';
  return 'none';
}

/**
 * Pure derivation of project agent status.
 * Exported for unit testing — no React inside.
 *
 * Only considers status==='running', non-internal sessions.
 * Sessions matching projectPath by basename(session.cwd) === basename(projectPath).
 */
export function deriveProjectStatus(
  sessions: AgentSession[],
  projectPath: string,
  seenKeys: ReadonlyMap<string, SeenKey>,
): ProjectAgentStatusSummary {
  const projectBasename = basename(projectPath);
  const ps = sessions.filter((s) => isProjectSession(s, projectBasename));

  const asking = ps.filter((s) => isAsking(s));
  const working = ps.filter((s) => s.lastTurnEndedAt === undefined && !isAsking(s));
  const finished = ps.filter((s) => s.lastTurnEndedAt !== undefined && !isAsking(s));

  const unseenAsking = asking.filter((s) => seenKeys.get(s.id) !== `ask:${pendingAskId(s)}`);
  const unseenFinished = finished.filter((s) => seenKeys.get(s.id) !== `turn-end:${s.lastTurnEndedAt}`);

  const workingCount = working.length;
  return {
    workingCount,
    unseenFinished: unseenFinished.length,
    unseenAsking: unseenAsking.length,
    borderMode: deriveBorderMode(workingCount, unseenAsking.length, unseenFinished.length),
  };
}

// ── React hooks ───────────────────────────────────────────────────────────────

/**
 * Returns a Map<projectPath, ProjectAgentStatusSummary> for all given projects.
 * Single useMemo over [agents, projects, seenKeys].
 *
 * Safe: returns an empty status map when AgentEventsContext is absent (e.g.
 * isolated component tests that render ProjectRail/UnifiedRail without providers).
 */
export function useAllProjectAgentStatus(
  projects: WorkbenchProject[],
  seenKeys: ReadonlyMap<string, SeenKey>,
): Map<string, ProjectAgentStatusSummary> {
  const { agents } = useAgentEventsContext();

  return useMemo(() => {
    const map = new Map<string, ProjectAgentStatusSummary>();
    for (const project of projects) {
      map.set(project.path, deriveProjectStatus(agents, project.path, seenKeys));
    }
    return map;
  }, [agents, projects, seenKeys]);
}

/** Convenience single-project hook. */
export function useProjectAgentStatus(
  projectPath: string,
  seenKeys: ReadonlyMap<string, SeenKey>,
): ProjectAgentStatusSummary {
  const statusMap = useAllProjectAgentStatus(
    [{ path: projectPath, name: '', initial: '', color: '', active: false, exists: true }],
    seenKeys,
  );
  return (
    statusMap.get(projectPath) ?? {
      workingCount: 0,
      unseenFinished: 0,
      unseenAsking: 0,
      borderMode: 'none',
    }
  );
}
