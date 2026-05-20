/**
 * AgentCompletionIndicatorsContext.tsx — Wave 99 Phase 4
 *
 * Mounts useAgentCompletionIndicators ONCE at the ChatWorkbenchBody level and
 * exposes the result to all descendants (outer rail, inner-sidebar terminals,
 * dock tab strip) so viewed-state is shared across surfaces.
 *
 * ADR 5 rationale: in-memory only; no persistence. If two surfaces mounted the
 * hook separately, their lastViewedAt watermarks would diverge — focusing a dock
 * tab would NOT clear the inner-rail dot for the same session. One shared
 * instance fixes that.
 */

import React, { createContext, useContext, useMemo } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import type { AgentCompletionIndicators } from '../../../hooks/useAgentCompletionIndicators';
import { useAgentCompletionIndicators } from '../../../hooks/useAgentCompletionIndicators';
import { useConfig } from '../../../hooks/useConfig';

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

// ── Provider ───────────────────────────────────────────────────────────────────

interface AgentCompletionIndicatorsProviderProps {
  children: React.ReactNode;
}

export function AgentCompletionIndicatorsProvider({
  children,
}: AgentCompletionIndicatorsProviderProps): React.ReactElement {
  const projects = useWorkbenchProjectsLocal();
  const indicators = useAgentCompletionIndicators(projects);
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
