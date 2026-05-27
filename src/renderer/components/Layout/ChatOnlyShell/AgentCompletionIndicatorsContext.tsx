/**
 * AgentCompletionIndicatorsContext.tsx — Wave 99 Phase 4 / Wave 99 follow-up
 *
 * Mounts useAgentCompletionIndicators ONCE at the ChatWorkbenchBody level and
 * exposes the result to all descendants (outer rail, inner-sidebar terminals,
 * dock tab strip) so viewed-state is shared across surfaces.
 *
 * ADR 5 rationale: in-memory only; no persistence. If two surfaces mounted the
 * hook separately, their lastViewedAt watermarks would diverge — focusing a dock
 * tab would NOT clear the inner-rail dot for the same session. One shared
 * instance fixes that.
 *
 * Wave 99 follow-up: the Provider now also builds a sessionProjectMap
 * (claudeSessionId → projectRoot) via the terminal→SessionRecord join so that
 * terminal-launched sessions (which never set agent.cwd) light the outer
 * project rail dot correctly.
 */

import React, { createContext, useContext, useMemo } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useProjectTerminalsContext } from '../../../contexts/ProjectTerminalsContext';
import type { AgentCompletionIndicators } from '../../../hooks/useAgentCompletionIndicators';
import { useAgentCompletionIndicators } from '../../../hooks/useAgentCompletionIndicators';
import { useConfig } from '../../../hooks/useConfig';
import type { SessionRecord } from '../../../types/electron';
import { buildTerminalClaudeIdMap } from './AgentCompletionIndicators.helpers';

// ── Context ────────────────────────────────────────────────────────────────────

const AgentCompletionIndicatorsContext = createContext<AgentCompletionIndicators | null>(null);

// ── projects helper (mirrors useWorkbenchProjects in ChatWorkbenchBody.rails) ──

function useWorkbenchProjectsLocal(): string[] {
  const { projectRoots } = useProject();
  const { config } = useConfig();
  return useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const p of [...projectRoots, ...(config?.recentProjects ?? [])]) {
      if (p && !seen.has(p)) {
        seen.add(p);
        merged.push(p);
      }
    }
    return merged;
  }, [projectRoots, config?.recentProjects]);
}

// ── sessionProjectMap builder ──────────────────────────────────────────────────

/**
 * Build a map from claudeSessionId → projectRoot using the
 * terminal→SessionRecord join. This enables the project-level indicator
 * to light for terminal-launched agents that never set agent.cwd.
 *
 * Join path:
 *   TerminalSession.claudeSessionId
 *     → SessionRecord.activeTerminalIds (reverse lookup via terminalClaudeIdMap)
 *     → SessionRecord.projectRoot
 */
function buildSessionProjectMap(
  sessions: SessionRecord[],
  terminalClaudeIds: Map<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const session of sessions) {
    for (const terminalId of session.activeTerminalIds ?? []) {
      const claudeId = terminalClaudeIds.get(terminalId);
      if (claudeId) result[claudeId] = session.projectRoot;
    }
  }
  return result;
}

// ── Provider ───────────────────────────────────────────────────────────────────

interface AgentCompletionIndicatorsProviderProps {
  children: React.ReactNode;
  /** SessionRecord list from the workbench sessions state. */
  sessions: SessionRecord[];
}

export function AgentCompletionIndicatorsProvider({
  children,
  sessions,
}: AgentCompletionIndicatorsProviderProps): React.ReactElement {
  const projects = useWorkbenchProjectsLocal();
  const { primary, secondary } = useProjectTerminalsContext();

  const terminalClaudeIds = useMemo(
    () => buildTerminalClaudeIdMap([...primary.sessions, ...secondary.sessions]),
    [primary.sessions, secondary.sessions],
  );

  const sessionProjectMap = useMemo(
    () => buildSessionProjectMap(sessions, terminalClaudeIds),
    [sessions, terminalClaudeIds],
  );

  const indicators = useAgentCompletionIndicators(projects, sessionProjectMap);
  return (
    <AgentCompletionIndicatorsContext.Provider value={indicators}>
      {children}
    </AgentCompletionIndicatorsContext.Provider>
  );
}

// ── Consumer hook ──────────────────────────────────────────────────────────────

/**
 * Returns the shared AgentCompletionIndicators instance.
 * Must be used inside AgentCompletionIndicatorsProvider.
 */
export function useAgentCompletionIndicatorsContext(): AgentCompletionIndicators {
  const ctx = useContext(AgentCompletionIndicatorsContext);
  if (ctx === null) {
    throw new Error(
      'useAgentCompletionIndicatorsContext must be used inside AgentCompletionIndicatorsProvider',
    );
  }
  return ctx;
}
