/**
 * RightSidebarTabs.tsx — Right sidebar panel.
 *
 * Wave 100: Chat removed. Monitor is the default view.
 * Chat tab, draft tabs, chat history panel, compare providers all removed.
 * IDE shell redesign deferred to a future wave.
 *
 * Sub-modules:
 *   RightSidebarTabs.icons.tsx  — SVG icons
 *   RightSidebarTabs.panels.tsx — ViewSwitcherDropdown, SecondaryViewHeader
 */

import React, { memo, useCallback, useEffect, useState } from 'react';

import { useMobileLayout } from '../../contexts/MobileLayoutContext';
import {
  OPEN_AWESOME_REF_EVENT,
  OPEN_DISPATCH_EVENT,
} from '../../hooks/appEventNames';
import { useViewportBreakpoint } from '../../hooks/useViewportBreakpoint';
import { AwesomeRefPanel } from '../AwesomeRef/AwesomeRefPanel';
import { MobileBottomSheet } from './MobileBottomSheet';
import { SecondaryViewHeader } from './RightSidebarTabs.panels';

export type RightSidebarView =
  | 'monitor'
  | 'git'
  | 'analytics'
  | 'memory'
  | 'rules'
  | 'dispatch';

export interface RightSidebarTabsProps {
  chatContent?: React.ReactNode;
  monitorContent: React.ReactNode;
  gitContent: React.ReactNode;
  analyticsContent?: React.ReactNode;
  memoryContent?: React.ReactNode;
  rulesContent?: React.ReactNode;
  dispatchContent?: React.ReactNode;
  showDispatch?: boolean;
  threads?: undefined;
  activeThreadId?: undefined;
  onSelectThread?: undefined;
  onDeleteThread?: undefined;
  onNewChat?: undefined;
  /** Kept for API compatibility — unused in Wave 100+. */
  projectPath?: string;
  /** Kept for API compatibility — unused in Wave 100+. */
  multiProvider?: boolean;
}

// ── Focus hook ────────────────────────────────────────────────────────────────

function useAgentChatViewFocus(
  setActiveView: React.Dispatch<React.SetStateAction<RightSidebarView>>,
): void {
  useEffect(() => {
    function openDispatch(): void {
      setActiveView('dispatch');
    }
    window.addEventListener(OPEN_DISPATCH_EVENT, openDispatch);
    return () => {
      window.removeEventListener(OPEN_DISPATCH_EVENT, openDispatch);
    };
  }, [setActiveView]);
}

// ── Awesome Ouroboros panel ───────────────────────────────────────────────────

function useAwesomeRefPanel() {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    function handleOpen(): void {
      setIsOpen(true);
    }
    window.addEventListener(OPEN_AWESOME_REF_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_AWESOME_REF_EVENT, handleOpen);
  }, []);
  return { isOpen, close: () => setIsOpen(false) };
}

// ── RightSidebarTabs ──────────────────────────────────────────────────────────

const VIEW_LABELS: Record<RightSidebarView, string> = { monitor: 'Monitor', git: 'Git Status', analytics: 'Analytics', memory: 'Memory', rules: 'Claude Config', dispatch: 'Dispatch' };

function useSidebarPanelState() {
  const [activeView, setActiveView] = useState<RightSidebarView>('monitor');
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const toggleViewDropdown = useCallback(() => {
    setViewDropdownOpen((p) => !p);
  }, []);
  const switchView = useCallback((view: RightSidebarView) => {
    setActiveView(view);
    setViewDropdownOpen(false);
  }, []);
  return {
    activeView,
    setActiveView,
    viewDropdownOpen,
    toggleViewDropdown,
    switchView,
  };
}

const ALL_VIEWS: RightSidebarView[] = ['monitor', 'git', 'analytics', 'memory', 'rules', 'dispatch'];

interface SidebarContentAreaProps {
  activeView: RightSidebarView;
  viewContent: Record<RightSidebarView, React.ReactNode>;
}

function SidebarContentArea({ activeView, viewContent }: SidebarContentAreaProps): React.ReactElement {
  return (
    <div className="flex-1 min-h-0 overflow-hidden relative">
      {ALL_VIEWS.map((view) => (
        <div key={view} className="h-full overflow-hidden" style={{ display: activeView === view ? undefined : 'none' }}>
          {viewContent[view]}
        </div>
      ))}
    </div>
  );
}

// ── Phone bottom sheet for secondary views ────────────────────────────────────

const SHEET_VIEW_LABELS: Record<string, string> = {
  monitor: 'Monitor',
  git: 'Git Status',
  analytics: 'Analytics',
  memory: 'Memory',
  rules: 'Claude Config',
  dispatch: 'Dispatch',
};

function MobileSecondarySheet({
  viewContent,
}: {
  viewContent: Record<RightSidebarView, React.ReactNode>;
}): React.ReactElement | null {
  const { isSheetOpen, activeSheetView, closeSheet } = useMobileLayout();
  const view = (activeSheetView ?? 'monitor') as RightSidebarView;
  const label = SHEET_VIEW_LABELS[view] ?? 'Views';
  return (
    <MobileBottomSheet isOpen={isSheetOpen} onClose={closeSheet} ariaLabel={label}>
      {viewContent[view]}
    </MobileBottomSheet>
  );
}

function buildViewContent(props: RightSidebarTabsProps): Record<RightSidebarView, React.ReactNode> {
  const { monitorContent, gitContent, analyticsContent, memoryContent, rulesContent, dispatchContent } = props;
  return { monitor: monitorContent, git: gitContent, analytics: analyticsContent ?? null, memory: memoryContent ?? null, rules: rulesContent ?? null, dispatch: dispatchContent ?? null };
}

export const RightSidebarTabs = memo(function RightSidebarTabs(props: RightSidebarTabsProps): React.ReactElement {
  const { showDispatch = false } = props;
  const { activeView, setActiveView, switchView } = useSidebarPanelState();
  const isPhone = useViewportBreakpoint() === 'phone';
  useAgentChatViewFocus(setActiveView);
  const awesomePanel = useAwesomeRefPanel();
  const viewContent = buildViewContent(props);
  const handleBackToChat = useCallback(() => { switchView('monitor'); }, [switchView]);

  void showDispatch;

  return (
    <div data-tour-anchor="sessions" className="flex flex-col h-full overflow-hidden">
      <SecondaryViewHeader label={VIEW_LABELS[activeView]} onBackToChat={handleBackToChat} />
      <SidebarContentArea activeView={activeView} viewContent={viewContent} />
      {isPhone && <MobileSecondarySheet viewContent={viewContent} />}
      <AwesomeRefPanel isOpen={awesomePanel.isOpen} onClose={awesomePanel.close} />
    </div>
  );
});
