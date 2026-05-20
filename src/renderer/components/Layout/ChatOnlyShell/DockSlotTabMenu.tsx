/**
 * DockSlotTabMenu.tsx — Re-click dropdown for active terminal-dock tabs.
 *
 * Extracted from DockSlotTabs.tsx to respect the 300-line file limit.
 * Follows the same portal + backdrop pattern as WorkbenchRailContextMenu.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Drag-and-drop types and helpers (used by DockSlotTabs TabItem)
// ---------------------------------------------------------------------------

export interface TabDragProps {
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export interface TabDragHandlers {
  guardedClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  wrappedDragStart: ((e: React.DragEvent) => void) | undefined;
  wrappedDragEnd: (() => void) | undefined;
  dragCls: string;
}

export function tabDragOverCls(drag: TabDragProps | undefined): string {
  if (!drag) return '';
  if (drag.isDragOver && !drag.isDragging)
    return 'border-l-2 border-l-interactive-accent bg-surface-raised';
  if (drag.isDragging) return 'opacity-40';
  return '';
}

export function useTabDrag(
  drag: TabDragProps | undefined,
  handleClick: (e: React.MouseEvent<HTMLButtonElement>) => void,
): TabDragHandlers {
  const didDragRef = useRef(false);

  const guardedClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      handleClick(e);
    },
    [handleClick],
  );

  const wrappedDragStart = drag
    ? (e: React.DragEvent): void => {
        e.dataTransfer.effectAllowed = 'move';
        didDragRef.current = true;
        drag.onDragStart(e);
      }
    : undefined;

  const wrappedDragEnd = drag
    ? (): void => {
        didDragRef.current = false;
        drag.onDragEnd();
      }
    : undefined;

  return { guardedClick, wrappedDragStart, wrappedDragEnd, dragCls: tabDragOverCls(drag) };
}

// ---------------------------------------------------------------------------
// Position type
// ---------------------------------------------------------------------------

export interface TabMenuPosition {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Primitives — follow WorkbenchRailContextMenu token conventions exactly
// ---------------------------------------------------------------------------

function TabMenuBackdrop({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-[9000]"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    />
  );
}

function TabMenuPanel({
  position,
  sessionId,
  children,
}: {
  position: TabMenuPosition;
  sessionId: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      role="menu"
      aria-label="Tab actions"
      className="fixed z-[9001] min-w-[140px] bg-surface-overlay py-1 shadow-lg"
      style={{ top: position.y, left: position.x }}
      data-testid={`dock-slot-tab-menu-${sessionId}`}
    >
      {children}
    </div>
  );
}

function TabMenuItem({
  label,
  onClick,
  testId,
}: {
  label: string;
  onClick: () => void;
  testId?: string;
}): React.ReactElement {
  return (
    <button
      role="menuitem"
      type="button"
      className="w-full cursor-pointer select-none px-3 py-1.5 text-left text-sm text-text-semantic-primary hover:bg-surface-hover"
      onClick={onClick}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// useTabMenu hook
// ---------------------------------------------------------------------------

export interface UseTabMenuResult {
  menuPos: TabMenuPosition | null;
  openMenu: (e: React.MouseEvent<HTMLButtonElement>) => void;
  closeMenu: () => void;
}

/** Manages open/close state for the tab re-click dropdown menu. */
export function useTabMenu(): UseTabMenuResult {
  const [menuPos, setMenuPos] = useState<TabMenuPosition | null>(null);

  const openMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ x: rect.left, y: rect.bottom + 2 });
  }, []);

  const closeMenu = useCallback((): void => {
    setMenuPos(null);
  }, []);

  useEffect(() => {
    if (menuPos === null) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [menuPos, closeMenu]);

  return { menuPos, openMenu, closeMenu };
}

// ---------------------------------------------------------------------------
// useTabItemHandlers — extracted so TabItem stays under 40 lines
// ---------------------------------------------------------------------------

export interface TabItemHandlers {
  editing: boolean;
  menuPos: TabMenuPosition | null;
  handleClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  handleCommit: (title: string) => void;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
  closeMenu: () => void;
}

export function useTabItemHandlers(
  sessionId: string,
  isActive: boolean,
  onActivate: (id: string) => void,
  onRename: (id: string, title: string) => void,
): TabItemHandlers {
  const [editing, setEditing] = useState(false);
  const { menuPos, openMenu, closeMenu } = useTabMenu();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      if (isActive) {
        openMenu(e);
      } else {
        onActivate(sessionId);
      }
    },
    [isActive, onActivate, openMenu, sessionId],
  );

  const handleCommit = useCallback(
    (title: string): void => {
      setEditing(false);
      onRename(sessionId, title);
    },
    [onRename, sessionId],
  );

  return { editing, menuPos, handleClick, handleCommit, setEditing, closeMenu };
}

// ---------------------------------------------------------------------------
// TabContextMenu — portal-based dropdown rendered from TabItem
// ---------------------------------------------------------------------------

interface TabContextMenuProps {
  sessionId: string;
  position: TabMenuPosition;
  onClose: () => void;
  onRename: () => void;
}

function TabContextMenuBody({
  sessionId,
  position,
  onClose,
  onRename,
}: TabContextMenuProps): React.ReactElement {
  const handleRename = useCallback((): void => {
    onRename();
    onClose();
  }, [onRename, onClose]);

  return (
    <>
      <TabMenuBackdrop onClose={onClose} />
      <TabMenuPanel position={position} sessionId={sessionId}>
        <TabMenuItem
          label="Rename"
          onClick={handleRename}
          testId={`dock-slot-tab-menu-rename-${sessionId}`}
        />
      </TabMenuPanel>
    </>
  );
}

export function TabContextMenu(props: TabContextMenuProps): React.ReactElement {
  return createPortal(<TabContextMenuBody {...props} />, document.body);
}
