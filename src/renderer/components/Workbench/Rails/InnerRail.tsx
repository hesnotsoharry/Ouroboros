/**
 * InnerRail — 256 px wide inner rail (canon §07, dual mode).
 *
 * Two sections divided by a 1px --stroke-faint line:
 *   1. Running (top): all active sessions across projects.
 *      Current project first, 6 px spacer, then others.
 *      Active session: --accent-tint bg + 1px --accent-edge border.
 *   2. Files (scrollable, flex 1): indented file tree via FileNode.
 *      Header label "FILES".
 *
 * Footer (full width): branch icon · name · spacer · +adds · -dels.
 *
 * Static only — data from workbenchMockData. No interactions this wave.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import {
  MOCK_BRANCH,
  MOCK_FILE_TREE,
  MOCK_PROJECTS,
  MOCK_SESSIONS,
  type MockSession,
} from '../workbenchMockData';
import { FileNode } from './FileNode';

const RAIL_STYLE: React.CSSProperties = {
  width: 256,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(14, 16, 26, 0.32)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  borderRight: '1px solid var(--stroke-faint)',
};

export function InnerRail(): React.ReactElement {
  const activeProjectId =
    MOCK_PROJECTS.find((p) => p.active)?.id ?? MOCK_PROJECTS[0].id;
  const currentSessions = MOCK_SESSIONS.filter(
    (s) => s.projectId === activeProjectId,
  );
  const otherSessions = MOCK_SESSIONS.filter(
    (s) => s.projectId !== activeProjectId,
  );

  return (
    <div data-testid="workbench-innerrail" style={RAIL_STYLE}>
      <RunningSection
        currentSessions={currentSessions}
        otherSessions={otherSessions}
      />
      <div style={{ height: 1, background: 'var(--stroke-faint)', margin: '0 10px' }} />
      <FilesSection />
      <BranchFooter />
    </div>
  );
}

// ── Running section ───────────────────────────────────────────────────────────

function RunningSection({
  currentSessions,
  otherSessions,
}: {
  currentSessions: MockSession[];
  otherSessions: MockSession[];
}): React.ReactElement {
  return (
    <div style={{ padding: '12px 10px 8px', flexShrink: 0 }}>
      <RunningSectionHeader />
      {currentSessions.map((s) => (
        <SessionRow key={s.id} session={s} isCurrent />
      ))}
      {otherSessions.length > 0 && <div style={{ height: 6 }} />}
      {otherSessions.map((s) => (
        <SessionRow key={s.id} session={s} isCurrent={false} />
      ))}
    </div>
  );
}

function RunningSectionHeader(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
        padding: '0 6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusDot status="live" />
        <SectionLabel>Running</SectionLabel>
      </div>
      <button
        title="Collapse to unified rail"
        onClick={() => undefined}
        style={iconBtnStyle}
      >
        <Icon name="Chevron" size={11} style={{ transform: 'rotate(180deg)' }} />
      </button>
    </div>
  );
}

function SessionRow({
  session,
  isCurrent,
}: {
  session: MockSession;
  isCurrent: boolean;
}): React.ReactElement {
  const activeProject =
    MOCK_PROJECTS.find((p) => p.id === session.projectId) ?? MOCK_PROJECTS[0];

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 6px',
    borderRadius: 8,
    cursor: 'pointer',
    background: session.active ? 'var(--accent-tint)' : 'transparent',
    border: session.active ? '1px solid var(--accent-edge)' : '1px solid transparent',
    marginBottom: 2,
    opacity: isCurrent ? 1 : 0.85,
  };

  return (
    <div style={rowStyle}>
      <ProjectMiniChip color={activeProject.color} initial={activeProject.initial} />
      <KindIcon kind={session.kind} active={session.active} />
      <SessionLabel label={session.label} sub={session.sub} active={session.active} />
      <StatusDot status={session.status} />
    </div>
  );
}

function ProjectMiniChip({
  color,
  initial,
}: {
  color: string;
  initial: string;
}): React.ReactElement {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#0a0b14',
        fontSize: 9,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}

function KindIcon({
  kind,
  active,
}: {
  kind: 'claude' | 'shell';
  active: boolean;
}): React.ReactElement {
  return (
    <span
      style={{
        color: active ? 'var(--accent-hi)' : 'var(--ink-3)',
        display: 'inline-flex',
        flexShrink: 0,
      }}
    >
      <Icon name={kind === 'claude' ? 'Sparkle' : 'Terminal'} size={11} />
    </span>
  );
}

function SessionLabel({
  label,
  sub,
  active,
}: {
  label: string;
  sub: string;
  active: boolean;
}): React.ReactElement {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 11.5,
          color: active ? 'var(--ink)' : 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--ink-3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {sub}
      </div>
    </div>
  );
}

// ── Files section ─────────────────────────────────────────────────────────────

function FilesSectionHeader(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
        padding: '0 8px',
      }}
    >
      <SectionLabel>Files</SectionLabel>
      <div style={{ display: 'flex', gap: 2 }}>
        <button title="Search files" onClick={() => undefined} style={iconBtnStyle}>
          <Icon name="Search" size={11} />
        </button>
        <button title="New file" onClick={() => undefined} style={iconBtnStyle}>
          <Icon name="Plus" size={11} />
        </button>
      </div>
    </div>
  );
}

function FilesSection(): React.ReactElement {
  return (
    <div style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', minHeight: 0 }}>
      <FilesSectionHeader />
      {MOCK_FILE_TREE.map((node, i) => (
        <FileNode key={`${node.name}-${String(i)}`} node={node} />
      ))}
    </div>
  );
}

// ── Git footer ────────────────────────────────────────────────────────────────

function BranchFooter(): React.ReactElement {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '8px 12px',
        borderTop: '1px solid var(--stroke-faint)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: 'var(--ink-3)',
      }}
    >
      <Icon name="Branch" size={12} />
      <span style={{ color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {MOCK_BRANCH.name}
      </span>
      <span style={{ color: 'var(--success)', flexShrink: 0 }}>+{MOCK_BRANCH.adds}</span>
      <span style={{ color: 'var(--error)', flexShrink: 0 }}>−{MOCK_BRANCH.dels}</span>
    </div>
  );
}

// ── Shared micro-components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

const STATUS_DOT_COLORS: Record<string, string> = {
  live: 'var(--success)',
  warn: 'var(--warning)',
  idle: 'var(--ink-4)',
};

function StatusDot({ status }: { status: string }): React.ReactElement {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: STATUS_DOT_COLORS[status] ?? 'var(--ink-4)',
        flexShrink: 0,
        boxShadow:
          status === 'live' ? '0 0 6px var(--success)' : 'none',
      }}
    />
  );
}

const iconBtnStyle: React.CSSProperties = {
  padding: 2,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-4)',
  cursor: 'pointer',
  borderRadius: 4,
};
