/**
 * softDeleteGc.test.ts — Unit tests for the 30-day soft-delete GC.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from './session';
import type { SessionStore } from './sessionStore';
import { runSoftDeleteGc, THIRTY_DAYS_MS } from './softDeleteGc';

// ─── Fake timers ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime('2026-04-15T00:00:00Z');
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Fixture factories ────────────────────────────────────────────────────────

const NOW = new Date('2026-04-15T00:00:00Z').getTime();

function makeSession(id: string, deletedAt?: number): Session {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-01-01T00:00:00.000Z',
    projectRoot: '/projects/test',
    worktree: false,
    pinned: false,
    tags: [],
    activeTerminalIds: [],
    costRollup: { totalUsd: 0, inputTokens: 0, outputTokens: 0 },
    telemetry: { correlationIds: [], telemetrySessionId: id },
    pinnedContext: [],
    deletedAt,
  };
}

function makeSessionStore(sessions: Session[]): SessionStore {
  const store = [...sessions];
  return {
    getById: (id) => store.find((s) => s.id === id),
    listAll: () => [...store],
    listByProjectRoot: (root) => store.filter((s) => s.projectRoot === root),
    listActive: () => store.filter((s) => !s.archivedAt && !s.deletedAt),
    upsert: vi.fn(),
    archive: vi.fn(),
    delete: (id) => {
      const i = store.findIndex((s) => s.id === id);
      if (i >= 0) store.splice(i, 1);
    },
    pin: vi.fn(),
    softDelete: vi.fn(),
    restoreDeleted: vi.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runSoftDeleteGc — null store', () => {
  it('returns zero count when store is null', async () => {
    const result = await runSoftDeleteGc(NOW, null);
    expect(result).toEqual({ purgedSessions: 0 });
  });
});

describe('runSoftDeleteGc — sessions', () => {
  it('purges sessions whose deletedAt + 30 days < now', async () => {
    const expired = makeSession('s-expired', NOW - THIRTY_DAYS_MS - 1);
    const recent = makeSession('s-recent', NOW - THIRTY_DAYS_MS + 1000);
    const active = makeSession('s-active');
    const store = makeSessionStore([expired, recent, active]);

    const result = await runSoftDeleteGc(NOW, store);

    expect(result.purgedSessions).toBe(1);
    expect(store.listAll().map((s) => s.id)).not.toContain('s-expired');
    expect(store.listAll().map((s) => s.id)).toContain('s-recent');
    expect(store.listAll().map((s) => s.id)).toContain('s-active');
  });

  it('does not purge sessions without deletedAt', async () => {
    const session = makeSession('s-no-delete');
    const store = makeSessionStore([session]);
    const result = await runSoftDeleteGc(NOW, store);
    expect(result.purgedSessions).toBe(0);
  });

  it('purges multiple expired sessions', async () => {
    const sessions = [
      makeSession('s1', NOW - THIRTY_DAYS_MS - 1000),
      makeSession('s2', NOW - THIRTY_DAYS_MS - 500),
      makeSession('s3', NOW - THIRTY_DAYS_MS + 1000), // not yet expired
    ];
    const store = makeSessionStore(sessions);
    const result = await runSoftDeleteGc(NOW, store);
    expect(result.purgedSessions).toBe(2);
  });
});

describe('runSoftDeleteGc — boundary conditions', () => {
  it('does not purge when deletedAt + 30 days === now (not strictly less)', async () => {
    // exactly at the boundary: deletedAt + 30d == now → NOT < now → not expired
    const session = makeSession('s-boundary', NOW - THIRTY_DAYS_MS);
    const store = makeSessionStore([session]);
    const result = await runSoftDeleteGc(NOW, store);
    expect(result.purgedSessions).toBe(0);
  });

  it('purges when deletedAt + 30 days is 1ms before now', async () => {
    const session = makeSession('s-just-expired', NOW - THIRTY_DAYS_MS - 1);
    const store = makeSessionStore([session]);
    const result = await runSoftDeleteGc(NOW, store);
    expect(result.purgedSessions).toBe(1);
  });
});
