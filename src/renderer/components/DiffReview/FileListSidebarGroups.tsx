/**
 * FileListSidebarGroups.tsx - Project group header and list components for FileListSidebar.
 *
 * Extracted from FileListSidebar.tsx (Wave 95 Phase G lint cleanup) to satisfy
 * the ESLint max-lines-per-function (40) and max-lines (300) caps.
 */

import React, { type CSSProperties } from 'react';

import type { FileListSidebarProps } from './FileListSidebar';
import { FileListItem } from './FileListSidebar';

export interface ProjectGroupHeaderProps {
  label: string;
  projectRoot: string;
  fileCount: number;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onClose: () => void;
  onActivate: () => void;
}

const projectGroupHeaderStyle = (isActive: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '5px 8px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: isActive ? 'var(--interactive-accent)' : 'var(--text-muted)',
  borderBottom: '1px solid var(--border-subtle)',
  borderLeft: isActive ? '2px solid var(--interactive-accent)' : '2px solid transparent',
  cursor: 'pointer',
  userSelect: 'none',
  backgroundColor: isActive ? 'var(--interactive-accent-subtle)' : 'transparent',
});

const closeBtnStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '0 4px',
  fontSize: '0.625rem',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-faint)',
  cursor: 'pointer',
  lineHeight: 1,
};

function ProjectGroupLabel({
  label,
  fileCount,
  isExpanded,
}: {
  label: string;
  fileCount: number;
  isExpanded: boolean;
}): React.ReactElement {
  return (
    <>
      <span style={{ flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span style={{ flexShrink: 0, color: 'var(--text-faint)' }}>({fileCount})</span>
    </>
  );
}

export function ProjectGroupHeader({
  label,
  fileCount,
  isExpanded,
  isActive,
  onToggle,
  onClose,
  onActivate,
}: ProjectGroupHeaderProps): React.ReactElement {
  return (
    <div
      style={projectGroupHeaderStyle(isActive)}
      onClick={() => {
        onActivate();
        onToggle();
      }}
      title={label}
    >
      <ProjectGroupLabel label={label} fileCount={fileCount} isExpanded={isExpanded} />
      <button
        type="button"
        style={closeBtnStyle}
        title="Close this project review"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}

export interface ProjectGroupListProps extends FileListSidebarProps {
  expanded: Set<string>;
  onToggle: (projectRoot: string) => void;
}

interface BuildGroupItemsOpts {
  project: ProjectGroupListProps['projects'][number];
  startIdx: number;
  selectedIndex: number;
  onSelect: FileListSidebarProps['onSelect'];
  onAcceptAll: FileListSidebarProps['onAcceptAll'];
  onRejectAll: FileListSidebarProps['onRejectAll'];
}

function buildGroupItems({
  project,
  startIdx,
  selectedIndex,
  onSelect,
  onAcceptAll,
  onRejectAll,
}: BuildGroupItemsOpts): React.ReactElement[] {
  return project.files.map((file, fileIdx) => {
    const fi = startIdx + fileIdx;
    return (
      <FileListItem
        key={file.filePath}
        file={file}
        flatIndex={fi}
        isSelected={fi === selectedIndex}
        onSelect={onSelect}
        onAcceptAll={() => onAcceptAll(project.projectRoot, fileIdx)}
        onRejectAll={() => onRejectAll(project.projectRoot, fileIdx)}
      />
    );
  });
}

function projectStartIndices(projects: ProjectGroupListProps['projects']): number[] {
  let count = 0;
  return projects.map((p) => {
    const idx = count;
    count += p.files.length;
    return idx;
  });
}

export function ProjectGroupList({
  projects,
  activeProjectRoot,
  selectedIndex,
  expanded,
  onSelect,
  onAcceptAll,
  onRejectAll,
  onCloseProject,
  onSetActiveProject,
  onToggle,
}: ProjectGroupListProps): React.ReactElement {
  const startIndices = projectStartIndices(projects);
  return (
    <>
      {projects.map((project, i) => {
        const isExpanded = expanded.has(project.projectRoot);
        const isActive = project.projectRoot === activeProjectRoot;
        const items = isExpanded
          ? buildGroupItems({ project, startIdx: startIndices[i], selectedIndex, onSelect, onAcceptAll, onRejectAll })
          : null;
        return (
          <div key={project.projectRoot}>
            <ProjectGroupHeader
              label={project.projectLabel}
              projectRoot={project.projectRoot}
              fileCount={project.files.length}
              isExpanded={isExpanded}
              isActive={isActive}
              onToggle={() => onToggle(project.projectRoot)}
              onClose={() => onCloseProject(project.projectRoot)}
              onActivate={() => onSetActiveProject(project.projectRoot)}
            />
            {items}
          </div>
        );
      })}
    </>
  );
}
