/**
 * HookTimeline — §09 ⑤ reverse-chronological hook event list.
 *
 * Adaptive cards rule (treatment B):
 *   running      → full glass card with progress bar
 *   most recent  → full card
 *   older        → collapsed one-liner at 0.7 opacity, expands on hover
 *
 * Vertical 1px rail (gradient accent → stroke-faint) on the left.
 * Wave 4 Phase 2: wired to live adapter data via `events` prop (required).
 * `think` events are absent from the live type (ADR D6 — no wire source).
 *
 * Card subcomponents live in HookTimeline.parts.tsx.
 */

import React from 'react';

import type { WorkbenchTimelineEvent } from '../useWorkbenchAgentData';
import type { MockToolEvent } from '../workbenchMockData';
import { EventRow } from './HookTimeline.parts';

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

// ── timeline header ───────────────────────────────────────────────────────────

function TimelineHeader(): React.ReactElement {
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
        TIMELINE
      </span>
      <button
        type="button"
        onClick={undefined}
        style={{
          fontSize: 10,
          color: 'var(--ink-4)',
          background: 'transparent',
          border: 'none',
          cursor: 'default',
          padding: 0,
        }}
      >
        View all
      </button>
    </div>
  );
}

// ── timeline rail (event list + vertical rule) ────────────────────────────────

interface TimelineRailProps {
  sorted: WorkbenchTimelineEvent[];
}

function TimelineRail({ sorted }: TimelineRailProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: 12,
        paddingRight: 4,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 23,
          top: 0,
          bottom: 0,
          width: 1,
          background: 'linear-gradient(to bottom, var(--accent), var(--stroke-faint))',
          pointerEvents: 'none',
        }}
      />
      {sorted.map((event, idx) => (
        <EventRow
          key={event.id}
          event={event}
          isRunning={event.kind === 'tool' && (event as MockToolEvent).status === 'running'}
          isMostRecent={idx === 0}
        />
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface HookTimelineProps {
  events: WorkbenchTimelineEvent[];
}

export function HookTimeline({ events }: HookTimelineProps): React.ReactElement {
  const sorted = [...events].sort((a, b) => b.t - a.t);
  return (
    <div data-testid="hook-timeline" style={{ display: 'flex', flexDirection: 'column' }}>
      <TimelineHeader />
      <TimelineRail sorted={sorted} />
    </div>
  );
}
