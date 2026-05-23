/**
 * ProjectRail — outer left rail, 56 px wide (canon §07, dual mode).
 * Chips + add-project + layout toggle + user avatar with stub profile menu.
 * Project list: useWorkbenchProjects(). Chip color: deterministic HSL from path.
 */

import React, { useCallback, useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { Icon } from '../../shared/Icon';
import { useWorkbenchProjects, type WorkbenchProject } from '../useWorkbenchProjects';
import { UserAvatar } from './ProjectRailAvatar';

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

const ICON_BTN_STYLE: React.CSSProperties = {
  width: 38,
  height: 38,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-3)',
  cursor: 'pointer',
  flexShrink: 0,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAddProject(addProjectRoot: (p: string) => void): () => void {
  return useCallback(async () => {
    if (!window.electronAPI?.files?.selectFolder) return;
    const result = await window.electronAPI.files.selectFolder();
    if (result.success && result.path) addProjectRoot(result.path);
  }, [addProjectRoot]) as () => void;
}

function useLayoutToggle(): [string, () => void] {
  const [label, setLabel] = useState<'A' | 'B'>('A');
  const toggle = useCallback(() => {
    const next = label === 'A' ? 'B' : 'A';
    setLabel(next);
    console.warn('[wave-10] Layout button click — Wave 12 wires the density mechanic');
    window.dispatchEvent(
      new CustomEvent('agent-ide:workbench-layout-toggle', { detail: { layout: next } }),
    );
  }, [label]);
  return [label, toggle];
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProjectRailProps {
  onCollapse?: () => void;
}

export function ProjectRail({ onCollapse }: ProjectRailProps): React.ReactElement {
  const projects = useWorkbenchProjects();
  const { setActiveProjectRoot, addProjectRoot } = useProject();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [layoutLabel, handleLayoutClick] = useLayoutToggle();
  const handleAddProject = useAddProject(addProjectRoot);

  return (
    <div data-testid="workbench-projectrail" style={RAIL_STYLE}>
      <CollapseHandle onCollapse={onCollapse} />
      {projects.map((p) => (
        <ProjectChip key={p.path} project={p} onClick={() => setActiveProjectRoot(p.path)} />
      ))}
      <AddProjectButton onClick={handleAddProject} />
      <div style={{ flex: 1 }} />
      <FooterButton title={`Layout: ${layoutLabel}`} onClick={handleLayoutClick}>
        <Icon name="Layers" size={15} />
      </FooterButton>
      <UserAvatar
        menuOpen={profileMenuOpen}
        onToggleMenu={() => setProfileMenuOpen((prev) => !prev)}
        onClose={() => setProfileMenuOpen(false)}
      />
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

function ProjectChip({
  project,
  onClick,
}: {
  project: WorkbenchProject;
  onClick: () => void;
}): React.ReactElement {
  const { name, initial, color, active } = project;
  return (
    <button
      title={name}
      onClick={onClick}
      style={chipStyle(color, active)}
      data-testid={`project-chip-${name}`}
    >
      {initial}
      {active && <ActiveIndicator color={color} />}
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

function FooterButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button title={title} onClick={onClick} style={ICON_BTN_STYLE}>
      {children}
    </button>
  );
}
