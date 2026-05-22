/**
 * ProjectRail — outer left rail, 56 px wide (canon §07, dual mode).
 *
 * From top to bottom:
 *   Collapse handle (chevron → unified, no-op stub)
 *   Project chips (38×38, radius 11, gradient + active indicator + dirty badge)
 *   Add-project button (dashed border)
 *   [spacer]
 *   Layout selector button
 *   User avatar button
 *
 * Static only — all data from workbenchMockData. Interactions are no-op stubs.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { MOCK_PROJECTS, type MockProject } from '../workbenchMockData';

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

export function ProjectRail(): React.ReactElement {
  const activeProject = MOCK_PROJECTS.find((p) => p.active) ?? MOCK_PROJECTS[0];

  return (
    <div data-testid="workbench-projectrail" style={RAIL_STYLE}>
      <CollapseHandle />

      {MOCK_PROJECTS.map((p) => (
        <ProjectChip key={p.id} project={p} isActive={p.id === activeProject.id} />
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

function CollapseHandle(): React.ReactElement {
  return (
    <button
      title="Collapse to unified rail"
      onClick={() => undefined}
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

function ProjectChip({
  project,
  isActive,
}: {
  project: MockProject;
  isActive: boolean;
}): React.ReactElement {
  const chipStyle: React.CSSProperties = {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 11,
    background: isActive
      ? `linear-gradient(135deg, ${project.color}, ${project.color}cc)`
      : 'rgba(255,255,255,0.04)',
    border: isActive ? '1px solid var(--stroke-strong)' : '1px solid var(--stroke-faint)',
    color: isActive ? '#0a0b14' : 'var(--ink-2)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 150ms',
    boxShadow: isActive ? `0 6px 18px -4px ${project.color}90, var(--inset-hi, none)` : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <button title={project.name} onClick={() => undefined} style={chipStyle}>
      {project.initial}
      {!isActive && project.dirty > 0 && <DirtyBadge count={project.dirty} />}
      {isActive && <ActiveIndicator color={project.color} />}
    </button>
  );
}

function DirtyBadge({ count }: { count: number }): React.ReactElement {
  return (
    <span
      style={{
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 14,
        height: 14,
        padding: '0 4px',
        borderRadius: 999,
        background: 'var(--warning)',
        color: '#0a0b14',
        fontSize: 9,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1.5px solid var(--wash-2, var(--bg))',
      }}
    >
      {count}
    </span>
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
