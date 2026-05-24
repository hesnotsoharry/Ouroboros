/**
 * CenterPane — vertical split of two live terminal frames (Wave 2, both live).
 *
 * Upper terminal (CC) + 10px draggable divider + lower terminal (shell).
 * The split ratio is persisted to `config.layout.workbenchTerminalSplit`
 * on drag-END and restored on mount (Wave 2 Phase 3, Decision 4).
 *
 * Read pattern: `config.getAll()` → `cfg.layout.workbenchTerminalSplit`.
 * Write pattern: `config.getAll()` → merge → `config.set('layout', merged)`.
 * (Mirrors `useImmersiveChatFlag` — the established pattern for layout keys.)
 *
 * Transparent column, 10px padding, as per canon §02 + §08.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { PermissionOverlay } from '../Permission/PermissionOverlay';
import { TerminalShell } from './TerminalShell';
import { useVerticalSplitResize } from './useVerticalSplitResize';
import { useWorkbenchTabs } from './useWorkbenchTabs';
import { useWorkbenchTerminals } from './useWorkbenchTerminals';

const DEFAULT_RATIO = 0.62;

/** Reads the persisted split ratio from config. Returns the default if absent. */
export async function readSplitRatio(): Promise<number> {
  try {
    const cfg = await window.electronAPI.config.getAll();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (cfg as any)?.layout?.workbenchTerminalSplit;
    return typeof val === 'number' ? val : DEFAULT_RATIO;
  } catch {
    return DEFAULT_RATIO;
  }
}

/** Persists the committed split ratio (called on drag-END only, Decision 4). */
export async function writeSplitRatio(ratio: number): Promise<void> {
  try {
    const cfg = await window.electronAPI.config.getAll();
    const merged = { ...(cfg?.layout ?? {}), workbenchTerminalSplit: ratio };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await window.electronAPI.config.set('layout', merged as any);
  } catch {
    // Best-effort persist; in-memory state is already correct.
  }
}

const OUTER_STYLE: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  padding: 10,
  gap: 0,
};

const DIVIDER_OUTER_STYLE: React.CSSProperties = {
  height: 10,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'row-resize',
  touchAction: 'none',
};

const DIVIDER_INNER_STYLE: React.CSSProperties = {
  width: 32,
  height: 3,
  borderRadius: 999,
  background: 'var(--stroke-faint)',
};

interface CenterPaneProps {
  onClaudeSessionId?: (id: string | null) => void;
}

/**
 * CenterPane — the centre column of the workbench.
 *
 * Carries `data-testid="workbench-terminals"` so tests resolve on the root.
 * Wave 8 Phase 1: calls `onClaudeSessionId` whenever the bound Claude session
 * changes so Workbench.tsx can thread the id to the AgentSidebar.
 */
/** Derives the active terminal session id per frame, preferring the tab's activeTabId. */
function useActiveSessionIds(
  projectRoot: string | null,
  upperSessionId: string,
  lowerSessionId: string,
) {
  const upperTabs = useWorkbenchTabs('upper', projectRoot);
  const lowerTabs = useWorkbenchTabs('lower', projectRoot);
  return {
    activeUpperId: upperTabs.activeTabId ?? upperSessionId,
    activeLowerId: lowerTabs.activeTabId ?? lowerSessionId,
  };
}

/** Loads and persists the vertical split ratio. */
function useSplitRatio(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [initialRatio, setInitialRatio] = useState(DEFAULT_RATIO);
  useEffect(() => {
    let cancelled = false;
    readSplitRatio()
      .then((r) => {
        if (!cancelled) setInitialRatio(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const onCommit = useCallback((r: number) => {
    void writeSplitRatio(r);
  }, []);
  return useVerticalSplitResize({ initialRatio, onCommit, containerRef });
}

export function CenterPane({ onClaudeSessionId }: CenterPaneProps): React.ReactElement {
  const { projectRoot } = useProject();
  const { upperSessionId, lowerSessionId, claudeSessionId } = useWorkbenchTerminals();
  const { activeUpperId, activeLowerId } = useActiveSessionIds(
    projectRoot,
    upperSessionId,
    lowerSessionId,
  );
  useEffect(() => {
    onClaudeSessionId?.(claudeSessionId);
  }, [claudeSessionId, onClaudeSessionId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { ratio, handlePointerDown } = useSplitRatio(containerRef);

  return (
    <div ref={containerRef} data-testid="workbench-terminals" style={OUTER_STYLE}>
      <TerminalShell kind="cc" flex={ratio} sessionId={activeUpperId} isActive />
      <div aria-hidden="true" style={DIVIDER_OUTER_STYLE} onPointerDown={handlePointerDown}>
        <div style={DIVIDER_INNER_STYLE} />
      </div>
      <TerminalShell kind="shell" flex={1 - ratio} sessionId={activeLowerId} isActive />
      <PermissionOverlay />
    </div>
  );
}
