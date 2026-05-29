/**
 * config.test.ts — Tests for config.ts debounced-write behaviour.
 *
 * Covers:
 *  1. read-your-writes: set then get (no flush) returns the new value.
 *  2. coalescing: N sets within the debounce window → exactly ONE store write.
 *  3. flush-on-quit: pending writes are flushed synchronously; nothing pending after.
 *  4. immediate path: setConfigValueImmediate writes synchronously (no buffer entry).
 *  5. debounce flush fires after the debounce window via fake timers.
 *  6. re-exports: getConfig, getConfigValue, setConfigValue are all exported.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module-level mocks — must be defined BEFORE any dynamic import ──────────

const storeSpy = vi.fn();
const storeObj: Record<string, unknown> = {};

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-userdata' },
}));

vi.mock('./configStoreLazy', () => {
  return {
    lazyStore: storeObj,
    ensureStore: () => ({
      store: {},
      get: (k: string) => storeObj[k], // eslint-disable-line security/detect-object-injection -- test-controlled keys
      set: (k: string, v: unknown) => {
        // eslint-disable-next-line security/detect-object-injection -- test-controlled keys
        storeObj[k] = v;
        storeSpy(k, v);
      },
    }),
  };
});

vi.mock('./configMigrations', () => ({
  migrateChatPrimary: vi.fn(),
  migrateChatSurface: vi.fn(),
}));

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadModules(): Promise<{
  config: typeof import('./config');
  buffer: typeof import('./configWriteBuffer');
}> {
  const [config, buffer] = await Promise.all([
    import('./config'),
    import('./configWriteBuffer'),
  ]);
  return { config, buffer };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('config — re-exports', () => {
  it('exports getConfig, getConfigValue, setConfigValue', async () => {
    const { config } = await loadModules();
    expect(typeof config.getConfig).toBe('function');
    expect(typeof config.getConfigValue).toBe('function');
    expect(typeof config.setConfigValue).toBe('function');
  });

  it('getConfig returns an object', async () => {
    const { config } = await loadModules();
    const cfg = config.getConfig();
    expect(cfg !== null && typeof cfg === 'object').toBe(true);
  });
});

describe('config — read-your-writes consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storeSpy.mockClear();
    Object.keys(storeObj).forEach((k) => delete storeObj[k]); // eslint-disable-line security/detect-object-injection -- clearing test store
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('returns the new value immediately after set, before flush fires', async () => {
    const { config } = await loadModules();
    config.setConfigValue('defaultProjectRoot' as never, '/new/path' as never);
    const val = config.getConfigValue('defaultProjectRoot' as never);
    expect(val).toBe('/new/path');
  });
});

describe('config — write coalescing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storeSpy.mockClear();
    Object.keys(storeObj).forEach((k) => delete storeObj[k]); // eslint-disable-line security/detect-object-injection -- clearing test store
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('collapses N sets within the debounce window into exactly ONE store write per key', async () => {
    const { config } = await loadModules();
    config.setConfigValue('defaultProjectRoot' as never, '/path/1' as never);
    config.setConfigValue('defaultProjectRoot' as never, '/path/2' as never);
    config.setConfigValue('defaultProjectRoot' as never, '/path/3' as never);

    // Before the debounce timer fires, no store write should have occurred.
    const callsBefore = storeSpy.mock.calls.filter((c) => c[0] === 'defaultProjectRoot');
    expect(callsBefore.length).toBe(0);

    // Advance past the 200ms debounce window.
    vi.advanceTimersByTime(250);

    const callsAfter = storeSpy.mock.calls.filter((c) => c[0] === 'defaultProjectRoot');
    expect(callsAfter.length).toBe(1);
    expect(callsAfter[0][1]).toBe('/path/3');
  });
});

describe('config — flush-on-quit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storeSpy.mockClear();
    Object.keys(storeObj).forEach((k) => delete storeObj[k]); // eslint-disable-line security/detect-object-injection -- clearing test store
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('flushPendingWritesSync writes pending entries synchronously without waiting for timer', async () => {
    const { config, buffer } = await loadModules();
    config.setConfigValue('defaultProjectRoot' as never, '/quit/path' as never);

    // Debounce timer has NOT fired yet.
    expect(storeSpy.mock.calls.filter((c) => c[0] === 'defaultProjectRoot').length).toBe(0);
    expect(buffer.hasPendingWrites()).toBe(true);

    buffer.flushPendingWritesSync();

    // After sync flush: write happened, nothing pending.
    expect(storeSpy.mock.calls.filter((c) => c[0] === 'defaultProjectRoot').length).toBe(1);
    expect(buffer.hasPendingWrites()).toBe(false);
  });
});

describe('config — immediate write path', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storeSpy.mockClear();
    Object.keys(storeObj).forEach((k) => delete storeObj[k]); // eslint-disable-line security/detect-object-injection -- clearing test store
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('setConfigValueImmediate writes to the store synchronously with no pending buffer entry', async () => {
    const { config, buffer } = await loadModules();
    config.setConfigValueImmediate('defaultProjectRoot' as never, '/immediate/path' as never);

    // Must have written synchronously.
    expect(storeSpy.mock.calls.filter((c) => c[0] === 'defaultProjectRoot').length).toBe(1);
    expect(storeSpy.mock.calls[0][1]).toBe('/immediate/path');
    // Must NOT leave a pending buffer entry.
    expect(buffer.hasPendingWrites()).toBe(false);
  });

  it('drops a queued debounced write for the same key so a later flush cannot clobber the immediate value', async () => {
    const { config, buffer } = await loadModules();
    // Queue a debounced write, then immediately overwrite the same key.
    config.setConfigValue('defaultProjectRoot' as never, '/stale/debounced' as never);
    expect(buffer.hasPendingWrites()).toBe(true);
    config.setConfigValueImmediate('defaultProjectRoot' as never, '/authoritative/immediate' as never);
    // The queued entry must be gone so it can't flush later and clobber.
    expect(buffer.hasPendingWrites()).toBe(false);

    // Advancing past the debounce window must NOT re-write the stale value.
    storeSpy.mockClear();
    vi.advanceTimersByTime(500);
    const clobbered = storeSpy.mock.calls.some(
      (c) => c[0] === 'defaultProjectRoot' && c[1] === '/stale/debounced',
    );
    expect(clobbered).toBe(false);
  });
});

describe('config — debounce fires after window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storeSpy.mockClear();
    Object.keys(storeObj).forEach((k) => delete storeObj[k]); // eslint-disable-line security/detect-object-injection -- clearing test store
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('automatically flushes after the debounce window elapses', async () => {
    const { config } = await loadModules();
    config.setConfigValue('defaultProjectRoot' as never, '/debounced/path' as never);

    expect(storeSpy.mock.calls.filter((c) => c[0] === 'defaultProjectRoot').length).toBe(0);

    vi.advanceTimersByTime(201);

    expect(storeSpy.mock.calls.filter((c) => c[0] === 'defaultProjectRoot').length).toBe(1);
    expect(storeSpy.mock.calls[0][1]).toBe('/debounced/path');
  });
});
