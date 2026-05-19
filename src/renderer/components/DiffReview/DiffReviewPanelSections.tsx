import React from 'react';

import { DiffReviewHeaderActions } from './DiffReviewHeaderActions';
import { DiffReviewHeaderStats } from './DiffReviewHeaderStats';
import type { DiffReviewStats } from './DiffReviewPanelState';
import { StatusIcon } from './DiffReviewPanelState';
import { FileListSidebar } from './FileListSidebar';
import { HunkView } from './HunkView';
import type { DiffReviewState, ProjectReview, ReviewFile } from './types';

interface DiffReviewLayoutProps {
  state: DiffReviewState;
  activeProject: ProjectReview;
  selectedFileIdx: number;
  stats: DiffReviewStats;
  canRollback: boolean;
  enhancedEnabled: boolean;
  focusedHunkId: string | null;
  onClose: () => void;
  onCloseProject: (projectRoot: string) => void;
  onSetActiveProject: (projectRoot: string) => void;
  onAcceptAll: (projectRoot: string) => void;
  onRejectAll: (projectRoot: string) => void;
  onRollback: (projectRoot: string) => void;
  onAcceptAllFile: (projectRoot: string, fileIdx: number) => void;
  onRejectAllFile: (projectRoot: string, fileIdx: number) => void;
  onSelectFile: (idx: number) => void;
  onAcceptHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  onRejectHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  setFileRef: (idx: number, element: HTMLDivElement | null) => void;
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: 'var(--surface-base)',
};

const headerStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  borderBottom: '1px solid var(--border-default)',
  backgroundColor: 'var(--surface-panel)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-ui)',
  userSelect: 'none',
};

interface DiffReviewHeaderProps {
  stats: DiffReviewStats;
  allDecided: boolean;
  canRollback: boolean;
  enhancedEnabled: boolean;
  files: ReviewFile[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onRollback: () => void;
  onClose: () => void;
}

function buildDiffReviewHeaderProps(props: DiffReviewLayoutProps): DiffReviewHeaderProps {
  const {
    stats,
    canRollback,
    enhancedEnabled,
    activeProject,
    onAcceptAll,
    onRejectAll,
    onRollback,
    onClose,
  } = props;
  const root = activeProject.projectRoot;
  return {
    stats,
    allDecided: stats.decidedHunks === stats.totalHunks,
    canRollback,
    enhancedEnabled,
    files: activeProject.files,
    onAcceptAll: () => onAcceptAll(root),
    onRejectAll: () => onRejectAll(root),
    onRollback: () => onRollback(root),
    onClose,
  };
}

export function DiffReviewLayout(props: DiffReviewLayoutProps): React.ReactElement {
  const { state, activeProject, selectedFileIdx, focusedHunkId } = props;
  const { onCloseProject, onSetActiveProject, onAcceptAllFile, onRejectAllFile } = props;
  const { onSelectFile, onAcceptHunk, onRejectHunk, setFileRef } = props;
  return (
    <div style={panelStyle}>
      <DiffReviewHeader {...buildDiffReviewHeaderProps(props)} />
      <DiffReviewBody
        state={state}
        activeProject={activeProject}
        selectedFileIdx={selectedFileIdx}
        focusedHunkId={focusedHunkId}
        onCloseProject={onCloseProject}
        onSetActiveProject={onSetActiveProject}
        onAcceptAllFile={onAcceptAllFile}
        onRejectAllFile={onRejectAllFile}
        onSelectFile={onSelectFile}
        onAcceptHunk={onAcceptHunk}
        onRejectHunk={onRejectHunk}
        setFileRef={setFileRef}
      />
    </div>
  );
}

type DiffReviewBodyProps = {
  state: DiffReviewState;
  activeProject: ProjectReview;
  selectedFileIdx: number;
  focusedHunkId: string | null;
  onCloseProject: (projectRoot: string) => void;
  onSetActiveProject: (projectRoot: string) => void;
  onAcceptAllFile: (projectRoot: string, fileIdx: number) => void;
  onRejectAllFile: (projectRoot: string, fileIdx: number) => void;
  onSelectFile: (idx: number) => void;
  onAcceptHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  onRejectHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  setFileRef: (idx: number, element: HTMLDivElement | null) => void;
};

type HunkScrollAreaProps = Pick<
  DiffReviewBodyProps,
  'activeProject' | 'selectedFileIdx' | 'focusedHunkId' | 'onAcceptHunk' | 'onRejectHunk'
> & { setFileRef: DiffReviewBodyProps['setFileRef'] };

function HunkScrollArea({
  activeProject,
  selectedFileIdx,
  focusedHunkId,
  onAcceptHunk,
  onRejectHunk,
  setFileRef,
}: HunkScrollAreaProps): React.ReactElement {
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {activeProject.files.map((file, fileIdx) => (
        <FileSection
          key={file.filePath}
          ref={(element) => {
            setFileRef(fileIdx, element);
          }}
          file={file}
          fileIdx={fileIdx}
          projectRoot={activeProject.projectRoot}
          isSelected={fileIdx === selectedFileIdx}
          focusedHunkId={focusedHunkId}
          onAcceptHunk={onAcceptHunk}
          onRejectHunk={onRejectHunk}
        />
      ))}
    </div>
  );
}

