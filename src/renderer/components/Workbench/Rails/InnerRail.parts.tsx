/**
 * InnerRail.parts — shared micro-components for InnerRail, extracted to keep
 * InnerRail.tsx under the 300-line ESLint cap. Section label, status dot, icon button.
 */

import React from 'react';

export function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

const STATUS_DOT_COLORS: Record<string, string> = {
  live: 'var(--success)',
  warn: 'var(--warning)',
  idle: 'var(--ink-4)',
};

export function StatusDot({ status }: { status: string }): React.ReactElement {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: STATUS_DOT_COLORS[status] ?? 'var(--ink-4)',
        flexShrink: 0,
        boxShadow: status === 'live' ? '0 0 6px var(--success)' : 'none',
      }}
    />
  );
}

export const iconBtnStyle: React.CSSProperties = {
  padding: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-4)',
  cursor: 'pointer',
  borderRadius: 4,
};
