/**
 * useVerticalSplitResize — vertical (row-resize) split hook for CenterPane.
 *
 * Vertical counterpart of `useSplitResize` (TerminalManagerSplitPane.tsx), which
 * is horizontal-only (`clientX` / `rect.width`). This hook reads `clientY` /
 * `rect.height` and invokes `onCommit` on drag-END only (Decision 4 — no write
 * storm).
 *
 * @see roadmap/wave-2-workbench-terminal-integration/wave-2-decisions.md Decision 4
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Clamped fraction bounds — avoids one frame collapsing entirely. */
const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

/**
 * Compute the upper-frame fraction from a pointer position + container rect.
 *
 * Exported as a pure helper so it can be unit-tested without a DOM.
 */
export function computeSplitRatio(clientY: number, rect: DOMRect): number {
  const raw = (clientY - rect.top) / rect.height;
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, raw));
}

export interface VerticalSplitResizeOptions {
  /** Initial ratio (upper-frame fraction). */
  initialRatio: number;
  /** Called once on drag-END with the committed ratio. Use to persist. */
  onCommit: (ratio: number) => void;
  /** Ref to the container element whose height is used for the math. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export interface VerticalSplitResizeResult {
  /** Current upper-frame fraction (live during drag). */
  ratio: number;
  /** Attach to the divider's `onPointerDown`. */
  handlePointerDown: (event: React.PointerEvent) => void;
}

export function useVerticalSplitResize(
  options: VerticalSplitResizeOptions,
): VerticalSplitResizeResult {
  const { initialRatio, onCommit, containerRef } = options;
  const [ratio, setRatio] = useState(initialRatio);
  const isDraggingRef = useRef(false);

  // Apply a late-arriving initialRatio (e.g. the async config restore resolving
  // after first render) — but never clobber an in-progress drag. useState only
  // honours its initial arg on the first render, so without this the persisted
  // ratio would be read from config yet never reach the rendered frames.
  useEffect(() => {
    if (!isDraggingRef.current) setRatio(initialRatio);
  }, [initialRatio]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      isDraggingRef.current = true;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current || !containerRef.current) {
          return;
        }
        const rect = containerRef.current.getBoundingClientRect();
        setRatio(computeSplitRatio(moveEvent.clientY, rect));
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        isDraggingRef.current = false;
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('pointercancel', handlePointerUp);

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          onCommit(computeSplitRatio(upEvent.clientY, rect));
        }
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
    },
    [containerRef, onCommit],
  );

  return { ratio, handlePointerDown };
}
