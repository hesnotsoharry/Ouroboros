/**
 * InnerRailProjectDropdown — project switcher for the InnerRail header.
 *
 * D4: a separate component from TitleBarProjectDropdown — the inner rail is a
 * narrow column (256px) with different layout constraints.
 *
 * Renders an inline trigger showing the active project name. Clicking opens a
 * compact dropdown list. Esc or click-outside closes. Selecting a project calls
 * setActiveProjectRoot + closes.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Closes a dropdown (via setOpen) on click-outside or Esc. */
function useDropdownDismiss(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  setOpen: (v: boolean) => void,
): void {
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, setOpen]);
}

import { useProject } from '../../../contexts/ProjectContext';
import { Icon } from '../../shared/Icon';
import { useWorkbenchProjects, type WorkbenchProject } from '../useWorkbenchProjects';

// ── Styles ────────────────────────────────────────────────────────────────────

const TRIGGER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 6px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  borderRadius: 6,
  width: '100%',
  textAlign: 'left',
};

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 2,
  // Wave 10.1 — popover uses --glass-overlay (92% opacity), not --glass-panel
  // (35% opacity). With Mica window transparency, the panel token bleeds
  // desktop content through and makes dropdown text unreadable. The overlay
  // token is the canon choice for menus/dialogs.
  background: 'var(--glass-overlay)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 'var(--r-md, 8px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  zIndex: 200,
  overflow: 'hidden',
  padding: '4px 0',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniChip({ color, initial }: { color: string; initial: string }): React.ReactElement {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        // project.color is data-derived HSL — sanctioned exception.
        background: `linear-gradient(135deg, ${color}, ${color}80)`,
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

function ProjectRow({
  project,
  onSelect,
}: {
  project: WorkbenchProject;
  onSelect: (path: string) => void;
}): React.ReactElement {
  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 11.5,
        fontFamily: 'var(--font-ui)',
        background: project.active
          ? 'var(--interactive-accent-subtle, rgba(99,102,241,0.15))'
          : 'transparent',
        color: project.active ? 'var(--ink)' : 'var(--ink-2)',
        border: 'none',
        width: '100%',
        textAlign: 'left',
      }}
      onClick={() => onSelect(project.path)}
      data-testid={`innerrail-project-row-${project.name}`}
    >
      <MiniChip color={project.color} initial={project.initial} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {project.name}
      </span>
      {project.active && (
        <span style={{ color: 'var(--interactive-accent)', fontSize: 10, fontWeight: 700 }}>✓</span>
      )}
    </button>
  );
}

function TriggerButton({
  active,
  open,
  onClick,
}: {
  active: WorkbenchProject | undefined;
  open: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button style={TRIGGER_STYLE} onClick={onClick} data-testid="innerrail-project-trigger">
      {active && <MiniChip color={active.color} initial={active.initial} />}
      <span
        style={{
          flex: 1,
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {active?.name ?? 'No project'}
      </span>
      <Icon
        name="ChevronDown"
        size={10}
        style={{
          color: 'var(--ink-4)',
          transform: open ? 'rotate(180deg)' : undefined,
          transition: 'transform 150ms',
          flexShrink: 0,
        }}
      />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function InnerRailProjectDropdown(): React.ReactElement {
  const { setActiveProjectRoot } = useProject();
  const projects = useWorkbenchProjects();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeProject = projects.find((p) => p.active) ?? projects[0];
  const handleSelect = useCallback(
    (path: string) => {
      setActiveProjectRoot(path);
      setOpen(false);
    },
    [setActiveProjectRoot],
  );
  useDropdownDismiss(containerRef, open, setOpen);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      data-testid="innerrail-project-dropdown"
    >
      <TriggerButton active={activeProject} open={open} onClick={() => setOpen((p) => !p)} />
      {open && (
        <div style={DROPDOWN_STYLE}>
          {projects.map((p) => (
            <ProjectRow key={p.path} project={p} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
