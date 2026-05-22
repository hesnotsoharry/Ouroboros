/**
 * WorkbenchFileTree — live canon §07 file tree for InnerRail.
 *
 * Renders the project file tree from window.electronAPI.files (via
 * useWorkbenchFileTree). Directories expand lazily on click. Reuses
 * FileNode for row rendering (icon colours, indent, chevron).
 *
 * M/A git-status badges: deferred.
 *   roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md
 */

import React from 'react';

import { FileNode } from './FileNode';
import { type LiveFileNode, useWorkbenchFileTree } from './useWorkbenchFileTree';

// ── Props ────────────────────────────────────────────────────────────────────

interface WorkbenchFileTreeProps {
  rootPath: string;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const EMPTY_STYLE: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 11,
  color: 'var(--ink-3)',
};

const ERROR_STYLE: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 11,
  color: 'var(--status-error)',
};

const LOADING_STYLE: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 11,
  color: 'var(--ink-3)',
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * WorkbenchFileTree renders a single project root's file tree.
 * Directories expand/collapse on click via toggleDir.
 */
export function WorkbenchFileTree({ rootPath }: WorkbenchFileTreeProps): React.ReactElement {
  const { nodes, isLoading, error, toggleDir } = useWorkbenchFileTree(rootPath);

  if (isLoading && nodes.length === 0) {
    return <div style={LOADING_STYLE}>Loading…</div>;
  }

  if (error !== null) {
    return <div style={ERROR_STYLE}>{error}</div>;
  }

  if (nodes.length === 0) {
    return <div style={EMPTY_STYLE}>Empty directory</div>;
  }

  return (
    <div data-testid="workbench-filetree">
      {nodes.map((node) => (
        <NodeRow key={node.key} node={node} onToggle={toggleDir} />
      ))}
    </div>
  );
}

// ── Row wrapper ──────────────────────────────────────────────────────────────

interface NodeRowProps {
  node: LiveFileNode;
  onToggle: (path: string) => void;
}

function NodeRow({ node, onToggle }: NodeRowProps): React.ReactElement {
  const handleClick = (): void => {
    if (node.type === 'dir') {
      onToggle(node.path);
    }
  };

  return (
    <div
      role={node.type === 'dir' ? 'button' : undefined}
      onClick={handleClick}
      style={{ cursor: node.type === 'dir' ? 'pointer' : 'default' }}
    >
      <FileNode node={node} />
    </div>
  );
}
