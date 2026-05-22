/**
 * LatestHunk — §09 ④ most recent diff applied.
 *
 * Header (file + line anchor) → diff body (6–8 gutter lines) → footer
 * (Accept / Reject / Open — all no-op stubs this wave).
 * Static mock data only — Wave 3 wires live hook data.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import type { MockDiffHunk, MockDiffLine } from '../workbenchMockData';

// ── diff row ──────────────────────────────────────────────────────────────────

const BG: Record<string, string> = {
  add: 'var(--success-tint)',
  del: 'var(--error-tint)',
  ctx: 'transparent',
};
const SIGN: Record<string, string> = { add: '+', del: '−', ctx: ' ' };
const SIGN_COLOR: Record<string, string> = {
  add: 'var(--success)',
  del: 'var(--error)',
  ctx: 'var(--ink-4)',
};

interface DiffRowProps {
  line: MockDiffLine;
}

function DiffRow({ line }: DiffRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        background: BG[line.type],
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11,
      }}
    >
      <span
        style={{
          minWidth: 28,
          paddingRight: 4,
          textAlign: 'right',
          flexShrink: 0,
          color: 'var(--ink-4)',
          userSelect: 'none',
        }}
      >
        {line.n}
      </span>
      <span style={{ width: 12, flexShrink: 0, color: SIGN_COLOR[line.type], userSelect: 'none' }}>
        {SIGN[line.type]}
      </span>
      <span
        style={{
          flex: 1,
          color: 'var(--ink-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'pre',
          paddingLeft: 4,
        }}
      >
        {line.text}
      </span>
    </div>
  );
}

// ── stub buttons ──────────────────────────────────────────────────────────────

interface StubButtonProps {
  label: string;
  variant: 'accent' | 'ghost';
  icon?: React.ReactElement;
}

function StubButton({ label, variant, icon }: StubButtonProps): React.ReactElement {
  const isAccent = variant === 'accent';
  return (
    <button
      type="button"
      onClick={undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 11,
        cursor: 'default',
        background: isAccent ? 'var(--interactive-accent)' : 'transparent',
        color: isAccent ? 'var(--ink-on-accent, var(--ink))' : 'var(--ink-2)',
        border: isAccent ? 'none' : '1px solid var(--stroke-inner)',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── hunk header ───────────────────────────────────────────────────────────────

interface HunkHeaderProps {
  file: string;
  startLine: number;
}

function HunkHeader({ file, startLine }: HunkHeaderProps): React.ReactElement {
  const filename = file.split('/').at(-1) ?? file;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px 4px',
      }}
    >
      <span
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)' }}
      >
        LATEST HUNK
      </span>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--ink-4)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 160,
        }}
      >
        {filename}
        <span style={{ marginLeft: 4 }}>:{startLine}</span>
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface LatestHunkProps {
  hunk?: MockDiffHunk;
}

function EmptyHunkPlaceholder(): React.ReactElement {
  return (
    <div
      data-testid="latest-hunk-empty"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 12px 4px',
      }}
    >
      <span
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)' }}
      >
        LATEST HUNK
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'var(--ink-4)',
          fontFamily: 'var(--font-mono, monospace)',
          marginTop: 6,
        }}
      >
        No recent diff
      </span>
    </div>
  );
}

export function LatestHunk({ hunk }: LatestHunkProps): React.ReactElement {
  if (!hunk) {
    return <EmptyHunkPlaceholder />;
  }
  return (
    <div data-testid="latest-hunk" style={{ display: 'flex', flexDirection: 'column' }}>
      <HunkHeader file={hunk.file} startLine={hunk.startLine} />
      <div
        style={{
          margin: '0 8px',
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid var(--stroke-inner)',
          background: 'var(--glass-panel)',
        }}
      >
        {hunk.lines.map((line, i) => (
          <DiffRow key={i} line={line} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 12px' }}>
        <StubButton label="Accept" variant="accent" />
        <StubButton label="Reject" variant="ghost" />
        <StubButton label="Open" variant="ghost" icon={<Icon name="Eye" size={11} />} />
      </div>
    </div>
  );
}
