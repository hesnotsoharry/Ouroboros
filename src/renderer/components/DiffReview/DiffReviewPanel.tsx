import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DiffReviewLayout } from './DiffReviewPanelSections';
import { getDiffReviewStateView, getDiffReviewStats } from './DiffReviewPanelState';
import type { DiffReviewState, ProjectReview, ReviewHunk } from './types';
import { useDiffReviewKeyboard } from './useDiffReviewKeyboard';

interface DiffReviewPanelProps {
  state: DiffReviewState;
  canRollback: boolean;
  enhancedEnabled: boolean;
  onAcceptHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  onRejectHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  onAcceptAllFile: (projectRoot: string, fileIdx: number) => void;
  onRejectAllFile: (projectRoot: string, fileIdx: number) => void;
  onAcceptAll: (projectRoot: string) => void;
  onRejectAll: (projectRoot: string) => void;
  onRollback: (projectRoot: string) => void;
  onClose: () => void;
  onCloseProject: (projectRoot: string) => void;
  onSetActiveProject: (projectRoot: string) => void;
  onConfirmStaleOp?: () => void;
  onDismissStaleOp?: () => void;
}

const staleBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  background: 'var(--status-warning-subtle)',
  borderBottom: '1px solid var(--border-semantic)',
  fontSize: 13,
  color: 'var(--text-semantic-primary)',
};

const staleActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginLeft: 'auto',
};

const btnBase: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 4,
  border: '1px solid var(--border-semantic)',
  cursor: 'pointer',
  fontSize: 12,
  background: 'var(--surface-raised)',
  color: 'var(--text-semantic-primary)',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--interactive-accent)',
  color: 'var(--text-on-accent)',
  border: 'none',
};

function StalePromptBar({
  staleFile,
  onConfirm,
  onDismiss,
}: {
  staleFile: string;
  onConfirm: () => void;
  onDismiss: () => void;
}): React.ReactElement {
  return (
    <div style={staleBarStyle} role="alert">
      <span>
        ⚠ <strong>{staleFile}</strong> was modified externally — refresh diff or proceed anyway?
      </span>
      <div style={staleActionsStyle}>
        <button type="button" style={btnBase} onClick={onDismiss}>
          Cancel
        </button>
        <button type="button" style={btnPrimary} onClick={onConfirm}>
          Proceed anyway
        </button>
      </div>
    </div>
  );
}

interface FlatHunk {
  projectRoot: string;
  fileIdx: number;
  hunkIdx: number;
  id: string;
}

function flattenHunks(project: ProjectReview): FlatHunk[] {
  return project.files.flatMap((file, fileIdx) =>
    file.hunks.map((hunk, hunkIdx) => ({
      projectRoot: project.projectRoot,
      fileIdx,
      hunkIdx,
      id: hunk.id,
    })),
  );
}

function useKeyboardNav(
  project: ProjectReview,
  enabled: boolean,
  onAcceptHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void,
  onRejectHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void,
): string | null {
  const flatHunks = useMemo(() => flattenHunks(project), [project]);
  const allHunks = useMemo<ReviewHunk[]>(() => project.files.flatMap((f) => f.hunks), [project]);

  const handleAccept = useCallback(
    (id: string) => {
      const entry = flatHunks.find((h) => h.id === id);
      if (entry) onAcceptHunk(entry.projectRoot, entry.fileIdx, entry.hunkIdx);
    },
    [flatHunks, onAcceptHunk],
  );

  const handleReject = useCallback(
    (id: string) => {
      const entry = flatHunks.find((h) => h.id === id);
      if (entry) onRejectHunk(entry.projectRoot, entry.fileIdx, entry.hunkIdx);
    },
    [flatHunks, onRejectHunk],
  );

  const { focusedHunkId } = useDiffReviewKeyboard({
    enabled,
    hunks: allHunks,
    onAccept: handleAccept,
    onReject: handleReject,
  });
  return focusedHunkId;
}

function useFileNavState(project: ProjectReview): {
  selectedFileIdx: number;
  setSelectedFileIdx: (idx: number) => void;
  setFileRef: (idx: number, el: HTMLDivElement | null) => void;
} {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const fileRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const setFileRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) fileRefs.current.set(idx, el);
    else fileRefs.current.delete(idx);
  }, []);
  useEffect(() => {
    fileRefs.current.get(selectedFileIdx)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedFileIdx]);
  void project;
  return { selectedFileIdx, setSelectedFileIdx, setFileRef };
}

const EMPTY_PROJECT: ProjectReview = {
  projectRoot: '',
  projectLabel: '',
  sessionId: '',
  snapshotHash: '',
  files: [],
  loading: false,
  error: null,
  lastAcceptedBatch: null,
  staleFiles: [],
  stalePendingOp: null,
};

