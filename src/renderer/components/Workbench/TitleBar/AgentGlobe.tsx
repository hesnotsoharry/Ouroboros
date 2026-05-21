/**
 * AgentGlobe — centred live-agent pill in the title bar (canon §06).
 *
 * Running state: gradient bg, accent-edge border, 3s shimmer sweep.
 * Idle state: 0.6 opacity, no shimmer.
 *
 * Shimmer keyframe injected once into <head> via the shared/CLAUDE.md pattern
 * (id-guarded createElement — avoids React <style> tags and duplicate injection).
 *
 * All data from workbenchMockData — no live IPC this wave.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { MOCK_CONTEXT_STATS, MOCK_HOOK_EVENTS } from '../workbenchMockData';

// ── Inject shimmer keyframe once ─────────────────────────────────────────────

const SHIMMER_STYLE_ID = '__workbench-globe-shimmer__';

function injectShimmer(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = SHIMMER_STYLE_ID;
  el.textContent = `
    @keyframes shimmerSweep {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }
  `;
  document.head.appendChild(el);
}

injectShimmer();

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

function getActiveToolEvent() {
  return MOCK_HOOK_EVENTS.filter((e) => e.kind === 'tool').at(-1);
}

// ── Divider ──────────────────────────────────────────────────────────────────

function GlobeDivider(): React.ReactElement {
  return (
    <span
      style={{
        width: 1,
        height: 14,
        background: 'var(--stroke-strong, rgba(255,255,255,0.14))',
        flexShrink: 0,
      }}
    />
  );
}

// ── Live dot ─────────────────────────────────────────────────────────────────

function LiveDot(): React.ReactElement {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: 'var(--success, #34d399)',
        boxShadow: '0 0 8px var(--success, #34d399)',
        flexShrink: 0,
      }}
    />
  );
}

// ── Running content ──────────────────────────────────────────────────────────

const sparkleStyle: React.CSSProperties = {
  color: 'var(--accent-hi, #a5b4fc)',
  display: 'inline-flex',
  filter: 'drop-shadow(0 0 4px var(--accent, #818cf8))',
};

const targetStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  color: 'var(--ink-3)',
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const durationStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  color: 'var(--accent-hi, #a5b4fc)',
  fontWeight: 600,
};

interface RunningContentProps {
  model: string;
  toolName: string;
  target: string;
  duration: number;
}

function RunningContent({ model, toolName, target, duration }: RunningContentProps): React.ReactElement {
  return (
    <>
      <span style={sparkleStyle}><Icon name="Sparkle" size={12} /></span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{model}</span>
      <GlobeDivider />
      <Icon name="Edit" size={11} style={{ color: 'var(--purple, #c084fc)' }} />
      <span style={{ fontSize: 11, color: 'var(--purple, #c084fc)', fontWeight: 500 }}>
        {toolName}
      </span>
      <span style={targetStyle}>{target}</span>
      <GlobeDivider />
      <span style={durationStyle}>{formatDuration(duration)}</span>
      <LiveDot />
    </>
  );
}

// ── Idle content ─────────────────────────────────────────────────────────────

function IdleContent({ model }: { model: string }): React.ReactElement {
  return (
    <>
      <span style={{ color: 'var(--accent-hi, #a5b4fc)', display: 'inline-flex' }}>
        <Icon name="Sparkle" size={12} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{model}</span>
      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· idle</span>
    </>
  );
}

// ── AgentGlobe ───────────────────────────────────────────────────────────────

export type GlobeState = 'running' | 'idle';

interface AgentGlobeProps {
  state?: GlobeState;
}

const shimmerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
  animation: 'shimmerSweep 3s linear infinite',
  pointerEvents: 'none',
};

function buildGlobeStyle(isRunning: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 28,
    padding: '0 12px 0 10px',
    background: 'linear-gradient(180deg, var(--accent-tint, rgba(129,140,248,0.14)), rgba(129,140,248,0.04))',
    border: '1px solid var(--accent-edge, rgba(129,140,248,0.35))',
    borderRadius: 999,
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    opacity: isRunning ? 1 : 0.6,
    boxShadow: '0 0 0 1px rgba(129,140,248,0.04), 0 4px 20px -8px rgba(129,140,248,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    WebkitAppRegion: 'no-drag',
    flexShrink: 0,
  } as React.CSSProperties;
}

export function AgentGlobe({ state = 'running' }: AgentGlobeProps): React.ReactElement {
  const model = MOCK_CONTEXT_STATS.model;
  const lastTool = getActiveToolEvent();
  const toolName = lastTool?.kind === 'tool' ? lastTool.tool : 'Edit';
  const target = lastTool?.kind === 'tool' ? lastTool.target : '';
  const duration = MOCK_CONTEXT_STATS.elapsedSec;
  const isRunning = state === 'running';

  return (
    <button data-testid="agent-globe" title="Click to focus active session" style={buildGlobeStyle(isRunning)}>
      {isRunning && <span aria-hidden style={shimmerStyle} />}
      {isRunning ? (
        <RunningContent model={model} toolName={toolName} target={target} duration={duration} />
      ) : (
        <IdleContent model={model} />
      )}
    </button>
  );
}
