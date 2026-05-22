/**
 * UnifiedRail.parts.tsx — accordion & session-row subcomponents extracted
 * for line-count compliance. Internal to UnifiedRail; do NOT import from outside Rails/.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { MOCK_FILE_TREE, type MockProject, type MockSession } from '../workbenchMockData';
import { FileNode } from './FileNode';

// ── shared ─────────────────────────────────────────────────────────────────────

export const iconBtnStyle: React.CSSProperties = {
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

// ── accordion row style helper ────────────────────────────────────────────────

export function accordionRowStyle(expanded: boolean): React.CSSProperties {
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

// ── small decorators ──────────────────────────────────────────────────────────

export function RunningDot(): React.ReactElement {
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

interface ProjectDirtyBadgeProps {
  count: number;
}

export function ProjectDirtyBadge({ count }: ProjectDirtyBadgeProps): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 10,
        padding: '0 5px',
        borderRadius: 999,
        background: 'var(--warning-tint, rgba(251,191,36,0.15))',
        color: 'var(--warning)',
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

// ── project small chip ────────────────────────────────────────────────────────

interface ProjectSmallChipProps {
  project: MockProject;
  expanded: boolean;
}

export function ProjectSmallChip({ project, expanded }: ProjectSmallChipProps): React.ReactElement {
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

// ── accordion header ──────────────────────────────────────────────────────────

interface AccordionHeaderProps {
  project: MockProject;
  expanded: boolean;
  hasRunning: boolean;
}

export function AccordionHeader({
  project,
  expanded,
  hasRunning,
}: AccordionHeaderProps): React.ReactElement {
  return (
    <div onClick={() => undefined} style={accordionRowStyle(expanded)}>
      <Icon
        name={expanded ? 'ChevronDown' : 'Chevron'}
        size={11}
        style={{ color: 'var(--ink-4)', flexShrink: 0 }}
      />
      <ProjectSmallChip project={project} expanded={expanded} />
      <span
        style={{
          fontSize: 12.5,
          color: 'var(--ink)',
          fontWeight: expanded ? 600 : 500,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {project.name}
      </span>
      {project.dirty > 0 && <ProjectDirtyBadge count={project.dirty} />}
      {hasRunning && <RunningDot />}
    </div>
  );
}

// ── accordion mini chip ───────────────────────────────────────────────────────

interface AccordionMiniChipProps {
  color: string;
  initial: string;
}

function AccordionMiniChip({ color, initial }: AccordionMiniChipProps): React.ReactElement {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#0a0b14',
        fontSize: 8,
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

// ── accordion session row ─────────────────────────────────────────────────────

interface AccordionSessionRowProps {
  session: MockSession;
  projectColor: string;
  projectInitial: string;
}

export function AccordionSessionRow({
  session,
  projectColor,
  projectInitial,
}: AccordionSessionRowProps): React.ReactElement {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 6px',
    borderRadius: 7,
    cursor: 'pointer',
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
      <span
        style={{
          fontSize: 11,
          color: 'var(--ink)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {session.label}
      </span>
    </div>
  );
}

// ── body label ────────────────────────────────────────────────────────────────

interface BodyLabelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function BodyLabel({ children, style }: BodyLabelProps): React.ReactElement {
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

// ── accordion body ────────────────────────────────────────────────────────────

interface AccordionBodyProps {
  project: MockProject;
  sessions: MockSession[];
}

export function AccordionBody({ project, sessions }: AccordionBodyProps): React.ReactElement {
  return (
    <div style={{ paddingLeft: 8, marginTop: 4 }}>
      <BodyLabel>Running</BodyLabel>
      {sessions.map((s) => (
        <AccordionSessionRow
          key={s.id}
          session={s}
          projectColor={project.color}
          projectInitial={project.initial}
        />
      ))}
      <BodyLabel style={{ paddingTop: 8 }}>Files</BodyLabel>
      {MOCK_FILE_TREE.slice(0, 10).map((node, i) => (
        <FileNode key={`${node.name}-${String(i)}`} node={node} />
      ))}
    </div>
  );
}

// ── project accordion ─────────────────────────────────────────────────────────

interface ProjectAccordionProps {
  project: MockProject;
  expanded: boolean;
  /** Live sessions to filter for this project. Callers that wire live data pass
   *  these; legacy/test renders that rely on mock data may omit them. */
  sessions: MockSession[];
}

export function ProjectAccordion({
  project,
  expanded,
  sessions,
}: ProjectAccordionProps): React.ReactElement {
  const projectSessions = sessions.filter((s) => s.projectId === project.id);
  const hasRunning = projectSessions.some((s) => s.status === 'live');

  return (
    <div style={{ marginBottom: 6 }}>
      <AccordionHeader project={project} expanded={expanded} hasRunning={hasRunning} />
      {expanded && <AccordionBody project={project} sessions={projectSessions} />}
    </div>
  );
}
