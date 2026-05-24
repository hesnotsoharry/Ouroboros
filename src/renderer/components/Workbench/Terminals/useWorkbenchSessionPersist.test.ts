/**
 * useWorkbenchSessionPersist — unit tests (Wave 12 Phase 3).
 *
 * Contract: debounced 750ms writer + 30s safety interval.
 * Wave 12: writes `canonWorkbenchSessions` as a Record keyed by projectRoot,
 * where each slot holds `{ upper: TabCollection, lower: TabCollection }`.
 * New signature: `{ frame, projectRoot, tabCollection }` (replaces Wave-10
 * `{ projectRoot, upperSessionId, lowerSessionId, claudeSessionId }`).
 * Short-circuits when `persistTerminalSessions` is false or `projectRoot` is null.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TabCollection } from '../../../types/electron';
import { useWorkbenchSessionPersist } from './useWorkbenchSessionPersist';

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

const UPPER_COLLECTION: TabCollection = {
  activeTabId: 'tab-cc-1',
  tabs: [
    {
      id: 'tab-cc-1',
      label: 'claude',
      sessionId: 'sess-abc',
      kind: 'cc',
      createdAt: 1716000000000,
    },
  ],
};

const LOWER_COLLECTION: TabCollection = {
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
};

function makeApi(existingRecord: unknown = {}) {
  return {
    config: {
      get: vi.fn().mockResolvedValue(existingRecord),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

beforeEach(() => {
  mockPersistEnabled = true;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useWorkbenchSessionPersist — 750ms debounce', () => {
  it('coalesces rapid tabCollection changes into a single config.set call', async () => {
    const api = makeApi();
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    const tab1: TabCollection = { activeTabId: 'tab-1', tabs: [] };
    const tab2: TabCollection = { activeTabId: 'tab-2', tabs: [] };
    const tab3: TabCollection = { activeTabId: 'tab-3', tabs: [] };

    const { rerender } = renderHook(
      ({ tabCollection }) =>
        useWorkbenchSessionPersist({
          frame: 'upper',
          projectRoot: TEST_ROOT,
          tabCollection,
        }),
      { initialProps: { tabCollection: tab1 } },
    );

    // Rapid changes — should all be coalesced.
    rerender({ tabCollection: tab2 });
    rerender({ tabCollection: tab3 });

    // Before debounce fires: no write yet.
    expect(api.config.set).not.toHaveBeenCalled();

    // Advance past the debounce.
    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    // Exactly one config.set, with the latest tabCollection.
    expect(api.config.set).toHaveBeenCalledTimes(1);
    expect(api.config.set).toHaveBeenCalledWith(
      'canonWorkbenchSessions',
      expect.objectContaining({
        [TEST_ROOT]: expect.objectContaining({
          upper: expect.objectContaining({ activeTabId: 'tab-3' }),
        }),
      }),
    );
  });
});

describe('useWorkbenchSessionPersist — TabCollection write shape', () => {
  it('writes correct TabCollection payload shape nested under projectRoot', async () => {
    const api = makeApi();
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        frame: 'upper',
        projectRoot: TEST_ROOT,
        tabCollection: UPPER_COLLECTION,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    expect(api.config.set).toHaveBeenCalledWith('canonWorkbenchSessions', {
      [TEST_ROOT]: {
        upper: UPPER_COLLECTION,
        lower: { activeTabId: null, tabs: [] }, // empty other frame
      },
    });
  });

  it('preserves the other frame data when writing one frame', async () => {
    // Existing record has lower frame data — writing upper should preserve it.
    const existing = {
      [TEST_ROOT]: {
        upper: { activeTabId: null, tabs: [] },
        lower: LOWER_COLLECTION,
      },
    };
    const api = makeApi(existing);
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        frame: 'upper',
        projectRoot: TEST_ROOT,
        tabCollection: UPPER_COLLECTION,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    expect(api.config.set).toHaveBeenCalledWith('canonWorkbenchSessions', {
      [TEST_ROOT]: {
        upper: UPPER_COLLECTION,
        lower: LOWER_COLLECTION,
      },
    });
  });
});

describe('useWorkbenchSessionPersist — safety interval at 30s', () => {
  it('fires a write every 30s even without tabCollection changes', async () => {
    const api = makeApi();
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        frame: 'upper',
        projectRoot: TEST_ROOT,
        tabCollection: UPPER_COLLECTION,
      }),
    );

    // Let the initial debounce fire.
    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    const afterDebounce = api.config.set.mock.calls.length;

    // Advance 30s — safety interval fires.
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(api.config.set.mock.calls.length).toBeGreaterThan(afterDebounce);
  });
});

describe('useWorkbenchSessionPersist — persistTerminalSessions:false short-circuit', () => {
  it('does not call config.set when the flag is off', async () => {
    mockPersistEnabled = false;
    const api = makeApi();
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        frame: 'upper',
        projectRoot: TEST_ROOT,
        tabCollection: UPPER_COLLECTION,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(api.config.set).not.toHaveBeenCalled();
  });
});