function DiffReviewBody({
  state,
  activeProject,
  selectedFileIdx,
  focusedHunkId,
  onCloseProject,
  onSetActiveProject,
  onAcceptAllFile,
  onRejectAllFile,
  onSelectFile,
  onAcceptHunk,
  onRejectHunk,
  setFileRef,
}: DiffReviewBodyProps): React.ReactElement {
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <FileListSidebar
        projects={state.projects}
        activeProjectRoot={state.activeProjectRoot}
        selectedIndex={selectedFileIdx}
        onSelect={onSelectFile}
        onAcceptAll={onAcceptAllFile}
        onRejectAll={onRejectAllFile}
        onCloseProject={onCloseProject}
        onSetActiveProject={onSetActiveProject}
      />
      <HunkScrollArea
        activeProject={activeProject}
        selectedFileIdx={selectedFileIdx}
        focusedHunkId={focusedHunkId}
        onAcceptHunk={onAcceptHunk}
        onRejectHunk={onRejectHunk}
        setFileRef={setFileRef}
      />
    </div>
  );
}

function DiffReviewHeader({
  stats,
  allDecided,
  canRollback,
  enhancedEnabled,
  files,
  onAcceptAll,
  onRejectAll,
  onRollback,
  onClose,
}: {
  stats: DiffReviewStats;
  allDecided: boolean;
  canRollback: boolean;
  enhancedEnabled: boolean;
  files: ReviewFile[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onRollback: () => void;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div style={headerStyle}>
      <DiffReviewHeaderStats stats={stats} />
      <DiffReviewHeaderActions
        allDecided={allDecided}
        canRollback={canRollback}
        enhancedEnabled={enhancedEnabled}
        files={files}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
        onRollback={onRollback}
        onClose={onClose}
      />
    </div>
  );
}

interface FileSectionProps {
  file: ReviewFile;
  fileIdx: number;
  projectRoot: string;
  focusedHunkId: string | null;
  isSelected: boolean;
  onAcceptHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  onRejectHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  ref?: React.Ref<HTMLDivElement>;
}

function FileSection({
  file,
  fileIdx,
  projectRoot,
  focusedHunkId,
  isSelected,
  onAcceptHunk,
  onRejectHunk,
  ref,
}: FileSectionProps): React.ReactElement {
  return (
    <div ref={ref} style={{ borderBottom: '2px solid var(--border-default)' }}>
      <FileSectionHeader file={file} isSelected={isSelected} />
      {file.hunks.map((hunk, hunkIdx) => (
        <HunkView
          key={hunk.id}
          hunk={hunk}
          isFocused={hunk.id === focusedHunkId}
          onAccept={() => onAcceptHunk(projectRoot, fileIdx, hunkIdx)}
          onReject={() => onRejectHunk(projectRoot, fileIdx, hunkIdx)}
        />
      ))}
    </div>
  );
}

function FileSectionHeader({
  file,
  isSelected,
}: {
  file: ReviewFile;
  isSelected: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 12px',
        backgroundColor: isSelected ? 'var(--interactive-accent-subtle)' : 'var(--surface-panel)',
        borderBottom: '1px solid var(--border-default)',
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
        userSelect: 'none',
      }}
    >
      <StatusIcon status={file.status} />
      <span style={{ fontWeight: 500 }}>{file.relativePath}</span>
      {file.oldPath && (
        <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
          (was {file.oldPath})
        </span>
      )}
      <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem', marginLeft: 'auto' }}>
        {file.hunks.length} hunk{file.hunks.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
