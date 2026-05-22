/**
 * HookTimeline — §09 ⑤ reverse-chronological hook event list.
 *
 * Adaptive cards rule (treatment B):
 *   running      → full glass card with progress bar
 *   most recent  → full card
 *   older        → collapsed one-liner at 0.7 opacity, expands on hover
 *
 * Vertical 1px rail (gradient accent → stroke-faint) on the left.
 * Static mock data only — Wave 3 wires live hook data.
 */

import React, { useState } from 'react';

import { Icon, IconName } from '../../shared/Icon';
import { MOCK_HOOK_EVENTS, MockHookEvent, MockToolEvent } from '../workbenchMockData';

// ── CSS injection ─────────────────────────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('__hooktimeline-anim__')) {
  const s = document.createElement('style');
  s.id = '__hooktimeline-anim__';
  s.textContent = `@keyframes hooktimeline-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px var(--accent); }
    50%       { opacity: 0.4; box-shadow: 0 0 3px var(--accent); }
  }`;
  document.head.appendChild(s);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function toolIcon(tool: string): IconName {
  const map: Record<string, IconName> = {
    Edit: 'Edit', Write: 'Write', Read: 'Read',
    Bash: 'Bash', Grep: 'Grep', Glob: 'Glob',
  };
  return map[tool] ?? 'Bolt';
}

function nodeColor(e: MockHookEvent): string {
  if (e.kind === 'prompt') return 'var(--accent)';
  if (e.kind === 'think') return 'var(--purple)';
  const t = e as MockToolEvent;
  if (t.status === 'running') return 'var(--accent)';
  if (t.status === 'warn') return 'var(--warning)';
  return 'var(--success)';
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function summaryText(e: MockHookEvent): string {
  if (e.kind === 'prompt') {
    const t = e.text;
    return `"${t.slice(0, 60)}${t.length > 60 ? '…' : ''}"`;
  }
  if (e.kind === 'think') return `thinking · ${formatMs(e.dur)}`;
  const t = e as MockToolEvent;
  return `${t.tool} → ${t.target.split('/').at(-1) ?? t.target}`;
}

// ── rail node ─────────────────────────────────────────────────────────────────

interface RailNodeProps { color: string; running: boolean }

function RailNode({ color, running }: RailNodeProps): React.ReactElement {
  return (
    <div style={{
      width: 9, height: 9, borderRadius: '50%',
      background: color, flexShrink: 0, zIndex: 1,
      animation: running ? 'hooktimeline-pulse 1.4s ease-in-out infinite' : undefined,
    }} />
  );
}

// ── prompt card ───────────────────────────────────────────────────────────────

interface PromptCardProps { text: string }

function PromptCard({ text }: PromptCardProps): React.ReactElement {
  return (
    <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--ink-2)' }}>
      {`"${text}"`}
    </span>
  );
}

// ── think card ────────────────────────────────────────────────────────────────

interface ThinkCardProps { dur: number }

function ThinkCard({ dur }: ThinkCardProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name="Bolt" size={11} style={{ color: 'var(--purple)' }} />
      <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>Thinking</span>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
        {formatMs(dur)}
      </span>
    </div>
  );
}

// ── tool card ─────────────────────────────────────────────────────────────────

interface ToolCardProps { event: MockToolEvent }

function ToolCard({ event }: ToolCardProps): React.ReactElement {
  const isRunning = event.status === 'running';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name={toolIcon(event.tool)} size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-mono, monospace)' }}>
          {event.tool}
        </span>
        {event.duration > 0 && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)', marginLeft: 'auto' }}>
            {formatMs(event.duration)}
          </span>
        )}
      </div>
      <span style={{
        fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        direction: 'rtl', unicodeBidi: 'plaintext',
      }}>
        {event.target}
      </span>
      {isRunning && (
        <div style={{ height: 2, borderRadius: 1, background: 'var(--stroke-faint)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: '40%',
            background: 'linear-gradient(90deg, var(--accent), var(--accent-hi))',
            animation: 'nowblock-shimmer 1.4s ease-in-out infinite',
          }} />
        </div>
      )}
    </div>
  );
}

// ── full card dispatcher ──────────────────────────────────────────────────────

interface FullCardProps { event: MockHookEvent }

function FullCard({ event }: FullCardProps): React.ReactElement {
  if (event.kind === 'prompt') return <PromptCard text={event.text} />;
  if (event.kind === 'think') return <ThinkCard dur={event.dur} />;
  return <ToolCard event={event as MockToolEvent} />;
}

// ── card body wrapper ─────────────────────────────────────────────────────────

interface CardBodyProps { event: MockHookEvent; elevated: boolean; showFull: boolean }

function CardBody({ event, elevated, showFull }: CardBodyProps): React.ReactElement {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: elevated ? 'var(--glass-panel)' : 'transparent',
      border: elevated ? '1px solid var(--stroke-inner)' : 'none',
      borderRadius: 6,
      padding: showFull ? '8px 10px' : '2px 0',
      transition: 'padding 0.15s ease',
    }}>
      {showFull ? (
        <FullCard event={event} />
      ) : (
        <span style={{
          fontSize: 11, color: 'var(--ink-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
        }}>
          {summaryText(event)}
        </span>
      )}
    </div>
  );
}

// ── single event row ──────────────────────────────────────────────────────────

interface EventRowProps { event: MockHookEvent; isRunning: boolean; isMostRecent: boolean }

function EventRow({ event, isRunning, isMostRecent }: EventRowProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const isCollapsed = !isRunning && !isMostRecent;
  const showFull = !isCollapsed || hovered;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '5px 8px 5px 0',
        opacity: isCollapsed && !hovered ? 0.7 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <div style={{ flexShrink: 0, paddingTop: 3, width: 24, display: 'flex', justifyContent: 'center' }}>
        <RailNode color={nodeColor(event)} running={isRunning} />
      </div>
      <CardBody event={event} elevated={isRunning || isMostRecent} showFull={showFull} />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface HookTimelineProps { events?: MockHookEvent[] }

export function HookTimeline({ events = MOCK_HOOK_EVENTS }: HookTimelineProps): React.ReactElement {
  const sorted = [...events].sort((a, b) => b.t - a.t);
  return (
    <div data-testid="hook-timeline" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 4px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
          TIMELINE
        </span>
        <button type="button" onClick={undefined} style={{
          fontSize: 10, color: 'var(--ink-4)', background: 'transparent', border: 'none', cursor: 'default', padding: 0,
        }}>
          View all
        </button>
      </div>
      <div style={{ position: 'relative', paddingLeft: 12, paddingRight: 4, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          position: 'absolute', left: 23, top: 0, bottom: 0, width: 1,
          background: 'linear-gradient(to bottom, var(--accent), var(--stroke-faint))',
          pointerEvents: 'none',
        }} />
        {sorted.map((event, idx) => (
          <EventRow
            key={event.id}
            event={event}
            isRunning={event.kind === 'tool' && (event as MockToolEvent).status === 'running'}
            isMostRecent={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}
