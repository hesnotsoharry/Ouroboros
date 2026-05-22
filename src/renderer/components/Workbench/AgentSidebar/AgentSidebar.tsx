/**
 * AgentSidebar — §09 right-edge panel (348 px).
 *
 * Container: header + five stacked panels (NowBlock, ContextBlock,
 * FilesTouched, LatestHunk, HookTimeline). All data is static mock;
 * Wave 3 swaps the source without changing shapes.
 *
 * Header: status dot · session label · sub-label · Stop (no-op) · Maximize (no-op)
 * Bottom border: --stroke-faint (per canon §09)
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { useWorkbenchAgentData } from '../useWorkbenchAgentData';
import { ContextBlock } from './ContextBlock';
import { FilesTouched } from './FilesTouched';
import { HookTimeline } from './HookTimeline';
import { LatestHunk } from './LatestHunk';
import { NowBlock } from './NowBlock';

// ── header sub-components ─────────────────────────────────────────────────────

function StatusDot(): React.ReactElement {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'var(--accent)',
        boxShadow: '0 0 5px var(--accent)',
      }}
    />
  );
}

interface SessionLabelsProps {
  label: string;
  sub: string;
}

function SessionLabels({ label, sub }: SessionLabelsProps): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}
      >
        {sub}
      </span>
    </div>
  );
}

interface IconButtonProps {
  title: string;
  danger?: boolean;
}

function IconButton({
  title,
  danger = false,
  children,
}: React.PropsWithChildren<IconButtonProps>): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      onClick={undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 4,
        flexShrink: 0,
        cursor: 'default',
        padding: 0,
        background: danger ? 'var(--error-tint)' : 'transparent',
        border: danger
          ? '1px solid var(--error, rgba(248,113,113,0.4))'
          : '1px solid var(--stroke-inner)',
        color: danger ? 'var(--error)' : 'var(--ink-3)',
      }}
    >
      {children}
    </button>
  );
}

// ── header ────────────────────────────────────────────────────────────────────

const HEADER_FALLBACK = { label: '—', sub: '' };

function SidebarHeader(): React.ReactElement {
  const { sessions } = useWorkbenchAgentData();
  const primary = sessions.find((s) => s.active) ?? HEADER_FALLBACK;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 36,
        flexShrink: 0,
        borderBottom: '1px solid var(--stroke-faint)',
      }}
    >
      <StatusDot />
      <SessionLabels label={primary.label} sub={primary.sub} />
      <IconButton title="Stop" danger>
        <Icon name="Stop" size={11} />
      </IconButton>
      <IconButton title="Maximize sidebar">
        <Icon name="Maximize" size={11} />
      </IconButton>
    </div>
  );
}

// ── panel divider ─────────────────────────────────────────────────────────────

function PanelDivider(): React.ReactElement {
  return <div style={{ height: 1, background: 'var(--stroke-faint)', margin: '0 8px' }} />;
}

// ── AgentSidebar root ─────────────────────────────────────────────────────────

export function AgentSidebar(): React.ReactElement {
  const agentData = useWorkbenchAgentData();
  return (
    <div
      data-testid="workbench-agentsidebar"
      style={{
        width: 348,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--glass-panel)',
        border: '1px solid var(--stroke-inner)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        color: 'var(--ink)',
      }}
    >
      <SidebarHeader />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <NowBlock data={agentData.now} />
        <PanelDivider />
        <ContextBlock data={agentData.context} />
        <PanelDivider />
        <FilesTouched />
        <PanelDivider />
        <LatestHunk />
        <PanelDivider />
        <HookTimeline />
      </div>
    </div>
  );
}
