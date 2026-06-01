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
import { useWorkbenchTabsContextSafe } from './Terminals/WorkbenchTabsProvider';
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

/**
 * Returns true when the session has received any activity that indicates a
 * turn is (or was) in progress: at least one conversation turn OR at least
 * one tool call. A freshly-spawned session that has NEVER been prompted has
 * neither — it is idle/ready and MUST NOT be classified as working (Bug D fix).
 */
function hasActivity(s: AgentSession): boolean {
  return (s.conversationTurns?.length ?? 0) > 0 || s.toolCalls.length > 0;
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
 *
 * @param openPaneIds - Set of currently-open tab pane ids (from WorkbenchTabsProvider).
 *   When non-empty, sessions whose paneId is NOT in this set are excluded from the
 *   working count so closed-tab sessions don't keep the working border alive (Bug E fix).
 *   Pass an empty set (default) when tab context is unavailable — falls back to the
 *   pre-fix behaviour (all project sessions counted).
 */
export function deriveProjectStatus(
  sessions: AgentSession[],
  projectPath: string,
  seenKeys: ReadonlyMap<string, SeenKey>,
  openPaneIds: ReadonlySet<string> = new Set(),
): ProjectAgentStatusSummary {
  const projectBasename = basename(projectPath);
  const ps = sessions.filter((s) => isProjectSession(s, projectBasename));

  const asking = ps.filter((s) => isAsking(s));

  // A session is "working" only when:
  //   - it has no pending AskUserQuestion (those go into the asking bucket),
  //   - its current turn has not ended yet (lastTurnEndedAt === undefined),
  //   - it has received at least one conversation turn or tool call (hasActivity),
  //     so freshly-spawned sessions are not misclassified as working (Bug D fix),
  //   - its pane is still open (openPaneIds check) so closed-tab sessions are
  //     excluded from the working count (Bug E fix; skipped when no pane info).
  const working = ps.filter((s) => {
    if (isAsking(s)) return false;
    if (s.lastTurnEndedAt !== undefined) return false;
    if (!hasActivity(s)) return false;
    if (openPaneIds.size > 0 && s.paneId !== undefined && !openPaneIds.has(s.paneId)) return false;
    return true;
  });

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
 * Single useMemo over [agents, projects, seenKeys, openPaneIds].
 *
 * Derives the live open-pane id set from both workbench frames so closed-tab
 * sessions are excluded from working counts (Bug E fix). Safe: returns an empty
 * status map when AgentEventsContext is absent (e.g. isolated component tests that
 * render ProjectRail/UnifiedRail without providers).
 */
export function useAllProjectAgentStatus(
  projects: WorkbenchProject[],
  seenKeys: ReadonlyMap<string, SeenKey>,
): Map<string, ProjectAgentStatusSummary> {
  const { agents } = useAgentEventsContext();
  const upperCtx = useWorkbenchTabsContextSafe('upper');
  const lowerCtx = useWorkbenchTabsContextSafe('lower');

  return useMemo(() => {
    // Build the live pane-id set from both frames. When the provider is absent
    // (test isolation, cold boot) both contexts are null → set stays empty and
    // deriveProjectStatus falls back to the no-filter path.
    const openPaneIds = new Set<string>();
    for (const tab of upperCtx?.tabs ?? []) openPaneIds.add(tab.id);
    for (const tab of lowerCtx?.tabs ?? []) openPaneIds.add(tab.id);

    const map = new Map<string, ProjectAgentStatusSummary>();
    for (const project of projects) {
      map.set(project.path, deriveProjectStatus(agents, project.path, seenKeys, openPaneIds));
    }
    return map;
  }, [agents, projects, seenKeys, upperCtx, lowerCtx]);
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
