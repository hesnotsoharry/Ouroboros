/**
 * ProjectRail — outer left rail, 56 px wide (canon §07, dual mode).
 * Chips + add-project. Project list: useWorkbenchProjects(). Chip color: deterministic HSL from path.
 */

import React, { useCallback, useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { Icon } from '../../shared/Icon';
import { useProjectCRUDActions } from '../useProjectCRUDActions';
import { useWorkbenchProjects, type WorkbenchProject } from '../useWorkbenchProjects';
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

// ── Main component ────────────────────────────────────────────────────────────

interface ProjectRailProps {
  onCollapse?: () => void;
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

export function ProjectRail({ onCollapse }: ProjectRailProps): React.ReactElement {
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

function chipStyle(color: string, active: boolean): React.CSSProperties {
  return {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 11,
    // color is data-derived HSL — sanctioned exception per renderer color rule.
    background: active ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'rgba(255,255,255,0.04)',
    border: active ? '1px solid var(--stroke-strong)' : '1px solid var(--stroke-faint)',
    color: active ? '#0a0b14' : 'var(--ink-2)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 150ms',
    boxShadow: active ? `0 6px 18px -4px ${color}90, var(--inset-hi, none)` : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  };
}

function ActiveIndicator({ color }: { color: string }): React.ReactElement {
  return (
    <span
      style={{
        position: 'absolute',
        left: -10,
        top: 6,
        bottom: 6,
        width: 3,
        borderRadius: 999,
        // color is data-derived HSL — sanctioned exception per renderer color rule.
        background: color,
        boxShadow: `0 0 10px ${color}`,
      }}
    />
  );
}

const CHIP_WRAPPER_STYLE: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
};

const REMOVE_BTN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 1,
  right: 1,
  width: 14,
  height: 14,
  borderRadius: 3,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.45)',
  border: 'none',
  color: 'var(--ink)',
  cursor: 'pointer',
  fontSize: 9,
  lineHeight: '1',
  fontWeight: 700,
  zIndex: 1,
};

/** Inline-X shown only on stale chips (exists: false). Wave 14 D1 safety affordance. */
function StaleRemoveButton({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <button
      aria-label={`Remove ${name}`}
      data-testid={`remove-project-${name}`}
      style={REMOVE_BTN_STYLE}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      ×
    </button>
  );
}

function ProjectChip({
  project,
  onClick,
  onContextMenu,
  onRemove,
}: {
  project: WorkbenchProject;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRemove: () => void;
}): React.ReactElement {
  const { name, initial, color, active, exists } = project;
  // chipStyle already has position:relative — override to static here;
  // the wrapper div owns the positioning context.
  const innerStyle: React.CSSProperties = {
    ...chipStyle(color, active),
    position: 'static',
    flexShrink: undefined,
  };
  const wrapperStyle: React.CSSProperties = exists
    ? CHIP_WRAPPER_STYLE
    : { ...CHIP_WRAPPER_STYLE, opacity: 0.5 };
  return (
    <div
      style={wrapperStyle}
      data-testid={`project-chip-${name}`}
      title={name}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <button aria-label={name} onClick={onClick} style={innerStyle}>
        {initial}
        {active && <ActiveIndicator color={color} />}
      </button>
      {!exists && <StaleRemoveButton name={name} onRemove={onRemove} />}
    </div>
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
