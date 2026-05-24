/**
 * Orchestrator-owned acceptance test — Wave 10 Phase 1, updated Wave 12 Phase 3.
 *
 * Wave 12 update: reshapes the per-project slot from `{ upper: {cwd,...}|null,
 * lower: {cwd}|null }` (Wave 10) to `{ upper: TabCollection, lower: TabCollection }`
 * where `TabCollection = { activeTabId, tabs: TabState[] }`.
 *
 * The hook contracts under test:
 *   - useWorkbenchRestore(projectRoot: string | null)
 *       reads `canonWorkbenchSessions` from electron-store and returns the slice
 *       under [projectRoot]. Returns empty (all fields undefined) when:
 *         (a) projectRoot is null  (short-circuit, isReady:true immediately)
 *         (b) the record lacks a [projectRoot] key
 *         (c) the persisted data is legacy flat-shape (Wave 9 `{ upper, lower }`)
 *         (d) the persisted data is Wave-10 cwd-slot shape (now also legacy)
 *         (e) persistTerminalSessions is false
 *       Returns upperCollection/lowerCollection when Wave-12 TabCollection shape found.
 *
 *   - useWorkbenchSessionPersist({ frame, projectRoot, tabCollection })
 *       performs a read-modify-write of the record: latest value of
 *       canonWorkbenchSessions is read at flush time, the [projectRoot][frame] slot
 *       is replaced, other frames and other projects are preserved. Legacy flat-shape
 *       on disk at flush time is replaced with a fresh record carrying ONLY the
 *       active project's slot (cold-start per Wave 10 ADR D1).
 *
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { TabCollection } from '../../../types/electron';
import { useWorkbenchRestore } from './useWorkbenchRestore';
import { useWorkbenchSessionPersist } from './useWorkbenchSessionPersist';

// ── Config mock — persistEnabled toggleable per test ──────────────────────────
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

// ── electronAPI harness ───────────────────────────────────────────────────────

interface ConfigSetCall {
  key: string;
  value: unknown;
}

interface MockElectronStore {
  storeValue: unknown;
  setCalls: ConfigSetCall[];
}

function installElectronAPI(store: MockElectronStore): void {
  const getMock = vi.fn(async (key: string) => {
    if (key === 'canonWorkbenchSessions') return store.storeValue;
    return undefined;
  });
  const setMock = vi.fn(async (key: string, value: unknown) => {
    store.setCalls.push({ key, value });
    if (key === 'canonWorkbenchSessions') {
      store.storeValue = value;
    }
    return { success: true };
  });

  (window as unknown as { electronAPI: unknown }).electronAPI = {
    config: { get: getMock, set: setMock },
  };
}

function newStore(initial: unknown): MockElectronStore {
  return { storeValue: initial, setCalls: [] };
}

// ── Wave-12 TabCollection fixtures ────────────────────────────────────────────

const makeTabCollection = (kind: 'cc' | 'shell', sessionId: string): TabCollection => ({
  activeTabId: `tab-${kind}-1`,
  tabs: [
    {
      id: `tab-${kind}-1`,
      label: kind === 'cc' ? 'claude' : 'shell',
      sessionId,
      kind,
      createdAt: 1716000000000,
    },
  ],
});

const EMPTY_COLLECTION: TabCollection = { activeTabId: null, tabs: [] };

beforeEach(() => {
  mockPersistEnabled = true;
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── useWorkbenchRestore — per-project reads ────────────────────────────────────

describe('Wave 10 — useWorkbenchRestore(projectRoot) reads the per-project slice', () => {
  it('returns the slice under [projectRoot] when the record-shape contains that key', async () => {
    const upperA = makeTabCollection('cc', 'sess-A');
    const lowerA = makeTabCollection('shell', 'tab-sh-1-a');
    const upperB = makeTabCollection('cc', 'sess-B');
    const lowerB = makeTabCollection('shell', 'tab-sh-1-b');

    const store = newStore({
      '/proj/a': { upper: upperA, lower: lowerA },
      '/proj/b': { upper: upperB, lower: lowerB },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCollection).toEqual(upperA);
    expect(result.current.lowerCollection).toEqual(lowerA);
    // resumeSessionId is derived from the active CC tab.
    expect(result.current.resumeSessionId).toBe('sess-A');
  });

  it('returns empty (all fields undefined) when [projectRoot] key is absent', async () => {
    const store = newStore({
      '/proj/a': {
        upper: makeTabCollection('cc', 'sess-A'),
        lower: EMPTY_COLLECTION,
      },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/never-seen'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCollection).toBeUndefined();
    expect(result.current.lowerCollection).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });

  it('returns empty when the [projectRoot] slot exists but is null', async () => {
    const store = newStore({ '/proj/a': null });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCollection).toBeUndefined();
    expect(result.current.lowerCollection).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });
});

// ── useWorkbenchRestore — legacy shape cold-start ──────────────────────────────

describe('Wave 10 — useWorkbenchRestore cold-starts on Wave 9 legacy flat shape (ADR D1)', () => {
  it('returns empty when persisted data is the legacy { upper, lower } flat shape', async () => {
    const store = newStore({
      upper: { cwd: '/legacy/cwd', claudeSessionId: 'legacy-sess' },
      lower: { cwd: '/legacy/cwd' },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCollection).toBeUndefined();
    expect(result.current.lowerCollection).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });
});

// ── useWorkbenchRestore — null projectRoot short-circuit ───────────────────────

describe('Wave 10 — useWorkbenchRestore(null) short-circuits without reading the store', () => {
  it('returns isReady:true immediately and never calls config.get when projectRoot is null', async () => {
    const store = newStore({
      '/proj/a': {
        upper: makeTabCollection('cc', 'sess-A'),
        lower: EMPTY_COLLECTION,
      },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore(null));

    await act(async () => {
      /* flush microtasks */
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    const getMock = (window.electronAPI as unknown as { config: { get: Mock } }).config.get;
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.upperCollection).toBeUndefined();
    expect(result.current.lowerCollection).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });

  it('returns isReady:true and empty fields when persistTerminalSessions is false', async () => {
    mockPersistEnabled = false;
    const store = newStore({
      '/proj/a': {
        upper: makeTabCollection('cc', 'sess-A'),
        lower: EMPTY_COLLECTION,
      },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    const getMock = (window.electronAPI as unknown as { config: { get: Mock } }).config.get;
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.upperCollection).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });
});

