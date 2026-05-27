/**
 * TitleBarProjectDropdown — opens below the ProjectChip in the title bar.
 *
 * Lists all projects from useWorkbenchProjects(). Click a row → setActiveProjectRoot
 * + close. Active project highlighted. Esc or click-outside closes.
 *
 * D4: separate from InnerRailProjectDropdown — title bar has wider layout constraints.
 */

import React, { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import {
  ProjectContextMenu,
  type ProjectCtxMenuState,
} from '../Rails/ProjectContextMenu';
import { useProjectCRUDActions } from '../useProjectCRUDActions';
import { useWorkbenchProjects, type WorkbenchProject } from '../useWorkbenchProjects';

// ── Styles ────────────────────────────────────────────────────────────────────

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 220,
  // Wave 10.1 — popover uses --glass-overlay (92% opacity), not --glass-panel
  // (35% opacity which bleeds Mica desktop content through, making dropdown
  // text unreadable). Overlay is the canon token for menus/dialogs.
  background: 'var(--glass-overlay)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 'var(--r-md, 8px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 200,
  overflow: 'hidden',
  padding: '4px 0',
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const onMouse = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [ref, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const NAME_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const CHECK_STYLE: React.CSSProperties = {
  color: 'var(--interactive-accent)',
  fontSize: 10,
  fontWeight: 700,
};

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-ui)',
    background: active ? 'var(--interactive-accent-subtle, rgba(99,102,241,0.15))' : 'transparent',
    color: active ? 'var(--ink)' : 'var(--ink-2)',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  };
}

function miniChipStyle(color: string): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: 4,
    // project.color is data-derived HSL — sanctioned exception.
    background: `linear-gradient(135deg, ${color}, ${color}80)`,
    color: '#0a0b14',
    fontSize: 9,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
}

function ProjectRow({
  project,
  onContextMenu,
  onSelect,
}: {
  project: WorkbenchProject;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
  onSelect: (path: string) => void;
}): React.ReactElement {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center' }}
      data-testid={`titlebar-project-row-${project.name}`}
      onClick={() => onSelect(project.path)}
      onContextMenu={(e) => onContextMenu(e, project.path)}
    >
      <button
        style={{ ...rowStyle(project.active), flex: 1 }}
        onClick={() => onSelect(project.path)}
      >
        <span style={miniChipStyle(project.color)}>{project.initial}</span>
        <span style={NAME_STYLE}>{project.name}</span>
        {project.active && <span style={CHECK_STYLE}>✓</span>}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function useDropdownContextMenu(removeProject: (path: string) => void): {
  handleContextMenu: (e: React.MouseEvent, path: string) => void;
  menuElement: React.ReactElement | null;
} {
  const [ctxMenu, setCtxMenu] = useState<ProjectCtxMenuState | null>(null);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, projectPath: path });
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
  return { handleContextMenu, menuElement };
}

interface TitleBarProjectDropdownProps {
  onClose: () => void;
}

export function TitleBarProjectDropdown({
  onClose,
}: TitleBarProjectDropdownProps): React.ReactElement {
  const { setActiveProjectRoot } = useProject();
  const { removeProject } = useProjectCRUDActions();
  const projects = useWorkbenchProjects();
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleContextMenu, menuElement } = useDropdownContextMenu(removeProject);

  const handleSelect = useCallback(
    (path: string) => {
      setActiveProjectRoot(path);
      onClose();
    },
    [setActiveProjectRoot, onClose],
  );

  useDismiss(containerRef, onClose);

  return (
    <div ref={containerRef} style={DROPDOWN_STYLE} data-testid="titlebar-project-dropdown">
      {projects.map((p) => (
        <ProjectRow
          key={p.path}
          project={p}
          onSelect={handleSelect}
          onContextMenu={handleContextMenu}
        />
      ))}
      {menuElement}
    </div>
  );
}
