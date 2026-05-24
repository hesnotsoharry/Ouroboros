/* eslint-disable security/detect-non-literal-fs-filename -- test paths are os.tmpdir-derived, not user input */
/**
 * Orchestrator-owned acceptance test — Wave 12 Phase 3 (configPreflight Wave-10 migration).
 *
 * Expresses the contract: `resetLegacyCanonWorkbenchSessions` (called inside
 * `runConfigPreflight`) MUST detect and clear the Wave 10 single-slot shape so
 * that Conf's new Wave-12 TabCollection schema does not crash on boot.
 *
 * Wave 10 shape: Record<projectRoot, { upper: {cwd, claudeSessionId?}|null, lower: {cwd}|null } | null>
 * Wave 12 shape: Record<projectRoot, { upper: TabCollection, lower: TabCollection } | null>
 *   where TabCollection = { activeTabId: string|null; tabs: TabState[] }
 *   and   TabState      = { id, label, sessionId, kind:'cc'|'shell', createdAt }
 *
 * The preflight MUST:
 *   (1) Detect the Wave 10 single-slot shape and clear to {}
 *   (2) Preserve a valid Wave 12 TabCollection shape untouched
 *   (3) Still detect the Wave 9 flat shape (regression check — Wave 10.1 hotfix preserved)
 *   (4) Leave an empty or absent value untouched
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 3
 * implementer extends `resetLegacyCanonWorkbenchSessions` (or adds a sibling)
 * against THIS test and MAY NOT modify it. Tests are RED at dispatch.
 *
 * Infrastructure: mirrors the existing configPreflight.test.ts pattern
 * (real fs writes to os.tmpdir, platform-bridge trick for resolveUserDataDir).
 */
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
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-wave10-'));
  tmpDirs.push(home);
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

describe('runConfigPreflight — Wave 10 → Wave 12 canonWorkbenchSessions migration', () => {
  it('detects Wave-10 single-slot shape and clears to {}', async () => {
    // Wave 10 shape: keyed by projectRoot, values are { upper: {cwd,...}|null, lower: {cwd}|null }
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      activeTheme: 'modern',
      canonWorkbenchSessions: {
        '/repos/x': {
          upper: { cwd: '/repos/x', claudeSessionId: 'sess-1' },
          lower: { cwd: '/repos/x' },
        },
      },
    });

    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();

    const after = readConfig(file);
    // The Wave 10 slot shape must be cleared so the Wave 12 schema doesn't crash.
    expect(after.canonWorkbenchSessions).toEqual({});
    // Unrelated keys must be preserved.
    expect(after.activeTheme).toBe('modern');
  });

  it('detects Wave-10 single-slot shape with null lower and clears to {}', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      canonWorkbenchSessions: {
        '/repos/y': {
          upper: { cwd: '/repos/y' },
          lower: null,
        },
      },
    });

    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();

    const after = readConfig(file);
    expect(after.canonWorkbenchSessions).toEqual({});
  });

  it('preserves valid Wave-12 TabCollection shape untouched', async () => {
    const dir = makeTmpUserData();
    const wave12Value = {
      '/repos/x': {
        upper: {
          activeTabId: 't1',
          tabs: [
            {
              id: 't1',
              label: 'main',
              sessionId: 'wb-cc-X',
              kind: 'cc',
              createdAt: 123,
            },
          ],
        },
        lower: {
          activeTabId: null,
          tabs: [],
        },
      },
    };
    const file = writeConfig(dir, {
      canonWorkbenchSessions: wave12Value,
    });

    const before = fs.statSync(file).mtimeMs;
    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();
    const after = readConfig(file);

    // Shape must be preserved exactly.
    expect(after.canonWorkbenchSessions).toEqual(wave12Value);
    // File must not be rewritten if nothing changed.
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('still detects Wave-9 flat { upper, lower } shape and clears to {} (regression)', async () => {
    // Wave 9 wrote the flat shape at the top of the record (not keyed by project root).
    // The Wave 10.1 hotfix detected this; Phase 3 must not regress it.
    const dir = makeTmpUserData();
    const file = writeConfig(dir, {
      canonWorkbenchSessions: {
        upper: { cwd: '/x' },
        lower: null,
      },
    });

    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();

    const after = readConfig(file);
    expect(after.canonWorkbenchSessions).toEqual({});
  });

  it('leaves an empty {} canonWorkbenchSessions untouched', async () => {
    const dir = makeTmpUserData();
    const file = writeConfig(dir, { canonWorkbenchSessions: {} });
    const before = fs.statSync(file).mtimeMs;

    const { runConfigPreflight } = await loadModule(dir);
    runConfigPreflight();

    const after = readConfig(file);
    expect(after.canonWorkbenchSessions).toEqual({});
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });
});
