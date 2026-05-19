import React from 'react';

import { OPEN_SUBAGENT_PANEL_EVENT } from '../../../hooks/appEventNames';
import type { ChatWorkbenchUtilityTab } from './useChatWorkbenchLayout';

interface UtilityTrigger {
  key: string;
  tab: ChatWorkbenchUtilityTab;
}

export interface UseWorkbenchSurfacePolicyOptions {
  approvalCount: number;
  setUtilityOpen: (open: boolean) => void;
  setActiveUtilityTab: (tab: ChatWorkbenchUtilityTab) => void;
}

export interface UseWorkbenchSurfacePolicyResult {
  closeUtility: () => void;
}

interface UtilityCallbacksResult {
  openUtility: (trigger: UtilityTrigger) => void;
  closeUtility: () => void;
}

function useUtilityCallbacks(
  setUtilityOpen: (open: boolean) => void,
  setActiveUtilityTab: (tab: ChatWorkbenchUtilityTab) => void,
): UtilityCallbacksResult {
  const dismissedKeysRef = React.useRef(new Set<string>());
  const currentKeyRef = React.useRef<string | null>(null);

  const openUtility = React.useCallback(
    (trigger: UtilityTrigger) => {
      currentKeyRef.current = trigger.key;
      if (dismissedKeysRef.current.has(trigger.key)) return;
      setUtilityOpen(true);
      setActiveUtilityTab(trigger.tab);
    },
    [setActiveUtilityTab, setUtilityOpen],
  );

  const closeUtility = React.useCallback(() => {
    const key = currentKeyRef.current;
    if (key) dismissedKeysRef.current.add(key);
    setUtilityOpen(false);
  }, [setUtilityOpen]);

  return { openUtility, closeUtility };
}

function useUtilityEffects(
  approvalCount: number,
  openUtility: (trigger: UtilityTrigger) => void,
): void {
  React.useEffect(() => {
    if (approvalCount <= 0) return;
    openUtility({ key: `approvals:${approvalCount}`, tab: 'approvals' });
  }, [approvalCount, openUtility]);

  React.useEffect(() => {
    const handleSubagentOpen = (event: Event): void => {
      const detail = (event as CustomEvent<{ toolCallId?: string }>).detail;
      openUtility({ key: `monitor:${detail?.toolCallId ?? 'unknown'}`, tab: 'monitor' });
    };
    window.addEventListener(OPEN_SUBAGENT_PANEL_EVENT, handleSubagentOpen);
    return () => {
      window.removeEventListener(OPEN_SUBAGENT_PANEL_EVENT, handleSubagentOpen);
    };
  }, [openUtility]);
}

export function useWorkbenchSurfacePolicy({
  approvalCount,
  setUtilityOpen,
  setActiveUtilityTab,
}: UseWorkbenchSurfacePolicyOptions): UseWorkbenchSurfacePolicyResult {
  const { openUtility, closeUtility } = useUtilityCallbacks(setUtilityOpen, setActiveUtilityTab);

  useUtilityEffects(approvalCount, openUtility);

  return { closeUtility };
}
