/**
 * hookInstallerSettings.test.ts — Unit tests for telemetry hook registration
 * and removed-hook pruning (Wave 101).
 *
 * Coverage:
 *   - registerTelemetryHooksInSettings: TELEMETRY_HOOKS is now empty (Wave 101
 *     Phase 6/6b removed all hooks), so the function always reports "already
 *     registered" and never writes.
 *   - pruneRouterShadowFromSettings: removes stale entries for both removed
 *     scripts (router-shadow @ UserPromptSubmit AND spawn-cost @ SessionStart);
 *     preserves all other hooks; handles both in one atomic write; idempotent;
 *     fails gracefully.
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

// Both scripts are REMOVED in Wave 101 — used only in prune tests.
const SPAWN_COST_CMD = buildTelemetryHookCommand(HOOKS_DIR, 'session_start_spawn_cost.mjs');
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildTelemetryHookCommand', () => {
  it('returns a node invocation with the script path quoted', () => {
    const cmd = buildTelemetryHookCommand('/some/hooks', 'session_start_spawn_cost.mjs');
    expect(cmd).toMatch(/^node "/);
    expect(cmd).toContain('session_start_spawn_cost.mjs');
  });
});

describe('registerTelemetryHooksInSettings', () => {
  // TELEMETRY_HOOKS is now empty (Wave 101 Phase 6/6b removed all hooks).
  // The function still runs but finds nothing to write — it always logs
  // "already registered" without touching the file.

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not write settings.json when TELEMETRY_HOOKS manifest is empty', () => {
    setupEmptySettings();

    registerTelemetryHooksInSettings(HOOKS_DIR);

    // Empty manifest → added=0 → no write
    const tmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(tmpCalls).toHaveLength(0);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    );
  });

  it('does not write the removed spawn-cost or router-shadow entries', () => {
    // Verifies the manifest truly has no hooks — neither spawn-cost nor router-shadow
    // should ever be written by this function (they are removed hooks).
    setupEmptySettings();

    registerTelemetryHooksInSettings(HOOKS_DIR);

    const tmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(tmpCalls).toHaveLength(0);
    // Confirm no write occurred (and thus no SessionStart or UserPromptSubmit written)
    expect(mockRenameSync).not.toHaveBeenCalled();
  });

  it('is idempotent: second run behaves the same as the first (no writes)', () => {
    setupEmptySettings();
    registerTelemetryHooksInSettings(HOOKS_DIR);
    const firstTmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(firstTmpCalls).toHaveLength(0);

    vi.clearAllMocks();
    setupEmptySettings();

    registerTelemetryHooksInSettings(HOOKS_DIR);

    const secondTmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(secondTmpCalls).toHaveLength(0);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
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
// Now generalized to prune ALL removed hooks (REMOVED_HOOKS list):
//   - user_prompt_submit_router_shadow.mjs @ UserPromptSubmit (Phase 6)
//   - session_start_spawn_cost.mjs @ SessionStart (Phase 6b)

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

  it('removes the spawn-cost SessionStart entry when present', () => {
    const existingSettings = {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: SPAWN_COST_CMD }] },
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
    expect(hooks['SessionStart']).toBeUndefined();
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining('pruned'),
    );
  });

  it('prunes both removed hooks in a single atomic write when both are present', () => {
    const existingSettings = {
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: 'command', command: ROUTER_SHADOW_CMD }] },
        ],
        SessionStart: [
          { hooks: [{ type: 'command', command: SPAWN_COST_CMD }] },
        ],
      },
    };
    mockReadClaudeSettings.mockReturnValue(JSON.parse(JSON.stringify(existingSettings)));
    mockExistsSync.mockImplementation((p: string) => p === SETTINGS_PATH);
    mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings));
    mockReaddirSync.mockReturnValue([]);

    pruneRouterShadowFromSettings();

    // One atomic write covers both removals
    const tmpCalls = mockWriteFileSync.mock.calls.filter((c) => String(c[0]).endsWith('.tmp'));
    expect(tmpCalls).toHaveLength(1);
    const written = captureWrittenSettings();
    const hooks = written['hooks'] as Record<string, unknown>;
    expect(hooks['UserPromptSubmit']).toBeUndefined();
    expect(hooks['SessionStart']).toBeUndefined();
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

  it('preserves other SessionStart hooks while removing only the spawn-cost entry', () => {
    const userEntry = { type: 'command', command: 'node /usr/local/bin/my-session-hook.mjs' };
    const existingSettings = {
      hooks: {
        SessionStart: [
          { hooks: [userEntry] },
          { hooks: [{ type: 'command', command: SPAWN_COST_CMD }] },
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
    const remaining = hooks['SessionStart'];
    expect(Array.isArray(remaining)).toBe(true);
    const cmds = remaining.flatMap((m) => m.hooks.map((h) => h.command));
    expect(cmds).toContain(userEntry.command);
    expect(cmds).not.toContain(SPAWN_COST_CMD);
  });

  it('is idempotent: does nothing when both removed scripts are already absent', () => {
    const existingSettings = {
      hooks: {
        PreToolUse: [{ hooks: [{ type: 'command', command: 'node /some/other-hook.mjs' }] }],
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
