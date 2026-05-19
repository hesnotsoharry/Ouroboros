/**
 * @vitest-environment jsdom
 */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useChatWorkbenchLayout } from './useChatWorkbenchLayout';

const STORAGE_KEY = 'agent-ide:chat-workbench-layout';

describe('useChatWorkbenchLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('returns the default layout state with rail open and utility closed', () => {
    const { result } = renderHook(() => useChatWorkbenchLayout());

    expect(result.current.railOpen).toBe(true);
    expect(result.current.utilityOpen).toBe(false);
    expect(result.current.activeUtilityTab).toBe('activity');
    // Wave 95 Phase H continuation: artifact pane removed — no artifactOpen state
    expect('artifactOpen' in result.current).toBe(false);
    expect('isArtifactOpen' in result.current).toBe(false);
    expect('toggleArtifact' in result.current).toBe(false);
  });

  it('restores utility and rail state from localStorage (ignores removed artifact fields)', () => {
    // Old persisted data may contain artifactOpen/lastRightPaneView — gracefully ignored.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        railOpen: false,
        artifactOpen: true,
        utilityOpen: true,
        activeUtilityTab: 'monitor',
        lastRightPaneView: 'artifact',
      }),
    );

    const { result } = renderHook(() => useChatWorkbenchLayout());

    expect(result.current.railOpen).toBe(false);
    expect(result.current.utilityOpen).toBe(true);
    expect(result.current.activeUtilityTab).toBe('monitor');
  });

  it('falls back to defaults when persisted state is corrupted', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');

    const { result } = renderHook(() => useChatWorkbenchLayout());

    expect(result.current.railOpen).toBe(true);
    expect(result.current.utilityOpen).toBe(false);
    expect(result.current.activeUtilityTab).toBe('activity');
  });

  it('persists updates after toggle and setter changes', async () => {
    const { result } = renderHook(() => useChatWorkbenchLayout());

    act(() => {
      result.current.toggleRail();
      result.current.setUtilityOpen(true);
      result.current.setActiveUtilityTab('monitor');
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      railOpen: false,
      utilityOpen: true,
      activeUtilityTab: 'monitor',
    });
  });

  it('toggleUtility opens and closes utility pane', () => {
    const { result } = renderHook(() => useChatWorkbenchLayout());

    act(() => result.current.toggleUtility());
    expect(result.current.isUtilityOpen).toBe(true);
    expect(result.current.rightPaneOpen).toBe(true);
    expect(result.current.rightPaneView).toBe('utility');

    act(() => result.current.toggleUtility());
    expect(result.current.isUtilityOpen).toBe(false);
    expect(result.current.rightPaneOpen).toBe(false);
    expect(result.current.rightPaneView).toBeNull();
  });

  it('isUtilityOpen is an alias for utilityOpen', () => {
    const { result } = renderHook(() => useChatWorkbenchLayout());
    act(() => result.current.setUtilityOpen(true));
    expect(result.current.isUtilityOpen).toBe(result.current.utilityOpen);
    expect(result.current.isUtilityOpen).toBe(true);
  });

  it('toggleRightPane opens and closes the utility pane', () => {
    const { result } = renderHook(() => useChatWorkbenchLayout());

    act(() => result.current.toggleRightPane());
    expect(result.current.utilityOpen).toBe(true);
    expect(result.current.rightPaneOpen).toBe(true);
    expect(result.current.rightPaneView).toBe('utility');

    act(() => result.current.toggleRightPane());
    expect(result.current.utilityOpen).toBe(false);
    expect(result.current.rightPaneOpen).toBe(false);
  });
});
