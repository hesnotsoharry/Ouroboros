import React from 'react';

import { AgentMonitorManager } from '../../AgentMonitor';
import type { ChatWorkbenchUtilityTab } from './useChatWorkbenchLayout';
import { useWorkbenchTimeline } from './useWorkbenchTimeline';
import { WorkbenchApprovalPanel } from './WorkbenchApprovalPanel';
import { WorkbenchTimelinePanel } from './WorkbenchTimelinePanel';

export interface ChatWorkbenchUtilityDrawerProps {
  activeTab: ChatWorkbenchUtilityTab;
  onSelectTab: (tab: ChatWorkbenchUtilityTab) => void;
  onClose: () => void;
}

function tabLabel(tab: ChatWorkbenchUtilityTab): string {
  if (tab === 'approvals') return 'Approvals';
  if (tab === 'monitor') return 'Monitor';
  return 'Timeline';
}

function useTabCounts(): Record<ChatWorkbenchUtilityTab, number> {
  const { counts } = useWorkbenchTimeline();
  return {
    approvals: counts.approvals,
    monitor: counts.monitor,
    activity: counts.activity,
  };
}

function TabButton({
  tab,
  activeTab,
  count,
  onSelect,
}: {
  tab: ChatWorkbenchUtilityTab;
  activeTab: ChatWorkbenchUtilityTab;
  count: number;
  onSelect: (tab: ChatWorkbenchUtilityTab) => void;
}): React.ReactElement {
  const active = tab === activeTab;
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? 'bg-surface-panel text-text-semantic-primary'
          : 'bg-transparent text-text-semantic-secondary hover:bg-surface-hover'
      }`}
      onClick={() => {
        onSelect(tab);
      }}
      data-testid={`chat-workbench-utility-tab-${tab}`}
    >
      <span>{tabLabel(tab)}</span>
      {count > 0 && (
        <span className="rounded-full bg-surface-panel px-1.5 py-0.5 text-[10px]">{count}</span>
      )}
    </button>
  );
}

function DrawerContent({
  activeTab,
}: {
  activeTab: ChatWorkbenchUtilityTab;
}): React.ReactElement {
  if (activeTab === 'approvals') return <WorkbenchApprovalPanel />;
  if (activeTab === 'monitor')
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AgentMonitorManager />
      </div>
    );
  return <WorkbenchTimelinePanel />;
}

interface DrawerHeaderProps {
  onClose: () => void;
}

function DrawerHeader({ onClose }: DrawerHeaderProps): React.ReactElement {
  return (
    <header className="flex items-center gap-2 border-b border-border-semantic px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-semantic-tertiary">
          Utility Drawer
        </div>
      </div>
      <button
        type="button"
        className="rounded border border-border-semantic bg-surface-panel px-2 py-1 text-xs text-text-semantic-secondary transition-colors hover:bg-surface-hover hover:text-text-semantic-primary"
        onClick={onClose}
        data-testid="chat-workbench-utility-close"
      >
        Close
      </button>
    </header>
  );
}

const DRAWER_TABS: ChatWorkbenchUtilityTab[] = ['activity', 'approvals', 'monitor'];

export function ChatWorkbenchUtilityDrawer({
  activeTab,
  onSelectTab,
  onClose,
}: ChatWorkbenchUtilityDrawerProps): React.ReactElement {
  const counts = useTabCounts();
  return (
    <aside
      // Wave 82.1 — added `min-h-0 flex-1 overflow-hidden` so the aside fills
      // its bounded parent (the wrapper div in WorkbenchRightPane has
      // `flex-1 min-h-0 overflow-hidden`). Without these, default flex
      // behaviour (`flex: 0 1 auto`) sized the aside to its content height,
      // which made the inner `TimelineGroupList`'s `overflow-y-auto` ineffective
      // (no bounded parent → no overflow → outer session list didn't scroll).
      className="flex min-h-0 w-[360px] flex-1 shrink-0 flex-col overflow-hidden border-l border-border-semantic bg-surface-overlay"
      data-testid="chat-workbench-utility-drawer"
    >
      <DrawerHeader onClose={onClose} />
      <div className="flex flex-wrap gap-2 border-b border-border-semantic-subtle px-3 py-2">
        {DRAWER_TABS.map((tab) => (
          <TabButton
            key={tab}
            tab={tab}
            activeTab={activeTab}
            count={counts[tab]}
            onSelect={onSelectTab}
          />
        ))}
      </div>
      <DrawerContent activeTab={activeTab} />
    </aside>
  );
}
