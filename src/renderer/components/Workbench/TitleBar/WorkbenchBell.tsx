/**
 * WorkbenchBell — live notification bell for the canon TitleBar (Wave 7 Phase 3).
 *
 * Badge: canon §06 warning dot (8×8, --warning token), shown when unreadCount > 0.
 * Panel: <NotificationCenter> anchored below the button, fed by useToastContext().
 *
 * Mirrors the NotificationBell pattern in Layout/TitleBar.controls.tsx but preserves
 * the canon visual styling (dot badge, not a count pill; --ink-3 color; no-drag).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useToastContext } from '../../../contexts/ToastContext';
import { NotificationCenter } from '../../shared/NotificationCenter';

// ── Badge (canon §06 warning dot) ────────────────────────────────────────────

function BellDot(): React.ReactElement {
  return (
    <span
      data-testid="workbench-bell-dot"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 3,
        right: 3,
        width: 8,
        height: 8,
        borderRadius: 999,
        background: 'var(--warning, #fbbf24)',
        boxShadow: '0 0 6px var(--warning, #fbbf24), 0 0 0 2px var(--bg-wash, #0a0b14)',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Bell icon (inline SVG, 14px — matches canon §06 size) ────────────────────

function BellSvg(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 5.5a5 5 0 0 0-10 0c0 2.5-1.5 4-1.5 4h13S13 8 13 5.5z" />
      <path d="M6 13.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

// ── Anchor-rect update hook ───────────────────────────────────────────────────

function useAnchorRect(
  open: boolean,
  buttonRef: React.RefObject<HTMLButtonElement | null>,
): DOMRect | null {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const update = useCallback((): void => {
    setAnchorRect(buttonRef.current?.getBoundingClientRect() ?? null);
  }, [buttonRef]);
  useEffect(() => {
    if (!open) return undefined;
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);
  return anchorRect;
}

// ── Bell state hook ───────────────────────────────────────────────────────────

interface BellState {
  open: boolean;
  toggle: () => void;
  handleClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

function useBellState(unreadCount: number, markAllRead: () => void): BellState {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const toggle = useCallback((): void => {
    setOpen((prev) => !prev);
  }, []);
  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);
  useEffect(() => {
    if (open && unreadCount > 0) markAllRead();
  }, [open, unreadCount, markAllRead]);
  return { open, toggle, handleClose, buttonRef };
}

// ── Bell button ───────────────────────────────────────────────────────────────

const bellButtonStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  color: 'var(--ink-3)',
  cursor: 'pointer',
  WebkitAppRegion: 'no-drag',
  flexShrink: 0,
} as React.CSSProperties;

function BellButton({
  buttonRef,
  title,
  hasUnread,
  onMouseDown,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  title: string;
  hasUnread: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
}): React.ReactElement {
  return (
    <button
      ref={buttonRef}
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={onMouseDown}
      style={bellButtonStyle as React.CSSProperties}
    >
      <BellSvg />
      {hasUnread && <BellDot />}
    </button>
  );
}

// ── WorkbenchBell ─────────────────────────────────────────────────────────────

export function WorkbenchBell(): React.ReactElement {
  const { notifications, unreadCount, markAllRead, removeNotification, clearAllNotifications } =
    useToastContext();
  const { open, toggle, handleClose, buttonRef } = useBellState(unreadCount, markAllRead);
  const anchorRect = useAnchorRect(open, buttonRef);
  const hasUnread = unreadCount > 0;
  const title = hasUnread
    ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
    : 'Notifications';
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      e.stopPropagation();
      toggle();
    },
    [toggle],
  );
  return (
    <div
      style={{ position: 'relative', height: '100%', display: 'inline-flex', alignItems: 'center' }}
    >
      <BellButton
        buttonRef={buttonRef}
        title={title}
        hasUnread={hasUnread}
        onMouseDown={handleMouseDown}
      />
      {open && (
        <NotificationCenter
          anchorRect={anchorRect}
          notifications={notifications}
          onRemove={removeNotification}
          onClearAll={clearAllNotifications}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
