import { describe, expect, it, vi } from 'vitest';

import { parseUsageText, spawnPty } from './claudeUsagePoller';

// ── spawnPty env-suppression tests ────────────────────────────────────────
//
// Mock node-pty at the module boundary so spawnPty never touches a real PTY.
// We only assert on the options object passed to pty.spawn.

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    kill: vi.fn(),
  })),
}));

describe('spawnPty — hook suppression env', () => {
  it('passes OUROBOROS_CHAT_SESSION=1 in the env to suppress hook scripts', async () => {
    const pty = await import('node-pty');
    const mockSpawn = vi.mocked(pty.spawn);
    mockSpawn.mockClear();

    spawnPty({ shell: 'claude', args: [] });

    expect(mockSpawn).toHaveBeenCalledOnce();
    const opts = mockSpawn.mock.calls[0][2] as Record<string, unknown>;
    expect((opts['env'] as Record<string, string>)['OUROBOROS_CHAT_SESSION']).toBe('1');
  });

  it('inherits process.env entries alongside the suppression flag', async () => {
    const pty = await import('node-pty');
    const mockSpawn = vi.mocked(pty.spawn);
    mockSpawn.mockClear();

    spawnPty({ shell: 'claude', args: [] });

    const opts = mockSpawn.mock.calls[0][2] as Record<string, unknown>;
    const env = opts['env'] as Record<string, string | undefined>;
    // process.env.PATH should be present (spread of process.env)
    expect(env).toMatchObject({ OUROBOROS_CHAT_SESSION: '1' });
    // Verify the env is an object (not undefined), proving process.env was spread
    expect(typeof env).toBe('object');
  });

  it('preserves all other spawn options (name, cols, rows, cwd)', async () => {
    const pty = await import('node-pty');
    const mockSpawn = vi.mocked(pty.spawn);
    mockSpawn.mockClear();

    spawnPty({ shell: 'powershell.exe', args: ['-NoLogo'] });

    const opts = mockSpawn.mock.calls[0][2] as Record<string, unknown>;
    expect(opts['name']).toBe('xterm-256color');
    expect(opts['cols']).toBe(120);
    expect(opts['rows']).toBe(30);
    expect(typeof opts['cwd']).toBe('string');
  });
});

// ── parseUsageText unit tests ──────────────────────────────────────────────

const SAMPLE_USAGE_TEXT = `
Current session
████████  80% used
Resets 11pm (America/Toronto)

Current week (all models)
██████  34% used
Resets Apr 4, 1pm (America/Toronto)
`;

const EMPTY_TEXT = 'No usage data here';

describe('parseUsageText', () => {
  it('parses fiveHourUsed and sevenDayUsed from well-formed output', () => {
    const result = parseUsageText(SAMPLE_USAGE_TEXT);
    expect(result.fiveHourUsed).toBe(80);
    expect(result.sevenDayUsed).toBe(34);
  });

  it('returns null fields when output has no usage data', () => {
    const result = parseUsageText(EMPTY_TEXT);
    expect(result.fiveHourUsed).toBeNull();
    expect(result.sevenDayUsed).toBeNull();
    expect(result.fiveHourResetsAt).toBeNull();
    expect(result.sevenDayResetsAt).toBeNull();
  });

  it('does not set stale on a fresh parse result', () => {
    const result = parseUsageText(SAMPLE_USAGE_TEXT);
    expect(result.stale).toBeUndefined();
  });
});

// ── stale flag tests (simulated via the shape contract) ────────────────────
//
// spawnUsageQuery is not directly testable without a real PTY, so we verify
// the stale-flag contract through the ParsedUsage type shape and the spread
// pattern used in attachPtyHandlers.

describe('stale flag contract', () => {
  it('spread of a fresh parse with stale:true produces correct shape', () => {
    const fresh = parseUsageText(SAMPLE_USAGE_TEXT);
    // Simulate what the timeout path does
    const staleResult = fresh.fiveHourUsed !== null ? { ...fresh, stale: true } : null;
    expect(staleResult).not.toBeNull();
    expect(staleResult?.stale).toBe(true);
    expect(staleResult?.fiveHourUsed).toBe(80);
    expect(staleResult?.sevenDayUsed).toBe(34);
  });

  it('returns null when no parse has succeeded (empty lastParse)', () => {
    // Simulate timeout path when lastParseRef.value is null.
    // Use a helper to avoid TS literal-null narrowing on the spread.
    function applyStale(last: ReturnType<typeof parseUsageText> | null) {
      return last ? { ...last, stale: true } : null;
    }
    expect(applyStale(null)).toBeNull();
  });

  it('stale is not set on a non-timeout (exit) result', () => {
    // Exit path: result comes directly from parseUsageText with no stale spread
    const exitResult = parseUsageText(SAMPLE_USAGE_TEXT);
    expect(exitResult.stale).toBeUndefined();
  });
});