function resolveProject(state: DiffReviewState): ProjectReview {
  return (
    state.projects.find((p) => p.projectRoot === state.activeProjectRoot) ??
    state.projects[0] ??
    EMPTY_PROJECT
  );
}

function getStaleFilePath(project: ProjectReview): string | null {
  const op = project.stalePendingOp;
  if (op === null) return null;
  return project.files[op.fileIdx]?.relativePath ?? '';
}

interface PanelRenderProps {
  state: DiffReviewState;
  activeProject: ProjectReview;
  stats: ReturnType<typeof getDiffReviewStats>;
  canRollback: boolean;
  enhancedEnabled: boolean;
  focusedHunkId: string | null;
  selectedFileIdx: number;
  setSelectedFileIdx: (idx: number) => void;
  setFileRef: (idx: number, el: HTMLDivElement | null) => void;
  staleFilePath: string | null;
  onConfirmStaleOp: () => void;
  onDismissStaleOp: () => void;
  onAcceptHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  onRejectHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  onAcceptAllFile: (projectRoot: string, fileIdx: number) => void;
  onRejectAllFile: (projectRoot: string, fileIdx: number) => void;
  onAcceptAll: (projectRoot: string) => void;
  onRejectAll: (projectRoot: string) => void;
  onRollback: (projectRoot: string) => void;
  onClose: () => void;
  onCloseProject: (projectRoot: string) => void;
  onSetActiveProject: (projectRoot: string) => void;
}

function DiffReviewPanelBody(p: PanelRenderProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {p.staleFilePath !== null && (
        <StalePromptBar
          staleFile={p.staleFilePath}
          onConfirm={p.onConfirmStaleOp}
          onDismiss={p.onDismissStaleOp}
        />
      )}
      <DiffReviewLayout
        state={p.state}
        activeProject={p.activeProject}
        selectedFileIdx={p.selectedFileIdx}
        stats={p.stats}
        canRollback={p.canRollback}
        enhancedEnabled={p.enhancedEnabled}
        focusedHunkId={p.focusedHunkId}
        onClose={p.onClose}
        onCloseProject={p.onCloseProject}
        onSetActiveProject={p.onSetActiveProject}
        onAcceptAll={p.onAcceptAll}
        onRejectAll={p.onRejectAll}
        onRollback={p.onRollback}
        onAcceptAllFile={p.onAcceptAllFile}
        onRejectAllFile={p.onRejectAllFile}
        onSelectFile={p.setSelectedFileIdx}
        onAcceptHunk={p.onAcceptHunk}
        onRejectHunk={p.onRejectHunk}
        setFileRef={p.setFileRef}
      />
    </div>
  );
}

export function DiffReviewPanel(props: DiffReviewPanelProps): React.ReactElement {
  const { state, canRollback, enhancedEnabled, onAcceptHunk, onRejectHunk } = props;
  const { onAcceptAllFile, onRejectAllFile, onAcceptAll, onRejectAll, onRollback, onClose } = props;
  const { onCloseProject, onSetActiveProject } = props;
  const { onConfirmStaleOp = () => undefined, onDismissStaleOp = () => undefined } = props;

  const activeProject = resolveProject(state);
  const stats = useMemo(() => getDiffReviewStats(activeProject.files), [activeProject.files]);
  const stateView = getDiffReviewStateView(activeProject, onClose);
  const focusedHunkId = useKeyboardNav(activeProject, enhancedEnabled, onAcceptHunk, onRejectHunk);
  const { selectedFileIdx, setSelectedFileIdx, setFileRef } = useFileNavState(activeProject);

  if (stateView) return stateView;
  return (
    <DiffReviewPanelBody
      state={state}
      activeProject={activeProject}
      stats={stats}
      canRollback={canRollback}
      enhancedEnabled={enhancedEnabled}
      focusedHunkId={focusedHunkId}
      selectedFileIdx={selectedFileIdx}
      setSelectedFileIdx={setSelectedFileIdx}
      setFileRef={setFileRef}
      staleFilePath={getStaleFilePath(activeProject)}
      onConfirmStaleOp={onConfirmStaleOp}
      onDismissStaleOp={onDismissStaleOp}
      onAcceptHunk={onAcceptHunk}
      onRejectHunk={onRejectHunk}
      onAcceptAllFile={onAcceptAllFile}
      onRejectAllFile={onRejectAllFile}
      onAcceptAll={onAcceptAll}
      onRejectAll={onRejectAll}
      onRollback={onRollback}
      onClose={onClose}
      onCloseProject={onCloseProject}
      onSetActiveProject={onSetActiveProject}
    />
  );
}
