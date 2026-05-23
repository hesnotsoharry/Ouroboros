/**
 * useWorkbenchRestore — unit tests (Wave 9 Phase 1).
 *
 * Contract: one-shot async read of `canonWorkbenchSessions` from electron-store on mount.
 * Returns `{ isReady: false }` until the read completes, then maps the persisted shape.
 * Short-circuits when `persistTerminalSessions` is false.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkbenchRestoreState } from './useWorkbenchRestore';
import { useWorkbenchRestore } from './useWorkbenchRestore';

// ── useConfig mock ────────────────────────────────────────────────────────────
let mockPersistEnabled = true;

vi.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { persistTerminalSessions: mockPersistEnabled },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────
function makeElectronAPI(canonValue: unknown) {
  return {
    config: {
      get: vi.fn().mockResolvedValue(canonValue),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

beforeEach(() => {
  mockPersistEnabled = true;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useWorkbenchRestore — isReady lifecycle', () => {
  it('starts with isReady:false before the async read resolves', async () => {
    // Use a never-resolving promise so we can observe the initial state.
    const hang = new Promise<never>(() => {
      /* never resolves */
    });
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: { get: vi.fn().mockReturnValue(hang) },
    };

    const { result } = renderHook(() => useWorkbenchRestore());

    // Synchronously: isReady must be false.
    expect(result.current.isReady).toBe(false);
    expect(result.current.upperCwd).toBeUndefined();
    expect(result.current.lowerCwd).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });

  it('flips isReady:true after the async read resolves', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: null,
      lower: null,
    });

    const { result } = renderHook(() => useWorkbenchRestore());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });
});

describe('useWorkbenchRestore — empty store', () => {
  it('returns isReady:true with all fields undefined when store has { upper:null, lower:null }', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: null,
      lower: null,
    });

    const { result } = renderHook(() => useWorkbenchRestore());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    const state: WorkbenchRestoreState = result.current;
    expect(state.upperCwd).toBeUndefined();
    expect(state.lowerCwd).toBeUndefined();
    expect(state.resumeSessionId).toBeUndefined();
    // Confirm config.get was called with the correct key.
    const mockGet = (window.electronAPI as { config: { get: ReturnType<typeof vi.fn> } }).config
      .get;
    expect(mockGet).toHaveBeenCalledWith('canonWorkbenchSessions');
  });
});

describe('useWorkbenchRestore — claude-only upper frame', () => {
  it('returns upperCwd and resumeSessionId when upper has claudeSessionId, lower is null', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: { cwd: '/home/user/project', claudeSessionId: 'sess-abc123' },
      lower: null,
    });

    const { result } = renderHook(() => useWorkbenchRestore());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCwd).toBe('/home/user/project');
    expect(result.current.resumeSessionId).toBe('sess-abc123');
    expect(result.current.lowerCwd).toBeUndefined();
  });
});

describe('useWorkbenchRestore — full two-frame restore', () => {
  it('returns all three values when both frames are populated', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: { cwd: '/home/user/project', claudeSessionId: 'sess-xyz789' },
      lower: { cwd: '/home/user/other' },
    });

    const { result } = renderHook(() => useWorkbenchRestore());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCwd).toBe('/home/user/project');
    expect(result.current.resumeSessionId).toBe('sess-xyz789');
    expect(result.current.lowerCwd).toBe('/home/user/other');
  });
});

describe('useWorkbenchRestore — persistTerminalSessions:false short-circuit', () => {
  it('returns isReady:true immediately without calling config.get when flag is off', async () => {
    mockPersistEnabled = false;
    const mockGet = vi.fn();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: { get: mockGet },
    };

    const { result } = renderHook(() => useWorkbenchRestore());

    await act(async () => {
      // Flush microtasks — config.get must NOT be called.
    });

    // isReady resolves synchronously (via the persistEnabled:false branch in useEffect).
    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.upperCwd).toBeUndefined();
    expect(result.current.lowerCwd).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });
});
