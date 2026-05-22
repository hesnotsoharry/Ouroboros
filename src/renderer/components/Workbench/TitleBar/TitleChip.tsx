/**
 * TitleChip — reusable title-bar chip (project and branch variants).
 *
 * 26px tall, 8px horizontal padding, 7px radius.
 * Hover: bg rgba(255,255,255,0.04) + 1px --stroke-inner border.
 * Click handler is a no-op stub this wave.
 * -webkit-app-region: no-drag so hover/click reach the button.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';

// ── Shared chip wrapper ──────────────────────────────────────────────────────

interface TitleChipBaseProps {
  onClick?: () => void;
  children: React.ReactNode;
}

function TitleChipBase({ children, onClick }: TitleChipBaseProps): React.ReactElement {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      style={
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 26,
          padding: '0 8px',
          background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: `1px solid ${hovered ? 'var(--stroke-inner)' : 'transparent'}`,
          borderRadius: 7,
          color: 'var(--ink-2)',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          transition: 'background 120ms, border-color 120ms',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
        } as React.CSSProperties
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

// ── Project chip ─────────────────────────────────────────────────────────────

/** Minimal shape ProjectChip needs — compatible with WorkbenchProject. */
interface ProjectChipProject {
  name: string;
  initial: string;
  /** Deterministic HSL color — data-derived project identity, not a hardcoded hex. */
  color: string;
}

interface ProjectChipProps {
  project: ProjectChipProject;
  onClick?: () => void;
}

export function ProjectChip({ project, onClick }: ProjectChipProps): React.ReactElement {
  return (
    <TitleChipBase onClick={onClick}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: 5,
          // project.color is data-derived (deterministic HSL from path) — sanctioned exception.
          background: `linear-gradient(135deg, ${project.color}, ${project.color}80)`,
          color: '#0a0b14',
          fontSize: 10,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {project.initial}
      </span>
      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{project.name}</span>
      <Icon name="ChevronDown" size={10} style={{ color: 'var(--ink-4)', marginLeft: -2 }} />
    </TitleChipBase>
  );
}

// ── Branch chip ───────────────────────────────────────────────────────────────

interface BranchChipProps {
  branch: string;
  onClick?: () => void;
}

export function BranchChip({ branch, onClick }: BranchChipProps): React.ReactElement {
  return (
    <TitleChipBase onClick={onClick}>
      <Icon name="Branch" size={11} style={{ color: 'var(--ink-3)' }} />
      <span
        style={{
          color: 'var(--ink-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {branch}
      </span>
      <Icon name="ChevronDown" size={10} style={{ color: 'var(--ink-4)', marginLeft: -2 }} />
    </TitleChipBase>
  );
}
