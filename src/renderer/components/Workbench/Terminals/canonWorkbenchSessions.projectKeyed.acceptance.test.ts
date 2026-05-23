/**
 * Orchestrator-owned acceptance test — Wave 10 Phase 1 (per-project session persistence).
 *
 * Expresses the contract: `canonWorkbenchSessions` is reshaped from a flat
 * `{ upper, lower }` (Wave 9) to `Record<projectRoot, { upper, lower }>` (Wave 10).
 *
 * The hook contracts under test:
 *   - useWorkbenchRestore(projectRoot: string | null)
 *       reads `canonWorkbenchSessions` from electron-store and returns the slice
 *       under [projectRoot]. Returns empty (all fields undefined) when:
 *         (a) projectRoot is null  (short-circuit, isReady:true immediately)
 *         (b) the record lacks a [projectRoot] key
 *         (c) the persisted data is legacy flat-shape (Wave 9 `{ upper, lower }`)
 *         (d) persistTerminalSessions is false
 *
 *   - useWorkbenchSessionPersist({ projectRoot, upperSessionId, lowerSessionId, claudeSessionId })
 *       performs a read-modify-write of the record: latest value of
 *       canonWorkbenchSessions is read at flush time, the [projectRoot] slot is
 *       replaced, other keys' data is preserved. Legacy flat-shape on disk at
 *       flush time is replaced with a fresh record carrying ONLY the active
 *       project's slot (cold-start per Wave 10 ADR D1).
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 1
 * implementer implements against THIS test and MAY NOT modify it. RED at
 * dispatch; goes green when the reshape + per-project hook signatures land.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

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
  cwdByPty: Record<string, string>;
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
  const getCwdMock = vi.fn(async (ptyId: string) => {
    const cwd = store.cwdByPty[ptyId];
    if (!cwd) return { success: false };
    return { success: true, cwd };
  });

  (window as unknown as { electronAPI: unknown }).electronAPI = {
    config: { get: getMock, set: setMock },
    pty: { getCwd: getCwdMock },
  };
}

function newStore(initial: unknown, cwdByPty: Record<string, string> = {}): MockElectronStore {
  return { storeValue: initial, setCalls: [], cwdByPty };
}

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
    const store = newStore({
      '/proj/a': {
        upper: { cwd: '/proj/a/src', claudeSessionId: 'sess-A' },
        lower: { cwd: '/proj/a' },
      },
      '/proj/b': {
        upper: { cwd: '/proj/b/src', claudeSessionId: 'sess-B' },
        lower: { cwd: '/proj/b' },
      },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCwd).toBe('/proj/a/src');
    expect(result.current.lowerCwd).toBe('/proj/a');
    expect(result.current.resumeSessionId).toBe('sess-A');
  });

  it('returns empty (all fields undefined) when [projectRoot] key is absent', async () => {
    const store = newStore({
      '/proj/a': {
        upper: { cwd: '/proj/a', claudeSessionId: 'sess-A' },
        lower: { cwd: '/proj/a' },
      },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/never-seen'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCwd).toBeUndefined();
    expect(result.current.lowerCwd).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });

  it('returns empty when the [projectRoot] slot exists but is null', async () => {
    const store = newStore({
      '/proj/a': null,
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCwd).toBeUndefined();
    expect(result.current.lowerCwd).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });
});

// ── useWorkbenchRestore — legacy flat-shape cold-start ─────────────────────────

describe('Wave 10 — useWorkbenchRestore cold-starts on Wave 9 legacy flat shape (ADR D1)', () => {
  it('returns empty when persisted data is the legacy { upper, lower } flat shape', async () => {
    // Legacy Wave 9 shape that should be treated as throwaway.
    const store = newStore({
      upper: { cwd: '/legacy/cwd', claudeSessionId: 'legacy-sess' },
      lower: { cwd: '/legacy/cwd' },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.upperCwd).toBeUndefined();
    expect(result.current.lowerCwd).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });
});

// ── useWorkbenchRestore — null projectRoot short-circuit ───────────────────────

describe('Wave 10 — useWorkbenchRestore(null) short-circuits without reading the store', () => {
  it('returns isReady:true immediately and never calls config.get when projectRoot is null', async () => {
    const store = newStore({
      '/proj/a': { upper: { cwd: '/proj/a' }, lower: { cwd: '/proj/a' } },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore(null));

    await act(async () => {
      /* flush microtasks */
    });

    await waitFor(() => expect(result.current.isReady).toBe(true));

    const getMock = (
      window.electronAPI as unknown as { config: { get: Mock } }
    ).config.get;
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.upperCwd).toBeUndefined();
    expect(result.current.lowerCwd).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });

  it('returns isReady:true and empty fields when persistTerminalSessions is false', async () => {
    mockPersistEnabled = false;
    const store = newStore({
      '/proj/a': { upper: { cwd: '/proj/a' }, lower: { cwd: '/proj/a' } },
    });
    installElectronAPI(store);

    const { result } = renderHook(() => useWorkbenchRestore('/proj/a'));

    await waitFor(() => expect(result.current.isReady).toBe(true));

    const getMock = (
      window.electronAPI as unknown as { config: { get: Mock } }
    ).config.get;
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.upperCwd).toBeUndefined();
    expect(result.current.lowerCwd).toBeUndefined();
    expect(result.current.resumeSessionId).toBeUndefined();
  });
});

