/**
 * useWorkbenchRestore — unit tests (Wave 9 Phase 1, updated Wave 10 Phase 1).
 *
 * Contract: one-shot async read of `canonWorkbenchSessions` from electron-store on mount.
 * Returns `{ isReady: false }` until the read completes, then maps the per-project slice.
 * Short-circuits when `persistTerminalSessions` is false or `projectRoot` is null.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const TEST_ROOT = '/home/user/project';

/** Wraps the per-project slot under the test project root key. */
function makeElectronAPI(slotValue: unknown) {
  return {
    config: {
      get: vi.fn().mockResolvedValue({ [TEST_ROOT]: slotValue }),
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

    const { result } = renderHook(() => useWorkbenchRestore(TEST_ROOT));

    // Synchronously: isReady must be false.
    // Wave-9 compat fields (upperCwd, lowerCwd, resumeSessionId) are removed per
    // product decision 2026-05-31 — access via cast to avoid tsc errors on removed fields.
    expect(result.current.isReady).toBe(false);
    expect((result.current as Record<string, unknown>)['upperCwd']).toBeUndefined();
    expect((result.current as Record<string, unknown>)['lowerCwd']).toBeUndefined();
    expect((result.current as Record<string, unknown>)['resumeSessionId']).toBeUndefined();
  });

  it('flips isReady:true after the async read resolves', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: null,
      lower: null,
    });

    const { result } = renderHook(() => useWorkbenchRestore(TEST_ROOT));

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });
});

describe('useWorkbenchRestore — empty store', () => {
  it('returns isReady:true with all fields undefined when slot has { upper:null, lower:null }', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: null,
      lower: null,
    });

    const { result } = renderHook(() => useWorkbenchRestore(TEST_ROOT));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    const state = result.current as Record<string, unknown>;
    // Wave-9 compat fields (upperCwd, lowerCwd, resumeSessionId) removed — cast to verify undefined.
    expect(state['upperCwd']).toBeUndefined();
    expect(state['lowerCwd']).toBeUndefined();
    expect(state['resumeSessionId']).toBeUndefined();
    // Confirm config.get was called with the correct key.
    const mockGet = (window.electronAPI as { config: { get: ReturnType<typeof vi.fn> } }).config
      .get;
    expect(mockGet).toHaveBeenCalledWith('canonWorkbenchSessions');
  });
});

describe('useWorkbenchRestore — Wave 12 CC tab restore (tab layout preserved, no resume)', () => {
  it('returns upperCollection with tab layout when upper has an active CC tab (no resumeSessionId)', async () => {
    // Wave 12 shape: TabCollection with an active CC tab.
    // resumeSessionId is intentionally gone (product decision 2026-05-31 — always spawn fresh).
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: {
        activeTabId: 'tab-cc-1',
        tabs: [
          {
            id: 'tab-cc-1',
            label: 'claude',
            sessionId: 'sess-abc123',
            kind: 'cc',
            createdAt: 1716000000000,
          },
        ],
      },
      lower: { activeTabId: null, tabs: [] },
    });

    const { result } = renderHook(() => useWorkbenchRestore(TEST_ROOT));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCollection).toBeDefined();
    expect(result.current.upperCollection!.tabs.length).toBe(1);
    // resumeSessionId is never returned — spawn-fresh contract.
    expect((result.current as Record<string, unknown>)['resumeSessionId']).toBeUndefined();
    expect(result.current.lowerCollection).toBeDefined();
  });
});

describe('useWorkbenchRestore — Wave 12 full two-frame restore', () => {
  it('returns upperCollection and lowerCollection when both frames have Tab Collections', async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = makeElectronAPI({
      upper: {
        activeTabId: 'tab-cc-1',
        tabs: [
          {
            id: 'tab-cc-1',
            label: 'claude',
            sessionId: 'sess-xyz789',
            kind: 'cc',
            createdAt: 1716000000000,
          },
        ],
      },
      lower: {
        activeTabId: 'tab-sh-1',
        tabs: [
          {
            id: 'tab-sh-1',
            label: 'shell',
            sessionId: 'tab-sh-1',
            kind: 'shell',
            createdAt: 1716000001000,
          },
        ],
      },
    });

    const { result } = renderHook(() => useWorkbenchRestore(TEST_ROOT));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    // resumeSessionId is never returned (spawn-fresh contract, 2026-05-31).
    expect((result.current as Record<string, unknown>)['resumeSessionId']).toBeUndefined();
    expect(result.current.upperCollection!.activeTabId).toBe('tab-cc-1');
    expect(result.current.lowerCollection!.activeTabId).toBe('tab-sh-1');
  });
});

describe('useWorkbenchRestore — persistTerminalSessions:false short-circuit', () => {
  it('returns isReady:true immediately without calling config.get when flag is off', async () => {
    mockPersistEnabled = false;
    const mockGet = vi.fn();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      config: { get: mockGet },
    };

    const { result } = renderHook(() => useWorkbenchRestore(TEST_ROOT));

    await act(async () => {
      // Flush microtasks — config.get must NOT be called.
    });

    // isReady resolves synchronously (via the persistEnabled:false branch in useEffect).
    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(mockGet).not.toHaveBeenCalled();
    // Wave-9 compat fields removed (product decision 2026-05-31) — cast to verify.
    expect((result.current as Record<string, unknown>)['upperCwd']).toBeUndefined();
    expect((result.current as Record<string, unknown>)['lowerCwd']).toBeUndefined();
    expect((result.current as Record<string, unknown>)['resumeSessionId']).toBeUndefined();
  });
});
