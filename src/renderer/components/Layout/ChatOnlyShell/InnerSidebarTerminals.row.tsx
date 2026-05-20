/**
 * InnerSidebarTerminals.row.tsx — Wave 95 Phase A
 *
 * TerminalRow and InlineRowEdit extracted from InnerSidebarTerminals.tsx
 * to keep the parent file under the 300-line ESLint limit.
 *
 * Exports:
 *  - TerminalRow — session row with click-to-activate, close, right-click Rename
 *  - InlineRowEdit — autofocus input for inline title editing
 */

import React, { useCallback, useState } from 'react';

import { InlineTitleEdit } from './InlineTitleEdit';

// ---------------------------------------------------------------------------
// RenameContextMenu — one-item context menu shown on row right-click
// ---------------------------------------------------------------------------

interface RenameContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onClose: () => void;
}

function RenameContextMenu({
  x,
  y,
  onRename,
  onClose,
}: RenameContextMenuProps): React.ReactElement {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        data-testid="inner-terminals-row-menu-backdrop"
      />
      <div
        className="fixed z-50 min-w-max rounded border border-border-semantic bg-surface-panel shadow-lg"
        style={{ top: `${y}px`, left: `${x}px` }}
        data-testid="inner-terminals-row-context-menu"
      >
        <button
          type="button"
          onClick={() => {
            onClose();
            onRename();
          }}
          className="block w-full px-3 py-2 text-left text-xs text-text-semantic-secondary transition-colors hover:bg-surface-hover hover:text-text-semantic-primary"
          data-testid="inner-terminals-row-rename"
        >
          Rename
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TerminalRowContent — label area (editing vs static)
// ---------------------------------------------------------------------------

function TerminalRowContent({
  sessionId,
  label,
  editing,
  onClick,
  onCommit,
  onCancel,
}: {
  sessionId: string;
  label: string;
  editing: boolean;
  onClick: () => void;
  onCommit: (title: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  if (editing) {
    return (
      <InlineTitleEdit
        initial={label}
        onCommit={onCommit}
        onCancel={onCancel}
        testId={`inner-sidebar-terminal-title-input-${sessionId}`}
      />
    );
  }
  return (
    <button type="button" onClick={onClick} className="flex-1 truncate text-left">
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// RowRenameButton — pencil icon, hover-revealed, left of the close button
// ---------------------------------------------------------------------------

function RowRenameButton({
  sessionId,
  onStartRename,
}: {
  sessionId: string;
  onStartRename: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onStartRename();
      }}
      title="Rename terminal"
      aria-label="Rename terminal"
      data-testid={`terminal-row-rename-${sessionId}`}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-text-semantic-muted hover:text-text-semantic-primary transition-opacity"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// RowCloseButton — extracted to keep TerminalRowBody under 40 lines
// ---------------------------------------------------------------------------

function RowCloseButton({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      title="Close terminal"
      aria-label="Close terminal"
      data-testid="inner-terminals-row-close"
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-text-semantic-muted hover:text-status-error transition-opacity"
    >
      ×
    </button>
  );
}

// ---------------------------------------------------------------------------
// TerminalRowBody — the visible row div + close button
// ---------------------------------------------------------------------------

interface TerminalRowBodyProps {
  sessionId: string;
  label: string;
  active: boolean;
  editing: boolean;
  onClick: () => void;
  onClose: () => void;
  onStartRename: () => void;
  onCommit: (title: string) => void;
  onCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function TerminalRowBody({
  label,
  active,
  editing,
  onClick,
  onClose,
  onStartRename,
  onCommit,
  onCancel,
  onContextMenu,
  sessionId,
}: TerminalRowBodyProps): React.ReactElement {
  const cls = active
    ? 'bg-interactive-selection text-text-semantic-primary'
    : 'text-text-semantic-secondary hover:bg-surface-hover hover:text-text-semantic-primary';
  return (
    <div
      data-testid="inner-terminals-row"
      onContextMenu={onContextMenu}
      className={`group flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${cls}`}
    >
      <TerminalRowContent
        sessionId={sessionId}
        label={label}
        editing={editing}
        onClick={onClick}
        onCommit={onCommit}
        onCancel={onCancel}
      />
      <RowRenameButton sessionId={sessionId} onStartRename={onStartRename} />
      <RowCloseButton onClose={onClose} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MaybeRenameMenu — conditionally renders RenameContextMenu
// ---------------------------------------------------------------------------

function MaybeRenameMenu({
  menu,
  onRename,
  onClose,
}: {
  menu: { x: number; y: number } | null;
  onRename: () => void;
  onClose: () => void;
}): React.ReactElement | null {
  if (menu === null) return null;
  return <RenameContextMenu x={menu.x} y={menu.y} onRename={onRename} onClose={onClose} />;
}

// ---------------------------------------------------------------------------
// useTerminalRowHandlers — callbacks for TerminalRow
// ---------------------------------------------------------------------------

function useTerminalRowHandlers(
  sessionId: string,
  onRename: (id: string, title: string) => void,
  setEditing: (v: boolean) => void,
  setMenu: (m: { x: number; y: number } | null) => void,
) {
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    },
    [setMenu],
  );
  const handleCommit = useCallback(
    (title: string) => {
      setEditing(false);
      onRename(sessionId, title);
    },
    [sessionId, onRename, setEditing],
  );
  return { handleContextMenu, handleCommit };
}

// ---------------------------------------------------------------------------
// TerminalRow — session row with activate, close, and right-click rename
// ---------------------------------------------------------------------------

export interface TerminalRowProps {
  sessionId: string;
  active: boolean;
  label: string;
  onClick: () => void;
  onClose: () => void;
  onRename: (sessionId: string, title: string) => void;
}

export function TerminalRow({
  sessionId,
  active,
  label,
  onClick,
  onClose,
  onRename,
}: TerminalRowProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { handleContextMenu, handleCommit } = useTerminalRowHandlers(
    sessionId,
    onRename,
    setEditing,
    setMenu,
  );
  return (
    <>
      <TerminalRowBody
        sessionId={sessionId}
        label={label}
        active={active}
        editing={editing}
        onClick={onClick}
        onClose={onClose}
        onStartRename={() => setEditing(true)}
        onCommit={handleCommit}
        onCancel={() => setEditing(false)}
        onContextMenu={handleContextMenu}
      />
      <MaybeRenameMenu
        menu={menu}
        onRename={() => setEditing(true)}
        onClose={() => setMenu(null)}
      />
    </>
  );
}
