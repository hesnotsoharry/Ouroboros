/**
 * TitleBarBranchDropdown — opens below the BranchChip in the title bar.
 *
 * Fetches branches via useGitBranches(projectRoot). Click a row →
 * git.checkout(projectRoot, branch) + close. Esc or click-outside closes.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useGitBranch } from '../../../hooks/useGitBranch';
import { Icon } from '../../shared/Icon';
import { useGitBranches } from './useGitBranches';

// ── Styles ────────────────────────────────────────────────────────────────────

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 220,
  // Wave 10.1 — popover uses --glass-overlay (92% opacity), not --glass-panel
  // (35% opacity which bleeds Mica desktop content through, making dropdown
  // text unreadable). Overlay is the canon token for menus/dialogs.
  background: 'var(--glass-overlay)',
  backdropFilter: 'var(--blur-soft)',
  WebkitBackdropFilter: 'var(--blur-soft)',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 'var(--r-md, 8px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 200,
  overflow: 'hidden',
  padding: '4px 0',
};

const PLACEHOLDER_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  color: 'var(--ink-3)',
  fontFamily: 'var(--font-ui)',
};

// ── Sub-components ────────────────────────────────────────────────────────────

const BRANCH_NAME_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-mono)',
};

const BRANCH_CHECK_STYLE: React.CSSProperties = {
  color: 'var(--interactive-accent)',
  fontSize: 10,
  fontWeight: 700,
};

function branchRowStyle(isCurrent: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-ui)',
    background: isCurrent
      ? 'var(--interactive-accent-subtle, rgba(99,102,241,0.15))'
      : 'transparent',
    color: isCurrent ? 'var(--ink)' : 'var(--ink-2)',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  };
}

function BranchRow({
  branch,
  isCurrent,
  onSelect,
}: {
  branch: string;
  isCurrent: boolean;
  onSelect: (b: string) => void;
}): React.ReactElement {
  return (
    <button
      style={branchRowStyle(isCurrent)}
      onClick={() => onSelect(branch)}
      data-testid={`titlebar-branch-row-${branch}`}
    >
      <Icon name="Branch" size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
      <span style={BRANCH_NAME_STYLE}>{branch}</span>
      {isCurrent && <span style={BRANCH_CHECK_STYLE}>✓</span>}
    </button>
  );
}

// ── Dismiss hook ─────────────────────────────────────────────────────────────

function useDismissOnOutsideOrEsc(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const onMouse = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onClose]);
}

// ── Main component ────────────────────────────────────────────────────────────

interface TitleBarBranchDropdownProps {
  onClose: () => void;
}

export function TitleBarBranchDropdown({
  onClose,
}: TitleBarBranchDropdownProps): React.ReactElement {
  const { projectRoot } = useProject();
  const { branch: currentBranch } = useGitBranch(projectRoot);
  const { branches, isLoading } = useGitBranches(projectRoot);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideOrEsc(containerRef, onClose);

  const handleSelect = useCallback(
    (branch: string) => {
      if (projectRoot) void window.electronAPI.git.checkout(projectRoot, branch);
      onClose();
    },
    [projectRoot, onClose],
  );

  return (
    <div ref={containerRef} style={DROPDOWN_STYLE} data-testid="titlebar-branch-dropdown">
      {isLoading && <div style={PLACEHOLDER_STYLE}>Loading branches…</div>}
      {!isLoading && branches.length === 0 && (
        <div style={PLACEHOLDER_STYLE}>No branches found</div>
      )}
      {branches.map((branch) => (
        <BranchRow
          key={branch}
          branch={branch}
          isCurrent={branch === currentBranch}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
