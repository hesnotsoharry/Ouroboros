/**
 * Orchestrator-owned acceptance test — Wave 14 Phase 2 (top-dock terminal cwd fix),
 * updated Wave 101 (cc-spawn gate: Start Claude button).
 *
 * Original contract (Wave 14): cc spawns automatically with the correct cwd once
 * projectRoot is available.
 *
 * Updated contract (Wave 101): cc does NOT auto-spawn regardless of projectRoot.
 * The user must click "Start Claude" (calls spawnCcTab). When spawnCcTab is called,
 * it MUST use the current projectRoot as cwd — NOT `undefined` or a stale root.
 *
 * Key assertions:
 *   1. spawnClaude does NOT fire automatically when projectRoot becomes available.
 *   2. spawnCcTab(tabId) fires spawnClaude with cwd = current projectRoot.
 *   3. Calling spawnCcTab after a projectRoot change uses the new root's cwd.
 *
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
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

  it('does NOT auto-spawn CC tab when projectRoot becomes available (Start Claude gate)', async () => {
    const projectRoot = 'C:\\Web App\\Gamify';

    // Start with null root.
    const wrapper = makeWrapper(null);
    const { rerender } = renderHook(
      ({ root }: { root: string | null }) => useWorkbenchTabs('upper', root),
      { wrapper, initialProps: { root: null } },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    // Project root becomes available — cc must still not auto-spawn.
    wrapperRoot = projectRoot;
    rerender({ root: projectRoot });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
  });

  it('spawns CC tab with the correct project root cwd on first mount when already available', async () => {
    const projectRoot = 'C:\\Web App\\Gamify';

    // Provider receives a valid root immediately on mount.
    const { result } = renderHook(() => useWorkbenchTabs('upper', projectRoot), {
      wrapper: makeWrapper(projectRoot),
    });

    // No auto-spawn — cc is gated.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    // User clicks "Start Claude" — spawnCcTab fires with current cwd.
    act(() => {
      result.current.spawnCcTab(result.current.activeTabId!);
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

    // Provider starts with firstRoot — user clicks "Start Claude".
    const wrapper = makeWrapper(firstRoot);
    const { result, rerender } = renderHook(
      ({ root }: { root: string }) => useWorkbenchTabs('upper', root),
      { wrapper, initialProps: { root: firstRoot } },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    act(() => {
      result.current.spawnCcTab(result.current.activeTabId!);
    });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [, firstOpts] = ptySpawnClaude().mock.calls[0];
    expect((firstOpts as { cwd?: string }).cwd).toBe(firstRoot);

    // Project switch — provider handles in-place (no key remount).
    // The provider saves firstRoot's tab state to its in-memory cache.
    wrapperRoot = secondRoot;
    rerender({ root: secondRoot });

    await new Promise((resolve) => setTimeout(resolve, 30));

    // cc does NOT auto-spawn for the new project — user must click again.
    expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);

    // User clicks "Start Claude" for the new project.
    act(() => {
      result.current.spawnCcTab(result.current.activeTabId!);
    });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(2);
    });

    const [, secondOpts] = ptySpawnClaude().mock.calls[1];
    expect((secondOpts as { cwd?: string }).cwd).toBe(secondRoot);
  });
});
