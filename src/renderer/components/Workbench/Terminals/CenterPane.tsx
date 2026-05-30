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
 *
 * Wave 12 Phase 4: accepts `maximizedFrame` + `onSetMaximizedFrame` props.
 * When non-null, hides the OTHER frame and the divider so the active frame
 * takes all available space.
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
  maximizedFrame?: 'upper' | 'lower' | null;
  onSetMaximizedFrame?: (frame: 'upper' | 'lower' | null) => void;
}

/**
 * CenterPane — the centre column of the workbench.
 *
 * Carries `data-testid="workbench-terminals"` so tests resolve on the root.
 * Wave 12 Phase 4: maximizedFrame prop hides the non-active frame + divider.
 * Wave 13 Phase 2: onClaudeSessionId callback removed (D5 heuristic deletion).
 */
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

function makeMaximizeHandler(
  frame: 'upper' | 'lower',
  maximizedFrame: 'upper' | 'lower' | null | undefined,
  onSetMaximizedFrame: ((f: 'upper' | 'lower' | null) => void) | undefined,
): () => void {
  return () => {
    if (!onSetMaximizedFrame) return;
    onSetMaximizedFrame(maximizedFrame === frame ? null : frame);
  };
}

interface FramePaneProps {
  ratio: number;
  handlePointerDown: (e: React.PointerEvent) => void;
  activeUpperId: string;
  activeLowerId: string;
  maximizedFrame: 'upper' | 'lower' | null | undefined;
  onSetMaximizedFrame: ((f: 'upper' | 'lower' | null) => void) | undefined;
}

const DIVIDER_HIDDEN_STYLE: React.CSSProperties = { ...DIVIDER_OUTER_STYLE, display: 'none' };

function SplitDivider({
  hidden,
  onPointerDown,
}: {
  hidden: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}): React.ReactElement {
  return (
    <div
      data-testid="terminal-divider"
      aria-hidden="true"
      style={hidden ? DIVIDER_HIDDEN_STYLE : DIVIDER_OUTER_STYLE}
      onPointerDown={onPointerDown}
    >
      <div style={DIVIDER_INNER_STYLE} />
    </div>
  );
}

function FramePane({
  ratio,
  handlePointerDown,
  activeUpperId,
  activeLowerId,
  maximizedFrame,
  onSetMaximizedFrame,
}: FramePaneProps): React.ReactElement {
  const hideUpper = maximizedFrame === 'lower';
  const hideLower = maximizedFrame === 'upper';
  return (
    <>
      <TerminalShell
        kind="cc"
        flex={hideLower ? 1 : ratio}
        sessionId={activeUpperId}
        isActive
        onMaximize={makeMaximizeHandler('upper', maximizedFrame, onSetMaximizedFrame)}
        style={hideUpper ? { display: 'none' } : undefined}
      />
      <SplitDivider hidden={maximizedFrame != null} onPointerDown={handlePointerDown} />
      <TerminalShell
        kind="shell"
        flex={hideUpper ? 1 : 1 - ratio}
        sessionId={activeLowerId}
        isActive
        onMaximize={makeMaximizeHandler('lower', maximizedFrame, onSetMaximizedFrame)}
        style={hideLower ? { display: 'none' } : undefined}
      />
    </>
  );
}

export function CenterPane({
  maximizedFrame,
  onSetMaximizedFrame,
}: CenterPaneProps): React.ReactElement {
  const { upperSessionId, lowerSessionId } = useWorkbenchTerminals();
  const containerRef = useRef<HTMLDivElement>(null);
  const { ratio, handlePointerDown } = useSplitRatio(containerRef);
  // sessionId props are FALLBACKS — TerminalShell mounts its own useWorkbenchTabs
  // and overrides with activeTab?.sessionId. Mounting useWorkbenchTabs here too
  // would create duplicate hook instances racing the same persist write path.
  return (
    <div ref={containerRef} data-testid="workbench-terminals" style={OUTER_STYLE}>
      <FramePane
        ratio={ratio}
        handlePointerDown={handlePointerDown}
        activeUpperId={upperSessionId}
        activeLowerId={lowerSessionId}
        maximizedFrame={maximizedFrame}
        onSetMaximizedFrame={onSetMaximizedFrame}
      />
    </div>
  );
}
