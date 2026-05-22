/**
 * Workbench — six-region canon shell (Wave 1, walking skeleton).
 *
 * Renders the canon §02 layout grid with labeled glass placeholders in each
 * of the six regions. Phases 2–6 replace each placeholder with a real region
 * component. This file owns only the grid assembly; region internals live in
 * their own subdirectories.
 *
 * Dimensions (canon §02):
 *   Title bar:   top, full width, 40px
 *   Status bar:  bottom, full width, 24px
 *   Project rail: left, 56px
 *   Inner rail:  next, 256px
 *   Centre pane: flex 1
 *   Agent rail:  right, 348px
 */

import React from 'react';

import { InnerRail } from './Rails/InnerRail';
import { ProjectRail } from './Rails/ProjectRail';
import { CenterPane } from './Terminals/CenterPane';
import { TitleBar } from './TitleBar/TitleBar';

function PlaceholderRegion({
  label,
  testId,
  style,
}: {
  label: string;
  testId: string;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--glass-panel)',
        border: '1px solid var(--stroke-inner)',
        borderRadius: 'var(--r-md)',
        color: 'var(--ink-3)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono, monospace)',
        letterSpacing: '0.06em',
        overflow: 'hidden',
        ...style,
      }}
    >
      {label}
    </div>
  );
}

const stageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100vw',
  // 100vh (not 100%) so the stage fills the window regardless of the parent
  // chain's height — the canon workbench owns the whole window, incl. its own
  // 40px title bar. With a plain 100% the 1fr middle row collapsed to content
  // height and every region squished to the top.
  height: '100vh',
  background: 'var(--bg-wash)',
  overflow: 'hidden',
};

const middleRowStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'row',
  minHeight: 0,
  gap: '2px',
  padding: '0 2px',
};

function MiddleRow(): React.ReactElement {
  return (
    <div style={middleRowStyle}>
      <ProjectRail />
      <InnerRail />
      <CenterPane />
      <PlaceholderRegion
        label="Agent Sidebar"
        testId="workbench-agentsidebar"
        style={{ width: '348px', flexShrink: 0 }}
      />
    </div>
  );
}

export function Workbench(): React.ReactElement {
  return (
    <div data-testid="workbench-root" style={stageStyle}>
      <TitleBar />
      <MiddleRow />
      <PlaceholderRegion
        label="Status Bar"
        testId="workbench-statusbar"
        style={{ height: '24px', flexShrink: 0, borderRadius: 0, border: 'none', borderTop: '1px solid var(--stroke-inner)' }}
      />
    </div>
  );
}
