/**
 * HookTimeline.parts.tsx — card + rail subcomponents extracted for line-count compliance.
 *
 * All exports here are internal to HookTimeline; do NOT import from outside AgentSidebar.
 */

import React, { useState } from 'react';

import { Icon, IconName } from '../../shared/Icon';
import type { WorkbenchTimelineEvent } from '../useWorkbenchAgentData';
import type { MockToolEvent } from '../workbenchMockData';

// ── helpers (shared with HookTimeline) ───────────────────────────────────────

export function toolIcon(tool: string): IconName {
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

export function nodeColor(e: WorkbenchTimelineEvent): string {
  if (e.kind === 'prompt') return 'var(--accent)';
  const t = e as MockToolEvent;
  if (t.status === 'running') return 'var(--accent)';
  if (t.status === 'warn') return 'var(--warning)';
  return 'var(--success)';
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function summaryText(e: WorkbenchTimelineEvent): string {
  if (e.kind === 'prompt') {
    const t = e.text;
    return `"${t.slice(0, 60)}${t.length > 60 ? '…' : ''}"`;
  }
  const t = e as MockToolEvent;
  return `${t.tool} → ${t.target.split('/').at(-1) ?? t.target}`;
}

// ── rail node ─────────────────────────────────────────────────────────────────

interface RailNodeProps {
  color: string;
  running: boolean;
}

export function RailNode({ color, running }: RailNodeProps): React.ReactElement {
  return (
    <div
      style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        zIndex: 1,
        animation: running ? 'hooktimeline-pulse 1.4s ease-in-out infinite' : undefined,
      }}
    />
  );
}

// ── prompt card ───────────────────────────────────────────────────────────────

interface PromptCardProps {
  text: string;
}

export function PromptCard({ text }: PromptCardProps): React.ReactElement {
  return (
    <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--ink-2)' }}>{`"${text}"`}</span>
  );
}

// ── tool card running progress ────────────────────────────────────────────────

function ToolCardProgress(): React.ReactElement {
  return (
    <div
      style={{ height: 2, borderRadius: 1, background: 'var(--stroke-faint)', overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%',
          width: '40%',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-hi))',
          animation: 'nowblock-shimmer 1.4s ease-in-out infinite',
        }}
      />
    </div>
  );
}

// ── tool card header row ──────────────────────────────────────────────────────

interface ToolCardHeaderProps {
  tool: string;
  duration: number;
}

function ToolCardHeader({ tool, duration }: ToolCardHeaderProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name={toolIcon(tool)} size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      <span
        style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-mono, monospace)' }}
      >
        {tool}
      </span>
      {duration > 0 && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--ink-4)',
            marginLeft: 'auto',
          }}
        >
          {formatMs(duration)}
        </span>
      )}
    </div>
  );
}

// ── tool card ─────────────────────────────────────────────────────────────────

interface ToolCardProps {
  event: MockToolEvent;
}

export function ToolCard({ event }: ToolCardProps): React.ReactElement {
  const isRunning = event.status === 'running';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <ToolCardHeader tool={event.tool} duration={event.duration} />
      <span
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)',
          color: 'var(--ink-3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          direction: 'rtl',
          unicodeBidi: 'plaintext',
        }}
      >
        {event.target}
      </span>
      {isRunning && <ToolCardProgress />}
    </div>
  );
}

// ── full card dispatcher ──────────────────────────────────────────────────────

interface FullCardProps {
  event: WorkbenchTimelineEvent;
}

export function FullCard({ event }: FullCardProps): React.ReactElement {
  if (event.kind === 'prompt') return <PromptCard text={event.text} />;
  return <ToolCard event={event as MockToolEvent} />;
}

// ── card body wrapper ─────────────────────────────────────────────────────────

interface CardBodyProps {
  event: WorkbenchTimelineEvent;
  elevated: boolean;
  showFull: boolean;
}

export function CardBody({ event, elevated, showFull }: CardBodyProps): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: elevated ? 'var(--glass-panel)' : 'transparent',
        border: elevated ? '1px solid var(--stroke-inner)' : 'none',
        borderRadius: 6,
        padding: showFull ? '8px 10px' : '2px 0',
        transition: 'padding 0.15s ease',
      }}
    >
      {showFull ? (
        <FullCard event={event} />
      ) : (
        <span
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {summaryText(event)}
        </span>
      )}
    </div>
  );
}

// ── single event row ──────────────────────────────────────────────────────────

interface EventRowProps {
  event: WorkbenchTimelineEvent;
  isRunning: boolean;
  isMostRecent: boolean;
}

export function EventRow({ event, isRunning, isMostRecent }: EventRowProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const isCollapsed = !isRunning && !isMostRecent;
  const showFull = !isCollapsed || hovered;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '5px 8px 5px 0',
        opacity: isCollapsed && !hovered ? 0.7 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          paddingTop: 3,
          width: 24,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <RailNode color={nodeColor(event)} running={isRunning} />
      </div>
      <CardBody event={event} elevated={isRunning || isMostRecent} showFull={showFull} />
    </div>
  );
}
