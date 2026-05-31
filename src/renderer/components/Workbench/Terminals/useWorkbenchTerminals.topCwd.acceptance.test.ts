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
 * Re-wiring note (structural fix only — contract unchanged): WorkbenchTabsProvider
 * now owns the projectRoot (it was moved from the hook arg into the provider prop
 * during the Wave 13 singleton-context refactor). To exercise the same deferral
 * contract, projectRoot is driven through the provider prop instead of the hook arg.
 * The provider's useTabRestoreInit still returns early when cwd === undefined, so
 * assertions 1 and 2 above remain satisfiable and byte-for-byte equivalent.
 *
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { useWorkbenchTabs } from './useWorkbenchTabs';
import { WorkbenchTabsProvider } from './WorkbenchTabsProvider';

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

// ── Wrapper helpers ───────────────────────────────────────────────────────────
// WorkbenchTabsProvider now owns the projectRoot (moved from the useWorkbenchTabs
// arg into the provider prop). To vary projectRoot across rerenders we use a
// module-level mutable ref that the wrapper reads on each render cycle.
// Pattern: set `wrapperRoot` before calling `rerender()`; the wrapper re-renders
// and passes the updated value to WorkbenchTabsProvider.

let wrapperRoot: string | null = null;

function makeWrapper(initialRoot: string | null): (p: { children: React.ReactNode }) => React.ReactElement {
  wrapperRoot = initialRoot;
  return function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(WorkbenchTabsProvider, { projectRoot: wrapperRoot }, children);
  };
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
    // Drive projectRoot through the provider prop (null = no cwd → no spawn).
    renderHook(() => useWorkbenchTabs('upper', null), {
      wrapper: makeWrapper(null),
    });

    // Give any async effects a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 30));

    // spawnClaude must not fire while project root is null.
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });

  it('spawns CC tab with cwd equal to the active project root once it is available', async () => {
    const projectRoot = 'C:\\Web App\\Gamify';

    // Start with null root — provider holds the deferred spawn.
    const wrapper = makeWrapper(null);
    const { rerender } = renderHook(
      ({ root }: { root: string | null }) => useWorkbenchTabs('upper', root),
      { wrapper, initialProps: { root: null } },
    );

    // No spawn yet — project root not available.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    // Project root becomes available (simulates ProjectContext loading).
    // Update the wrapper's mutable ref then rerender to push the new root
    // through the provider prop — this is the structural equivalent of
    // passing root: projectRoot to the old hook arg.
    wrapperRoot = projectRoot;
    rerender({ root: projectRoot });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, opts] = ptySpawnClaude().mock.calls[0];
    expect((opts as { cwd?: string }).cwd).toBe(projectRoot);
  });

  it('spawns CC tab with the correct project root cwd on first mount when already available', async () => {
    const projectRoot = 'C:\\Web App\\Gamify';

    // Provider receives a valid root immediately on mount → spawn fires once.
    renderHook(() => useWorkbenchTabs('upper', projectRoot), {
      wrapper: makeWrapper(projectRoot),
    });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, opts] = ptySpawnClaude().mock.calls[0];
    expect((opts as { cwd?: string }).cwd).toBe(projectRoot);
  });

  it('spawns once per project when projectRoot changes (in-place project switch)', async () => {
    const firstRoot = 'C:\\Web App\\Gamify';
    const secondRoot = 'C:\\Web App\\ContractorApp';

    // Provider starts with firstRoot → spawn fires once.
    const wrapper = makeWrapper(firstRoot);
    const { rerender } = renderHook(
      ({ root }: { root: string }) => useWorkbenchTabs('upper', root),
      { wrapper, initialProps: { root: firstRoot } },
    );

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, firstOpts] = ptySpawnClaude().mock.calls[0];
    expect((firstOpts as { cwd?: string }).cwd).toBe(firstRoot);

    // Project switch — provider handles in-place (no key remount). A new CC spawn
    // fires for secondRoot so the user gets a fresh claude session in the new project.
    // The provider saves firstRoot's tab state to its in-memory cache.
    wrapperRoot = secondRoot;
    rerender({ root: secondRoot });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(2);
    });

    const [, secondOpts] = ptySpawnClaude().mock.calls[1];
    expect((secondOpts as { cwd?: string }).cwd).toBe(secondRoot);
  });
});
