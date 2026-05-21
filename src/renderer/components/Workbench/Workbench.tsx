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
  width: '100%',
  height: '100%',
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
      <PlaceholderRegion
        label="Project Rail"
        testId="workbench-projectrail"
        style={{ width: '56px', flexShrink: 0 }}
      />
      <PlaceholderRegion
        label="Inner Rail"
        testId="workbench-innerrail"
        style={{ width: '256px', flexShrink: 0 }}
      />
      <PlaceholderRegion
        label="Terminals"
        testId="workbench-terminals"
        style={{ flex: 1, minWidth: 0 }}
      />
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
      <PlaceholderRegion
        label="Title Bar"
        testId="workbench-titlebar"
        style={{ height: '40px', flexShrink: 0, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--stroke-inner)' }}
      />
      <MiddleRow />
      <PlaceholderRegion
        label="Status Bar"
        testId="workbench-statusbar"
        style={{ height: '24px', flexShrink: 0, borderRadius: 0, border: 'none', borderTop: '1px solid var(--stroke-inner)' }}
      />
    </div>
  );
}
