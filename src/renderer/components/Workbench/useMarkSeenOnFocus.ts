/**
 * useMarkSeenOnFocus — side-effect hook that marks sessions as "seen" when
 * their terminal tab is focused in either workbench frame.
 *
 * Called ONCE from WorkbenchStage (inside AgentEventsProvider and
 * ProjectNotificationStoreProvider) so the effect fires regardless of whether
 * the dual or unified rail is active.
 *
 * Re-runs when agents finish a turn while the user already has the session
 * focused — no dot for a watched session.
 */

import { useEffect } from 'react';

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import { useWorkbenchTabsContextSafe } from './Terminals/WorkbenchTabsProvider';
import { deriveCurrentNotificationKey, useProjectNotificationStore } from './useProjectNotificationStore';

export function useMarkSeenOnFocus(): void {
  const { agents } = useAgentEventsContext();
  const { markSeen } = useProjectNotificationStore();
  const upperCtx = useWorkbenchTabsContextSafe('upper');
  const lowerCtx = useWorkbenchTabsContextSafe('lower');

  const upperActiveId = upperCtx?.activeTabId ?? null;
  const lowerActiveId = lowerCtx?.activeTabId ?? null;

  useEffect(() => {
    const activePaneIds = new Set<string>();
    if (upperActiveId) activePaneIds.add(upperActiveId);
    if (lowerActiveId) activePaneIds.add(lowerActiveId);

    for (const session of agents) {
      if (session.paneId && activePaneIds.has(session.paneId)) {
        const key = deriveCurrentNotificationKey(session);
        if (key !== null) {
          markSeen(session.id, key);
        }
      }
    }
  }, [upperActiveId, lowerActiveId, agents, markSeen]);
}
