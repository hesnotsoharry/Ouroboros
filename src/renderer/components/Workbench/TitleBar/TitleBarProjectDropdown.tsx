/**
 * TitleBarProjectDropdown — opens below the ProjectChip in the title bar.
 *
 * Lists all projects from useWorkbenchProjects(). Click a row → setActiveProjectRoot
 * + close. Active project highlighted. Esc or click-outside closes.
 *
 * D4: separate from InnerRailProjectDropdown — title bar has wider layout constraints.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useWorkbenchProjects, type WorkbenchProject } from '../useWorkbenchProjects';

// ── Styles ────────────────────────────────────────────────────────────────────

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 220,
  background: 'var(--glass-panel)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 'var(--r-md, 8px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 200,
  overflow: 'hidden',
  padding: '4px 0',
};

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
  onSelect,
}: {
  project: WorkbenchProject;
  onSelect: (path: string) => void;
}): React.ReactElement {
  return (
    <button
      style={rowStyle(project.active)}
      onClick={() => onSelect(project.path)}
      data-testid={`titlebar-project-row-${project.name}`}
    >
      <span style={miniChipStyle(project.color)}>{project.initial}</span>
      <span style={NAME_STYLE}>{project.name}</span>
      {project.active && <span style={CHECK_STYLE}>✓</span>}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface TitleBarProjectDropdownProps {
  onClose: () => void;
}

export function TitleBarProjectDropdown({
  onClose,
}: TitleBarProjectDropdownProps): React.ReactElement {
  const { setActiveProjectRoot } = useProject();
  const projects = useWorkbenchProjects();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (path: string) => {
      setActiveProjectRoot(path);
      onClose();
    },
    [setActiveProjectRoot, onClose],
  );

  useEffect(() => {
    const onMouse = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div ref={containerRef} style={DROPDOWN_STYLE} data-testid="titlebar-project-dropdown">
      {projects.map((p) => (
        <ProjectRow key={p.path} project={p} onSelect={handleSelect} />
      ))}
    </div>
  );
}
