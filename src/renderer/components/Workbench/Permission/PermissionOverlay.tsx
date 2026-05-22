/**
 * PermissionOverlay — canon §13a terminal-overlay presentation.
 *
 * Absolutely-positioned glass card anchored near the bottom of the centre
 * pane (its containing region must be position:relative). Renders only when
 * a permission request is pending. Consumes useWorkbenchApproval() — does
 * NOT bind its own keydown listener (ADR D3 single keyboard owner).
 */

import React from 'react';

import { PermissionCard } from './PermissionCard';
import { useWorkbenchApproval } from './useWorkbenchApproval';

// Inject slide-up keyframe once at module evaluation time.
if (typeof document !== 'undefined' && !document.getElementById('__permission-overlay-anim__')) {
  const s = document.createElement('style');
  s.id = '__permission-overlay-anim__';
  s.textContent = `@keyframes permission-slide-up {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }`;
  document.head.appendChild(s);
}

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 460,
  maxWidth: 'calc(100% - 28px)',
  background: 'var(--glass-overlay)',
  backdropFilter: 'var(--blur-strong)',
  WebkitBackdropFilter: 'var(--blur-strong)',
  border: '1px solid var(--warning)',
  borderRadius: 'var(--r-md)',
  zIndex: 100,
  animation: 'permission-slide-up 0.18s ease-out both',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)', // hardcoded: opacity-only drop shadow (sanctioned scrim per .claude/rules/renderer.md)
};

export function PermissionOverlay(): React.ReactElement | null {
  const { current, queuedCount, elapsedSec, approve, deny, alwaysAllow } = useWorkbenchApproval();

  if (!current) return null;

  return (
    <div data-testid="permission-overlay" style={OVERLAY_STYLE}>
      <PermissionCard
        request={current}
        queuedCount={queuedCount}
        elapsedSec={elapsedSec}
        variant="overlay"
        onApprove={approve}
        onAlwaysAllow={alwaysAllow}
        onDeny={deny}
      />
    </div>
  );
}
