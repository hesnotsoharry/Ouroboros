/**
 * UnifiedRail — 272 px wide unified-mode rail (canon §07).
 *
 * NOT mounted by Workbench.tsx this wave — dual mode is the default (Decision 3).
 * Built complete so the toggle can be wired in a later wave without rework.
 *
 * Header: Layers icon · "Projects" · plus button · chevron-to-dual.
 * Body: one ProjectAccordion per project (only the active one is expanded).
 * Footer: branch icon · name · +adds · -dels.
 *
 * Accordion subcomponents live in UnifiedRail.parts.tsx.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { MOCK_BRANCH, MOCK_PROJECTS } from '../workbenchMockData';
import { iconBtnStyle, ProjectAccordion } from './UnifiedRail.parts';

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

export function UnifiedRail(): React.ReactElement {
  const activeProject = MOCK_PROJECTS.find((p) => p.active) ?? MOCK_PROJECTS[0];

  return (
    <div data-testid="workbench-unifiedrail" style={RAIL_STYLE}>
      <UnifiedHeader />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 8 }}>
        {MOCK_PROJECTS.map((p) => (
          <ProjectAccordion key={p.id} project={p} expanded={p.id === activeProject.id} />
        ))}
      </div>
      <UnifiedFooter />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function UnifiedHeader(): React.ReactElement {
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
      <button title="Expand to dual rail" onClick={() => undefined} style={iconBtnStyle}>
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
        {MOCK_BRANCH.name}
      </span>
      <span style={{ color: 'var(--success)', flexShrink: 0 }}>+{MOCK_BRANCH.adds}</span>
      <span style={{ color: 'var(--error)', flexShrink: 0 }}>−{MOCK_BRANCH.dels}</span>
    </div>
  );
}
