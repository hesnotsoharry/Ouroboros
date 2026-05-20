/**
 * DockSlotTabs.tsx — Wave 94 Phase C / Wave 95 Phase A
 *
 * Per-slot tab strip rendered inside DockSlot when sessions exist (ADR Decision 5).
 * Replaces the slot label row; affordances (collapse, recording, close) sit at the
 * right edge of the 28px strip. The + New button moves here from SlotHeader so
 * all tab operations live in one row.
 *
 * Wave 95 Phase A: double-click tab title to rename inline. onRename wired from
 * SlotHandle.renameSession — persists title and sets userRenamed=true so PTY
 * titleChange events are suppressed for that session.
 *
 * Also exports SlotTabsHeader — the wired version that connects a SlotHandle to
 * DockSlotTabs and owns close-with-activation semantics.
 */

import React, { useCallback } from 'react';

import type { TerminalSession } from '../../Terminal/TerminalTabs';
import { useTabDragDrop } from '../../Terminal/TerminalTabs.dnd';
import type { TabDragProps, TabMenuPosition } from './DockSlotTabMenu';
import { TabContextMenu, useTabDrag, useTabItemHandlers } from './DockSlotTabMenu';
import { InlineTitleEdit } from './InlineTitleEdit';

export type { SlotTabsHeaderProps } from './DockSlotTabs.header';
export { SlotTabsHeader } from './DockSlotTabs.header';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BTN_BASE = 'rounded px-2 py-0.5 text-xs text-text-semantic-secondary transition-colors';
const BTN_HOVER = 'hover:bg-surface-hover hover:text-text-semantic-primary';

// ---------------------------------------------------------------------------
// DockSlotTabsProps
// ---------------------------------------------------------------------------

