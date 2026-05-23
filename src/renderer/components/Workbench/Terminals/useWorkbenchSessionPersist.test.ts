/**
 * useWorkbenchSessionPersist — unit tests (Wave 9 Phase 1, updated Wave 10 Phase 1).
 *
 * Contract: debounced 750ms writer + 30s safety interval.
 * Wave 10: writes `canonWorkbenchSessions` as a Record keyed by projectRoot.
 * Short-circuits when `persistTerminalSessions` is false or `projectRoot` is null.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const UPPER_ID = 'wb-cc-test-upper';
const LOWER_ID = 'wb-shell-test-lower';
const TEST_ROOT = '/home/user/project';

function makeApi(upperCwd: string, lowerCwd: string, existingRecord: unknown = {}) {
  return {
    pty: {
      getCwd: vi.fn((id: string) => {
        const cwd = id === UPPER_ID ? upperCwd : lowerCwd;
        return Promise.resolve({ success: true, cwd });
      }),
    },
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
  it('coalesces rapid claudeSessionId changes into a single config.set call', async () => {
    const api = makeApi('/upper/cwd', '/lower/cwd');
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    const { rerender } = renderHook(
      ({ claudeSessionId }) =>
        useWorkbenchSessionPersist({
          projectRoot: TEST_ROOT,
          upperSessionId: UPPER_ID,
          lowerSessionId: LOWER_ID,
          claudeSessionId,
        }),
      { initialProps: { claudeSessionId: null as string | null } },
    );

    // Rapid changes — should all be coalesced.
    rerender({ claudeSessionId: 'sess-1' });
    rerender({ claudeSessionId: 'sess-2' });
    rerender({ claudeSessionId: 'sess-3' });

    // Before debounce fires: no write yet.
    expect(api.config.set).not.toHaveBeenCalled();

    // Advance past the debounce.
    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    // Exactly one config.set, with the latest claudeSessionId nested under projectRoot.
    expect(api.config.set).toHaveBeenCalledTimes(1);
    expect(api.config.set).toHaveBeenCalledWith(
      'canonWorkbenchSessions',
      expect.objectContaining({
        [TEST_ROOT]: expect.objectContaining({
          upper: expect.objectContaining({ claudeSessionId: 'sess-3' }),
        }),
      }),
    );
  });
});

describe('useWorkbenchSessionPersist — claudeSessionId change triggers write', () => {
  it('writes correct payload shape with cwd + claudeSessionId nested under projectRoot', async () => {
    const api = makeApi('/work/project', '/work/shell');
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        projectRoot: TEST_ROOT,
        upperSessionId: UPPER_ID,
        lowerSessionId: LOWER_ID,
        claudeSessionId: 'sess-abc',
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    expect(api.config.set).toHaveBeenCalledWith('canonWorkbenchSessions', {
      [TEST_ROOT]: {
        upper: { cwd: '/work/project', claudeSessionId: 'sess-abc' },
        lower: { cwd: '/work/shell' },
      },
    });
  });

  it('writes upper without claudeSessionId when claudeSessionId is null', async () => {
    const api = makeApi('/work/project', '/work/shell');
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        projectRoot: TEST_ROOT,
        upperSessionId: UPPER_ID,
        lowerSessionId: LOWER_ID,
        claudeSessionId: null,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    const call = api.config.set.mock.calls[0];
    const record = call[1] as Record<
      string,
      { upper: Record<string, unknown> | null; lower: Record<string, unknown> | null }
    >;
    expect(call[0]).toBe('canonWorkbenchSessions');
    const slot = record[TEST_ROOT];
    expect(slot.upper).toBeTruthy();
    expect(slot.upper?.claudeSessionId).toBeUndefined();
  });
});

describe('useWorkbenchSessionPersist — safety interval at 30s', () => {
  it('fires a write every 30s even without claudeSessionId changes', async () => {
    const api = makeApi('/safe/upper', '/safe/lower');
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        projectRoot: TEST_ROOT,
        upperSessionId: UPPER_ID,
        lowerSessionId: LOWER_ID,
        claudeSessionId: 'sess-stable',
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
  it('does not call getCwd or config.set when the flag is off', async () => {
    mockPersistEnabled = false;
    const api = makeApi('/no/write/upper', '/no/write/lower');
    (window as unknown as { electronAPI: unknown }).electronAPI = api;

    renderHook(() =>
      useWorkbenchSessionPersist({
        projectRoot: TEST_ROOT,
        upperSessionId: UPPER_ID,
        lowerSessionId: LOWER_ID,
        claudeSessionId: 'sess-should-not-write',
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(api.pty.getCwd).not.toHaveBeenCalled();
    expect(api.config.set).not.toHaveBeenCalled();
  });
});
