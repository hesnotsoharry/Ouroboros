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

import { useApprovalContext } from '../../../contexts/ApprovalContext';
import { Icon } from '../../shared/Icon';
import { PermissionSidebarTakeover } from '../Permission/PermissionSidebarTakeover';
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

/** Panels 2–5: dimmed to 0.7 opacity while a permission request is pending. */
function PanelStack({
  agentData,
  dim,
}: {
  agentData: ReturnType<typeof useWorkbenchAgentData>;
  dim: boolean;
}): React.ReactElement {
  return (
    <div style={{ opacity: dim ? 0.7 : 1 }}>
      <PanelDivider />
      <ContextBlock data={agentData.context} />
      <PanelDivider />
      <FilesTouched data={agentData.filesTouched} />
      <PanelDivider />
      <LatestHunk hunk={agentData.latestHunk} />
      <PanelDivider />
      <HookTimeline events={agentData.timeline} />
    </div>
  );
}

/**
 * Reads approval state from context WITHOUT registering a keydown handler.
 * useWorkbenchApproval() is intentionally NOT called here — it owns the single
 * window keydown handler (ADR D3). Calling it again would register a duplicate.
 * Returns pre-bound handler props ready to spread onto PermissionSidebarTakeover.
 */
function useSidebarApproval() {
  const { pendingCount, requests, approve, reject, alwaysAllow } = useApprovalContext();
  const current = requests.length > 0 ? requests[0] : null;
  const takeoverProps = current
    ? {
        request: current,
        queuedCount: Math.max(0, pendingCount - 1),
        elapsedSec: Math.floor((Date.now() - current.timestamp) / 1000),
        onApprove: () => approve(current.requestId),
        onAlwaysAllow: () => alwaysAllow(current.requestId, current.sessionId, current.toolName),
        onDeny: (reason?: string) => reject(current.requestId, reason),
      }
    : null;
  return { current, isPending: current !== null, takeoverProps };
}

const SIDEBAR_SHELL_STYLE: React.CSSProperties = {
  width: 348,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--glass-panel)',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 'var(--r-md)',
  overflow: 'hidden',
  color: 'var(--ink)',
};

const SIDEBAR_SCROLL_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

export function AgentSidebar(): React.ReactElement {
  const agentData = useWorkbenchAgentData();
  const { isPending, takeoverProps } = useSidebarApproval();
  return (
    <div data-testid="workbench-agentsidebar" style={SIDEBAR_SHELL_STYLE}>
      <SidebarHeader />
      <div style={SIDEBAR_SCROLL_STYLE}>
        {isPending && takeoverProps ? (
          <PermissionSidebarTakeover {...takeoverProps} />
        ) : (
          <NowBlock data={agentData.now} />
        )}
        <PanelStack agentData={agentData} dim={isPending} />
      </div>
    </div>
  );
}
