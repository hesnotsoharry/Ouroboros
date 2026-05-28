/**
 * windowManagerRailSync.test.ts — Unit tests for rail-root persistence helpers.
 *
 * Tests the pure delta-computation and store-mutating helpers in
 * windowManagerRailSync.ts. All tests work without launching Electron.
 *
 * Coverage:
 *   1. DEFECT 2 guard — upsertSessionsForRoots creates a record for every root,
 *      including non-first roots that were never made active.
 *   2. DEFECT 1 guard — pruneRemovedRoots deletes records for removed roots while
 *      leaving records for surviving roots intact.
 *   3. Shared-root guard — a root still used by another window is NOT pruned.
 *   4. computeRemovedRoots pure-function contract.
 *   5. isRootUsedByOtherWindow pure-function contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from './session/session';
import type { SessionStore } from './session/sessionStore';
import {
  computeRemovedRoots,
  isRootUsedByOtherWindow,
  pruneRemovedRoots,
  upsertSessionsForRoots,
} from './windowManagerRailSync';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(root: string): Session {
  return {
    id: `session-${root}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    projectRoot: root,
    worktree: false,
    tags: [],
    activeTerminalIds: [],
    pinnedContext: [],
    costRollup: { totalUsd: 0, inputTokens: 0, outputTokens: 0 },
    telemetry: { correlationIds: [], telemetrySessionId: 'tel' },
  };
}

function buildStore(initial: Session[] = []): SessionStore & { _data: Session[] } {
  const data: Session[] = [...initial];
  return {
    _data: data,
    getById: (id) => data.find((s) => s.id === id),
    listAll: () => [...data],
    listByProjectRoot: (root) => data.filter((s) => s.projectRoot === root),
    listActive: () => data.filter((s) => !s.archivedAt && !s.deletedAt),
    upsert: vi.fn((session) => {
      const idx = data.findIndex((s) => s.id === session.id);
      if (idx < 0) data.push(session);
      else data.splice(idx, 1, session);
    }),
    archive: vi.fn(),
    delete: vi.fn((id) => {
      const idx = data.findIndex((s) => s.id === id);
      if (idx >= 0) data.splice(idx, 1);
    }),
    pin: vi.fn(),
    softDelete: vi.fn(),
    restoreDeleted: vi.fn(),
  };
}

// ─── computeRemovedRoots ──────────────────────────────────────────────────────

describe('computeRemovedRoots', () => {
  it('returns roots present in old but absent in new', () => {
    const removed = computeRemovedRoots(['/a', '/b', '/c'], ['/a', '/c']);
    expect(removed).toEqual(['/b']);
  });

  it('returns empty array when nothing was removed', () => {
    expect(computeRemovedRoots(['/a'], ['/a', '/b'])).toEqual([]);
  });

  it('returns all old roots when new list is empty', () => {
    expect(computeRemovedRoots(['/a', '/b'], [])).toEqual(['/a', '/b']);
  });

  it('returns empty array when both lists are empty', () => {
    expect(computeRemovedRoots([], [])).toEqual([]);
  });
});

// ─── isRootUsedByOtherWindow ──────────────────────────────────────────────────

describe('isRootUsedByOtherWindow', () => {
  it('returns false when only the excluded window uses the root', () => {
    const map = new Map([[1, ['/a']]]);
    expect(isRootUsedByOtherWindow('/a', 1, map)).toBe(false);
  });

  it('returns true when another window uses the root', () => {
    const map = new Map([
      [1, ['/a']],
      [2, ['/a', '/b']],
    ]);
    expect(isRootUsedByOtherWindow('/a', 1, map)).toBe(true);
  });

  it('returns false when no window uses the root', () => {
    const map = new Map([[1, ['/x']]]);
    expect(isRootUsedByOtherWindow('/notpresent', 1, map)).toBe(false);
  });
});

// ─── upsertSessionsForRoots (DEFECT 2 guard) ─────────────────────────────────

describe('upsertSessionsForRoots — DEFECT 2: every rail root gets a session record', () => {
  it('creates a session record for each root, including non-first roots', () => {
    const store = buildStore();
    const makeSess = vi.fn(makeSession);

    upsertSessionsForRoots(['/root/a', '/root/b', '/root/meta'], store, makeSess);

    expect(makeSess).toHaveBeenCalledTimes(3);
    expect(store.listByProjectRoot('/root/a')).toHaveLength(1);
    expect(store.listByProjectRoot('/root/b')).toHaveLength(1);
    expect(store.listByProjectRoot('/root/meta')).toHaveLength(1);
  });

  it('does not duplicate a session when the root already has a non-archived record', () => {
    const existing = makeSession('/root/a');
    const store = buildStore([existing]);
    const makeSess = vi.fn(makeSession);

    upsertSessionsForRoots(['/root/a'], store, makeSess);

    expect(makeSess).not.toHaveBeenCalled();
    expect(store.upsert).not.toHaveBeenCalled();
    expect(store.listByProjectRoot('/root/a')).toHaveLength(1);
  });

  it('creates a new session when the only existing record is archived', () => {
    const archived = { ...makeSession('/root/a'), archivedAt: new Date().toISOString() };
    const store = buildStore([archived]);
    const makeSess = vi.fn(makeSession);

    upsertSessionsForRoots(['/root/a'], store, makeSess);

    expect(makeSess).toHaveBeenCalledWith('/root/a');
    expect(store.upsert).toHaveBeenCalledTimes(1);
  });

  it('returns the first root session as the active session', () => {
    const store = buildStore();
    const result = upsertSessionsForRoots(['/root/first', '/root/second'], store, makeSession);
    expect(result?.projectRoot).toBe('/root/first');
  });

  it('returns null for empty roots array', () => {
    const store = buildStore();
    const result = upsertSessionsForRoots([], store, makeSession);
    expect(result).toBeNull();
  });
});

// ─── pruneRemovedRoots (DEFECT 1 guard) ──────────────────────────────────────

describe('pruneRemovedRoots — DEFECT 1: removed roots are pruned', () => {
  let store: ReturnType<typeof buildStore>;
  let sessA: Session;
  let sessB: Session;

  beforeEach(() => {
    sessA = makeSession('/root/a');
    sessB = makeSession('/root/b');
    store = buildStore([sessA, sessB]);
  });

  it('deletes the record for an explicitly-removed root', () => {
    const map: ReadonlyMap<number, readonly string[]> = new Map([[1, ['/root/a']]]);

    pruneRemovedRoots({
      removedRoots: ['/root/b'],
      winId: 1,
      allWindowRoots: map,
      store,
    });

    expect(store.delete).toHaveBeenCalledWith(sessB.id);
    expect(store.listByProjectRoot('/root/b')).toHaveLength(0);
  });

  it('does NOT delete records for roots that are still present', () => {
    const map: ReadonlyMap<number, readonly string[]> = new Map([[1, ['/root/a']]]);

    pruneRemovedRoots({
      removedRoots: ['/root/b'],
      winId: 1,
      allWindowRoots: map,
      store,
    });

    expect(store.listByProjectRoot('/root/a')).toHaveLength(1);
  });

  it('does NOT prune a root still used by another open window', () => {
    // Window 1 removes /root/b, but window 2 still has /root/b
    const map: ReadonlyMap<number, readonly string[]> = new Map([
      [1, ['/root/a']],
      [2, ['/root/b']],
    ]);

    pruneRemovedRoots({
      removedRoots: ['/root/b'],
      winId: 1,
      allWindowRoots: map,
      store,
    });

    expect(store.delete).not.toHaveBeenCalled();
    expect(store.listByProjectRoot('/root/b')).toHaveLength(1);
  });

  it('does nothing when removedRoots is empty', () => {
    const map: ReadonlyMap<number, readonly string[]> = new Map([[1, ['/root/a', '/root/b']]]);

    pruneRemovedRoots({ removedRoots: [], winId: 1, allWindowRoots: map, store });

    expect(store.delete).not.toHaveBeenCalled();
  });

  it('deletes all records for a root (handles root with multiple sessions)', () => {
    const sess2 = makeSession('/root/b');
    store._data.push(sess2);

    const map: ReadonlyMap<number, readonly string[]> = new Map([[1, ['/root/a']]]);

    pruneRemovedRoots({
      removedRoots: ['/root/b'],
      winId: 1,
      allWindowRoots: map,
      store,
    });

    expect(store.delete).toHaveBeenCalledTimes(2);
    expect(store.listByProjectRoot('/root/b')).toHaveLength(0);
  });
});
