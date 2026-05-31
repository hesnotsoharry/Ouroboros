/**
 * Workbench — six-region canon shell (Wave 1, walking skeleton).
 *
 * Wave 6 Phase 3: responsive layout driven by useWorkbenchBreakpoint().
 *
 *   full    (≥1760) : ProjectRail + InnerRail; AgentSidebar 348px
 *   compact (1440–1759) : ProjectRail + InnerRail; AgentSidebar 300px; LatestHunk collapsed
 *   unified (<1440) : UnifiedRail only; AgentSidebar 300px
 *
 * forceUnified: manual collapse triggered by the rail collapse-handle buttons.
 * Effective left-rail mode = unified when breakpoint is 'unified' OR forceUnified.
 */

import React, { useEffect, useState } from 'react';

import { useProjectOptional } from '../../contexts/ProjectContext';
import { DiffReviewProvider } from '../DiffReview/DiffReviewManager';
import { Icon } from '../shared/Icon';
import { AgentSidebar } from './AgentSidebar/AgentSidebar';
import { WorkbenchCommandPalette } from './Overlays/WorkbenchCommandPalette';
import { WorkbenchFilePicker } from './Overlays/WorkbenchFilePicker';
import { WorkbenchFileViewerModal } from './Overlays/WorkbenchFileViewerModal';
import { WorkbenchSettingsOverlay } from './Overlays/WorkbenchSettingsOverlay';
import { InnerRail } from './Rails/InnerRail';
import { ProjectRail } from './Rails/ProjectRail';
import { UnifiedRail } from './Rails/UnifiedRail';
import { StatusBar } from './StatusBar';
import { CenterPane } from './Terminals/CenterPane';
import { WorkbenchTabsProvider } from './Terminals/WorkbenchTabsProvider';
import { TitleBar } from './TitleBar/TitleBar';
import { ActiveFrameProvider } from './useActiveWorkbenchFrame';
import { useMarkSeenOnFocus } from './useMarkSeenOnFocus';
import type { ProjectAgentStatusSummary } from './useProjectAgentStatus';
import { useAllProjectAgentStatus } from './useProjectAgentStatus';
import { ProjectNotificationStoreProvider, useProjectNotificationStore } from './useProjectNotificationStore';
import { useWorkbenchBreakpoint } from './useWorkbenchBreakpoint';
import { useWorkbenchProjects } from './useWorkbenchProjects';

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

// Edge handle shown when the AgentSidebar is hidden — 12px wide strip at right edge.
const edgeHandleStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  borderLeft: '1px solid var(--stroke-inner)',
  color: 'var(--ink-3)',
};

function SidebarEdgeHandle({ onShow }: { onShow: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      title="Show panel"
      onClick={onShow}
      style={edgeHandleStyle}
    >
      <Icon name="Maximize" size={10} />
    </button>
  );
}

interface MiddleRowProps {
  isUnified: boolean;
  breakpointMode: 'full' | 'compact' | 'unified';
  onCollapseToUnified: () => void;
  onExpandToDual: () => void;
  projectKey: string;
  onSelectFile: (path: string) => void;
  maximizedFrame: 'upper' | 'lower' | null;
  onSetMaximizedFrame: (frame: 'upper' | 'lower' | null) => void;
  showAgentSidebar: boolean;
  onHideSidebar: () => void;
  onShowSidebar: () => void;
  agentStatusMap: ReadonlyMap<string, ProjectAgentStatusSummary>;
}

function MiddleRow({
  isUnified,
  breakpointMode,
  onCollapseToUnified,
  onExpandToDual,
  projectKey,
  onSelectFile,
  maximizedFrame,
  onSetMaximizedFrame,
  showAgentSidebar,
  onHideSidebar,
  onShowSidebar,
  agentStatusMap,
}: MiddleRowProps): React.ReactElement {
  return (
    <div style={middleRowStyle}>
      {isUnified ? (
        <UnifiedRail onExpand={onExpandToDual} agentStatusMap={agentStatusMap} />
      ) : (
        <>
          <ProjectRail onCollapse={onCollapseToUnified} agentStatusMap={agentStatusMap} />
          <InnerRail onCollapse={onCollapseToUnified} onSelectFile={onSelectFile} />
        </>
      )}
      <CenterPane
        key={projectKey}
        maximizedFrame={maximizedFrame}
        onSetMaximizedFrame={onSetMaximizedFrame}
      />
      {showAgentSidebar ? (
        <AgentSidebar breakpointMode={breakpointMode} onHide={onHideSidebar} />
      ) : (
        <SidebarEdgeHandle onShow={onShowSidebar} />
      )}
    </div>
  );
}

