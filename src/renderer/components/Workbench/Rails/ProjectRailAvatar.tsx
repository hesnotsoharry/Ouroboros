/**
 * ProjectRailAvatar — user avatar button + stub profile menu for ProjectRail.
 */

import React, { useRef } from 'react';

import { useCloseOnOutsideOrEsc } from './ProjectRail.hooks';

// ── Styles ────────────────────────────────────────────────────────────────────

const PROFILE_MENU_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: 46,
  marginBottom: 4,
  // Wave 10.1 — popover uses --glass-overlay (92% opacity), not --glass-panel
  // (35% opacity which bleeds Mica desktop content through, making menu text
  // unreadable). Overlay is the canon token for menus/dialogs.
  background: 'var(--glass-overlay)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 'var(--r-md, 8px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  zIndex: 200,
  minWidth: 180,
  padding: '4px 0',
};

const PROFILE_ENTRY_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-2)',
  fontSize: 12,
  fontFamily: 'var(--font-ui)',
  cursor: 'default',
  width: '100%',
  textAlign: 'left',
};

const AVATAR_BTN_STYLE: React.CSSProperties = {
  width: 38,
  height: 38,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
};

const AVATAR_DOT_STYLE: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  background: 'linear-gradient(135deg, var(--accent), var(--purple, #c084fc))',
  display: 'block',
  flexShrink: 0,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileMenu(): React.ReactElement {
  return (
    <div data-testid="profile-menu" style={PROFILE_MENU_STYLE}>
      <button style={PROFILE_ENTRY_STYLE} data-testid="profile-menu-stub-entry">
        Profile (stub — to be wired)
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function UserAvatar({
  menuOpen,
  onToggleMenu,
  onClose,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onClose: () => void;
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideOrEsc(containerRef, menuOpen, onClose);
  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        title="Profile"
        onClick={onToggleMenu}
        data-testid="user-avatar-btn"
        style={AVATAR_BTN_STYLE}
      >
        <span style={AVATAR_DOT_STYLE} />
      </button>
      {menuOpen && <ProfileMenu />}
    </div>
  );
}
