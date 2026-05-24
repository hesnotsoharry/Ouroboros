/* eslint-disable security/detect-non-literal-fs-filename -- test paths are os.tmpdir-derived, not user input */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tmpDirs: string[] = [];

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
  },
}));

const originalPlatform = process.platform;
const originalHome = process.env.HOME;

async function loadModule(userDataDir: string) {
  // resolveUserDataDir uses a lazy require('electron') (deliberately not a
  // static import — see configPreflight.ts for the worker_threads electron
  // hazard). A bare require() in vite-transformed code resolves natively and
  // bypasses vi.mock('electron'), so resolveUserDataDir falls through to its
  // platform-convention branch. Drive that branch deterministically: force
  // linux + HOME so it returns <HOME>/.config/ouroboros === userDataDir.
  // Also set the getPath mock so the test still passes if interception ever
  // starts working (belt-and-suspenders — both paths resolve to userDataDir).
  const electron = (await import('electron')) as unknown as {
    app: { getPath: ReturnType<typeof vi.fn> };
  };
  electron.app.getPath.mockReturnValue(userDataDir);
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  process.env.HOME = path.resolve(userDataDir, '..', '..');
  vi.resetModules();
  electron.app.getPath.mockReturnValue(userDataDir);
  return import('./configPreflight');
}

function makeTmpUserData(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-preflight-'));
  tmpDirs.push(home);
  // resolveUserDataDir's linux branch returns <HOME>/.config/ouroboros; mirror
  // that layout so the resolved path equals the dir the test reads/writes.
  const dir = path.join(home, '.config', 'ouroboros');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeConfig(dir: string, value: unknown): string {
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(value, null, '\t'), 'utf8');
  return file;
}

function readConfig(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('runConfigPreflight', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    while (tmpDirs.length > 0) {
      const dir = tmpDirs.pop()!;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it('resets non-array profiles to []', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      profiles: { 'Cole Stacey': { activeTheme: 'warp' } },
      activeTheme: 'warp',
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect(Array.isArray(after.profiles)).toBe(true);
    expect(after.profiles).toEqual([]);
    expect(after.activeTheme).toBe('warp');
  });

  it('leaves a valid array profiles untouched', async () => {
    const dir = makeTmpUserData();
    const profiles = [{ id: 'p1', name: 'Default' }];
    const file = writeConfig(dir, { profiles });
    const before = fs.statSync(file).mtimeMs;
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect(after.profiles).toEqual(profiles);
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('is a no-op when config.json does not exist', async () => {
    const dir = makeTmpUserData();
    const file = path.join(dir, 'config.json');
    const { runConfigPreflight } = await loadModule(dir);
    expect(() => runConfigPreflight()).not.toThrow();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('does not throw on malformed JSON', async () => {
    const dir = makeTmpUserData();
    const file = path.join(dir, 'config.json');
    fs.writeFileSync(file, '{ not json', 'utf8');
    const { runConfigPreflight } = await loadModule(dir);
    expect(() => runConfigPreflight()).not.toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe('{ not json');
  });

  it('does not add a profiles key when one was absent', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, { activeTheme: 'modern' });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect('profiles' in after).toBe(false);
  });

  it('strips wave-79 windowSessions top-level key', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      activeTheme: 'modern',
      windowSessions: [{ id: 'old', bounds: {} }],
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect('windowSessions' in after).toBe(false);
    expect(after.activeTheme).toBe('modern');
  });

  it('strips routerSettings.llmJudgeSampleRate while leaving other router keys', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      routerSettings: { llmJudgeSampleRate: 0.3, autoRetrainEnabled: true },
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    const router = after.routerSettings as Record<string, unknown>;
    expect('llmJudgeSampleRate' in router).toBe(false);
    expect(router.autoRetrainEnabled).toBe(true);
  });

  it('strips wave-79 codemode.routeInternalMcp while leaving other codemode keys', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      codemode: { routeInternalMcp: true, enabled: true },
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    const codemode = after.codemode as Record<string, unknown>;
    expect('routeInternalMcp' in codemode).toBe(false);
    expect(codemode.enabled).toBe(true);
  });

  it('strips wave-79 internalMcp.transport while leaving other internalMcp keys', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      internalMcp: { transport: 'sse', enabled: true },
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    const internalMcp = after.internalMcp as Record<string, unknown>;
    expect('transport' in internalMcp).toBe(false);
    expect(internalMcp.enabled).toBe(true);
  });

  it('resets wave-9 flat canonWorkbenchSessions { upper, lower } to {}', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      activeTheme: 'modern',
      canonWorkbenchSessions: {
        upper: { cwd: '/home/cole/proj', claudeSessionId: 'sess-abc' },
        lower: { cwd: '/home/cole/proj' },
      },
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect(after.canonWorkbenchSessions).toEqual({});
    expect(after.activeTheme).toBe('modern');
  });

  it('leaves a valid wave-10 record-shape canonWorkbenchSessions untouched', async () => {
    const dir = makeTmpUserData();
    const valid = {
      '/home/cole/proj-a': {
        upper: { cwd: '/home/cole/proj-a', claudeSessionId: 'sess-a' },
        lower: { cwd: '/home/cole/proj-a' },
      },
      '/home/cole/proj-b': null,
    };
    const file = writeConfig(dir, { canonWorkbenchSessions: valid });
    const before = fs.statSync(file).mtimeMs;
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect(after.canonWorkbenchSessions).toEqual(valid);
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('resets wave-9 partial flat canonWorkbenchSessions { upper } (lower absent) to {}', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      canonWorkbenchSessions: {
        upper: { cwd: '/home/cole/proj' },
      },
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect(after.canonWorkbenchSessions).toEqual({});
  });

  it('leaves an empty canonWorkbenchSessions {} untouched', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, { canonWorkbenchSessions: {} });
    const before = fs.statSync(file).mtimeMs;
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);
    expect(after.canonWorkbenchSessions).toEqual({});
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('is idempotent — running twice on a stripped config does not rewrite', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      codemode: { routeInternalMcp: true, enabled: true },
    });
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const mtimeAfterFirst = fs.statSync(file).mtimeMs;
    runConfigPreflight();
    expect(fs.statSync(file).mtimeMs).toBe(mtimeAfterFirst);
  });
});
