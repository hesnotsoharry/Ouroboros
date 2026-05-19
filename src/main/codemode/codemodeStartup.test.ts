/**
 * codemodeStartup.test.ts — Wave 53l Phase A + Wave 98 bypass.
 *
 * Smoke tests for the user-level CodeMode lifecycle hooks. Mocks
 * `codemodeManager` (the underlying enable/disable mechanics, already
 * tested by `codemodeManager.test.ts`) and `../config` so the gate logic
 * and eligibility filter can be exercised without real file I/O.
 *
 * Wave 98 bypass adds tests for `runCodeModeStartupGate`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({ getConfigValue: vi.fn() }));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./codemodeManager', () => ({
  enableCodeMode: vi.fn(),
  disableCodeMode: vi.fn(),
  getMcpServers: vi.fn(),
  isCodeModeEnabled: vi.fn(),
  maybeRestoreFromCrash: vi.fn(),
}));
vi.mock('./codemodeManagerFiles', () => ({
  deleteRestorationFile: vi.fn(),
  restorationFilePath: vi.fn(() => '/home/user/.claude/codemode-managed.json'),
  PROXY_CONFIG_PATH: '/tmp/codemode-proxy-config.json',
}));
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    unlink: vi.fn(),
  },
}));

import fs from 'fs/promises';

import { getConfigValue } from '../config';
import {
  disableCodeMode,
  enableCodeMode,
  getMcpServers,
  isCodeModeEnabled,
  maybeRestoreFromCrash,
} from './codemodeManager';
import { deleteRestorationFile } from './codemodeManagerFiles';
import {
  disableCodeModeUserLevel,
  enableCodeModeUserLevel,
  runCodeModeStartupGate,
} from './codemodeStartup';

const cfg = getConfigValue as ReturnType<typeof vi.fn>;
const enabledFn = isCodeModeEnabled as ReturnType<typeof vi.fn>;
const enableFn = enableCodeMode as ReturnType<typeof vi.fn>;
const disableFn = disableCodeMode as ReturnType<typeof vi.fn>;
const serversFn = getMcpServers as ReturnType<typeof vi.fn>;
const restoreFn = maybeRestoreFromCrash as ReturnType<typeof vi.fn>;
const deleteFn = deleteRestorationFile as ReturnType<typeof vi.fn>;
const fsMock = fs as { access: ReturnType<typeof vi.fn>; unlink: ReturnType<typeof vi.fn> };

function setConfig(map: Record<string, unknown>): void {
  cfg.mockImplementation((key: string) => map[key as keyof typeof map]);
}

beforeEach(() => {
  vi.clearAllMocks();
  enabledFn.mockReturnValue(false);
  enableFn.mockResolvedValue({ success: true });
  disableFn.mockResolvedValue({ success: true });
  serversFn.mockResolvedValue([]);
  restoreFn.mockResolvedValue(undefined);
  deleteFn.mockResolvedValue(undefined);
  // Default: no restoration file on disk
  fsMock.access.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  fsMock.unlink.mockResolvedValue(undefined);
});

describe('enableCodeModeUserLevel — gate', () => {
  it('returns success:false when codemode.enabled is missing', async () => {
    setConfig({});
    const result = await enableCodeModeUserLevel();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/codemode\.enabled is false/);
    expect(enableFn).not.toHaveBeenCalled();
  });

  it('returns success:false when codemode.enabled is false', async () => {
    setConfig({ codemode: { enabled: false } });
    const result = await enableCodeModeUserLevel();
    expect(result.success).toBe(false);
    expect(enableFn).not.toHaveBeenCalled();
  });

  it('returns success:true and skips when already enabled (idempotent)', async () => {
    setConfig({ codemode: { enabled: true } });
    enabledFn.mockReturnValue(true);
    const result = await enableCodeModeUserLevel();
    expect(result.success).toBe(true);
    expect(enableFn).not.toHaveBeenCalled();
  });
});

describe('enableCodeModeUserLevel — eligibility filter', () => {
  it('multiplexes stdio-capable servers, skips HTTP-only', async () => {
    setConfig({ codemode: { enabled: true } });
    serversFn.mockResolvedValue([
      { name: 'github', enabled: true, scope: 'global', config: { command: 'gh-bin' } },
      { name: 'sentry', enabled: true, scope: 'global', config: { url: 'https://x' } },
      { name: 'context7', enabled: true, scope: 'global', config: { url: 'https://y' } },
      {
        name: 'ouroboros',
        enabled: true,
        scope: 'project',
        config: { command: 'node', args: ['/path/ouroborosMcp.js'] },
      },
    ]);
    await enableCodeModeUserLevel({ projectRoot: '/proj' });
    expect(enableFn).toHaveBeenCalledTimes(1);
    const names = enableFn.mock.calls[0][0] as string[];
    expect(names).toEqual(expect.arrayContaining(['github', 'ouroboros']));
    expect(names).not.toContain('sentry');
    expect(names).not.toContain('context7');
  });

  it('respects codemode.excludeFromMultiplex', async () => {
    setConfig({ codemode: { enabled: true, excludeFromMultiplex: ['github'] } });
    serversFn.mockResolvedValue([
      { name: 'github', enabled: true, scope: 'global', config: { command: 'gh-bin' } },
      { name: 'stripe', enabled: true, scope: 'global', config: { command: 'stripe-bin' } },
    ]);
    await enableCodeModeUserLevel();
    const names = enableFn.mock.calls[0][0] as string[];
    expect(names).not.toContain('github');
    expect(names).toContain('stripe');
  });

  it('skips disabled servers', async () => {
    setConfig({ codemode: { enabled: true } });
    serversFn.mockResolvedValue([
      { name: 'github', enabled: true, scope: 'global', config: { command: 'gh-bin' } },
      { name: 'inactive', enabled: false, scope: 'global', config: { command: 'na' } },
    ]);
    await enableCodeModeUserLevel();
    const names = enableFn.mock.calls[0][0] as string[];
    expect(names).toContain('github');
    expect(names).not.toContain('inactive');
  });

  // Wave 60 Phase E: removed two `drops ouroboros when [bridge port stale]`
  // tests — the dropStaleOuroboros guard they covered was scaffolding around
  // the bridge architecture, which Wave 60 deleted. The standalone is
  // portless and stable, so there's nothing for the guard to defend against.

  it('returns success:false when no eligible servers exist', async () => {
    setConfig({ codemode: { enabled: true } });
    serversFn.mockResolvedValue([
      { name: 'sentry', enabled: true, scope: 'global', config: { url: 'https://x' } },
    ]);
    const result = await enableCodeModeUserLevel();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no eligible servers/);
    expect(enableFn).not.toHaveBeenCalled();
  });

  it('calls maybeRestoreFromCrash before resolving eligible servers (Wave 98 ordering fix)', async () => {
    // Verifies the fix: crash-recovery runs before getMcpServers so that
    // servers restored from the backup are visible when eligibility is assessed.
    setConfig({ codemode: { enabled: true } });
    const callOrder: string[] = [];
    restoreFn.mockImplementation(async () => {
      callOrder.push('restore');
    });
    serversFn.mockImplementation(async () => {
      callOrder.push('getMcpServers');
      return [];
    });
    await enableCodeModeUserLevel();
    expect(callOrder.indexOf('restore')).toBeLessThan(callOrder.indexOf('getMcpServers'));
  });
});

describe('enableCodeModeUserLevel — passthrough to enableCodeMode', () => {
  it('passes scope=global and forwards projectRoot', async () => {
    setConfig({ codemode: { enabled: true } });
    serversFn.mockResolvedValue([
      { name: 'github', enabled: true, scope: 'global', config: { command: 'gh' } },
    ]);
    await enableCodeModeUserLevel({ projectRoot: '/some/proj' });
    const call = enableFn.mock.calls[0];
    expect(call[1]).toBe('global');
    expect(call[2]).toBe('/some/proj');
  });

  it('forwards enableCodeMode failure to caller', async () => {
    setConfig({ codemode: { enabled: true } });
    serversFn.mockResolvedValue([
      { name: 'github', enabled: true, scope: 'global', config: { command: 'gh' } },
    ]);
    enableFn.mockResolvedValue({ success: false, error: 'something broke' });
    const result = await enableCodeModeUserLevel();
    expect(result.success).toBe(false);
    expect(result.error).toBe('something broke');
  });
});

describe('disableCodeModeUserLevel', () => {
  it('does nothing when codemode is not enabled', async () => {
    enabledFn.mockReturnValue(false);
    await disableCodeModeUserLevel();
    expect(disableFn).not.toHaveBeenCalled();
  });

  it('calls disableCodeMode when active', async () => {
    enabledFn.mockReturnValue(true);
    await disableCodeModeUserLevel();
    expect(disableFn).toHaveBeenCalledTimes(1);
  });

  it('swallows disable errors so app shutdown is not blocked', async () => {
    enabledFn.mockReturnValue(true);
    disableFn.mockRejectedValue(new Error('mid-write'));
    await expect(disableCodeModeUserLevel()).resolves.toBeUndefined();
  });

  it('logs but tolerates disable returning success:false', async () => {
    enabledFn.mockReturnValue(true);
    disableFn.mockResolvedValue({ success: false, error: 'not enabled' });
    await expect(disableCodeModeUserLevel()).resolves.toBeUndefined();
  });
});

describe('runCodeModeStartupGate — Wave 98 bypass', () => {
  it('skips restoration and enable when no codemode-managed.json exists', async () => {
    fsMock.access.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await runCodeModeStartupGate();
    expect(restoreFn).not.toHaveBeenCalled();
    expect(enableFn).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('runs restoration and skips enable when codemode-managed.json exists', async () => {
    fsMock.access.mockResolvedValue(undefined);
    await runCodeModeStartupGate();
    expect(restoreFn).toHaveBeenCalledTimes(1);
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(enableFn).not.toHaveBeenCalled();
  });

  it('deletes restoration file even when maybeRestoreFromCrash throws (malformed file)', async () => {
    fsMock.access.mockResolvedValue(undefined);
    restoreFn.mockRejectedValue(new Error('malformed JSON'));
    await runCodeModeStartupGate();
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(enableFn).not.toHaveBeenCalled();
  });

  it('cleans up proxy config file after restoration', async () => {
    fsMock.access.mockResolvedValue(undefined);
    await runCodeModeStartupGate();
    expect(fsMock.unlink).toHaveBeenCalledTimes(1);
    expect(fsMock.unlink).toHaveBeenCalledWith('/tmp/codemode-proxy-config.json');
  });

  it('never calls enableCodeModeUserLevel internals regardless of codemode.enabled config', async () => {
    setConfig({ codemode: { enabled: true } });
    fsMock.access.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await runCodeModeStartupGate();
    expect(enableFn).not.toHaveBeenCalled();
  });
});
