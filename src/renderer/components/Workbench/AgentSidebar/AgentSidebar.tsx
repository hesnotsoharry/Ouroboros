/**
 * AgentSidebar — §09 right-edge panel (348 px).
 *
 * Container: header + five stacked panels (NowBlock, ContextBlock,
 * FilesTouched, LatestHunk, HookTimeline). All data is static mock;
 * Wave 3 swaps the source without changing shapes.
 *
 * Header: status dot · session label · sub-label · Hide panel button
 * Bottom border: --stroke-faint (per canon §09)
 */

import React, { useState } from 'react';

import { Icon } from '../../shared/Icon';
import { useWorkbenchTabsContext } from '../Terminals/WorkbenchTabsProvider';
import { useActiveWorkbenchFrame } from '../useActiveWorkbenchFrame';
import { useWorkbenchAgentData } from '../useWorkbenchAgentData';
import type { WorkbenchBreakpointMode } from '../useWorkbenchBreakpoint';
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
  onClick?: () => void;
}

function IconButton({
  title,
  onClick,
  children,
}: React.PropsWithChildren<IconButtonProps>): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 4,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        padding: 0,
        background: 'transparent',
        border: '1px solid var(--stroke-inner)',
        color: 'var(--ink-3)',
      }}
    >
      {children}
    </button>
  );
}

// ── header ────────────────────────────────────────────────────────────────────

const HEADER_FALLBACK = { label: '—', sub: '' };

interface SidebarHeaderProps {
  paneId?: string | null;
  onHide?: () => void;
}

function SidebarHeader({ paneId, onHide }: SidebarHeaderProps): React.ReactElement {
  const { sessions } = useWorkbenchAgentData(paneId);
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
      <IconButton title="Hide panel" onClick={onHide}>
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

// ── collapsed latest-hunk indicator ──────────────────────────────────────────

function LatestHunkCollapsed({ onExpand }: { onExpand: () => void }): React.ReactElement {
  return (
    <button
      data-testid="latest-hunk-collapsed"
      type="button"
      onClick={onExpand}
      title="Show latest hunk"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '5px 12px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--stroke-faint)',
        color: 'var(--ink-3)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Icon name="Eye" size={10} />
      LATEST HUNK ▾
    </button>
  );
}

// ── panel stack ───────────────────────────────────────────────────────────────

/** Panels 2–5: dimmed to 0.7 opacity while a permission request is pending. */
function PanelStack({
  agentData,
  dim,
  collapsed,
}: {
  agentData: ReturnType<typeof useWorkbenchAgentData>;
  dim: boolean;
  collapsed: boolean;
}): React.ReactElement {
  // Compact/unified collapse the Latest Hunk panel to a one-line indicator
  // (canon §16); clicking it expands the full hunk in place ("Click expands").
  const [hunkExpanded, setHunkExpanded] = useState(false);
  return (
    <div style={{ opacity: dim ? 0.7 : 1 }}>
      <PanelDivider />
      <ContextBlock data={agentData.context} />
      <PanelDivider />
      <FilesTouched data={agentData.filesTouched} />
      <PanelDivider />
      {collapsed && !hunkExpanded ? (
        <LatestHunkCollapsed onExpand={() => setHunkExpanded(true)} />
      ) : (
        <LatestHunk hunk={agentData.latestHunk} />
      )}
      <PanelDivider />
      <HookTimeline events={agentData.timeline} />
    </div>
  );
}


const SIDEBAR_BASE_STYLE: Omit<React.CSSProperties, 'width'> = {
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

// ── D4 empty state ────────────────────────────────────────────────────────────

const EMPTY_STATE_STYLE: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  color: 'var(--ink-3)',
  fontSize: 12,
  textAlign: 'center',
};

function SidebarEmptyState(): React.ReactElement {
  return <div style={EMPTY_STATE_STYLE}>No active claude session in this pane</div>;
}

// ── paneId derivation ─────────────────────────────────────────────────────────

/**
 * Derives the active pane id from the active frame + active tab.
 * Wave 13: AgentSidebar owns this derivation; it no longer receives claudeSessionId
 * as a prop (the heuristic binding is deleted — ADR D5).
 */
function useActivePaneId(): string | null {
  const { activeFrame } = useActiveWorkbenchFrame();
  const { tabs, activeTabId } = useWorkbenchTabsContext(activeFrame);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  return activeTab?.id ?? null;
}

interface AgentSidebarProps {
  breakpointMode?: WorkbenchBreakpointMode;
  onHide?: () => void;
}

export function AgentSidebar({
  breakpointMode = 'full',
  onHide,
}: AgentSidebarProps): React.ReactElement {
  const paneId = useActivePaneId();
  const agentData = useWorkbenchAgentData(paneId);
  const isFull = breakpointMode === 'full';
  const sidebarStyle: React.CSSProperties = { ...SIDEBAR_BASE_STYLE, width: isFull ? 348 : 300 };
  // D4: show empty state when no paneId-tagged session is active.
  const hasActiveSession = agentData.state !== 'fresh';

  return (
    <div data-testid="workbench-agentsidebar" style={sidebarStyle}>
      <SidebarHeader paneId={paneId} onHide={onHide} />
      <div style={SIDEBAR_SCROLL_STYLE}>
        {!hasActiveSession ? (
          <SidebarEmptyState />
        ) : (
          <NowBlock data={agentData.now} />
        )}
        {/* PanelStack renders unconditionally so breakpoint-gated sub-panels
            (e.g. latest-hunk-collapsed in COMPACT mode) remain in the DOM even
            when no active session is bound (empty data → panels show placeholders). */}
        <PanelStack agentData={agentData} dim={false} collapsed={!isFull} />
      </div>
    </div>
  );
}
