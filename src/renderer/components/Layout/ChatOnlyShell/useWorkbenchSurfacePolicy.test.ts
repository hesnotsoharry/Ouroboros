/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OPEN_SUBAGENT_PANEL_EVENT } from '../../../hooks/appEventNames';
import { useWorkbenchSurfacePolicy } from './useWorkbenchSurfacePolicy';

describe('useWorkbenchSurfacePolicy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens subagents on event and suppresses the same tool call after close', () => {
    const setUtilityOpen = vi.fn();
    const setActiveUtilityTab = vi.fn();

    const { result } = renderHook(() =>
      useWorkbenchSurfacePolicy({
        setUtilityOpen,
        setActiveUtilityTab,
      }),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_SUBAGENT_PANEL_EVENT, { detail: { toolCallId: 'tool-1' } }),
      );
    });
    expect(setUtilityOpen).toHaveBeenCalledWith(true);
    expect(setActiveUtilityTab).toHaveBeenCalledWith('monitor');

    act(() => {
      result.current.closeUtility();
    });
    setUtilityOpen.mockClear();
    setActiveUtilityTab.mockClear();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_SUBAGENT_PANEL_EVENT, { detail: { toolCallId: 'tool-1' } }),
      );
    });
    expect(setUtilityOpen).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(OPEN_SUBAGENT_PANEL_EVENT, { detail: { toolCallId: 'tool-2' } }),
      );
    });
    expect(setUtilityOpen).toHaveBeenCalledWith(true);
    expect(setActiveUtilityTab).toHaveBeenCalledWith('monitor');
  });
});
