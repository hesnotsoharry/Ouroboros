/**
 * TitleBar — 40px title bar (canon §06).
 *
 * Left → right:
 *   App mark · Project chip · Branch chip · [spacer] · AgentGlobe · [spacer]
 *   · Ctrl-K · Bell · Settings · WindowControls
 *
 * -webkit-app-region: drag on the bar background; no-drag on every interactive
 * child so clicks reach them.
 *
 * All data from workbenchMockData — no live IPC this wave.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { MOCK_PROJECTS } from '../workbenchMockData';
import { AgentGlobe } from './AgentGlobe';
import { BranchChip, ProjectChip } from './TitleChip';
import { WindowControls } from './WindowControls';

// ── App mark ─────────────────────────────────────────────────────────────────

function AppMark(): React.ReactElement {
  return (
    <div
      aria-label="Agent IDE"
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        background: 'linear-gradient(135deg, var(--accent, #818cf8), var(--purple, #c084fc))',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-on-accent, #0a0b14)',
        fontSize: 11,
        fontWeight: 800,
        flexShrink: 0,
        boxShadow: 'var(--accent-glow, 0 2px 14px -2px rgba(129,140,248,0.5))',
      }}
    >
      A
    </div>
  );
}

// ── Spacer ────────────────────────────────────────────────────────────────────

function Spacer(): React.ReactElement {
  return <div style={{ flex: 1 }} />;
}

// ── Ctrl-K affordance ─────────────────────────────────────────────────────────

function CtrlKButton(): React.ReactElement {
  return (
    <button
      title="Command palette"
      style={
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 6px 4px 8px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--stroke-inner)',
          borderRadius: 6,
          color: 'var(--ink-3)',
          cursor: 'pointer',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
        } as React.CSSProperties
      }
    >
      <Icon name="Search" size={12} />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-4)',
        }}
      >
        Ctrl K
      </span>
    </button>
  );
}

// ── Bell button ───────────────────────────────────────────────────────────────

const MOCK_PENDING_COUNT = 3; // 3 pending permissions in mock data

function BellBadge(): React.ReactElement {
  return (
    <span
      aria-label="pending permissions"
      style={{
        position: 'absolute',
        top: 3,
        right: 3,
        width: 8,
        height: 8,
        borderRadius: 999,
        background: 'var(--warning, #fbbf24)',
        boxShadow: '0 0 6px var(--warning, #fbbf24), 0 0 0 2px var(--bg-wash, #0a0b14)',
      }}
    />
  );
}

function BellButton(): React.ReactElement {
  const hasPending = MOCK_PENDING_COUNT > 0;
  return (
    <button
      title={hasPending ? `${MOCK_PENDING_COUNT} pending permissions` : 'Notifications'}
      style={
        {
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          color: 'var(--ink-3)',
          cursor: 'pointer',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
        } as React.CSSProperties
      }
    >
      <Icon name="Bell" size={14} />
      {hasPending && <BellBadge />}
    </button>
  );
}

// ── Settings button ───────────────────────────────────────────────────────────

function SettingsButton(): React.ReactElement {
  return (
    <button
      title="Settings"
      style={
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          marginRight: 6,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          color: 'var(--ink-3)',
          cursor: 'pointer',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
        } as React.CSSProperties
      }
    >
      <Icon name="Settings" size={14} />
    </button>
  );
}

// ── TitleBar ─────────────────────────────────────────────────────────────────

export function TitleBar(): React.ReactElement {
  const activeProject = MOCK_PROJECTS.find((p) => p.active) ?? MOCK_PROJECTS[0];

  return (
    <div
      data-testid="workbench-titlebar"
      style={
        {
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 0 0 12px',
          gap: 8,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.005))',
          borderBottom: '1px solid var(--stroke-inner)',
          position: 'relative',
          zIndex: 5,
          WebkitAppRegion: 'drag',
        } as React.CSSProperties
      }
    >
      <AppMark />
      <ProjectChip project={activeProject} />
      <BranchChip branch={activeProject.branch} />
      <Spacer />
      <AgentGlobe />
      <Spacer />
      <CtrlKButton />
      <BellButton />
      <SettingsButton />
      <WindowControls />
    </div>
  );
}
