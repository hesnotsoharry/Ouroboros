/**
 * FilesTouched — §09 ③ files touched by the current session.
 *
 * One row per file: icon + RTL-ellipsized path + +N/−N diff stats + live dot.
 * Active row (status === 'editing') gets accent-edge border.
 * Wave 4 Phase 2: wired to live adapter data via `data` prop (required).
 * adds/dels badges show 0 until Phase 3 enriches them from ParsedFileDiff.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import type { MockFileTouched } from '../workbenchMockData';

// ── diff badges ───────────────────────────────────────────────────────────────

interface DiffBadgesProps {
  adds: number;
  dels: number;
}

function DiffBadges({ adds, dels }: DiffBadgesProps): React.ReactElement {
  return (
    <>
      {adds > 0 && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--success)',
            flexShrink: 0,
          }}
        >
          +{adds}
        </span>
      )}
      {dels > 0 && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--error)',
            flexShrink: 0,
          }}
        >
          −{dels}
        </span>
      )}
    </>
  );
}

// ── live dot ──────────────────────────────────────────────────────────────────

function LiveDot(): React.ReactElement {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--accent)',
        flexShrink: 0,
        boxShadow: '0 0 5px var(--accent)',
      }}
    />
  );
}

// ── file row ──────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: MockFileTouched;
}

function FileRow({ file }: FileRowProps): React.ReactElement {
  const isEditing = file.status === 'editing';
  return (
    <div
      data-testid="files-touched-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 4,
        border: isEditing ? '1px solid var(--accent-edge)' : '1px solid transparent',
        background: isEditing ? 'var(--accent-tint)' : 'transparent',
      }}
    >
      <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
        <Icon name="File" size={11} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--ink-2)',
          direction: 'rtl',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          unicodeBidi: 'plaintext',
        }}
      >
        {file.path}
      </span>
      <DiffBadges adds={file.adds} dels={file.dels} />
      {isEditing && <LiveDot />}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface FilesTouchedProps {
  data: MockFileTouched[];
}

export function FilesTouched({ data }: FilesTouchedProps): React.ReactElement {
  const files = data;
  return (
    <div data-testid="files-touched" style={{ paddingTop: 6, paddingBottom: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px 6px',
        }}
      >
        <span
          style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)' }}
        >
          FILES TOUCHED
        </span>
        <span
          style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}
        >
          {files.length}
        </span>
      </div>
      {files.map((f) => (
        <FileRow key={f.path} file={f} />
      ))}
    </div>
  );
}
