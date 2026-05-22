/**
 * UnifiedRail — 272 px wide unified-mode rail (canon §07).
 *
 * NOT mounted by Workbench.tsx this wave — dual mode is the default (Decision 3).
 * Built complete so the toggle can be wired in a later wave without rework.
 *
 * Header: Layers icon · "Projects" · plus button · chevron-to-dual.
 * Body: one ProjectAccordion per project (only the active one is expanded).
 * Footer: branch icon · name · +adds · -dels.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import {
  MOCK_BRANCH,
  MOCK_FILE_TREE,
  MOCK_PROJECTS,
  MOCK_SESSIONS,
  type MockProject,
  type MockSession,
} from '../workbenchMockData';
import { FileNode } from './FileNode';

const RAIL_STYLE: React.CSSProperties = {
  width: 272,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(14, 16, 26, 0.36)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  borderRight: '1px solid var(--stroke-faint)',
};

export function UnifiedRail(): React.ReactElement {
  const activeProject = MOCK_PROJECTS.find((p) => p.active) ?? MOCK_PROJECTS[0];

  return (
    <div data-testid="workbench-unifiedrail" style={RAIL_STYLE}>
      <UnifiedHeader />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 8 }}>
        {MOCK_PROJECTS.map((p) => (
          <ProjectAccordion
            key={p.id}
            project={p}
            expanded={p.id === activeProject.id}
          />
        ))}
      </div>
      <UnifiedFooter />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function UnifiedHeader(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 10px 8px',
        borderBottom: '1px solid var(--stroke-faint)',
        flexShrink: 0,
      }}
    >
      <Icon name="Layers" size={13} style={{ color: 'var(--accent-hi)' }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          flex: 1,
        }}
      >
        Projects
      </span>
      <button title="Add project" onClick={() => undefined} style={iconBtnStyle}>
        <Icon name="Plus" size={12} />
      </button>
      <button
        title="Expand to dual rail"
        onClick={() => undefined}
        style={iconBtnStyle}
      >
        <Icon name="Chevron" size={11} />
      </button>
    </div>
  );
}

// ── Accordion ─────────────────────────────────────────────────────────────────

function ProjectAccordion({
  project,
  expanded,
}: {
  project: MockProject;
  expanded: boolean;
}): React.ReactElement {
  const projectSessions = MOCK_SESSIONS.filter(
    (s) => s.projectId === project.id,
  );
  const hasRunning = projectSessions.some((s) => s.status === 'live');

  return (
    <div style={{ marginBottom: 6 }}>
      <AccordionHeader project={project} expanded={expanded} hasRunning={hasRunning} />
      {expanded && (
        <AccordionBody project={project} sessions={projectSessions} />
      )}
    </div>
  );
}

function accordionRowStyle(expanded: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 8,
    cursor: 'pointer',
    background: expanded ? 'var(--accent-tint)' : 'transparent',
    border: expanded ? '1px solid var(--accent-edge)' : '1px solid transparent',
  };
}

function AccordionHeader({
  project,
  expanded,
  hasRunning,
}: {
  project: MockProject;
  expanded: boolean;
  hasRunning: boolean;
}): React.ReactElement {
  return (
    <div onClick={() => undefined} style={accordionRowStyle(expanded)}>
      <Icon name={expanded ? 'ChevronDown' : 'Chevron'} size={11} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
      <ProjectSmallChip project={project} expanded={expanded} />
      <span style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: expanded ? 600 : 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.name}
      </span>
      {project.dirty > 0 && (
        <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 999, background: 'var(--warning-tint, rgba(251,191,36,0.15))', color: 'var(--warning)', flexShrink: 0 }}>
          {project.dirty}
        </span>
      )}
      {hasRunning && <RunningDot />}
    </div>
  );
}

function ProjectSmallChip({
  project,
  expanded,
}: {
  project: MockProject;
  expanded: boolean;
}): React.ReactElement {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        background: `linear-gradient(135deg, ${project.color}, ${project.color}cc)`,
        color: '#0a0b14',
        fontSize: 11,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: expanded ? `0 4px 10px -3px ${project.color}90` : 'none',
      }}
    >
      {project.initial}
    </span>
  );
}

function RunningDot(): React.ReactElement {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        background: 'var(--success)',
        boxShadow: '0 0 6px var(--success)',
        flexShrink: 0,
      }}
    />
  );
}

function AccordionBody({
  project,
  sessions,
}: {
  project: MockProject;
  sessions: MockSession[];
}): React.ReactElement {
  return (
    <div style={{ paddingLeft: 8, marginTop: 4 }}>
      <BodyLabel>Running</BodyLabel>
      {sessions.map((s) => (
        <AccordionSessionRow key={s.id} session={s} projectColor={project.color} projectInitial={project.initial} />
      ))}
      <BodyLabel style={{ paddingTop: 8 }}>Files</BodyLabel>
      {MOCK_FILE_TREE.slice(0, 10).map((node, i) => (
        <FileNode key={`${node.name}-${String(i)}`} node={node} />
      ))}
    </div>
  );
}

function BodyLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'var(--ink-4)',
        textTransform: 'uppercase',
        padding: '4px 8px 2px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function AccordionMiniChip({
  color,
  initial,
}: {
  color: string;
  initial: string;
}): React.ReactElement {
  return (
    <span
      style={{
        width: 14, height: 14, borderRadius: 3,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#0a0b14', fontSize: 8, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}

function AccordionSessionRow({
  session,
  projectColor,
  projectInitial,
}: {
  session: MockSession;
  projectColor: string;
  projectInitial: string;
}): React.ReactElement {
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 6px', borderRadius: 7, cursor: 'pointer',
    background: session.active ? 'var(--accent-tint)' : 'transparent',
    border: session.active ? '1px solid var(--accent-edge)' : '1px solid transparent',
    marginBottom: 1,
  };
  return (
    <div style={rowStyle}>
      <AccordionMiniChip color={projectColor} initial={projectInitial} />
      <Icon
        name={session.kind === 'claude' ? 'Sparkle' : 'Terminal'}
        size={10}
        style={{ color: session.active ? 'var(--accent-hi)' : 'var(--ink-3)', flexShrink: 0 }}
      />
      <span style={{ fontSize: 11, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {session.label}
      </span>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

const FOOTER_STYLE: React.CSSProperties = {
  flexShrink: 0, padding: '8px 12px', borderTop: '1px solid var(--stroke-faint)',
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)',
};

function UnifiedFooter(): React.ReactElement {
  return (
    <div style={FOOTER_STYLE}>
      <Icon name="Branch" size={12} />
      <span style={{ color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {MOCK_BRANCH.name}
      </span>
      <span style={{ color: 'var(--success)', flexShrink: 0 }}>+{MOCK_BRANCH.adds}</span>
      <span style={{ color: 'var(--error)', flexShrink: 0 }}>−{MOCK_BRANCH.dels}</span>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

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
