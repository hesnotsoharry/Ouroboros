/**
 * hookInstallerSettings.test.ts — Unit tests for telemetry hook registration
 * and router-shadow pruning (Wave 101).
 *
 * Coverage:
 *   - Idempotent merge: running twice writes once, no duplicates on second run.
 *   - User's existing entries survive.
 *   - First-install backup created.
 *   - Subsequent installs don't overwrite the backup.
 *   - Atomic write: tmp file used, settings.json never half-written.
 *   - Missing settings.json: creates a fresh file.
 *   - Malformed settings.json: treated as fresh + backup of corrupted file.
 *   - autoInstallHooks=false: callsite gates the call (caller responsibility).
 *   - pruneRouterShadowFromSettings: removes stale router-shadow entries;
 *     preserves all other hooks; idempotent; fails gracefully.
 *
 * Real ~/.claude/settings.json is NEVER touched. All fs calls are mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockRenameSync,
  mockCopyFileSync,
  mockReaddirSync,
  mockOpenSync,
  mockFsyncSync,
  mockCloseSync,
  mockMkdirSync,
  mockUnlinkSync,
  mockReadClaudeSettings,
  mockLog,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockRenameSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockOpenSync: vi.fn().mockReturnValue(3),
  mockFsyncSync: vi.fn(),
  mockCloseSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockReadClaudeSettings: vi.fn(),
  mockLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    renameSync: mockRenameSync,
    copyFileSync: mockCopyFileSync,
    readdirSync: mockReaddirSync,
    openSync: mockOpenSync,
    fsyncSync: mockFsyncSync,
    closeSync: mockCloseSync,
    mkdirSync: mockMkdirSync,
    unlinkSync: mockUnlinkSync,
  },
}));

vi.mock('./hookInstaller', () => ({
  readClaudeSettings: mockReadClaudeSettings,
}));

vi.mock('./logger', () => ({
  default: mockLog,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import os from 'os';
import path from 'path';

import {
  buildTelemetryHookCommand,
  pruneRouterShadowFromSettings,
  registerTelemetryHooksInSettings,
} from './hookInstallerSettings';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HOOKS_DIR = path.join(os.homedir(), '.claude', 'hooks');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

const SPAWN_COST_CMD = buildTelemetryHookCommand(HOOKS_DIR, 'session_start_spawn_cost.mjs');
// ROUTER_SHADOW_CMD still used in pruneRouterShadowFromSettings tests
const ROUTER_SHADOW_CMD = buildTelemetryHookCommand(
  HOOKS_DIR,
  'user_prompt_submit_router_shadow.mjs',
);

/** Captures the JSON written to the tmp file during atomicWriteSettings. */
function captureWrittenSettings(): Record<string, unknown> {
  const calls = mockWriteFileSync.mock.calls;
  const tmpCall = calls.find((c) => String(c[0]).endsWith('.tmp'));
  if (!tmpCall) throw new Error('no tmp write found');
  return JSON.parse(String(tmpCall[1]));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupEmptySettings(): void {
  mockReadClaudeSettings.mockReturnValue({});
  mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
  mockReadFileSync.mockReturnValue('{}');
  mockReaddirSync.mockReturnValue([]);
}

function setupSettingsWithHooks(extraHooks: Record<string, unknown>): void {
  const settings = { hooks: extraHooks };
  mockReadClaudeSettings.mockReturnValue(JSON.parse(JSON.stringify(settings)));
  mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
  mockReadFileSync.mockReturnValue(JSON.stringify(settings));
  mockReaddirSync.mockReturnValue([]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildTelemetryHookCommand', () => {
  it('returns a node invocation with the script path quoted', () => {
    const cmd = buildTelemetryHookCommand('/some/hooks', 'session_start_spawn_cost.mjs');
    expect(cmd).toMatch(/^node "/);
    expect(cmd).toContain('session_start_spawn_cost.mjs');
  });
});

describe('registerTelemetryHooksInSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a fresh settings.json with the SessionStart hook entry when file is missing', () => {
    mockReadClaudeSettings.mockReturnValue({});
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);

    registerTelemetryHooksInSettings(HOOKS_DIR);

    const written = captureWrittenSettings();
    const hooks = written['hooks'] as Record<string, unknown[]>;
    expect(Array.isArray(hooks['SessionStart'])).toBe(true);
    // UserPromptSubmit (router-shadow) removed in Wave 101 — must NOT be written
    expect(hooks['UserPromptSubmit']).toBeUndefined();
    const sessionCmds = (hooks['SessionStart'] as Array<{ hooks: Array<{ command: string }> }>)
      .flatMap((m) => m.hooks.map((h) => h.command));
    expect(sessionCmds).toContain(SPAWN_COST_CMD);
  });

  it('is idempotent: second run writes nothing new', () => {
    // First run
    setupEmptySettings();
    registerTelemetryHooksInSettings(HOOKS_DIR);
    const firstWritten = captureWrittenSettings();

    // Reset mock call counts but keep same settings (simulate re-read)
    vi.clearAllMocks();
    mockReadClaudeSettings.mockReturnValue(JSON.parse(JSON.stringify(firstWritten)));
    mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
    mockReadFileSync.mockReturnValue(JSON.stringify(firstWritten));
    // Simulate backup already exists from first run
    mockReaddirSync.mockReturnValue(['settings.json.2026-04-27T12-00-00.bak']);

    registerTelemetryHooksInSettings(HOOKS_DIR);

    // No tmp write on second run because all hooks are already present
    const tmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(tmpCalls).toHaveLength(0);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    );
  });

  it('preserves user-existing entries when appending', () => {
    const userEntry = {
      matcher: 'custom',
      hooks: [{ type: 'command', command: 'node /usr/local/bin/my-hook.mjs' }],
    };
    setupSettingsWithHooks({
      SessionStart: [userEntry],
    });

    registerTelemetryHooksInSettings(HOOKS_DIR);

    const written = captureWrittenSettings();
    const sessionMatchers = written['hooks'] as Record<string, unknown[]>;
    const sessionStart = sessionMatchers['SessionStart'] as Array<{ matcher?: string }>;
    expect(sessionStart.some((m) => m.matcher === 'custom')).toBe(true);
    const sessionCmds = (sessionStart as Array<{ hooks: Array<{ command: string }> }>)
      .flatMap((m) => m.hooks.map((h) => h.command));
    expect(sessionCmds).toContain(SPAWN_COST_CMD);
  });

  it('does not write when the only hook entry is already present', () => {
    // SessionStart with SPAWN_COST_CMD already present; no other hooks in manifest.
    const existingEntry = {
      hooks: [{ type: 'command', command: SPAWN_COST_CMD }],
    };
    setupSettingsWithHooks({ SessionStart: [existingEntry] });

    registerTelemetryHooksInSettings(HOOKS_DIR);

    // Nothing new to add — write must NOT be triggered
    const tmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(tmpCalls).toHaveLength(0);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    );
  });

  it('creates a backup on first install', () => {
    setupEmptySettings();

    registerTelemetryHooksInSettings(HOOKS_DIR);

    expect(mockCopyFileSync).toHaveBeenCalledWith(
      SETTINGS_PATH,
      expect.stringMatching(/settings\.json\.\d{4}-\d{2}-\d{2}.*\.bak$/),
    );
  });

  it('does not overwrite an existing backup', () => {
    setupEmptySettings();
    // Simulate a backup already present
    mockReaddirSync.mockReturnValue(['settings.json.2026-04-27T10-00-00.bak']);

    registerTelemetryHooksInSettings(HOOKS_DIR);

    expect(mockCopyFileSync).not.toHaveBeenCalled();
  });

  it('uses atomic write: writes to .tmp then renames', () => {
    setupEmptySettings();

    registerTelemetryHooksInSettings(HOOKS_DIR);

    const tmpPath = `${SETTINGS_PATH}.tmp`;
    expect(mockWriteFileSync).toHaveBeenCalledWith(tmpPath, expect.any(String), 'utf8');
    expect(mockRenameSync).toHaveBeenCalledWith(tmpPath, SETTINGS_PATH);
  });

  it('treats malformed settings.json as fresh and backs up the corrupted file', () => {
    // readClaudeSettings returns {} for malformed — that's the existing behavior
    mockReadClaudeSettings.mockReturnValue({});
    mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
    // readFileSync returns invalid JSON — indicates malformed file
    mockReadFileSync.mockReturnValue('{ invalid json }}}');
    mockReaddirSync.mockReturnValue([]);

    registerTelemetryHooksInSettings(HOOKS_DIR);

    // Backup should be created for the malformed file
    expect(mockCopyFileSync).toHaveBeenCalled();
    // Only the SessionStart hook is written (router-shadow removed in Wave 101)
    const written = captureWrittenSettings();
    const hooks = written['hooks'] as Record<string, unknown[]>;
    expect(hooks['SessionStart']).toBeDefined();
    expect(hooks['UserPromptSubmit']).toBeUndefined();
  });

  it('logs warn and does not throw when write fails', () => {
    setupEmptySettings();
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(() => registerTelemetryHooksInSettings(HOOKS_DIR)).not.toThrow();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not write'),
      expect.any(Error),
    );
  });

  it('logs warn and does not throw when read fails', () => {
    mockReadClaudeSettings.mockImplementation(() => {
      throw new Error('permission denied');
    });

    expect(() => registerTelemetryHooksInSettings(HOOKS_DIR)).not.toThrow();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not read'),
      expect.any(Error),
    );
  });
});

