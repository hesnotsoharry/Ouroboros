/**
 * ChatWorkbenchOverlays — Wave 89 Phase 3
 *
 * Renders the utility-drawer OverlayDrawer instance inside the chat-area's
 * positioned ancestor (which carries `relative`).
 *
 * Wave 95 Phase H continuation: the artifact pane overlay was removed entirely.
 * Diff review is exclusively accessed via ChatOnlyDiffOverlay (status-bar trigger).
 *
 * z-index: 200 (per OverlayDrawer primitive — between in-layout content and
 * full-screen modals).
 */

import React from 'react';

import { ChatWorkbenchUtilityDrawer } from './ChatWorkbenchUtilityDrawer';
import { OverlayDrawer } from './OverlayDrawer';
import type { ChatWorkbenchUtilityTab } from './useChatWorkbenchLayout';
import type { UseOverlayDrawerWidthsReturn } from './useOverlayDrawerWidths';

// ── Prop types ────────────────────────────────────────────────────────────────

export interface ChatWorkbenchOverlaysProps {
  utilityOpen: boolean;
  activeUtilityTab: ChatWorkbenchUtilityTab;
  onSelectUtilityTab: (tab: ChatWorkbenchUtilityTab) => void;
  onCloseUtility: () => void;
  activeProject: string | null;
  overlayWidths: UseOverlayDrawerWidthsReturn;
}

// ── Utility overlay ───────────────────────────────────────────────────────────

function UtilityOverlay({
  open,
  width,
  onWidthChange,
  onClose,
  activeTab,
  onSelectTab,
  activeProject,
}: {
  open: boolean;
  width: number;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  activeTab: ChatWorkbenchUtilityTab;
  onSelectTab: (tab: ChatWorkbenchUtilityTab) => void;
  activeProject: string | null;
}): React.ReactElement {
  return (
    <OverlayDrawer
      open={open}
      onClose={onClose}
      width={width}
      onWidthChange={onWidthChange}
      dataTestId="utility-overlay-drawer"
    >
      <ChatWorkbenchUtilityDrawer
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        onClose={onClose}
        activeProject={activeProject}
      />
    </OverlayDrawer>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ChatWorkbenchOverlays({
  utilityOpen,
  activeUtilityTab,
  onSelectUtilityTab,
  onCloseUtility,
  activeProject,
  overlayWidths,
}: ChatWorkbenchOverlaysProps): React.ReactElement {
  const { overlayDrawerWidth, setOverlayDrawerWidth } = overlayWidths;

  return (
    <UtilityOverlay
      open={utilityOpen}
      width={overlayDrawerWidth}
      onWidthChange={setOverlayDrawerWidth}
      onClose={onCloseUtility}
      activeTab={activeUtilityTab}
      onSelectTab={onSelectUtilityTab}
      activeProject={activeProject}
    />
  );
}
