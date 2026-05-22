/**
 * ProjectRail — outer left rail, 56 px wide (canon §07, dual mode).
 *
 * From top to bottom:
 *   Collapse handle (chevron → unified, no-op stub)
 *   Project chips (38×38, radius 11, gradient + active indicator)
 *   Add-project button (dashed border)
 *   [spacer]
 *   Layout selector button
 *   User avatar button
 *
 * Phase 2 live sources:
 *   - project list: useWorkbenchProjects() (open roots + recents, deduped)
 *   - chip color: deterministic HSL from path (data-derived, not hardcoded hex)
 *
 * Dirty badge omitted — per-project git fan-out deferred to follow-up:
 *   roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { useWorkbenchProjects, type WorkbenchProject } from '../useWorkbenchProjects';

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

interface ProjectRailProps {
  onCollapse?: () => void;
}

export function ProjectRail({ onCollapse }: ProjectRailProps): React.ReactElement {
  const projects = useWorkbenchProjects();

  return (
    <div data-testid="workbench-projectrail" style={RAIL_STYLE}>
      <CollapseHandle onCollapse={onCollapse} />

      {projects.map((p) => (
        <ProjectChip key={p.path} project={p} />
      ))}

      <AddProjectButton />

      <div style={{ flex: 1 }} />

      <FooterButton title="Layout">
        <Icon name="Layers" size={15} />
      </FooterButton>
      <UserAvatar />
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

function ProjectChip({ project }: { project: WorkbenchProject }): React.ReactElement {
  const { name, initial, color, active } = project;

  const chipStyle: React.CSSProperties = {
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

  return (
    <button title={name} onClick={() => undefined} style={chipStyle}>
      {initial}
      {active && <ActiveIndicator color={color} />}
    </button>
  );
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

function AddProjectButton(): React.ReactElement {
  return (
    <button
      title="Add project"
      onClick={() => undefined}
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      title={title}
      onClick={() => undefined}
      style={{
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
      }}
    >
      {children}
    </button>
  );
}

function UserAvatar(): React.ReactElement {
  return (
    <button
      title="Profile"
      onClick={() => undefined}
      style={{
        width: 38,
        height: 38,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: 'linear-gradient(135deg, var(--accent), var(--purple, #c084fc))',
          display: 'block',
          flexShrink: 0,
        }}
      />
    </button>
  );
}
