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

  it('opens approvals and only reopens when a new approval key arrives after dismissal', () => {
    const setUtilityOpen = vi.fn();
    const setActiveUtilityTab = vi.fn();

    const { result, rerender } = renderHook(
      (approvalCount: number) =>
        useWorkbenchSurfacePolicy({
          approvalCount,
          setUtilityOpen,
          setActiveUtilityTab,
        }),
      {
        initialProps: 0,
      },
    );

    rerender(1);
    expect(setUtilityOpen).toHaveBeenCalledWith(true);
    expect(setActiveUtilityTab).toHaveBeenCalledWith('approvals');

    act(() => {
      result.current.closeUtility();
    });
    expect(setUtilityOpen).toHaveBeenLastCalledWith(false);
    setUtilityOpen.mockClear();
    setActiveUtilityTab.mockClear();

    rerender(0);
    rerender(1);
    expect(setUtilityOpen).not.toHaveBeenCalled();

    rerender(2);
    expect(setUtilityOpen).toHaveBeenCalledWith(true);
    expect(setActiveUtilityTab).toHaveBeenCalledWith('approvals');
  });

  it('opens subagents on event and suppresses the same tool call after close', () => {
    const setUtilityOpen = vi.fn();
    const setActiveUtilityTab = vi.fn();

    const { result } = renderHook(() =>
      useWorkbenchSurfacePolicy({
        approvalCount: 0,
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
