import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedSessionSnapshot } from './useTerminalSessions.effects';
import {
  MAX_RESTORE_SESSIONS,
  spawnFromSavedOrDefault,
} from './useTerminalSessions.restore';
import { deduplicateSnapshots } from './useTerminalSessions.sync.helpers';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeClaudeSnapshot(
  cwd: string,
  claudeSessionId?: string,
): SavedSessionSnapshot {
  return { cwd, title: 'Claude 1', isClaude: true, claudeSessionId };
}

function makeShellSnapshot(cwd: string): SavedSessionSnapshot {
  return { cwd, title: 'Shell', isClaude: false };
}

function makeMockDeps() {
  return {
    spawnSession: vi.fn().mockResolvedValue(undefined),
    spawnClaudeSession: vi.fn().mockResolvedValue(undefined),
    spawnCodexSession: vi.fn().mockResolvedValue(undefined),
  };
}

function stubElectronAPI(options: { autoLaunch?: boolean } = {}): void {
  vi.stubGlobal('window', {
    electronAPI: {
      config: {
        get: vi.fn().mockResolvedValue(options.autoLaunch ?? false),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
  });
}

// ── MAX_RESTORE_SESSIONS constant ─────────────────────────────────────────────

describe('MAX_RESTORE_SESSIONS', () => {
  it('is a positive integer no greater than 8', () => {
    expect(typeof MAX_RESTORE_SESSIONS).toBe('number');
    expect(MAX_RESTORE_SESSIONS).toBeGreaterThan(0);
    expect(MAX_RESTORE_SESSIONS).toBeLessThanOrEqual(8);
  });
});

// ── deduplicateSnapshots ──────────────────────────────────────────────────────

describe('deduplicateSnapshots', () => {
  it('returns all entries when every snapshot is unique by claudeSessionId', () => {
    const snapshots: SavedSessionSnapshot[] = [
      makeClaudeSnapshot('/a', 'uuid-1'),
      makeClaudeSnapshot('/b', 'uuid-2'),
      makeClaudeSnapshot('/c', 'uuid-3'),
    ];
    expect(deduplicateSnapshots(snapshots)).toHaveLength(3);
  });

  it('collapses 40 identical claudeSessionId entries to 1 (the lockup scenario)', () => {
    const duplicates = Array.from({ length: 40 }, () =>
      makeClaudeSnapshot('C:\\Web App\\ContractorApp', 'uuid-abc'),
    );
    const result = deduplicateSnapshots(duplicates);
    expect(result).toHaveLength(1);
    expect(result[0].claudeSessionId).toBe('uuid-abc');
  });

  it('falls back to cwd as dedup key when claudeSessionId is absent', () => {
    const snapshots: SavedSessionSnapshot[] = [
      makeShellSnapshot('/project'),
      makeShellSnapshot('/project'),
      makeShellSnapshot('/other'),
    ];
    const result = deduplicateSnapshots(snapshots);
    expect(result).toHaveLength(2);
  });

  it('treats different claudeSessionIds at the same cwd as distinct entries', () => {
    const snapshots: SavedSessionSnapshot[] = [
      makeClaudeSnapshot('/project', 'uuid-1'),
      makeClaudeSnapshot('/project', 'uuid-2'),
    ];
    expect(deduplicateSnapshots(snapshots)).toHaveLength(2);
  });

  it('keeps the first occurrence when deduplicating', () => {
    const snapshots: SavedSessionSnapshot[] = [
      makeClaudeSnapshot('/a', 'uuid-x'),
      { ...makeClaudeSnapshot('/a', 'uuid-x'), title: 'second occurrence' },
    ];
    const result = deduplicateSnapshots(snapshots);
    expect(result[0].title).toBe('Claude 1');
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateSnapshots([])).toHaveLength(0);
  });
});

// ── spawnFromSavedOrDefault: hard cap ────────────────────────────────────────

describe('spawnFromSavedOrDefault — hard cap', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('spawns at most MAX_RESTORE_SESSIONS sessions when given more snapshots than the cap', async () => {
    const over = MAX_RESTORE_SESSIONS + 5;
    const snapshots = Array.from({ length: over }, (_, i) =>
      makeClaudeSnapshot(`/project-${i}`, `uuid-${i}`),
    );
    stubElectronAPI({ autoLaunch: false });
    const deps = makeMockDeps();

    await spawnFromSavedOrDefault(snapshots, deps);

    expect(deps.spawnClaudeSession).toHaveBeenCalledTimes(MAX_RESTORE_SESSIONS);
  });

  it('spawns exactly the snapshot count when below the cap', async () => {
    const snapshots = [
      makeClaudeSnapshot('/a', 'uuid-1'),
      makeClaudeSnapshot('/b', 'uuid-2'),
    ];
    stubElectronAPI({ autoLaunch: false });
    const deps = makeMockDeps();

    await spawnFromSavedOrDefault(snapshots, deps);

    expect(deps.spawnClaudeSession).toHaveBeenCalledTimes(2);
  });

  it('spawns at most MAX_RESTORE_SESSIONS sessions for the exact 40-dup lockup scenario', async () => {
    // Simulates the live store state: 40 identical ContractorApp entries
    const duplicates = Array.from({ length: 40 }, () =>
      makeClaudeSnapshot('C:\\Web App\\ContractorApp', 'uuid-contractor'),
    );
    stubElectronAPI({ autoLaunch: false });
    const deps = makeMockDeps();

    await spawnFromSavedOrDefault(duplicates, deps);

    // dedup collapses to 1, then cap trims to min(1, MAX_RESTORE_SESSIONS) = 1
    expect(deps.spawnClaudeSession).toHaveBeenCalledTimes(1);
    expect(deps.spawnSession).not.toHaveBeenCalled();
  });

  it('falls through to default spawn when no snapshots are saved', async () => {
    stubElectronAPI({ autoLaunch: false });
    const deps = makeMockDeps();

    await spawnFromSavedOrDefault([], deps);

    expect(deps.spawnSession).toHaveBeenCalledTimes(1);
    expect(deps.spawnClaudeSession).not.toHaveBeenCalled();
  });

  it('uses autoLaunch spawn when no snapshots and claudeAutoLaunch is true', async () => {
    stubElectronAPI({ autoLaunch: true });
    const deps = makeMockDeps();

    await spawnFromSavedOrDefault([], deps);

    expect(deps.spawnClaudeSession).toHaveBeenCalledTimes(1);
    expect(deps.spawnSession).not.toHaveBeenCalled();
  });
});
