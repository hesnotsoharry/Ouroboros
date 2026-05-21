/**
 * TerminalInstanceView.helpers.ts — Style constants and completion helper functions.
 *
 * Extracted from TerminalInstanceView.tsx to keep the view file under 300 lines.
 */

import type React from 'react';

import type { TerminalInstanceController } from './TerminalInstanceController';

export const ROOT_STYLE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  flexDirection: 'column',
  backgroundColor: 'var(--term-bg, var(--surface-base))',
};

export const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%',
  flex: '1 1 0',
  minHeight: 0,
  overflow: 'hidden',
  // Terminal background behind/around the xterm canvas. xterm only paints whole
  // character rows, so the sub-row remainder at the bottom of the wrapper would
  // otherwise show the glass-transparent ROOT background — reading as a "gap"
  // between stacked terminals and making the bottom-anchored toolbar appear to
  // straddle a black/glass seam. Uses the same fallback chain as the canvas token
  // so well themes get the translucent tint (glass shows through) and non-well
  // themes stay opaque. Composited at --terminal-canvas-opacity so tinted-glass
  // themes (opacity < 1) tint the wrapper identically to the canvas.
  backgroundColor: 'var(--term-canvas-bg, var(--palette-term-bg, #0c0c0e))',
  opacity: 'var(--terminal-canvas-opacity, 1)',
};

export const TOOLBAR_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 6,
  right: 6,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

export function getRootStyle(isActive: boolean): React.CSSProperties {
  // Inactive terminals stay mounted but use visibility:hidden, NOT display:none.
  // A display:none element has zero client dimensions, so @xterm/addon-fit's
  // proposeDimensions() returns undefined and fit() is skipped — output that
  // arrives in a hidden tab then wraps at stale columns and cannot be un-wrapped
  // on return (the "cut off / no scrollback" bug). visibility:hidden keeps the
  // element laid out so fit stays correct; pointerEvents:none ensures clicks
  // fall through the stacked hidden layers to the active terminal.
  return {
    ...ROOT_STYLE,
    display: 'flex',
    visibility: isActive ? 'visible' : 'hidden',
    pointerEvents: isActive ? 'auto' : 'none',
  };
}

export function applyCompletionSelection(
  controller: TerminalInstanceController,
  value: string,
): void {
  const type =
    controller.completions.state.completions.find((completion) => completion.value === value)
      ?.type ?? 'file';
  controller.completions.actions.applyCompletion(value, type);
}

export function navigateCompletion(controller: TerminalInstanceController, delta: number): void {
  const maxIndex = controller.completions.state.completions.length - 1;
  const nextIndex = Math.max(
    0,
    Math.min(controller.completions.state.completionIndex + delta, maxIndex),
  );
  controller.completions.state.setCompletionIndex(nextIndex);
  controller.completions.state.completionIndexRef.current = nextIndex;
}

export function dismissCompletion(controller: TerminalInstanceController): void {
  controller.completions.state.setCompletionVisible(false);
  controller.completions.state.completionVisibleRef.current = false;
  controller.historyHook.suggestionControls.isHistorySuggestionRef.current = false;
  controller.completions.state.setCompletions([]);
}