interface WorkbenchStageProps {
  scanlines: boolean;
  breakpointMode: 'full' | 'compact' | 'unified';
  isUnified: boolean;
  openFilePath: string | null;
  setOpenFilePath: (path: string | null) => void;
  projectKey: string;
  onCollapseToUnified: () => void;
  onExpandToDual: () => void;
  maximizedFrame: 'upper' | 'lower' | null;
  onSetMaximizedFrame: (frame: 'upper' | 'lower' | null) => void;
  showAgentSidebar: boolean;
  onHideSidebar: () => void;
  onShowSidebar: () => void;
}

function buildMiddleRowProps(
  p: WorkbenchStageProps,
  agentStatusMap: ReadonlyMap<string, ProjectAgentStatusSummary>,
): MiddleRowProps {
  return {
    isUnified: p.isUnified,
    breakpointMode: p.breakpointMode,
    onCollapseToUnified: p.onCollapseToUnified,
    onExpandToDual: p.onExpandToDual,
    projectKey: p.projectKey,
    onSelectFile: p.setOpenFilePath,
    maximizedFrame: p.maximizedFrame,
    onSetMaximizedFrame: p.onSetMaximizedFrame,
    showAgentSidebar: p.showAgentSidebar,
    onHideSidebar: p.onHideSidebar,
    onShowSidebar: p.onShowSidebar,
    agentStatusMap,
  };
}

/**
 * The Workbench shell content (everything inside the two outer providers).
 * Extracted from Workbench() to stay under the 40-line lint cap after the
 * Wave 11.1 DiffReviewProvider wrap was added on top.
 * Wave 13 Phase 2: claudeSessionId state + threading removed (D5).
 */
function WorkbenchStage(p: WorkbenchStageProps): React.ReactElement {
  // Agent-status: mark sessions seen on focus, compute per-project status map.
  useMarkSeenOnFocus();
  const projects = useWorkbenchProjects();
  const { seenKeys } = useProjectNotificationStore();
  const agentStatusMap = useAllProjectAgentStatus(projects, seenKeys);

  return (
    <div data-testid="workbench-root" style={stageStyle}>
      <TitleBar />
      <MiddleRow {...buildMiddleRowProps(p, agentStatusMap)} />
      <StatusBar />
      <WorkbenchSettingsOverlay />
      <WorkbenchCommandPalette />
      <WorkbenchFilePicker onSelectFile={p.setOpenFilePath} />
      <WorkbenchFileViewerModal
        openFilePath={p.openFilePath}
        onClose={() => p.setOpenFilePath(null)}
      />
      {p.scanlines && (
        <div aria-hidden="true" data-testid="workbench-scanlines" style={scanlineOverlayStyle} />
      )}
    </div>
  );
}

/**
 * Wave 11.1 — DiffReviewProvider required for the lazy FileViewer's
 * MonacoHunkGutterLayer (useEditorHunkDecorations → useDiffReview throws
 * outside provider). Wave 8 P3 chose FileViewer-direct (not FileViewerManager)
 * to avoid legacy-shell listener collision; the legacy shell's Manager is
 * what provided this context. Idle-zero-cost when no review active
 * (useStaleFileWatcher early-returns at diffReviewState.stale.ts:99).
 */
export function Workbench(): React.ReactElement {
  const scanlines = useScanlines();
  const breakpointMode = useWorkbenchBreakpoint();
  const [forceUnified, setForceUnified] = useState(false);
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [maximizedFrame, setMaximizedFrame] = useState<'upper' | 'lower' | null>(null);
  const [showAgentSidebar, setShowAgentSidebar] = useState(true);
  const projectCtx = useProjectOptional();
  const projectKey = projectCtx?.projectRoot ?? '__no-project__';
  const isUnified = forceUnified || breakpointMode === 'unified';
  return (
    <DiffReviewProvider>
      <ActiveFrameProvider>
        <ProjectNotificationStoreProvider>
        <WorkbenchTabsProvider
          projectRoot={projectCtx?.projectRoot ?? null}
        >
          <WorkbenchStage
            scanlines={scanlines}
            breakpointMode={breakpointMode}
            isUnified={isUnified}
            openFilePath={openFilePath}
            setOpenFilePath={setOpenFilePath}
            projectKey={projectKey}
            onCollapseToUnified={() => setForceUnified(true)}
            onExpandToDual={() => setForceUnified(false)}
            maximizedFrame={maximizedFrame}
            onSetMaximizedFrame={setMaximizedFrame}
            showAgentSidebar={showAgentSidebar}
            onHideSidebar={() => setShowAgentSidebar(false)}
            onShowSidebar={() => setShowAgentSidebar(true)}
          />
        </WorkbenchTabsProvider>
        </ProjectNotificationStoreProvider>
      </ActiveFrameProvider>
    </DiffReviewProvider>
  );
}
