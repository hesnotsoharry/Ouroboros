/**
 * Orchestrator-owned acceptance test — Wave 9 Phase 2 (canon restore + auto-resume).
 *
 * Expresses the contract: when `useWorkbenchRestore` returns restored state, the
 * canon terminals hook (a) gates its spawn effect on `isReady`, (b) uses the
 * restored cwds, and (c) conditionally auto-resumes claude in the upper frame
 * via `pty.spawnClaude({ resumeMode })` ONLY when `resumeSessionId` is non-null.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 2
 * implementer implements `useWorkbenchTerminals` against THIS test and MAY NOT
 * modify it. The test is RED at Phase 2 dispatch and goes green only when the
 * full restore + conditional-resume wiring lands.
 *
 * The lock-step contract is:
 *   - `isReady: false`  → 0 spawn calls of any kind on the first effect tick
 *   - `isReady: true`+resumeSessionId set
 *       → exactly 1 spawnClaude(upper, { cwd: restoredUpper, resumeMode })
 *       AND exactly 1 spawn(lower, { cwd: restoredLower })
 *       AND 0 plain spawn calls for the upper frame
 *   - `isReady: true`+resumeSessionId null
 *       → exactly 1 spawn(upper, { cwd: restoredUpper })
 *       AND exactly 1 spawn(lower, { cwd: restoredLower })
 *       AND 0 spawnClaude calls
 *   - Transition `isReady: false → true` fires spawns exactly once each
 *     (StrictMode-safe — no double-spawn from the mount→cleanup→mount cycle).
 *   - Missing restored cwd falls back to project root (no crash, no undefined cwd
 *     in the spawn call).
 *
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { WorkbenchRestoreState } from './useWorkbenchRestore';
import { useWorkbenchTerminals } from './useWorkbenchTerminals';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mutable per-test so individual cases can swap the restore state.
let mockRestoreState: WorkbenchRestoreState = { isReady: true };

vi.mock('./useWorkbenchRestore', () => ({
  useWorkbenchRestore: () => mockRestoreState,
}));

// useWorkbenchSessionPersist is a no-op in this test — Phase 2 mounts it but its
// write behaviour is exercised in its own unit tests, not the restore contract.
vi.mock('./useWorkbenchSessionPersist', () => ({
  useWorkbenchSessionPersist: vi.fn(),
}));

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoots: ['C:/proj'],
    projectRoot: 'C:/proj',
    projectName: 'proj',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => null,
}));

// ── electronAPI harness ───────────────────────────────────────────────────────

function installElectronAPI(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    pty: {
      spawn: vi.fn().mockResolvedValue({ success: true, pid: 1 }),
      spawnClaude: vi.fn().mockResolvedValue({ success: true, pid: 2 }),
      kill: vi.fn().mockResolvedValue({ success: true }),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
    },
    hooks: {
      onAgentEvent: vi.fn(() => () => {}),
    },
    config: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

function ptySpawn(): Mock {
  return window.electronAPI.pty.spawn as unknown as Mock;
}
function ptySpawnClaude(): Mock {
  return window.electronAPI.pty.spawnClaude as unknown as Mock;
}

beforeEach(() => {
  mockRestoreState = { isReady: true };
  installElectronAPI();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWorkbenchTerminals — restore gate (Wave 9 Phase 2)', () => {
  it('does NOT spawn when isReady is false', async () => {
    mockRestoreState = { isReady: false };

    renderHook(() => useWorkbenchTerminals());

    // Give any deferred effect tick a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptySpawn()).not.toHaveBeenCalled();
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });

  it('spawns ONCE per frame when isReady flips false → true', async () => {
    mockRestoreState = { isReady: false };

    const { rerender } = renderHook(() => useWorkbenchTerminals());

    // Confirm no spawns yet.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ptySpawn()).not.toHaveBeenCalled();

    // Flip ready.
    mockRestoreState = {
      isReady: true,
      upperCwd: '/restored-upper',
      lowerCwd: '/restored-lower',
    };
    rerender();

    await waitFor(() => {
      expect(ptySpawn()).toHaveBeenCalledTimes(2);
    });

    const calls = ptySpawn().mock.calls;
    const cwds = calls.map((c) => (c[1] as { cwd?: string }).cwd);
    expect(cwds).toEqual(expect.arrayContaining(['/restored-upper', '/restored-lower']));
  });
});

describe('useWorkbenchTerminals — auto-resume (Wave 9 Phase 2)', () => {
  it('auto-resumes claude in the upper frame when resumeSessionId is set', async () => {
    mockRestoreState = {
      isReady: true,
      upperCwd: '/restored-upper',
      lowerCwd: '/restored-lower',
      resumeSessionId: 'sess-X',
    };

    renderHook(() => useWorkbenchTerminals());

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [claudeId, claudeOpts] = ptySpawnClaude().mock.calls[0];
    expect(typeof claudeId).toBe('string');
    expect(claudeId).toMatch(/^wb-cc-/);
    expect(claudeOpts).toEqual(
      expect.objectContaining({
        cwd: '/restored-upper',
        resumeMode: 'sess-X',
      }),
    );

    // Lower frame still uses plain spawn with the restored cwd.
    await waitFor(() => {
      expect(ptySpawn()).toHaveBeenCalledTimes(1);
    });
    const [lowerId, lowerOpts] = ptySpawn().mock.calls[0];
    expect(lowerId).toMatch(/^wb-shell-/);
    expect(lowerOpts).toEqual(expect.objectContaining({ cwd: '/restored-lower' }));
  });

  it('does NOT call spawnClaude when resumeSessionId is null/undefined', async () => {
    mockRestoreState = {
      isReady: true,
      upperCwd: '/restored-upper',
      lowerCwd: '/restored-lower',
      // resumeSessionId omitted
    };

    renderHook(() => useWorkbenchTerminals());

    await waitFor(() => {
      expect(ptySpawn()).toHaveBeenCalledTimes(2);
    });

    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    // Both spawns use plain pty.spawn — upper at restored upper cwd, lower at
    // restored lower cwd.
    const calls = ptySpawn().mock.calls;
    const cwdsByPrefix = new Map<string, string | undefined>();
    for (const call of calls) {
      const id = call[0] as string;
      const opts = call[1] as { cwd?: string };
      const prefix = id.startsWith('wb-cc-') ? 'upper' : 'lower';
      cwdsByPrefix.set(prefix, opts.cwd);
    }
    expect(cwdsByPrefix.get('upper')).toBe('/restored-upper');
    expect(cwdsByPrefix.get('lower')).toBe('/restored-lower');
  });
});

describe('useWorkbenchTerminals — restore cwd fallback (Wave 9 Phase 2)', () => {
  it('falls back to project root when restored upperCwd is missing', async () => {
    mockRestoreState = {
      isReady: true,
      // upperCwd missing
      lowerCwd: '/restored-lower',
      resumeSessionId: 'sess-Y',
    };

    renderHook(() => useWorkbenchTerminals());

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, claudeOpts] = ptySpawnClaude().mock.calls[0];
    expect((claudeOpts as { cwd?: string }).cwd).toBe('C:/proj');
  });

  it('falls back to project root when restored lowerCwd is missing', async () => {
    mockRestoreState = {
      isReady: true,
      upperCwd: '/restored-upper',
      // lowerCwd missing
    };

    renderHook(() => useWorkbenchTerminals());

    await waitFor(() => {
      expect(ptySpawn()).toHaveBeenCalledTimes(2);
    });

    const lowerCall = ptySpawn().mock.calls.find((c) => (c[0] as string).startsWith('wb-shell-'));
    expect(lowerCall).toBeDefined();
    expect((lowerCall![1] as { cwd?: string }).cwd).toBe('C:/proj');
  });

  it('falls back to project root for BOTH frames when restore state is empty', async () => {
    mockRestoreState = { isReady: true };

    renderHook(() => useWorkbenchTerminals());

    await waitFor(() => {
      expect(ptySpawn()).toHaveBeenCalledTimes(2);
    });

    for (const call of ptySpawn().mock.calls) {
      expect((call[1] as { cwd?: string }).cwd).toBe('C:/proj');
    }
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });
});
