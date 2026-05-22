/**
 * InnerRail — 256 px wide inner rail (canon §07, dual mode).
 *
 * Two sections divided by a 1px --stroke-faint line:
 *   1. Running (top): live sessions from useWorkbenchAgentData. Current
 *      project first, 6 px spacer, then others.
 *   2. Files (scrollable, flex 1): mock file tree via FileNode (Wave 4).
 *
 * Footer: branch icon · name (live from useGitBranch). No interactions.
 */

import React from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useGitBranch } from '../../../hooks/useGitBranch';
import { Icon } from '../../shared/Icon';
import { useWorkbenchAgentData, type WorkbenchSession } from '../useWorkbenchAgentData';
import { useWorkbenchProjects } from '../useWorkbenchProjects';
import { MOCK_FILE_TREE } from '../workbenchMockData';
import { FileNode } from './FileNode';
import { iconBtnStyle, SectionLabel, StatusDot } from './InnerRail.parts';

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

interface InnerRailProps {
  onCollapse?: () => void;
}

export function InnerRail({ onCollapse }: InnerRailProps): React.ReactElement {
  const { projectRoot } = useProject();
  const { sessions } = useWorkbenchAgentData();
  // projectId is basename(cwd); match against basename of the current project root.
  const currentProjectId = projectRoot
    ? (projectRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? '')
    : '';
  const currentSessions = sessions.filter((s) => s.projectId === currentProjectId);
  const otherSessions = sessions.filter((s) => s.projectId !== currentProjectId);

  return (
    <div data-testid="workbench-innerrail" style={RAIL_STYLE}>
      <RunningSection
        currentSessions={currentSessions}
        otherSessions={otherSessions}
        onCollapse={onCollapse}
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
  onCollapse,
}: {
  currentSessions: WorkbenchSession[];
  otherSessions: WorkbenchSession[];
  onCollapse?: () => void;
}): React.ReactElement {
  return (
    <div style={{ padding: '12px 10px 8px', flexShrink: 0 }}>
      <RunningSectionHeader onCollapse={onCollapse} />
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

function RunningSectionHeader({ onCollapse }: { onCollapse?: () => void }): React.ReactElement {
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
        onClick={onCollapse ?? (() => undefined)}
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
  session: WorkbenchSession;
  isCurrent: boolean;
}): React.ReactElement {
  const projects = useWorkbenchProjects();
  // Match by basename of project path vs session.projectId (both are basenames).
  const project = projects.find(
    (p) => p.path.replace(/\\/g, '/').split('/').filter(Boolean).pop() === session.projectId,
  );
  const chipColor = project?.color ?? 'var(--ink-4)';
  const chipInitial = project?.initial ?? session.projectId[0]?.toUpperCase() ?? '?';

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
      <ProjectMiniChip color={chipColor} initial={chipInitial} />
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
  const { projectRoot } = useProject();
  const { branch } = useGitBranch(projectRoot);

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
      <span
        style={{
          color: 'var(--ink-2)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {/* +adds/−dels deferred: roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md */}
        {branch ?? '—'}
      </span>
    </div>
  );
}
