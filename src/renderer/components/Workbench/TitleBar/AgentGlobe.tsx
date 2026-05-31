/**
 * AgentGlobe — centred live-agent pill in the title bar (canon §06).
 *
 * Wave 3: self-driving — calls useWorkbenchAgentData() and exposes the
 * derived WorkbenchAgentState via `data-state` on the root button.
 * No `state` prop; no mock data imports.
 *
 * Running state: gradient bg, accent-edge border, 3s shimmer sweep.
 * Other active states: adapted tone (awaiting=warning, errored=error).
 * Idle/fresh/done states: 0.6 opacity, no shimmer.
 *
 * Shimmer keyframe injected once into <head> via the shared/CLAUDE.md pattern
 * (id-guarded createElement — avoids React <style> tags and duplicate injection).
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import type { WorkbenchAgentState } from '../useWorkbenchGlobeData';
import { useWorkbenchGlobeData } from '../useWorkbenchGlobeData';

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

// ── Re-export so callers can reference the type ───────────────────────────────

export type { WorkbenchAgentState as GlobeState };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60}s`;
}

function isActiveState(state: WorkbenchAgentState): boolean {
  return state === 'running' || state === 'thinking' || state === 'awaiting' || state === 'errored';
}

// 'ready' is not active — no shimmer, reduced opacity (same as 'done' and 'fresh').

// ── Shared sub-components ─────────────────────────────────────────────────────

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

// ── State-specific content ────────────────────────────────────────────────────

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

function RunningContent({
  model,
  toolName,
  target,
  duration,
}: RunningContentProps): React.ReactElement {
  return (
    <>
      <span style={sparkleStyle}>
        <Icon name="Sparkle" size={12} />
      </span>
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

function ThinkingContent({ model }: { model: string }): React.ReactElement {
  return (
    <>
      <span style={sparkleStyle}>
        <Icon name="Sparkle" size={12} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{model}</span>
      <GlobeDivider />
      <span style={{ fontSize: 11, color: 'var(--ink-2)', fontStyle: 'italic' }}>thinking…</span>
      <LiveDot />
    </>
  );
}

function AwaitingContent({ model }: { model: string }): React.ReactElement {
  return (
    <>
      <span style={{ color: 'var(--warning, #fbbf24)', display: 'inline-flex' }}>
        <Icon name="Sparkle" size={12} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{model}</span>
      <GlobeDivider />
      <span style={{ fontSize: 11, color: 'var(--warning, #fbbf24)' }}>awaiting permission</span>
    </>
  );
}

function ErroredContent({ model }: { model: string }): React.ReactElement {
  return (
    <>
      <span style={{ color: 'var(--error, #f87171)', display: 'inline-flex' }}>
        <Icon name="Sparkle" size={12} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{model}</span>
      <GlobeDivider />
      <span style={{ fontSize: 11, color: 'var(--error, #f87171)' }}>error</span>
    </>
  );
}

function DoneContent({ model }: { model: string }): React.ReactElement {
  return (
    <>
      <span style={{ color: 'var(--accent-hi, #a5b4fc)', display: 'inline-flex' }}>
        <Icon name="Sparkle" size={12} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{model}</span>
      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· done</span>
    </>
  );
}

function FreshContent(): React.ReactElement {
  return (
    <>
      <span style={{ color: 'var(--accent-hi, #a5b4fc)', display: 'inline-flex' }}>
        <Icon name="Sparkle" size={12} />
      </span>
      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· idle</span>
    </>
  );
}

function ReadyContent({ model }: { model: string }): React.ReactElement {
  return (
    <>
      <span style={{ color: 'var(--success, #34d399)', display: 'inline-flex' }}>
        <Icon name="Check" size={12} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{model}</span>
      <span style={{ fontSize: 11, color: 'var(--success, #34d399)' }}>· Agent Ready</span>
    </>
  );
}

// ── Globe container ───────────────────────────────────────────────────────────

const shimmerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
  animation: 'shimmerSweep 3s linear infinite',
  pointerEvents: 'none',
};

function buildGlobeStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 28,
    padding: '0 12px 0 10px',
    background:
      'linear-gradient(180deg, var(--accent-tint, rgba(129,140,248,0.14)), rgba(129,140,248,0.04))',
    border: '1px solid var(--accent-edge, rgba(129,140,248,0.35))',
    borderRadius: 999,
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    opacity: active ? 1 : 0.6,
    boxShadow:
      '0 0 0 1px rgba(129,140,248,0.04), 0 4px 20px -8px rgba(129,140,248,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    WebkitAppRegion: 'no-drag',
    flexShrink: 0,
  } as React.CSSProperties;
}

function GlobeContent(props: {
  state: WorkbenchAgentState;
  model: string;
  activeTool: string;
  target: string;
  elapsedSec: number;
}): React.ReactElement {
  const { state, model, activeTool, target, elapsedSec } = props;
  switch (state) {
    case 'running':
      return (
        <RunningContent model={model} toolName={activeTool} target={target} duration={elapsedSec} />
      );
    case 'thinking':
      return <ThinkingContent model={model} />;
    case 'awaiting':
      return <AwaitingContent model={model} />;
    case 'errored':
      return <ErroredContent model={model} />;
    case 'done':
      return <DoneContent model={model} />;
    case 'ready':
      return <ReadyContent model={model} />;
    case 'fresh':
    default:
      return <FreshContent />;
  }
}

// ── AgentGlobe ────────────────────────────────────────────────────────────────

export function AgentGlobe(): React.ReactElement {
  const { state, model, activeTool, target, elapsedSec } = useWorkbenchGlobeData();
  const active = isActiveState(state);

  return (
    <button
      data-testid="agent-globe"
      data-state={state}
      title="Click to focus active session"
      style={buildGlobeStyle(active)}
    >
      {active && <span aria-hidden style={shimmerStyle} />}
      <GlobeContent
        state={state}
        model={model}
        activeTool={activeTool}
        target={target}
        elapsedSec={elapsedSec}
      />
    </button>
  );
}
