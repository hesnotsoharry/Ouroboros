/**
 * UnifiedRail — 272 px wide unified-mode rail (canon §07).
 *
 * Wave 6 Phase 3: mounted when the breakpoint is 'unified' or forceUnified is
 * true. Wired to live data (useWorkbenchProjects, useGitBranch, useWorkbenchAgentData)
 * — NO MOCK_* in this surface (Risk #6).
 *
 * The rail adapts WorkbenchProject/WorkbenchSession (live types) to the MockProject/
 * MockSession shapes that UnifiedRail.parts.tsx consumes, bridging the data-source
 * change without redesigning the part components.
 *
 * Header: Layers icon · "Projects" · plus button · expand-to-dual button.
 * Body: one ProjectAccordion per project (active one is expanded).
 * Footer: branch icon · name (live from useGitBranch).
 */

import React, { useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useGitBranch } from '../../../hooks/useGitBranch';
import { Icon } from '../../shared/Icon';
import type { ProjectAgentStatusSummary } from '../useProjectAgentStatus';
import { useWorkbenchAgentData } from '../useWorkbenchAgentData';
import { useWorkbenchProjects, type WorkbenchProject } from '../useWorkbenchProjects';
import type { MockProject, MockSession } from '../workbenchMockData';
import { iconBtnStyle, ProjectAccordion } from './UnifiedRail.parts';

// ── Live → Mock adapters ──────────────────────────────────────────────────────

function adaptProject(p: WorkbenchProject): MockProject {
  return {
    id: p.path,
    name: p.name,
    color: p.color,
    initial: p.initial,
    branch: '',
    dirty: 0,
    active: p.active,
  };
}

function adaptSession(s: {
  id: string;
  projectId: string;
  kind: 'claude' | 'shell';
  label: string;
  sub: string;
  status: 'live' | 'warn' | 'idle';
  active: boolean;
}): MockSession {
  return {
    id: s.id,
    projectId: s.projectId,
    kind: s.kind,
    label: s.label,
    sub: s.sub,
    status: s.status,
    active: s.active,
  };
}

// ── Rail shell ────────────────────────────────────────────────────────────────

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

export interface UnifiedRailProps {
  onExpand?: () => void;
  /** Agent-status map keyed by project path. Provided by Workbench (has AgentEventsContext). */
  agentStatusMap?: ReadonlyMap<string, ProjectAgentStatusSummary>;
}

export function UnifiedRail({ onExpand, agentStatusMap }: UnifiedRailProps): React.ReactElement {
  const liveProjects = useWorkbenchProjects();
  const { sessions: liveSessions } = useWorkbenchAgentData();

  const projects = liveProjects.map(adaptProject);
  const sessions = liveSessions.map(adaptSession);
  const activeProject = projects.find((p) => p.active) ?? projects[0];

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    activeProject?.id ?? null,
  );

  const handleToggle = (id: string): void => {
    setExpandedProjectId((prev) => (prev === id ? null : id));
  };

  return (
    <div data-testid="workbench-unifiedrail" style={RAIL_STYLE}>
      <UnifiedHeader onExpand={onExpand} />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 8 }}>
        {liveProjects.map((lp, idx) => (
          <ProjectAccordion
            key={projects[idx].id}
            project={projects[idx]}
            expanded={projects[idx].id === expandedProjectId}
            sessions={sessions}
            onToggle={handleToggle}
            agentBorderMode={agentStatusMap?.get(lp.path)?.borderMode ?? 'none'}
          />
        ))}
      </div>
      <UnifiedFooter />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function UnifiedHeader({ onExpand }: { onExpand?: () => void }): React.ReactElement {
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
        onClick={onExpand ?? (() => undefined)}
        style={iconBtnStyle}
      >
        <Icon name="Chevron" size={11} />
      </button>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

const FOOTER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  padding: '8px 12px',
  borderTop: '1px solid var(--stroke-faint)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  color: 'var(--ink-3)',
};

function UnifiedFooter(): React.ReactElement {
  const { projectRoot } = useProject();
  const { branch } = useGitBranch(projectRoot);

  return (
    <div style={FOOTER_STYLE}>
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
