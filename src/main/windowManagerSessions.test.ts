/**
 * windowManagerSessions.test.ts — Smoke tests for windowManagerSessions.ts.
 */

import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  BrowserWindow: class {},
  app: { getPath: () => '/tmp' },
}));

vi.mock('./config', () => {
  const store: Record<string, unknown> = {};
  return {
    // eslint-disable-next-line security/detect-object-injection -- test store keys are controlled by session tests
    getConfigValue: (k: string) => store[k],
    // eslint-disable-next-line security/detect-object-injection -- test store keys are controlled by session tests
    setConfigValue: (k: string, v: unknown) => { store[k] = v; },
  };
});

const { mockSessDataToWindowSessions } = vi.hoisted(() => ({
  mockSessDataToWindowSessions: vi.fn(
    (data: unknown[]) =>
      (data as Array<{ projectRoots?: string[] }>)
        .filter((s) => s.projectRoots?.length)
        .map((s) => s as { projectRoots: string[] }),
  ),
}));

vi.mock('./windowManagerHelpers', () => ({
  captureWindowBounds: () => ({ width: 1280, height: 800, isMaximized: false }),
  mergeBoundsIntoSessions: (sessions: unknown[]) => sessions,
  sessionsDataToWindowSessions: mockSessDataToWindowSessions,
  applyPersistedBounds: vi.fn(),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import {
  persistWindowSessions,
  restoreWindowSessions,
  wireSessionHelpers,
} from './windowManagerSessions';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeWin(destroyed = false): BrowserWindow {
  return {
    id: Math.floor(Math.random() * 10000),
    isDestroyed: () => destroyed,
    isMaximized: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 800 }),
  } as unknown as BrowserWindow;
}

type ManagedEntry = { win: BrowserWindow; projectRoot: string | null; projectRoots: string[] };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('wireSessionHelpers + persistWindowSessions', () => {
  beforeEach(() => {
    // Reset module-level state by re-wiring with fresh stubs each test
  });

  it('does nothing when no windows have a projectRoot', () => {
    const entry: ManagedEntry = { win: makeFakeWin(), projectRoot: null, projectRoots: [] };
    wireSessionHelpers(
      () => [entry],
      () => makeFakeWin(),
      () => undefined,
    );
    // Should not throw
    expect(() => persistWindowSessions()).not.toThrow();
  });

  it('does not throw when sessionsData is undefined', () => {
    wireSessionHelpers(
      () => [],
      () => makeFakeWin(),
      () => undefined,
    );
    expect(() => persistWindowSessions()).not.toThrow();
  });

  it('skips destroyed windows when building bounds map', () => {
    const destroyed = makeFakeWin(true);
    const entry: ManagedEntry = { win: destroyed, projectRoot: '/project', projectRoots: ['/project'] };
    wireSessionHelpers(
      () => [entry],
      () => makeFakeWin(),
      () => undefined,
    );
    // boundsByRoot.size === 0 → early return, no throw
    expect(() => persistWindowSessions()).not.toThrow();
  });
});

describe('persistWindowSessions — window-close guard: does NOT prune records', () => {
  it('leaves all sessionsData records intact (never deletes) when called on window close', async () => {
    // Seed two session records in the config store.
    const { setConfigValue, getConfigValue } = await import('./config');
    const initial = [
      { id: 's1', projectRoot: '/root/a', bounds: undefined },
      { id: 's2', projectRoot: '/root/b', bounds: undefined },
    ];
    setConfigValue('sessionsData' as never, initial as never);

    // Wire a window with /root/a so boundsByRoot.size > 0 triggers a write.
    const fakeWin = {
      id: 1,
      isDestroyed: () => false,
      isMaximized: () => false,
      getBounds: () => ({ x: 0, y: 0, width: 1280, height: 800 }),
    } as unknown as BrowserWindow;

    const entry: ManagedEntry = { win: fakeWin, projectRoot: '/root/a', projectRoots: ['/root/a'] };
    wireSessionHelpers(
      () => [entry],
      () => fakeWin,
      () => undefined,
    );

    persistWindowSessions();

    // Both records must still be present — persistWindowSessions is bounds-only.
    const written = getConfigValue('sessionsData' as never) as Array<{ id: string }>;
    const ids = written?.map((s) => s.id) ?? [];
    expect(ids).toContain('s1');
    expect(ids).toContain('s2');
  });
});

describe('restoreWindowSessions', () => {
  it('returns empty array when sessionsData is undefined', () => {
    wireSessionHelpers(
      () => [],
      () => makeFakeWin(),
      () => undefined,
    );
    const result = restoreWindowSessions();
    expect(result).toEqual([]);
  });

  it('returns empty array when source has no entries', async () => {
    const { setConfigValue } = await import('./config');
    setConfigValue('sessionsData' as never, [] as never);

    wireSessionHelpers(
      () => [],
      () => makeFakeWin(),
      () => undefined,
    );
    const result = restoreWindowSessions();
    expect(result).toEqual([]);
  });

  it('calls createWindow for each session with projectRoots', async () => {
    const { setConfigValue } = await import('./config');
    setConfigValue('sessionsData' as never, [
      { projectRoots: ['/project-a'], bounds: undefined },
    ] as never);

    const created: BrowserWindow[] = [];
    const fakeWin = makeFakeWin();
    wireSessionHelpers(
      () => [],
      () => {
        created.push(fakeWin);
        return fakeWin;
      },
      () => undefined,
    );

    const result = restoreWindowSessions();
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('skips sessions without projectRoots', async () => {
    const { setConfigValue } = await import('./config');
    setConfigValue('sessionsData' as never, [
      { projectRoots: [], bounds: undefined },
    ] as never);

    let createCalled = false;
    wireSessionHelpers(
      () => [],
      () => { createCalled = true; return makeFakeWin(); },
      () => undefined,
    );

    restoreWindowSessions();
    expect(createCalled).toBe(false);
  });
});

// ── windowGroups persist + restore (new path) ─────────────────────────────────

describe('persistWindowSessions — writes windowGroups', () => {
  it('writes windowGroups with the full rail from a window with multiple roots', async () => {
    const { setConfigValue, getConfigValue } = await import('./config');
    setConfigValue('sessionsData' as never, [
      { id: 's1', projectRoot: '/root/a', bounds: undefined },
    ] as never);

    const fakeWin = {
      id: 1,
      isDestroyed: () => false,
      isMaximized: () => false,
      getBounds: () => ({ x: 10, y: 20, width: 1440, height: 900 }),
    } as unknown as BrowserWindow;

    const entry: ManagedEntry = {
      win: fakeWin,
      projectRoot: '/root/a',
      projectRoots: ['/root/a', '/root/b', '/root/c'],
    };
    wireSessionHelpers(
      () => [entry],
      () => fakeWin,
      () => undefined,
    );

    persistWindowSessions();

    const groups = getConfigValue('windowGroups' as never) as Array<{
      projectRoots: string[];
      bounds: unknown;
    }>;
    expect(groups).toHaveLength(1);
    expect(groups[0].projectRoots).toEqual(['/root/a', '/root/b', '/root/c']);
    expect(groups[0].bounds).toBeDefined();
  });
});

describe('restoreWindowSessions — windowGroups new path', () => {
  it('passes windowGroups to sessionsDataToWindowSessions when present', async () => {
    const { setConfigValue } = await import('./config');
    const groups = [
      {
        projectRoots: ['/root/a', '/root/b', '/root/c'],
        bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false },
      },
    ];
    setConfigValue('sessionsData' as never, [] as never);
    setConfigValue('windowGroups' as never, groups as never);

    mockSessDataToWindowSessions.mockClear();
    wireSessionHelpers(
      () => [],
      () => makeFakeWin(),
      () => undefined,
    );

    restoreWindowSessions();

    expect(mockSessDataToWindowSessions).toHaveBeenCalledWith([], groups);
  });
});

describe('restoreWindowSessions — legacy fallback when windowGroups empty', () => {
  it('falls back to sessionsData when windowGroups is empty', async () => {
    const { setConfigValue } = await import('./config');
    setConfigValue('sessionsData' as never, [
      { projectRoots: ['/legacy/root'], bounds: undefined },
    ] as never);
    setConfigValue('windowGroups' as never, [] as never);

    const created: BrowserWindow[] = [];
    const fakeWin = makeFakeWin();
    wireSessionHelpers(
      () => [],
      () => { created.push(fakeWin); return fakeWin; },
      () => undefined,
    );

    restoreWindowSessions();
    // sessionsDataToWindowSessions mock maps data→sessions; sessionsData had one entry
    expect(created.length).toBeGreaterThanOrEqual(1);
  });
});
