/**
 * FileNode — one row in the InnerRail / UnifiedRail file tree (canon §07).
 *
 * Indent: depth × 12 px + 6 px base left padding.
 * Directory icon: `--accent-hi`. File icon: `--ink-3`.
 * Right-aligned status badge: M (--warning) / A (--success). 14 px wide.
 *
 * Static only — data comes from workbenchMockData. No click handlers this wave.
 */

import React from 'react';

import { Icon } from '../../shared/Icon';
import { type MockFileNode } from '../workbenchMockData';

interface FileNodeProps {
  node: MockFileNode;
}

const BADGE_COLOR: Record<string, string> = {
  M: 'var(--warning)',
  A: 'var(--success)',
};

function rowStyle(indentPx: number): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
    paddingBottom: 2,
    paddingRight: 8,
    paddingLeft: indentPx,
    borderRadius: 5,
    fontSize: 11.5,
    color: 'var(--ink-2)',
    cursor: 'default',
  };
}

export function FileNode({ node }: FileNodeProps): React.ReactElement {
  const isDir = node.type === 'dir';
  const indentPx = 6 + node.depth * 12;
  return (
    <div style={rowStyle(indentPx)}>
      <ChevronSlot node={node} isDir={isDir} />
      <NodeIcon isDir={isDir} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.name}
      </span>
      {node.badge != null && node.badge !== '' && (
        <NodeBadge badge={node.badge} />
      )}
    </div>
  );
}

function NodeBadge({ badge }: { badge: string }): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: BADGE_COLOR[badge] ?? 'var(--ink-4)',
        width: 14,
        textAlign: 'center',
        flexShrink: 0,
      }}
    >
      {badge}
    </span>
  );
}

function ChevronSlot({
  node,
  isDir,
}: {
  node: MockFileNode;
  isDir: boolean;
}): React.ReactElement {
  if (!isDir) {
    return <span style={{ width: 11, flexShrink: 0 }} />;
  }
  return (
    <Icon
      name={node.open ? 'ChevronDown' : 'Chevron'}
      size={11}
      style={{ flexShrink: 0, color: 'var(--ink-4)' }}
    />
  );
}

function NodeIcon({ isDir }: { isDir: boolean }): React.ReactElement {
  return (
    <Icon
      name={isDir ? 'Folder' : 'File'}
      size={12}
      style={{
        flexShrink: 0,
        color: isDir ? 'var(--accent-hi)' : 'var(--ink-3)',
      }}
    />
  );
}
