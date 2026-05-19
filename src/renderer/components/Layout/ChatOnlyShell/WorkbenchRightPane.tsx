/**
 * WorkbenchRightPane — single right-side container for the utility drawer.
 * Used by the mobile overlay path (MobileRightPaneContent in ChatWorkbenchBody).
 *
 * Wave 95 Phase H continuation: artifact pane removed. The view-switcher and
 * artifact branch are gone; this component now renders the utility drawer only.
 */

import React from 'react';

import { ChatWorkbenchUtilityDrawer } from './ChatWorkbenchUtilityDrawer';
import type { ChatWorkbenchUtilityTab, RightPaneView } from './useChatWorkbenchLayout';

interface WorkbenchRightPaneProps {
  view: RightPaneView;
  activeUtilityTab: ChatWorkbenchUtilityTab;
  onSelectUtilityTab: (tab: ChatWorkbenchUtilityTab) => void;
  onSelectView: (view: RightPaneView) => void;
  onClose: () => void;
  activeProject: string | null;
}

function CloseIcon(): React.ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <line x1="2" y1="2" x2="10" y2="10" />
      <line x1="10" y1="2" x2="2" y2="10" />
    </svg>
  );
}

function RightPaneHeader({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <header
      className="flex shrink-0 items-center justify-between border-b border-border-semantic bg-surface-panel/95 px-2 py-1"
      data-testid="workbench-right-pane-header"
    >
      <span className="px-2 text-xs font-medium text-text-semantic-primary">Utility Drawer</span>
      <button
        type="button"
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center rounded text-text-semantic-muted transition-colors hover:bg-surface-hover hover:text-text-semantic-primary"
        title="Close pane"
        aria-label="Close pane"
        data-testid="workbench-right-pane-close"
      >
        <CloseIcon />
      </button>
    </header>
  );
}

export function WorkbenchRightPane({
  activeUtilityTab,
  onSelectUtilityTab,
  onClose,
  activeProject,
}: WorkbenchRightPaneProps): React.ReactElement {
  return (
    <aside
      className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-border-semantic bg-surface-base"
      data-testid="workbench-right-pane"
    >
      <RightPaneHeader onClose={onClose} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatWorkbenchUtilityDrawer
          activeTab={activeUtilityTab}
          onSelectTab={onSelectUtilityTab}
          onClose={onClose}
          activeProject={activeProject}
        />
      </div>
    </aside>
  );
}
