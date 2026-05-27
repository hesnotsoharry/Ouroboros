/**
 * Orchestrator-owned acceptance test — Wave 14 Phase 2 (top-dock terminal cwd fix).
 *
 * Contract: when the workbench upper (CC) terminal auto-spawns, it MUST use the
 * active project root as cwd — NOT `undefined`, NOT a sentinel such as
 * '__no-project__', and NOT a stale root from a previous session.
 *
 * Bug: the upper CC terminal was spawning Claude in `C:\Web App\AgentIDE`
 * regardless of which project was active. Root cause: `useWorkbenchTabs` fires
 * the initial spawn before the project root is loaded (when `defaultProjectRoot`
 * is unset), capturing `cwd: undefined`. Because `hasInitializedRef` prevents
 * re-spawn, the correct cwd arriving later is ignored.
 *
 * Fix contract (two assertions):
 *   1. When `projectRoot` is null on mount, `spawnClaude` MUST NOT fire until
 *      a valid project root is available.
 *   2. Once a valid project root is provided, `spawnClaude` MUST be called
 *      exactly once with `cwd` equal to that project root.
 *
 * The implementer implements the fix against THIS test and MAY NOT modify it.
 * The test is RED before the fix and GREEN only after the spawn-deferral and
 * main-process session-update fix lands.
 *
 * Test subject: `useWorkbenchTabs('upper', projectRoot)` — the actual spawn site
 * for the upper CC terminal (TerminalShell mounts this hook with the active
 * project root from ProjectContext).
 *
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { useWorkbenchTabs } from './useWorkbenchTabs';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('./useWorkbenchRestore', () => ({
  useWorkbenchRestore: vi.fn().mockReturnValue({
    isReady: true,
    upperCollection: undefined,
    lowerCollection: undefined,
  }),
}));

vi.mock('./useWorkbenchSessionPersist', () => ({
  useWorkbenchSessionPersist: vi.fn(),
}));

// ProjectContext is not used directly by useWorkbenchTabs — stub to prevent
// accidental import-time errors in transitive deps.
vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoots: [],
    projectRoot: null,
    projectName: '',
    isLoaded: false,
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

function ptySpawnClaude(): Mock {
  return window.electronAPI.pty.spawnClaude as unknown as Mock;
}

beforeEach(() => {
  installElectronAPI();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWorkbenchTabs upper-frame cwd — Wave 14 Phase 2 (top dock cwd fix)', () => {
  it('does not spawn when projectRoot is null (no project loaded yet)', async () => {
    renderHook(() => useWorkbenchTabs('upper', null));

    // Give any async effects a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 30));

    // spawnClaude must not fire while project root is null.
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });

  it('spawns CC tab with cwd equal to the active project root once it is available', async () => {
    const projectRoot = 'C:\\Web App\\Gamify';

    const { rerender } = renderHook(
      ({ root }: { root: string | null }) => useWorkbenchTabs('upper', root),
      { initialProps: { root: null } },
    );

    // No spawn yet — project root not available.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    // Project root becomes available (simulates ProjectContext loading).
    rerender({ root: projectRoot });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, opts] = ptySpawnClaude().mock.calls[0];
    expect((opts as { cwd?: string }).cwd).toBe(projectRoot);
  });

  it('spawns CC tab with the correct project root cwd on first mount when already available', async () => {
    const projectRoot = 'C:\\Web App\\Gamify';

    renderHook(() => useWorkbenchTabs('upper', projectRoot));

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, opts] = ptySpawnClaude().mock.calls[0];
    expect((opts as { cwd?: string }).cwd).toBe(projectRoot);
  });

  it('does NOT spawn a second time when project root changes after initial spawn', async () => {
    const firstRoot = 'C:\\Web App\\Gamify';
    const secondRoot = 'C:\\Web App\\ContractorApp';

    const { rerender } = renderHook(
      ({ root }: { root: string }) => useWorkbenchTabs('upper', root),
      { initialProps: { root: firstRoot } },
    );

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, opts] = ptySpawnClaude().mock.calls[0];
    expect((opts as { cwd?: string }).cwd).toBe(firstRoot);

    // Project switch — must NOT trigger a second spawn (TerminalShell unmounts/remounts
    // on project switch; re-spawn is handled by unmount+remount, not by cwd change).
    rerender({ root: secondRoot });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
  });
});