// ── useWorkbenchSessionPersist — per-project read-modify-write ────────────────

describe('Wave 10 — useWorkbenchSessionPersist(projectRoot, …) preserves other projects', () => {
  it('write under /proj/a preserves /proj/b slot in the record', async () => {
    const existingUpperB = makeTabCollection('cc', 'keep-B');
    const existingLowerB = makeTabCollection('shell', 'tab-sh-b');
    const newUpperA = makeTabCollection('cc', 'new-A');

    const store = newStore({
      '/proj/a': {
        upper: makeTabCollection('cc', 'old-A'),
        lower: EMPTY_COLLECTION,
      },
      '/proj/b': {
        upper: existingUpperB,
        lower: existingLowerB,
      },
    });
    installElectronAPI(store);

    renderHook(() =>
      useWorkbenchSessionPersist({
        frame: 'upper',
        projectRoot: '/proj/a',
        tabCollection: newUpperA,
      }),
    );

    // Wait for the debounced write to land (750ms debounce + buffer; real timers).
    await waitFor(
      () => {
        const lastWrite = store.setCalls.find((c) => c.key === 'canonWorkbenchSessions');
        expect(lastWrite).toBeDefined();
      },
      { timeout: 2500 },
    );

    const finalRecord = store.storeValue as Record<
      string,
      { upper: TabCollection; lower: TabCollection }
    >;

    // /proj/a upper updated to the new TabCollection.
    expect(finalRecord['/proj/a'].upper).toEqual(newUpperA);
    // /proj/b preserved verbatim.
    expect(finalRecord['/proj/b'].upper).toEqual(existingUpperB);
    expect(finalRecord['/proj/b'].lower).toEqual(existingLowerB);
  });

  it('write under /proj/a replaces the legacy flat shape with a fresh record (cold-start)', async () => {
    const newUpperA = makeTabCollection('cc', 'sess-A');
    const store = newStore({
      upper: { cwd: '/legacy/cwd', claudeSessionId: 'legacy-sess' },
      lower: { cwd: '/legacy/cwd' },
    });
    installElectronAPI(store);

    renderHook(() =>
      useWorkbenchSessionPersist({
        frame: 'upper',
        projectRoot: '/proj/a',
        tabCollection: newUpperA,
      }),
    );

    await waitFor(
      () => {
        const lastWrite = store.setCalls.find((c) => c.key === 'canonWorkbenchSessions');
        expect(lastWrite).toBeDefined();
      },
      { timeout: 2500 },
    );

    const finalRecord = store.storeValue as Record<string, unknown>;

    // The legacy flat-shape keys must be GONE.
    expect(finalRecord).not.toHaveProperty('upper');
    expect(finalRecord).not.toHaveProperty('lower');

    // The active project's slot is populated with the new TabCollection.
    const slot = finalRecord['/proj/a'] as { upper: TabCollection };
    expect(slot.upper).toEqual(newUpperA);
  });

  it('does NOT write when projectRoot is null (no active project)', async () => {
    const store = newStore({});
    installElectronAPI(store);

    renderHook(() =>
      useWorkbenchSessionPersist({
        frame: 'upper',
        projectRoot: null,
        tabCollection: makeTabCollection('cc', 'sess-X'),
      }),
    );

    // Allow plenty of time for the debounce to have fired had it been armed.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(store.setCalls).toHaveLength(0);
  });
});
