/**
 * windowManagerHelpers.test.ts — Unit tests for extracted window-creation helpers.
 *
 * Pure and near-pure functions can be tested in isolation; Electron APIs
 * (screen, session) are mocked so the test runner never needs a real
 * Electron process.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockOnHeadersReceived } = vi.hoisted(() => ({
  mockOnHeadersReceived: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: class {},
  screen: {
    getAllDisplays: vi.fn(() => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]),
  },
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: mockOnHeadersReceived,
      },
    },
  },
}));

vi.mock('./config', () => ({
  getConfigValue: vi.fn(() => undefined),
  setConfigValue: vi.fn(),
}));

vi.mock('./fdPressureDiagnostics', () => ({
  describeFdPressure: vi.fn(() => 'active handles=0'),
}));

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./perfMetrics', () => ({
  markStartup: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { screen } from 'electron';

import {
  getCascadeOffset,
  getInitialWindowPlacement,
  getInitialWindowSize,
  legacySessionsDataToWindowSessions,
  sessionsDataToWindowSessions,
  validateBounds,
} from './windowManagerHelpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getAllDisplaysMock = screen.getAllDisplays as ReturnType<typeof vi.fn>;

// ── validateBounds ────────────────────────────────────────────────────────────

describe('validateBounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllDisplaysMock.mockReturnValue([{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]);
  });

  it('returns the bounds when fully on screen', () => {
    const bounds = { x: 100, y: 100, width: 800, height: 600, isMaximized: false };
    expect(validateBounds(bounds)).toEqual(bounds);
  });

  it('returns null when x is missing', () => {
    const bounds = { width: 800, height: 600, isMaximized: false };
    expect(validateBounds(bounds)).toBeNull();
  });

  it('returns null when y is missing', () => {
    const bounds = { x: 100, width: 800, height: 600, isMaximized: false };
    expect(validateBounds(bounds)).toBeNull();
  });

  it('returns null when the window extends beyond screen right edge', () => {
    const bounds = { x: 1500, y: 100, width: 800, height: 600, isMaximized: false };
    expect(validateBounds(bounds)).toBeNull();
  });

  it('returns null when the window extends beyond screen bottom edge', () => {
    const bounds = { x: 100, y: 800, width: 800, height: 600, isMaximized: false };
    expect(validateBounds(bounds)).toBeNull();
  });

  it('returns null when display array is empty', () => {
    getAllDisplaysMock.mockReturnValue([]);
    const bounds = { x: 100, y: 100, width: 800, height: 600, isMaximized: false };
    expect(validateBounds(bounds)).toBeNull();
  });

  it('returns bounds when they exactly fill the screen', () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080, isMaximized: false };
    expect(validateBounds(bounds)).toEqual(bounds);
  });

  it('accepts bounds on a secondary monitor', () => {
    getAllDisplaysMock.mockReturnValue([
      { workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
      { workArea: { x: 1920, y: 0, width: 1920, height: 1080 } },
    ]);
    const bounds = { x: 2000, y: 100, width: 800, height: 600, isMaximized: false };
    expect(validateBounds(bounds)).toEqual(bounds);
  });
});

// ── getCascadeOffset ──────────────────────────────────────────────────────────

describe('getCascadeOffset', () => {
  it('returns empty object for count 0', () => {
    expect(getCascadeOffset(0)).toEqual({});
  });

  it('returns correct offset for count 1', () => {
    const offset = getCascadeOffset(1);
    expect(typeof offset.x).toBe('number');
    expect(typeof offset.y).toBe('number');
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeGreaterThan(0);
  });

  it('returns larger offset for count 3 than count 1', () => {
    const offset1 = getCascadeOffset(1);
    const offset3 = getCascadeOffset(3);
    expect(offset3.x).toBeGreaterThan(offset1.x!);
    expect(offset3.y).toBeGreaterThan(offset1.y!);
  });

  it('increments by 30 per additional window', () => {
    const offset1 = getCascadeOffset(1);
    const offset2 = getCascadeOffset(2);
    expect(offset2.x! - offset1.x!).toBe(30);
    expect(offset2.y! - offset1.y!).toBe(30);
  });
});

// ── getInitialWindowSize ──────────────────────────────────────────────────────

describe('getInitialWindowSize', () => {
  it('returns default 1280x800 when bounds is null', () => {
    expect(getInitialWindowSize(null)).toEqual({ width: 1280, height: 800 });
  });

  it('returns saved dimensions when bounds is provided', () => {
    const bounds = { x: 0, y: 0, width: 1440, height: 900, isMaximized: false };
    expect(getInitialWindowSize(bounds)).toEqual({ width: 1440, height: 900 });
  });
});

// ── getInitialWindowPlacement ─────────────────────────────────────────────────

describe('getInitialWindowPlacement', () => {
  it('uses saved x/y when bounds has valid coordinates', () => {
    const bounds = { x: 200, y: 150, width: 1280, height: 800, isMaximized: false };
    const placement = getInitialWindowPlacement(bounds, true, 0);
    expect(placement.x).toBe(200);
    expect(placement.y).toBe(150);
  });

  it('returns empty object for first window with no bounds', () => {
    const placement = getInitialWindowPlacement(null, true, 0);
    expect(placement).toEqual({});
  });

  it('returns cascade offset for non-first window with no bounds', () => {
    const placement = getInitialWindowPlacement(null, false, 2);
    expect(placement).toEqual(getCascadeOffset(2));
  });

  it('uses bounds coordinates even when isFirst is false', () => {
    const bounds = { x: 50, y: 75, width: 1280, height: 800, isMaximized: false };
    const placement = getInitialWindowPlacement(bounds, false, 3);
    expect(placement.x).toBe(50);
    expect(placement.y).toBe(75);
  });

  it('returns cascade offset for non-first window when bounds has no x', () => {
    const bounds = { width: 1280, height: 800, isMaximized: false };
    const placement = getInitialWindowPlacement(bounds, false, 1);
    expect(placement).toEqual(getCascadeOffset(1));
  });
});

// ── sessionsDataToWindowSessions ──────────────────────────────────────────────

type FakeSession = {
  projectRoot: string;
  bounds?: { x: number; y: number; width: number; height: number; isMaximized: boolean };
  archivedAt?: string;
  deletedAt?: string;
};

describe('sessionsDataToWindowSessions — new path (windowGroups provided)', () => {
  beforeEach(() => {
    vi.stubEnv('OUROBOROS_SINGLE_WINDOW', '0');
    vi.stubEnv('npm_lifecycle_event', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a WindowSession per group with full projectRoots rail', () => {
    const groups = [
      { projectRoots: ['/a', '/b', '/c'], bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = sessionsDataToWindowSessions([], groups);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/a', '/b', '/c']);
  });

  it('filters groups without bounds', () => {
    const groups = [
      { projectRoots: ['/a'], bounds: undefined },
      { projectRoots: ['/b'], bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = sessionsDataToWindowSessions([], groups);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/b']);
  });

  it('clamp: singleWindow keeps only first GROUP but preserves its full projectRoots', () => {
    vi.stubEnv('OUROBOROS_SINGLE_WINDOW', '1');
    const groups = [
      { projectRoots: ['/a', '/b'], bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
      { projectRoots: ['/c'], bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = sessionsDataToWindowSessions([], groups);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/a', '/b']);
  });

  it('dev-mode clamp: npm_lifecycle_event=dev restricts to first group', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('npm_lifecycle_event', 'dev');
    vi.stubEnv('OUROBOROS_SINGLE_WINDOW', '');
    const groups = [
      { projectRoots: ['/x'], bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
      { projectRoots: ['/y'], bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = sessionsDataToWindowSessions([], groups);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/x']);
  });
});

describe('sessionsDataToWindowSessions — legacy fallback (windowGroups empty)', () => {
  beforeEach(() => {
    vi.stubEnv('OUROBOROS_SINGLE_WINDOW', '0');
    vi.stubEnv('npm_lifecycle_event', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to per-root sessionsData when windowGroups is empty', () => {
    const sessions: FakeSession[] = [
      { projectRoot: '/legacy', bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = sessionsDataToWindowSessions(sessions as never, []);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/legacy']);
  });

  it('falls back to per-root sessionsData when windowGroups is undefined', () => {
    const sessions: FakeSession[] = [
      { projectRoot: '/legacy', bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = sessionsDataToWindowSessions(sessions as never);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/legacy']);
  });
});

describe('legacySessionsDataToWindowSessions', () => {
  beforeEach(() => {
    vi.stubEnv('OUROBOROS_SINGLE_WINDOW', '0');
    vi.stubEnv('npm_lifecycle_event', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('projects a session with bounds into a single-root WindowSession', () => {
    const sessions: FakeSession[] = [
      { projectRoot: '/p', bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = legacySessionsDataToWindowSessions(sessions as never);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/p']);
  });

  it('excludes sessions without bounds', () => {
    const sessions: FakeSession[] = [
      { projectRoot: '/a' },
      { projectRoot: '/b', bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = legacySessionsDataToWindowSessions(sessions as never);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/b']);
  });

  it('excludes archived sessions', () => {
    const sessions: FakeSession[] = [
      { projectRoot: '/a', bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false }, archivedAt: '2024-01-01' },
    ];
    const result = legacySessionsDataToWindowSessions(sessions as never);
    expect(result).toHaveLength(0);
  });

  it('clamps to one session when OUROBOROS_SINGLE_WINDOW=1', () => {
    vi.stubEnv('OUROBOROS_SINGLE_WINDOW', '1');
    const sessions: FakeSession[] = [
      { projectRoot: '/a', bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
      { projectRoot: '/b', bounds: { x: 0, y: 0, width: 1280, height: 800, isMaximized: false } },
    ];
    const result = legacySessionsDataToWindowSessions(sessions as never);
    expect(result).toHaveLength(1);
    expect(result[0].projectRoots).toEqual(['/a']);
  });
});

// ── ensureCSP ─────────────────────────────────────────────────────────────────
// ensureCSP has a module-level `cspInstalled` flag — once called it short-circuits.
// We isolate it by dynamically importing a fresh module copy in each sub-suite.

describe('ensureCSP — first call installs the handler', async () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('calls onHeadersReceived exactly once', async () => {
    mockOnHeadersReceived.mockClear();
    const { ensureCSP } = await import('./windowManagerHelpers');
    ensureCSP();
    expect(mockOnHeadersReceived).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — second call is a no-op', async () => {
    mockOnHeadersReceived.mockClear();
    const { ensureCSP } = await import('./windowManagerHelpers');
    ensureCSP();
    ensureCSP();
    expect(mockOnHeadersReceived).toHaveBeenCalledTimes(1);
  });

  it('installed handler adds Content-Security-Policy header', async () => {
    mockOnHeadersReceived.mockClear();
    const { ensureCSP } = await import('./windowManagerHelpers');
    ensureCSP();

    const handler = mockOnHeadersReceived.mock.calls[0][0] as (
      details: { responseHeaders: Record<string, string[]> },
      callback: (result: { responseHeaders: Record<string, string[]> }) => void,
    ) => void;

    let captured: { responseHeaders: Record<string, string[]> } | null = null;
    handler({ responseHeaders: { 'x-existing': ['value'] } }, (result) => {
      captured = result;
    });

    expect(captured).not.toBeNull();
    const csp = captured!.responseHeaders['Content-Security-Policy'];
    expect(Array.isArray(csp)).toBe(true);
    expect(csp[0]).toContain("default-src 'self'");
    expect(csp[0]).toContain('script-src');
    expect(csp[0]).toContain('connect-src');
  });

  it('preserves existing response headers', async () => {
    mockOnHeadersReceived.mockClear();
    const { ensureCSP } = await import('./windowManagerHelpers');
    ensureCSP();

    const handler = mockOnHeadersReceived.mock.calls[0][0] as (
      details: { responseHeaders: Record<string, string[]> },
      callback: (result: { responseHeaders: Record<string, string[]> }) => void,
    ) => void;

    let captured: { responseHeaders: Record<string, string[]> } | null = null;
    handler({ responseHeaders: { 'x-custom-header': ['hello'] } }, (result) => {
      captured = result;
    });

    expect(captured!.responseHeaders['x-custom-header']).toEqual(['hello']);
  });
});