// ── useWorkbenchSessionPersist — per-project read-modify-write ────────────────

describe('Wave 10 — useWorkbenchSessionPersist(projectRoot, …) preserves other projects', () => {
  it('write under /proj/a preserves /proj/b slot in the record', async () => {
    const store = newStore(
      {
        '/proj/a': {
          upper: { cwd: '/proj/a/old', claudeSessionId: 'old-A' },
          lower: { cwd: '/proj/a/old' },
        },
        '/proj/b': {
          upper: { cwd: '/proj/b/keep', claudeSessionId: 'keep-B' },
          lower: { cwd: '/proj/b/keep' },
        },
      },
      { 'pty-upper-A': '/proj/a/new', 'pty-lower-A': '/proj/a/new' },
    );
    installElectronAPI(store);

    renderHook(() =>
      useWorkbenchSessionPersist({
        projectRoot: '/proj/a',
        upperSessionId: 'pty-upper-A',
        lowerSessionId: 'pty-lower-A',
        claudeSessionId: 'new-A',
      }),
    );

    // Wait for the debounced write to land (750ms + buffer).
    await waitFor(
      () => {
        const lastWrite = store.setCalls.find((c) => c.key === 'canonWorkbenchSessions');
        expect(lastWrite).toBeDefined();
      },
      { timeout: 2500 },
    );

    const finalRecord = store.storeValue as Record<
      string,
      { upper: { cwd: string; claudeSessionId?: string } | null; lower: { cwd: string } | null }
    >;

    // /proj/a updated to the new cwd + claude id.
    expect(finalRecord['/proj/a']).toEqual({
      upper: { cwd: '/proj/a/new', claudeSessionId: 'new-A' },
      lower: { cwd: '/proj/a/new' },
    });
    // /proj/b preserved verbatim.
    expect(finalRecord['/proj/b']).toEqual({
      upper: { cwd: '/proj/b/keep', claudeSessionId: 'keep-B' },
      lower: { cwd: '/proj/b/keep' },
    });
  });

  it('write under /proj/a replaces the legacy flat shape with a fresh record (cold-start)', async () => {
    // Legacy Wave 9 shape on disk at flush time. Per D1 cold-start: the writer
    // does not migrate legacy data into the active key — it replaces the entire
    // value with a fresh record carrying ONLY the active project's slot.
    const store = newStore(
      {
        upper: { cwd: '/legacy/cwd', claudeSessionId: 'legacy-sess' },
        lower: { cwd: '/legacy/cwd' },
      },
      { 'pty-upper': '/proj/a/cwd', 'pty-lower': '/proj/a/cwd' },
    );
    installElectronAPI(store);

    renderHook(() =>
      useWorkbenchSessionPersist({
        projectRoot: '/proj/a',
        upperSessionId: 'pty-upper',
        lowerSessionId: 'pty-lower',
        claudeSessionId: 'sess-A',
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

    // The active project's slot is populated.
    expect(finalRecord['/proj/a']).toEqual({
      upper: { cwd: '/proj/a/cwd', claudeSessionId: 'sess-A' },
      lower: { cwd: '/proj/a/cwd' },
    });
  });

  it('does NOT write when projectRoot is null (no active project)', async () => {
    const store = newStore(
      {},
      { 'pty-upper': '/somewhere', 'pty-lower': '/somewhere' },
    );
    installElectronAPI(store);

    renderHook(() =>
      useWorkbenchSessionPersist({
        projectRoot: null,
        upperSessionId: 'pty-upper',
        lowerSessionId: 'pty-lower',
        claudeSessionId: 'sess-X',
      }),
    );

    // Allow plenty of time for the debounce to have fired had it been armed.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(store.setCalls).toHaveLength(0);
  });
});
