import React, { useEffect } from 'react';

import { SPLIT_TERMINAL_EVENT } from '../../hooks/appEventNames';
import { EmptyStateMessage } from '../EmptyState';
import { ActiveTerminalContent } from './TerminalManagerContent';
import { useTerminalManagerState } from './TerminalManagerState';
import type { TerminalSession } from './TerminalTabs';

export interface TerminalManagerProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onRestart: (id: string) => void;
  onClose: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onSpawn: () => void;
  recordingSessions?: Set<string>;
  onToggleRecording?: (sessionId: string) => void;
  onSplit?: (sessionId: string) => void;
  onCloseSplit?: (sessionId: string) => void;
  /**
   * Wave 89: slot identity for SPLIT_TERMINAL_EVENT scoping.
   * 'primary' | 'secondary' — if omitted, this instance responds to all splits
   * (legacy IDE shell behaviour outside the stacked dock).
   */
  slot?: 'primary' | 'secondary';
}

const NOOP = (): void => {};

function TerminalManagerShell({
  activeContent,
  isEmpty,
  onSpawn,
}: {
  activeContent: React.ReactNode;
  isEmpty: boolean;
  onSpawn: () => void;
}): React.ReactElement {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--term-bg, var(--surface-base))' }}
    >
      <div className="relative flex-1 min-h-0">
        {activeContent}
        {/* Wave 38 Phase C — i18n empty-state with session dismiss + spawn action */}
        {isEmpty && (
          <EmptyStateMessage
            messageKey="emptyState.terminal.primary"
            actionLabel="emptyState.terminal.action"
            onAction={onSpawn}
          />
        )}
      </div>
    </div>
  );
}

function SessionLayer({
  session,
  isActive,
  manager,
  state,
}: {
  session: TerminalSession;
  isActive: boolean;
  manager: TerminalManagerProps;
  state: ReturnType<typeof useTerminalManagerState>;
}): React.ReactElement {
  return (
    <div className="absolute inset-0">
      <ActiveTerminalContent
        session={session}
        isActive={isActive}
        onTitleChange={manager.onTitleChange}
        onRestart={manager.onRestart}
        onClose={manager.onClose}
        onSplit={manager.onSplit}
        onCloseSplit={manager.onCloseSplit ?? NOOP}
        recordingSessions={manager.recordingSessions}
        onToggleRecording={manager.onToggleRecording}
        syncInput={state.syncInput}
        allSessionIds={state.allSessionIds}
        onToggleSync={state.handleToggleSync}
      />
    </div>
  );
}

// Wave 97: every session stays mounted; only the active one is visible (via
// getRootStyle's visibility toggle). Previously only the active session was
// rendered, so switching tabs unmounted the xterm and destroyed its scrollback
// buffer — and any output an agent produced in a backgrounded tab was lost.
// Keeping all sessions mounted preserves scrollback and lets background tabs
// keep consuming PTY output live (matches the IDE's sidebar/center-pane
// "render-all, hide-inactive" pattern). RAM cost: ~1 scrollback buffer per
// open terminal — see Terminal/CLAUDE.md.
function buildActiveContent(
  props: TerminalManagerProps,
  state: ReturnType<typeof useTerminalManagerState>,
): React.ReactNode {
  if (props.sessions.length === 0) return null;
  return props.sessions.map((session) => (
    <SessionLayer
      key={session.id}
      session={session}
      isActive={session.id === props.activeSessionId}
      manager={props}
      state={state}
    />
  ));
}

export function TerminalManager(props: TerminalManagerProps): React.ReactElement {
  const state = useTerminalManagerState(props.sessions, props.activeSessionId);
  const { activeSessionId, onSplit, slot } = props;

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ slot?: string }>).detail;
      // Slot-scoped filter (Wave 89): if the event carries a slot, only act on
      // matching instances. If no slot in detail (legacy dispatch path from
      // TitleBar menus), default-route to 'primary' to preserve pre-Wave-89 behavior.
      const targetSlot = detail?.slot ?? 'primary';
      if (slot !== undefined && slot !== targetSlot) return;
      if (activeSessionId && onSplit) onSplit(activeSessionId);
    };
    window.addEventListener(SPLIT_TERMINAL_EVENT, handler);
    return () => window.removeEventListener(SPLIT_TERMINAL_EVENT, handler);
  }, [activeSessionId, onSplit, slot]);

  return (
    <TerminalManagerShell
      activeContent={buildActiveContent(props, state)}
      isEmpty={props.sessions.length === 0}
      onSpawn={props.onSpawn}
    />
  );
}