export interface DockSlotTabsProps {
  slot: 'primary' | 'secondary';
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onActivate: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onSpawn: () => void;
  onRename: (sessionId: string, title: string) => void;
  onReorder?: (reordered: TerminalSession[]) => void;
  /** Right-edge affordance buttons (collapse, recording, etc.) */
  rightControls?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// TabCloseButton — extracted to keep TabItem under 40 lines
// ---------------------------------------------------------------------------

function TabCloseButton({
  sessionId,
  title,
  onClose,
}: {
  sessionId: string;
  title: string;
  onClose: (id: string) => void;
}): React.ReactElement {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(sessionId);
    },
    [onClose, sessionId],
  );
  return (
    <span
      role="button"
      tabIndex={-1}
      className="ml-0.5 rounded px-0.5 hover:text-status-error"
      onClick={handleClick}
      aria-label={`Close tab ${title}`}
      data-testid={`dock-slot-tab-close-${sessionId}`}
    >
      ×
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single tab
// ---------------------------------------------------------------------------

function tabActiveCls(isActive: boolean): string {
  return isActive
    ? 'bg-interactive-accent text-text-semantic-on-accent'
    : 'text-text-semantic-secondary hover:bg-surface-hover hover:text-text-semantic-primary';
}

interface TabItemProps {
  session: TerminalSession;
  isActive: boolean;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
  drag?: TabDragProps;
}

/** Renders the editable/static title area of a tab. */
function TabTitleContent({
  sessionId,
  title,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  sessionId: string;
  title: string;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (t: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  if (editing) {
    return (
      <InlineTitleEdit
        initial={title}
        onCommit={onCommit}
        onCancel={onCancel}
        testId={`dock-slot-tab-title-${sessionId}`}
        className="max-w-[80px] bg-transparent text-xs outline-none"
      />
    );
  }
  return (
    <span
      className="max-w-[80px] truncate"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      data-testid={`dock-slot-tab-title-${sessionId}`}
    >
      {title}
    </span>
  );
}

interface TabButtonProps {
  session: TerminalSession;
  isActive: boolean;
  editing: boolean;
  drag: TabDragProps | undefined;
  guardedClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  wrappedDragStart: ((e: React.DragEvent) => void) | undefined;
  wrappedDragEnd: (() => void) | undefined;
  dragCls: string;
  onClose: (id: string) => void;
  setEditing: (v: boolean) => void;
  handleCommit: (t: string) => void;
}

function TabButton(p: TabButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      draggable={!!p.drag && !p.editing}
      className={`flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${tabActiveCls(p.isActive)} ${p.dragCls}`}
      onClick={p.guardedClick}
      onDragStart={p.wrappedDragStart}
      onDragOver={p.drag?.onDragOver}
      onDragLeave={p.drag?.onDragLeave}
      onDrop={p.drag?.onDrop}
      onDragEnd={p.wrappedDragEnd}
      aria-selected={p.isActive}
      aria-label={`Tab: ${p.session.title}`}
      data-testid={`dock-slot-tab-${p.session.id}`}
    >
      <TabTitleContent
        sessionId={p.session.id}
        title={p.session.title}
        editing={p.editing}
        onStartEdit={() => p.setEditing(true)}
        onCommit={p.handleCommit}
        onCancel={() => p.setEditing(false)}
      />
      <TabCloseButton sessionId={p.session.id} title={p.session.title} onClose={p.onClose} />
    </button>
  );
}

function TabItemMenu({
  sessionId,
  menuPos,
  closeMenu,
  setEditing,
}: {
  sessionId: string;
  menuPos: TabMenuPosition | null;
  closeMenu: () => void;
  setEditing: (v: boolean) => void;
}): React.ReactElement | null {
  if (menuPos === null) return null;
  return (
    <TabContextMenu
      sessionId={sessionId}
      position={menuPos}
      onClose={closeMenu}
      onRename={() => setEditing(true)}
    />
  );
}

function TabItem({
  session,
  isActive,
  onActivate,
  onClose,
  onRename,
  drag,
}: TabItemProps): React.ReactElement {
  const { editing, menuPos, handleClick, handleCommit, setEditing, closeMenu } = useTabItemHandlers(
    session.id,
    isActive,
    onActivate,
    onRename,
  );
  const { guardedClick, wrappedDragStart, wrappedDragEnd, dragCls } = useTabDrag(drag, handleClick);
  return (
    <>
      <TabButton
        session={session}
        isActive={isActive}
        editing={editing}
        drag={drag}
        guardedClick={guardedClick}
        wrappedDragStart={wrappedDragStart}
        wrappedDragEnd={wrappedDragEnd}
        dragCls={dragCls}
        onClose={onClose}
        setEditing={setEditing}
        handleCommit={handleCommit}
      />
      <TabItemMenu
        sessionId={session.id}
        menuPos={menuPos}
        closeMenu={closeMenu}
        setEditing={setEditing}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab list (extracted to keep DockSlotTabs under 40 lines)
// ---------------------------------------------------------------------------

interface TabListProps {
  slot: string;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onReorder?: (reordered: TerminalSession[]) => void;
  onSpawn: () => void;
}

function buildDragProps(s: TerminalSession, dnd: ReturnType<typeof useTabDragDrop>): TabDragProps {
  return {
    isDragging: dnd.draggingId === s.id,
    isDragOver: dnd.dragOverId === s.id,
    onDragStart: () => dnd.handleDragStart(s.id),
    onDragOver: (e: React.DragEvent) => dnd.handleDragOver(e, s.id),
    onDragLeave: dnd.handleDragLeave,
    onDrop: () => dnd.handleDrop(s.id),
    onDragEnd: dnd.handleDragEnd,
  };
}

function TabList({
  slot,
  sessions,
  activeSessionId,
  onActivate,
  onClose,
  onRename,
  onReorder,
  onSpawn,
}: TabListProps): React.ReactElement {
  const dnd = useTabDragDrop(sessions, onReorder);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1">
      {sessions.map((s) => (
        <TabItem
          key={s.id}
          session={s}
          isActive={s.id === activeSessionId}
          onActivate={onActivate}
          onClose={onClose}
          onRename={onRename}
          drag={buildDragProps(s, dnd)}
        />
      ))}
      <button
        type="button"
        className={`shrink-0 ${BTN_BASE} ${BTN_HOVER}`}
        onClick={onSpawn}
        data-testid={`dock-slot-${slot}-spawn`}
      >
        + New
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DockSlotTabs
// ---------------------------------------------------------------------------

export function DockSlotTabs({
  slot,
  sessions,
  activeSessionId,
  onActivate,
  onClose,
  onSpawn,
  onRename,
  onReorder,
  rightControls,
}: DockSlotTabsProps): React.ReactElement {
  return (
    <div
      className="flex shrink-0 items-center overflow-hidden border-b border-border-semantic"
      style={{ height: 28 }}
      data-testid={`dock-slot-tabs-${slot}`}
    >
      <TabList
        slot={slot}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onActivate={onActivate}
        onClose={onClose}
        onRename={onRename}
        onReorder={onReorder}
        onSpawn={onSpawn}
      />
      {rightControls !== undefined && (
        <div className="flex shrink-0 items-center gap-1 px-1">{rightControls}</div>
      )}
    </div>
  );
}