// ── pruneRouterShadowFromSettings ─────────────────────────────────────────────

describe('pruneRouterShadowFromSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any implementation overrides from prior test groups (e.g. the "disk full"
    // mockImplementation set in registerTelemetryHooksInSettings's write-fail test).
    // vi.clearAllMocks() clears call history but not custom implementations.
    mockWriteFileSync.mockReset();
    mockOpenSync.mockReturnValue(3); // restore default return value after mockReset
  });

  it('removes the router-shadow UserPromptSubmit entry when present', () => {
    const existingSettings = {
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: 'command', command: ROUTER_SHADOW_CMD }] },
        ],
      },
    };
    mockReadClaudeSettings.mockReturnValue(JSON.parse(JSON.stringify(existingSettings)));
    mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
    mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings));
    mockReaddirSync.mockReturnValue([]);

    pruneRouterShadowFromSettings();

    const written = captureWrittenSettings();
    const hooks = written['hooks'] as Record<string, unknown>;
    expect(hooks['UserPromptSubmit']).toBeUndefined();
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining('pruned'),
    );
  });

  it('preserves other UserPromptSubmit hooks while removing only the router-shadow entry', () => {
    const userEntry = { type: 'command', command: 'node /usr/local/bin/my-hook.mjs' };
    const existingSettings = {
      hooks: {
        UserPromptSubmit: [
          { hooks: [userEntry] },
          { hooks: [{ type: 'command', command: ROUTER_SHADOW_CMD }] },
        ],
      },
    };
    mockReadClaudeSettings.mockReturnValue(JSON.parse(JSON.stringify(existingSettings)));
    mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
    mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings));
    mockReaddirSync.mockReturnValue([]);

    pruneRouterShadowFromSettings();

    const written = captureWrittenSettings();
    const hooks = written['hooks'] as Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    const remaining = hooks['UserPromptSubmit'];
    expect(Array.isArray(remaining)).toBe(true);
    const cmds = remaining.flatMap((m) => m.hooks.map((h) => h.command));
    expect(cmds).toContain(userEntry.command);
    expect(cmds).not.toContain(ROUTER_SHADOW_CMD);
  });

  it('is idempotent: does nothing when router-shadow is already absent', () => {
    const existingSettings = {
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: SPAWN_COST_CMD }] }],
      },
    };
    mockReadClaudeSettings.mockReturnValue(JSON.parse(JSON.stringify(existingSettings)));
    mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
    mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings));
    mockReaddirSync.mockReturnValue([]);

    pruneRouterShadowFromSettings();

    // No write should occur — nothing to prune
    const tmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(tmpCalls).toHaveLength(0);
  });

  it('does nothing when settings.json is missing', () => {
    mockReadClaudeSettings.mockReturnValue({});
    mockExistsSync.mockReturnValue(false);

    expect(() => pruneRouterShadowFromSettings()).not.toThrow();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('does not throw when the write fails after pruning', () => {
    const existingSettings = {
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: 'command', command: ROUTER_SHADOW_CMD }] },
        ],
      },
    };
    mockReadClaudeSettings.mockReturnValue(JSON.parse(JSON.stringify(existingSettings)));
    mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
    mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings));
    mockReaddirSync.mockReturnValue([]);
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(() => pruneRouterShadowFromSettings()).not.toThrow();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.stringContaining('pruneRouterShadow'),
      expect.any(Error),
    );
  });
});
