/**
 * WindowControls — Windows-native min/max/close buttons.
 *
 * Three borderless 46×40 buttons. Close hover is #e81123 (sanctioned
 * Windows platform color — canon §06). Calls window.electronAPI.app
 * minimize/toggleMaximize/close via the existing IPC contract.
 *
 * -webkit-app-region: no-drag so clicks reach the buttons.
 */

import React from 'react';

// ── Inline SVG glyphs ────────────────────────────────────────────────────────

function MinimizeGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function MaximizeGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

function CloseGlyph(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
      <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ── WinBtn ───────────────────────────────────────────────────────────────────

interface WinBtnProps {
  title: string;
  isClose?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

function WinBtn({ title, isClose = false, onClick, children }: WinBtnProps): React.ReactElement {
  const [hovered, setHovered] = React.useState(false);

  const bg = hovered
    ? isClose
      ? '#e81123' // sanctioned Windows close-button platform color
      : 'rgba(255,255,255,0.06)'
    : 'transparent';

  const color = hovered && isClose ? '#fff' : 'var(--ink-2)';

  return (
    <button
      title={title}
      style={
        {
          width: 46,
          height: 40,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
          border: 'none',
          cursor: 'pointer',
          color,
          transition: 'background 120ms, color 120ms',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
        } as React.CSSProperties
      }
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

// ── WindowControls ───────────────────────────────────────────────────────────

export function WindowControls(): React.ReactElement {
  const handleMinimize = (): void => {
    window.electronAPI.app.minimizeWindow().catch(() => undefined);
  };

  const handleMaximize = (): void => {
    window.electronAPI.app.toggleMaximizeWindow().catch(() => undefined);
  };

  const handleClose = (): void => {
    window.electronAPI.app.closeWindow().catch(() => undefined);
  };

  return (
    <div
      data-testid="window-controls"
      style={
        {
          display: 'flex',
          height: '100%',
          alignItems: 'stretch',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties
      }
    >
      <WinBtn title="Minimize" onClick={handleMinimize}>
        <MinimizeGlyph />
      </WinBtn>
      <WinBtn title="Maximize" onClick={handleMaximize}>
        <MaximizeGlyph />
      </WinBtn>
      <WinBtn title="Close" isClose onClick={handleClose}>
        <CloseGlyph />
      </WinBtn>
    </div>
  );
}
