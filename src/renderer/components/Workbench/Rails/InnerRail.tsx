/**
 * InnerRail — 256 px wide inner rail (canon §07, dual mode).
 *
 * Top: command-palette button.
 * Header: add-project button.
 * Running section: live sessions from useWorkbenchAgentData.
 * Files section (scrollable, flex 1): live file tree via WorkbenchFileTree.
 *
 * BranchFooter and InnerRailProjectDropdown were removed (titlebar owns both).
 * RunningSectionHeader was removed per user request.
 */

import React from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { Icon } from '../../shared/Icon';
import { useWorkbenchAgentData, type WorkbenchSession } from '../useWorkbenchAgentData';
import { useWorkbenchProjects } from '../useWorkbenchProjects';
import { iconBtnStyle, SectionLabel, StatusDot } from './InnerRail.parts';
import { InnerRailAddProjectButton } from './InnerRailAddProjectButton';
import { WorkbenchFileTree } from './WorkbenchFileTree';

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
  onSelectFile?: (path: string) => void;
}

export function InnerRail({ onCollapse, onSelectFile }: InnerRailProps): React.ReactElement {
  const { projectRoot } = useProject();
  const { sessions } = useWorkbenchAgentData();
  // projectId is basename(cwd); match against basename of the current project root.
  const currentProjectId = projectRoot
    ? (projectRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? '')
    : '';
  const currentSessions = sessions.filter((s) => s.projectId === currentProjectId);

  return (
    <div data-testid="workbench-innerrail" style={RAIL_STYLE}>
      <CommandPaletteButton />
      <InnerRailHeader />
      <RunningSection
        currentSessions={currentSessions}
        onCollapse={onCollapse}
      />
      <div style={{ height: 1, background: 'var(--stroke-faint)', margin: '0 10px' }} />
      <FilesSection onSelectFile={onSelectFile} />
    </div>
  );
}

// ── Command palette button ────────────────────────────────────────────────────

const PALETTE_BTN_STYLE: React.CSSProperties = {
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 8px',
  background: 'var(--surface-inset, rgba(255,255,255,0.03))',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 6,
  color: 'var(--ink-3)',
  cursor: 'pointer',
  fontSize: 11,
};

const PALETTE_LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  color: 'var(--ink-4)',
  fontFamily: 'var(--font-sans)',
};

const PALETTE_KBD_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--ink-4)',
};

function dispatchCommandPalette(): void {
  window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
}

function CommandPaletteButton(): React.ReactElement {
  return (
    <div style={{ padding: '8px 10px 0', flexShrink: 0 }}>
      <button type="button" title="Command palette (Ctrl K)" onClick={dispatchCommandPalette} style={PALETTE_BTN_STYLE}>
        <Icon name="Search" size={12} />
        <span style={PALETTE_LABEL_STYLE}>Search commands…</span>
        <span style={PALETTE_KBD_STYLE}>Ctrl K</span>
      </button>
    </div>
  );
}

// ── Project header ────────────────────────────────────────────────────────────

function InnerRailHeader(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 10px 4px',
        flexShrink: 0,
      }}
    >
      <InnerRailAddProjectButton />
    </div>
  );
}

// ── Running section ───────────────────────────────────────────────────────────

function RunningSection({
  currentSessions,
}: {
  currentSessions: WorkbenchSession[];
  onCollapse?: () => void;
}): React.ReactElement {
  return (
    <div style={{ padding: '8px 10px 8px', flexShrink: 0 }}>
      {currentSessions.map((s) => (
        <SessionRow key={s.id} session={s} isCurrent />
      ))}
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
      <SessionLabel label={session.label} sub={session.sub} />
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

const ELLIPSIS: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function SessionLabel({
  label,
  sub,
}: {
  label: string;
  sub: string;
}): React.ReactElement {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink)', ...ELLIPSIS }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', ...ELLIPSIS }}>{sub}</div>
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
        <button
          title="Search files"
          style={iconBtnStyle}
          onClick={() => window.dispatchEvent(new CustomEvent('agent-ide:open-file-picker'))}
        >
          <Icon name="Search" size={11} />
        </button>
        <button title="New file" onClick={() => undefined} style={iconBtnStyle}>
          <Icon name="Plus" size={11} />
        </button>
      </div>
    </div>
  );
}

function FilesSection({
  onSelectFile,
}: {
  onSelectFile?: (path: string) => void;
}): React.ReactElement {
  const { projectRoot } = useProject();
  return (
    <div style={{ flex: 1, padding: '10px 6px', overflowY: 'auto', minHeight: 0 }}>
      <FilesSectionHeader />
      {projectRoot !== null && projectRoot !== '' && (
        <WorkbenchFileTree rootPath={projectRoot} onSelectFile={onSelectFile} />
      )}
    </div>
  );
}
