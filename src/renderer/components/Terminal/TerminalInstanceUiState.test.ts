// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useThemeSync } from './TerminalInstanceUiState';

describe('useThemeSync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs the theme once on mount — covers terminals that mount before theme hydration (canon workbench race)', () => {
    // rAF runs the callback synchronously so the on-mount sync is observable in the assertion.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const syncTheme = vi.fn();

    renderHook(() => useThemeSync(syncTheme));

    // Without the on-mount sync, a terminal that mounted before `agent-ide:theme-applied`
    // fired would never repaint with the hydrated well token — the regression this guards.
    expect(syncTheme).toHaveBeenCalledTimes(1);
  });

  it('re-syncs on every agent-ide:theme-applied event', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const syncTheme = vi.fn();

    renderHook(() => useThemeSync(syncTheme));
    syncTheme.mockClear(); // discard the mount sync; isolate the event path

    window.dispatchEvent(new Event('agent-ide:theme-applied'));

    expect(syncTheme).toHaveBeenCalledTimes(1);
  });
});
