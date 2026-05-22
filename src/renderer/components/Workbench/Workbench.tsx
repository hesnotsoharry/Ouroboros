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

import React, { useEffect, useState } from 'react';

import { AgentSidebar } from './AgentSidebar/AgentSidebar';
import { InnerRail } from './Rails/InnerRail';
import { ProjectRail } from './Rails/ProjectRail';
import { StatusBar } from './StatusBar';
import { CenterPane } from './Terminals/CenterPane';
import { TitleBar } from './TitleBar/TitleBar';

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
  position: 'relative',
};

const middleRowStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'row',
  minHeight: 0,
  gap: '2px',
  padding: '0 2px',
};

// Wave 6 Phase 2 — CRT scanline overlay (canon §15 Retro: "1 px stripes every 3 px
// at rgba(57,255,90,0.03) overlay"). Rendered only when data-scanlines="true" is set
// on :root by the theme bridge (Retro theme only). pointer-events:none so it never
// intercepts clicks. z-index matches the canon mockup's .wb-stage::after (10000).
const scanlineOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'repeating-linear-gradient(' +
    '0deg,' +
    ' rgba(57, 255, 90, 0.03) 0,' + // hardcoded: canon §15 CRT phosphor stripe — Retro-only effect color, not a themeable surface
    ' rgba(57, 255, 90, 0.03) 1px,' + // hardcoded: canon §15 CRT phosphor stripe — Retro-only effect color, not a themeable surface
    ' transparent 1px,' +
    ' transparent 3px' +
    ')',
  pointerEvents: 'none',
  zIndex: 10000,
  mixBlendMode: 'overlay',
};

/**
 * Reads the current data-scanlines attribute from :root and re-reads it
 * whenever the theme bridge fires the 'agent-ide:theme-applied' event.
 * Kept local to Workbench — scanlines are exclusively a Workbench concern.
 */
function useScanlines(): boolean {
  const [active, setActive] = useState(
    () => document.documentElement.dataset['scanlines'] === 'true',
  );

  useEffect(() => {
    const handler = (): void => {
      setActive(document.documentElement.dataset['scanlines'] === 'true');
    };
    window.addEventListener('agent-ide:theme-applied', handler);
    return (): void => window.removeEventListener('agent-ide:theme-applied', handler);
  }, []);

  return active;
}

function MiddleRow(): React.ReactElement {
  return (
    <div style={middleRowStyle}>
      <ProjectRail />
      <InnerRail />
      <CenterPane />
      <AgentSidebar />
    </div>
  );
}

export function Workbench(): React.ReactElement {
  const scanlines = useScanlines();
  return (
    <div data-testid="workbench-root" style={stageStyle}>
      <TitleBar />
      <MiddleRow />
      <StatusBar />
      {scanlines && (
        <div aria-hidden="true" data-testid="workbench-scanlines" style={scanlineOverlayStyle} />
      )}
    </div>
  );
}
