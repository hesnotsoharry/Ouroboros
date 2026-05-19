/**
 * FileListSidebar.tsx - Sidebar showing changed files grouped by project.
 *
 * Wave 95 Phase G: multi-project grouping with collapsible project headers.
 * Each project group shows a ▼/▶ header with the project label and file count.
 * Per-group expanded state lives in local useState<Set<string>>.
 * Default: all groups expanded.
 */

import React, { type CSSProperties, memo, useState } from 'react';

import { ProjectGroupList } from './FileListSidebarGroups';
import type { ProjectReview, ReviewFile } from './types';

export interface FileListSidebarProps {
  projects: ProjectReview[];
  activeProjectRoot: string | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAcceptAll: (projectRoot: string, index: number) => void;
  onRejectAll: (projectRoot: string, index: number) => void;
  onCloseProject: (projectRoot: string) => void;
  onSetActiveProject: (projectRoot: string) => void;
}

export interface FileListItemProps {
  file: ReviewFile;
  /** Flat index across all projects — used for selection. */
  flatIndex: number;
  isSelected: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSelect: (index: number) => void;
}

interface FileListItemSummaryProps {
  allDecided: boolean;
  file: ReviewFile;
  progress: { decided: number; total: number };
}

const sidebarStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'auto',
  borderRight: '1px solid var(--border-default)',
  backgroundColor: 'var(--surface-panel)',
  minWidth: '200px',
  maxWidth: '280px',
};

const sidebarHeaderStyle: CSSProperties = {
  padding: '6px 8px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border-default)',
  userSelect: 'none',
};

const fileItemSummaryStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px' };

const filePathStyle: CSSProperties = {
  flex: 1,
  fontSize: '0.75rem',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  direction: 'rtl',
  textAlign: 'left',
};

const actionRowStyle: CSSProperties = { display: 'flex', gap: '4px', marginTop: '2px' };

function statusBadge(status: ReviewFile['status']): { label: string; color: string } {
  switch (status) {
    case 'added':
      return { label: 'A', color: 'var(--status-success)' };
    case 'deleted':
      return { label: 'D', color: 'var(--status-error)' };
    case 'renamed':
      return { label: 'R', color: 'var(--interactive-accent)' };
    default:
      return { label: 'M', color: 'var(--status-warning)' };
  }
}

function hunkProgress(file: ReviewFile): { decided: number; total: number } {
  const total = file.hunks.length;
  const decided = file.hunks.filter((hunk) => hunk.decision !== 'pending').length;
  return { decided, total };
}

function fileItemStyle(isSelected: boolean, hovered: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 8px 6px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.1s',
    backgroundColor: isSelected
      ? 'var(--interactive-accent-subtle)'
      : hovered
        ? 'rgba(255,255,255,0.03)'
        : 'transparent',
    borderLeft: isSelected ? '2px solid var(--interactive-accent)' : '2px solid transparent',
  };
}

function badgeStyle(color: string): CSSProperties {
  return {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    fontSize: '0.625rem',
    fontWeight: 700,
    color,
    border: `1px solid ${color}`,
  };
}

function progressStyle(allDecided: boolean): CSSProperties {
  return {
    flexShrink: 0,
    fontSize: '0.625rem',
    fontWeight: 500,
    color: allDecided ? 'var(--status-success)' : 'var(--text-faint)',
  };
}

function actionButtonStyle(color: string): CSSProperties {
  return {
    padding: '1px 6px',
    fontSize: '0.5625rem',
    fontFamily: 'var(--font-ui)',
    border: `1px solid ${color}`,
    borderRadius: '3px',
    background: 'transparent',
    color,
    cursor: 'pointer',
  };
}

function FileListItemSummary({
  allDecided,
  file,
  progress,
}: FileListItemSummaryProps): React.ReactElement {
  const badge = statusBadge(file.status);
  return (
    <div style={fileItemSummaryStyle}>
      <span style={badgeStyle(badge.color)}>{badge.label}</span>
      <span style={filePathStyle} title={file.relativePath}>
        {file.relativePath}
      </span>
      <span style={progressStyle(allDecided)}>
        {progress.decided}/{progress.total}
      </span>
    </div>
  );
}

function QuickActionButton({
  color,
  label,
  onClick,
}: {
  color: string;
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={actionButtonStyle(color)}
    >
      {label}
    </button>
  );
}

function FileListItemActions({
  onAcceptAll,
  onRejectAll,
}: Pick<FileListItemProps, 'onAcceptAll' | 'onRejectAll'>): React.ReactElement {
  return (
    <div style={actionRowStyle}>
      <QuickActionButton color="var(--status-success)" label="Accept All" onClick={onAcceptAll} />
      <QuickActionButton color="var(--status-error)" label="Reject All" onClick={onRejectAll} />
    </div>
  );
}

export function FileListItem({
  file,
  flatIndex,
  isSelected,
  onAcceptAll,
  onRejectAll,
  onSelect,
}: FileListItemProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const progress = hunkProgress(file);
  const allDecided = progress.decided === progress.total;

  return (
    <div
      onClick={() => onSelect(flatIndex)}
      style={fileItemStyle(isSelected, hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <FileListItemSummary allDecided={allDecided} file={file} progress={progress} />
      {isSelected && !allDecided ? (
        <FileListItemActions onAcceptAll={onAcceptAll} onRejectAll={onRejectAll} />
      ) : null}
    </div>
  );
}

export const FileListSidebar = memo(function FileListSidebar({
  projects,
  activeProjectRoot,
  selectedIndex,
  onSelect,
  onAcceptAll,
  onRejectAll,
  onCloseProject,
  onSetActiveProject,
}: FileListSidebarProps): React.ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(projects.map((p) => p.projectRoot)),
  );
  const onToggle = (projectRoot: string): void => {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(projectRoot)) s.delete(projectRoot);
      else s.add(projectRoot);
      return s;
    });
  };
  const totalFiles = projects.reduce((sum, p) => sum + p.files.length, 0);
  return (
    <div style={sidebarStyle}>
      <div style={sidebarHeaderStyle}>Changed Files ({totalFiles})</div>
      <ProjectGroupList
        projects={projects}
        activeProjectRoot={activeProjectRoot}
        selectedIndex={selectedIndex}
        expanded={expanded}
        onToggle={onToggle}
        onSelect={onSelect}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
        onCloseProject={onCloseProject}
        onSetActiveProject={onSetActiveProject}
      />
    </div>
  );
});
