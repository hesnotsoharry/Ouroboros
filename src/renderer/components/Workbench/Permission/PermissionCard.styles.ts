/**
 * PermissionCard.styles — canon §13 permission-card style constants.
 *
 * Extracted from PermissionCard.tsx so the component file stays under the
 * 300-line cap after prettier formatting. Token contract: zero hardcoded hex
 * (canon aliases only). The sidebar variant's overrides also live here.
 */

import type React from 'react';

export const BADGE_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '1px 6px',
  borderRadius: 10,
  background: 'var(--warning-tint)',
  border: '1px solid var(--warning)',
  color: 'var(--warning)',
  whiteSpace: 'nowrap',
};

export const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const WARNING_TILE_STYLE: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  flexShrink: 0,
  background: 'var(--warning-tint)',
  border: '1px solid var(--warning)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  color: 'var(--warning)',
};

export const TITLE_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--ink)',
  flex: 1,
};

export const SESSION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--ink-3)',
  fontFamily: 'var(--font-mono, monospace)',
};

export const ELAPSED_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--ink-3)',
  fontFamily: 'var(--font-mono, monospace)',
  background: 'var(--warning-tint)',
  borderRadius: 4,
  padding: '1px 5px',
  border: '1px solid var(--warning)',
  whiteSpace: 'nowrap',
};

export const PREVIEW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '6px 8px',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface-inset)',
  border: '1px solid var(--border-subtle)',
};

export const TOOL_NAME_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--accent)',
  fontFamily: 'var(--font-mono, monospace)',
};

export const COMMAND_PREVIEW_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono, monospace)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const REASON_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 11,
  fontFamily: 'var(--font-mono, monospace)',
  background: 'var(--surface-inset)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--ink)',
  boxSizing: 'border-box',
};

export const REASON_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

export const REASON_LABEL_STYLE: React.CSSProperties = { fontSize: 10, color: 'var(--ink-3)' };

export const ACTION_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const BTN_BASE: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  borderRadius: 'var(--r-md)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  whiteSpace: 'nowrap',
};

export const APPROVE_BTN_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: 'var(--accent)',
  color: 'var(--ink-on-accent)',
};

export const ALWAYS_BTN_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: 'transparent',
  border: '1px solid var(--accent)',
  color: 'var(--accent)',
};

export const DENY_BTN_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: 'var(--warning-tint)',
  border: '1px solid var(--warning)',
  color: 'var(--warning)',
};

export const CARD_BASE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '12px 14px',
};
