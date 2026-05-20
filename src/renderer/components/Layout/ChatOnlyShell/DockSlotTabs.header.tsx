/**
 * DockSlotTabs.header.tsx — SlotTabsHeader extraction
 *
 * Extracted from DockSlotTabs.tsx to keep that file under the 300-line ESLint
 * limit. Owns close-with-neighbour-activation semantics and right-edge
 * affordances for the wired tab strip used by DockSlot (has-sessions state).
 */

import React, { useCallback } from 'react';

import type { SlotHandle } from '../../../hooks/useProjectTerminals';
import { useAgentCompletionIndicatorsContext } from './AgentCompletionIndicatorsContext';
import type { SlotId } from './DockSlot';
import { ShowSecondarySlotButton, SlotCollapseButton, SlotExpandedButtons } from './DockSlot';
import { DockSlotTabs } from './DockSlotTabs';

// ---------------------------------------------------------------------------
// SlotTabsHeader — wired tab strip for DockSlot (has-sessions state)
// ---------------------------------------------------------------------------

export interface SlotTabsHeaderProps {
  slot: SlotId;
  terminal: SlotHandle;
  collapsed: boolean;
  isRecording: boolean;
  onSpawn: () => void;
  onToggleRecording: () => void;
  onToggleCollapse: () => void;
  onShowSecondarySlot?: () => void;
}

/** Activate the neighbouring tab when the active one is closed. */
function activateNeighbour(terminal: SlotHandle, closedId: string): void {
  const { sessions, activeSessionId, setActiveSessionId } = terminal;
  if (closedId !== activeSessionId || sessions.length <= 1) return;
  const idx = sessions.findIndex((s) => s.id === closedId);
  const next = sessions[idx > 0 ? idx - 1 : 1];
  if (next) setActiveSessionId(next.id);
}

function useTabHandlers(terminal: SlotHandle, markSessionViewed: (id: string) => void) {
  const handleActivate = useCallback(
    (id: string) => {
      terminal.setActiveSessionId(id);
      const session = terminal.sessions.find((s) => s.id === id);
      if (session?.claudeSessionId) markSessionViewed(session.claudeSessionId);
    },
    [terminal, markSessionViewed],
  );
  const handleClose = useCallback(
    (id: string) => {
      activateNeighbour(terminal, id);
      terminal.handleTerminalClose(id);
    },
    [terminal],
  );
  return { handleActivate, handleClose };
}

interface RightControlsOpts {
  collapsed: boolean;
  terminal: SlotHandle;
  isRecording: boolean;
  onToggleRecording: () => void;
  onToggleCollapse: () => void;
  onShowSecondarySlot?: () => void;
}

function buildRightControls(opts: RightControlsOpts): React.ReactNode {
  const {
    collapsed,
    terminal,
    isRecording,
    onToggleRecording,
    onToggleCollapse,
    onShowSecondarySlot,
  } = opts;
  return (
    <>
      {!collapsed && (
        <SlotExpandedButtons
          activeSessionId={terminal.activeSessionId}
          isRecording={isRecording}
          onToggleRecording={onToggleRecording}
        />
      )}
      {onShowSecondarySlot && <ShowSecondarySlotButton onClick={onShowSecondarySlot} />}
      <SlotCollapseButton collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </>
  );
}

export function SlotTabsHeader({
  slot,
  terminal,
  collapsed,
  isRecording,
  onSpawn,
  onToggleRecording,
  onToggleCollapse,
  onShowSecondarySlot,
}: SlotTabsHeaderProps): React.ReactElement {
  const { statusByClaudeSessionId, markSessionViewed } = useAgentCompletionIndicatorsContext();
  const { handleActivate, handleClose } = useTabHandlers(terminal, markSessionViewed);
  const rightControls = buildRightControls({
    collapsed,
    terminal,
    isRecording,
    onToggleRecording,
    onToggleCollapse,
    onShowSecondarySlot,
  });
  return (
    <DockSlotTabs
      slot={slot}
      sessions={terminal.sessions}
      activeSessionId={terminal.activeSessionId}
      onActivate={handleActivate}
      onClose={handleClose}
      onRename={terminal.renameSession}
      onReorder={terminal.handleTerminalReorder}
      onSpawn={onSpawn}
      rightControls={rightControls}
      statusByClaudeSessionId={statusByClaudeSessionId}
    />
  );
}
