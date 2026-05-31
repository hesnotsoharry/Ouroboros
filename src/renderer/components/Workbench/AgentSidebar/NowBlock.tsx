/**
 * NowBlock — §09 ① current tool call.
 *
 * Displays the live executing tool: glyph tile + name → path, one-line
 * description, duration pill, and an indeterminate/determinate progress bar.
 * Static mock data only — no IPC or hooks (Wave 3 swaps the source).
 */

import React from 'react';

import { Icon, IconName } from '../../shared/Icon';
import type { MockNowToolCall } from '../workbenchMockData';

// ── helpers ───────────────────────────────────────────────────────────────────

function toolIcon(tool: string): IconName {
  const map: Record<string, IconName> = {
    Edit: 'Edit',
    Write: 'Write',
    Read: 'Read',
    Bash: 'Bash',
    Grep: 'Grep',
    Glob: 'Glob',
  };
  return map[tool] ?? 'Bolt';
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${(sec % 60).toString().padStart(2, '0')}s`;
}

// Inject shimmer keyframe once
if (typeof document !== 'undefined' && !document.getElementById('__nowblock-anim__')) {
  const s = document.createElement('style');
  s.id = '__nowblock-anim__';
  s.textContent = `@keyframes nowblock-shimmer {
    0%   { transform: translateX(-120%); }
    100% { transform: translateX(300%); }
  }`;
  document.head.appendChild(s);
}

// ── sub-components ────────────────────────────────────────────────────────────

interface GlyphTileProps {
  tool: string;
}

function GlyphTile({ tool }: GlyphTileProps): React.ReactElement {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        flexShrink: 0,
        background: 'var(--accent-tint)',
        border: '1px solid var(--accent-edge)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent)',
      }}
    >
      <Icon name={toolIcon(tool)} size={14} />
    </div>
  );
}

interface ProgressBarProps {
  progress?: number;
}

function ProgressBar({ progress }: ProgressBarProps): React.ReactElement {
  const indeterminate = progress === undefined;
  return (
    <div
      style={{ height: 3, borderRadius: 2, background: 'var(--stroke-faint)', overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%',
          width: indeterminate ? '40%' : `${(progress ?? 0) * 100}%`,
          background: 'linear-gradient(90deg, var(--accent), var(--accent-hi))',
          boxShadow: '0 0 6px var(--accent)',
          borderRadius: 2,
          animation: indeterminate ? 'nowblock-shimmer 1.4s ease-in-out infinite' : undefined,
        }}
      />
    </div>
  );
}

interface ToolRowProps {
  tool: string;
  target: string;
}

function ToolRow({ tool, target }: ToolRowProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <GlyphTile tool={tool} />
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--ink-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: 'var(--accent)' }}>{tool}</span>
        <span style={{ color: 'var(--ink-4)', margin: '0 3px' }}>→</span>
        {target}
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface NowBlockHeaderProps {
  elapsedSec: number;
  isIdle: boolean;
}

function NowBlockHeader({ elapsedSec, isIdle }: NowBlockHeaderProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-hi)' }}
      >
        NOW
      </span>
      {!isIdle && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--ink-3)',
            background: 'var(--accent-tint)',
            borderRadius: 4,
            padding: '1px 5px',
            border: '1px solid var(--accent-edge)',
          }}
        >
          {formatDuration(elapsedSec)}
        </span>
      )}
    </div>
  );
}

/**
 * Shown when a session IS bound to the pane but is ready between turns
 * (session_stop received, no new prompt yet). NOT the same as no session.
 */
function ReadyRow(): React.ReactElement {
  return (
    <div
      data-testid="now-block-idle"
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--ink-3)',
      }}
    >
      Agent Ready · Waiting for prompt
    </div>
  );
}

interface NowBlockProps {
  data: MockNowToolCall;
}

export function NowBlock({ data }: NowBlockProps): React.ReactElement {
  const isIdle = !data.tool;
  return (
    <div
      data-testid="now-block"
      style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <NowBlockHeader elapsedSec={data.elapsedSec} isIdle={isIdle} />
      {isIdle ? (
        <ReadyRow />
      ) : (
        <>
          <ToolRow tool={data.tool} target={data.target} />
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data.description}
          </div>
          <ProgressBar progress={data.progress} />
        </>
      )}
    </div>
  );
}
