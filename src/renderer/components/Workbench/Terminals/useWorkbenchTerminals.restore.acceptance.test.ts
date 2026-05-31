/**
 * Acceptance test — useWorkbenchTerminals (freeze-fix 2026-05-30).
 *
 * Contract change (freeze-fix): spawning was REMOVED from useWorkbenchTerminals.
 * WorkbenchTabsProvider is now the sole pty spawn authority (one CC spawn per pane
 * on cold start, no resumeMode). This hook returns stable fallback ids only.
 *
 * Contracts expressed here:
 *   - The hook never calls pty.spawn or pty.spawnClaude, regardless of isReady /
 *     resumeSessionId / cwd values (spawn is the provider's job).
 *   - The hook returns two stable string ids (upper wb-cc-*, lower wb-shell-*).
 *   - The hook does NOT kill any pty on unmount (no ptys to kill).
 *   - These hold even when isReady flips false → true (no deferred spawn).
 *
 * Previous Wave-9 Phase-2 contract (auto-resume via spawnClaude with resumeMode)
 * is INTENTIONALLY DELETED — that contract was the root cause of the cold-start
 * resume-picker bug (resumeMode was a pane-id string, not a real Claude session id).
 * The new spawn contract lives in WorkbenchTabsProvider.idmatch.acceptance.test.tsx.
 *
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { WorkbenchRestoreState } from './useWorkbenchRestore';
import { useWorkbenchTerminals } from './useWorkbenchTerminals';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockRestoreState: WorkbenchRestoreState = { isReady: true };

vi.mock('./useWorkbenchRestore', () => ({
  useWorkbenchRestore: () => mockRestoreState,
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
  };
}

function ptySpawn(): Mock {
  return (window as unknown as { electronAPI: { pty: { spawn: Mock } } }).electronAPI.pty.spawn;
}
function ptySpawnClaude(): Mock {
  return (window as unknown as { electronAPI: { pty: { spawnClaude: Mock } } }).electronAPI.pty.spawnClaude;
}
function ptyKill(): Mock {
  return (window as unknown as { electronAPI: { pty: { kill: Mock } } }).electronAPI.pty.kill;
}

beforeEach(() => {
  mockRestoreState = { isReady: true };
  installElectronAPI();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWorkbenchTerminals — NO spawn (freeze-fix)', () => {
  it('never calls pty.spawn or pty.spawnClaude when isReady is false', async () => {
    mockRestoreState = { isReady: false };

    renderHook(() => useWorkbenchTerminals());

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptySpawn()).not.toHaveBeenCalled();
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });

  it('never calls pty.spawn or pty.spawnClaude when isReady is true', async () => {
    mockRestoreState = {
      isReady: true,
      upperCwd: '/restored-upper',
      lowerCwd: '/restored-lower',
    };

    renderHook(() => useWorkbenchTerminals());

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptySpawn()).not.toHaveBeenCalled();
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });

  it('never calls spawnClaude even when resumeSessionId is set', async () => {
    mockRestoreState = {
      isReady: true,
      upperCwd: '/restored-upper',
      lowerCwd: '/restored-lower',
      resumeSessionId: 'sess-X',
    };

    renderHook(() => useWorkbenchTerminals());

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptySpawnClaude()).not.toHaveBeenCalled();
    expect(ptySpawn()).not.toHaveBeenCalled();
  });

  it('never calls pty.spawn or pty.spawnClaude when isReady flips false → true', async () => {
    mockRestoreState = { isReady: false };

    const { rerender } = renderHook(() => useWorkbenchTerminals());

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ptySpawn()).not.toHaveBeenCalled();

    mockRestoreState = {
      isReady: true,
      upperCwd: '/restored-upper',
      lowerCwd: '/restored-lower',
    };
    rerender();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptySpawn()).not.toHaveBeenCalled();
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });

  it('returns two distinct stable ids with correct prefixes', () => {
    const { result } = renderHook(() => useWorkbenchTerminals());

    const { upperSessionId, lowerSessionId } = result.current;
    expect(upperSessionId).toMatch(/^wb-cc-/);
    expect(lowerSessionId).toMatch(/^wb-shell-/);
    expect(upperSessionId).not.toBe(lowerSessionId);
  });

  it('does NOT call pty.kill on unmount (no ptys to kill)', async () => {
    const { unmount } = renderHook(() => useWorkbenchTerminals());

    unmount();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptyKill()).not.toHaveBeenCalled();
  });
});

describe('useWorkbenchTerminals — stable ids (freeze-fix)', () => {
  it('ids are stable across rerenders', () => {
    const { result, rerender } = renderHook(() => useWorkbenchTerminals());

    const first = { ...result.current };
    rerender();
    const second = { ...result.current };

    expect(second.upperSessionId).toBe(first.upperSessionId);
    expect(second.lowerSessionId).toBe(first.lowerSessionId);
  });
});
