/**
 * ProjectRail — outer left rail, 56 px wide (canon §07, dual mode).
 * Chips + add-project. Project list: useWorkbenchProjects(). Chip color: deterministic HSL from path.
 *
 * Wave N: Each chip now shows live agent-status overlays via ProjectAgentStatusSummary.
 * The agentStatusMap prop is supplied by Workbench (which has AgentEventsContext in scope).
 * When not provided (e.g. isolated tests), chips render with no status overlays.
 */

import React, { useCallback, useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { Icon } from '../../shared/Icon';
import type { ProjectAgentStatusSummary } from '../useProjectAgentStatus';
import { useProjectCRUDActions } from '../useProjectCRUDActions';
import { useWorkbenchProjects } from '../useWorkbenchProjects';
import { ProjectChip } from './ProjectChip';
import { ProjectContextMenu, type ProjectCtxMenuState } from './ProjectContextMenu';

// ── Styles ────────────────────────────────────────────────────────────────────

const RAIL_STYLE: React.CSSProperties = {
  width: 56,
  flexShrink: 0,
  padding: '10px 0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  background: 'var(--glass-rail, var(--glass-panel))',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  borderRight: '1px solid var(--stroke-faint)',
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAddProject(addProjectRoot: (p: string) => void): () => void {
  return useCallback(async () => {
    if (!window.electronAPI?.files?.selectFolder) return;
    const result = await window.electronAPI.files.selectFolder();
    if (result.success && result.path) addProjectRoot(result.path);
  }, [addProjectRoot]) as () => void;
}

function useRailContextMenu(removeProject: (path: string) => void): {
  ctxMenu: ProjectCtxMenuState | null;
  handleContextMenu: (e: React.MouseEvent, projectPath: string) => void;
  menuElement: React.ReactElement | null;
} {
  const [ctxMenu, setCtxMenu] = useState<ProjectCtxMenuState | null>(null);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, projectPath: string) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, projectPath });
    },
    [],
  );
  const menuElement = ctxMenu ? (
    <ProjectContextMenu
      x={ctxMenu.x}
      y={ctxMenu.y}
      projectPath={ctxMenu.projectPath}
      onRemove={removeProject}
      onDismiss={() => setCtxMenu(null)}
    />
  ) : null;
  return { ctxMenu, handleContextMenu, menuElement };
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_STATUS: ProjectAgentStatusSummary = {
  workingCount: 0,
  unseenFinished: 0,
  unseenAsking: 0,
  borderMode: 'none',
};

export interface ProjectRailProps {
  onCollapse?: () => void;
  /** Agent-status map keyed by project path. Provided by Workbench (has AgentEventsContext). */
  agentStatusMap?: ReadonlyMap<string, ProjectAgentStatusSummary>;
}

export function ProjectRail({ onCollapse, agentStatusMap }: ProjectRailProps): React.ReactElement {
  const projects = useWorkbenchProjects();
  const { setActiveProjectRoot, addProjectRoot } = useProject();
  const { removeProject } = useProjectCRUDActions();
  const handleAddProject = useAddProject(addProjectRoot);
  const { handleContextMenu, menuElement } = useRailContextMenu(removeProject);

  return (
    <div data-testid="workbench-projectrail" style={RAIL_STYLE}>
      <CollapseHandle onCollapse={onCollapse} />
      {projects.map((p) => (
        <ProjectChip
          key={p.path}
          project={p}
          agentStatus={agentStatusMap?.get(p.path) ?? EMPTY_STATUS}
          onClick={() => setActiveProjectRoot(p.path)}
          onContextMenu={(e) => handleContextMenu(e, p.path)}
          onRemove={() => removeProject(p.path)}
        />
      ))}
      <AddProjectButton onClick={handleAddProject} />
      {menuElement}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CollapseHandle({ onCollapse }: { onCollapse?: () => void }): React.ReactElement {
  return (
    <button
      title="Collapse to unified rail"
      onClick={onCollapse ?? (() => undefined)}
      style={{
        width: 24,
        height: 18,
        borderRadius: 6,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: 'var(--ink-4)',
        cursor: 'pointer',
        marginBottom: 2,
        flexShrink: 0,
      }}
    >
      <Icon name="Chevron" size={11} style={{ transform: 'rotate(180deg)' }} />
    </button>
  );
}

function AddProjectButton({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button
      title="Add project"
      onClick={onClick}
      data-testid="add-project-btn"
      style={{
        width: 38,
        height: 38,
        borderRadius: 11,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px dashed var(--stroke-inner)',
        color: 'var(--ink-4)',
        cursor: 'pointer',
        marginTop: 4,
        flexShrink: 0,
      }}
    >
      <Icon name="Plus" size={16} />
    </button>
  );
}
