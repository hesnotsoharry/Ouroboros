import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub electron and electron-store so the lazy proxy can construct under
// vitest's Node environment (no real Electron app singleton, no real schema
// validation against a persisted config file).
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
}));

vi.mock('./configPreflight', () => ({
  runConfigPreflight: vi.fn(),
  resolveUserDataDir: vi.fn(() => '/tmp/test-userdata'),
}));

describe('configStoreLazy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not construct the store at import time', async () => {
    const { runConfigPreflight } = await import('./configPreflight');
    await import('./configStoreLazy');
    // No construction at import → constructWithRetry (and its preflight) never ran.
    expect(runConfigPreflight).not.toHaveBeenCalled();
  });

  // NOTE: electron-store is loaded via a lazy `require('electron-store')` inside
  // configStoreLazy (deliberately not a static import — see that file for the
  // worker_threads electron hazard). A bare require() in vite-transformed test
  // code resolves natively and bypasses vi.mock('electron-store'), so the
  // constructor stub counter is NOT a reliable construction signal here.
  // Construction is instead asserted via the runConfigPreflight spy (our own
  // module, import-intercepted by vi.mock) which constructWithRetry calls
  // exactly once per construction, plus singleton identity.

  it('constructs the store on first proxy access', async () => {
    const { runConfigPreflight } = await import('./configPreflight');
    const { lazyStore } = await import('./configStoreLazy');
    expect(runConfigPreflight).not.toHaveBeenCalled();
    void lazyStore.get('anyKey' as never);
    expect(runConfigPreflight).toHaveBeenCalledTimes(1);
  });

  it('runs the preflight before constructing the store', async () => {
    const { runConfigPreflight } = await import('./configPreflight');
    const { ensureStore } = await import('./configStoreLazy');
    expect(runConfigPreflight).not.toHaveBeenCalled();
    ensureStore();
    expect(runConfigPreflight).toHaveBeenCalledTimes(1);
  });

  it('returns the same store instance across calls', async () => {
    const { runConfigPreflight } = await import('./configPreflight');
    const { ensureStore } = await import('./configStoreLazy');
    const a = ensureStore();
    const b = ensureStore();
    expect(a).toBe(b);
    // Construction happened exactly once → preflight ran exactly once.
    expect(runConfigPreflight).toHaveBeenCalledTimes(1);
  });
});
