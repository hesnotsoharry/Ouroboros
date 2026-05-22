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

import { TerminalShell } from './TerminalShell';
import { useVerticalSplitResize } from './useVerticalSplitResize';
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

/**
 * CenterPane — the centre column of the workbench.
 *
 * Carries `data-testid="workbench-terminals"` so tests resolve on the root.
 */
export function CenterPane(): React.ReactElement {
  const { upperSessionId, lowerSessionId } = useWorkbenchTerminals();
  const containerRef = useRef<HTMLDivElement>(null);
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
  const { ratio, handlePointerDown } = useVerticalSplitResize({
    initialRatio,
    onCommit,
    containerRef,
  });

  return (
    <div ref={containerRef} data-testid="workbench-terminals" style={OUTER_STYLE}>
      <TerminalShell kind="cc" flex={ratio} sessionId={upperSessionId} isActive />
      <div aria-hidden="true" style={DIVIDER_OUTER_STYLE} onPointerDown={handlePointerDown}>
        <div style={DIVIDER_INNER_STYLE} />
      </div>
      <TerminalShell kind="shell" flex={1 - ratio} sessionId={lowerSessionId} isActive />
    </div>
  );
}
