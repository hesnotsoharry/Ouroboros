/**
 * ContextBlock — §09 ② token usage donut + session meta.
 *
 * 56×56 SVG donut (radius 22, stroke 4px, accent + glow), centre percent + "USED",
 * right column: CONTEXT label · used/max tokens · elapsed · cost.
 * Static mock data only — Wave 3 wires live hook data.
 */

import React from 'react';

import { MOCK_CONTEXT_STATS, MockContextStats } from '../workbenchMockData';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${(sec % 60).toString().padStart(2, '0')}s`;
}

// ── donut constants ───────────────────────────────────────────────────────────

const DONUT_SIZE = 56;
const DONUT_RADIUS = 22;
const DONUT_STROKE = 4;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const CENTER = DONUT_SIZE / 2;

// ── donut arcs ────────────────────────────────────────────────────────────────

interface DonutArcsProps { pct: number }

function DonutArcs({ pct }: DonutArcsProps): React.ReactElement {
  const progress = pct * CIRCUMFERENCE;
  return (
    <>
      <circle cx={CENTER} cy={CENTER} r={DONUT_RADIUS}
        fill="none" stroke="var(--stroke-faint)" strokeWidth={DONUT_STROKE} />
      <circle cx={CENTER} cy={CENTER} r={DONUT_RADIUS}
        fill="none" stroke="var(--accent)" strokeWidth={DONUT_STROKE}
        strokeDasharray={`${progress} ${CIRCUMFERENCE - progress}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
        style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
      />
    </>
  );
}

// ── donut ─────────────────────────────────────────────────────────────────────

interface DonutProps { used: number; max: number }

function Donut({ used, max }: DonutProps): React.ReactElement {
  const pct = Math.min(used / max, 1);
  const label = `${Math.round(pct * 100)}%`;
  return (
    <div style={{ position: 'relative', width: DONUT_SIZE, height: DONUT_SIZE, flexShrink: 0 }}>
      <svg width={DONUT_SIZE} height={DONUT_SIZE}
        viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        role="img" aria-label={`Context usage: ${label}`}>
        <DonutArcs pct={pct} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink)' }}>
          {label}
        </span>
        <span style={{ fontSize: 8, letterSpacing: '0.06em', color: 'var(--ink-3)' }}>USED</span>
      </div>
    </div>
  );
}

// ── stats column ──────────────────────────────────────────────────────────────

interface StatsColumnProps { data: MockContextStats }

function StatsColumn({ data }: StatsColumnProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
        CONTEXT
      </span>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-2)' }}>
        {formatK(data.usedTokens)} / {formatK(data.maxTokens)} tokens
      </span>
      <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)' }}>
        ⏱ {formatElapsed(data.elapsedSec)} · ${data.costUsd.toFixed(2)}
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface ContextBlockProps { data?: MockContextStats }

export function ContextBlock({ data = MOCK_CONTEXT_STATS }: ContextBlockProps): React.ReactElement {
  return (
    <div data-testid="context-block" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Donut used={data.usedTokens} max={data.maxTokens} />
      <StatsColumn data={data} />
    </div>
  );
}
