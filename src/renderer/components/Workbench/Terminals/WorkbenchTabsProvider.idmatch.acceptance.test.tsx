/**
 * Orchestrator-owned acceptance test — freeze-fix (2026-05-30).
 *
 * Guards the cold-start id-match invariant:
 *   The tab id passed to pty.spawnClaude on cold start MUST equal the
 *   activeTabId returned by useWorkbenchTabsContext(frame) — the id that
 *   TerminalShell binds its visible terminal to.
 *
 * A mismatch (spawned-id ≠ displayed-id) produces a blank terminal: the PTY
 * sends data to an id nobody is listening to, and the mounted terminal waits
 * forever for data on an id that was never spawned. This was the exact bug
 * introduced by the prior fix attempt (wip-autoresume-attempt branch).
 *
 * The test renders the REAL WorkbenchTabsProvider (not a mock) so the invariant
 * is asserted against production wiring. It covers:
 *   (a) True cold start — no restore, no cache.
 *   (b) Restored-collection cold start — a TabCollection is present from a
 *       prior session (no in-memory cache → the restored tab is spawned fresh).
 *
 * Additional assertions (policy contracts):
 *   - No resumeMode is ever passed to spawnClaude.
 *   - Exactly ONE CC spawn fires per pane on cold start.
 *
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { TabCollection } from '../../../types/electron';
import { useWorkbenchTabsContext, WorkbenchTabsProvider } from './WorkbenchTabsProvider';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoots: ['/proj/A'],
    projectRoot: '/proj/A',
    projectName: 'A',
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
    config: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

function ptySpawnClaude(): Mock {
  return (window as unknown as { electronAPI: { pty: { spawnClaude: Mock } } }).electronAPI.pty.spawnClaude;
}

function makeWrapper(projectRoot: string) {
  return function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(WorkbenchTabsProvider, { projectRoot }, children);
  };
}

beforeEach(() => {
  installElectronAPI();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WorkbenchTabsProvider — cold-start id-match invariant (blank-screen regression)', () => {
  it('(a) true cold start: spawned id === activeTabId displayed by useWorkbenchTabsContext', async () => {
    // No restore, no cache — pure cold start.
    const { useWorkbenchRestore } = await import('./useWorkbenchRestore');
    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: undefined,
      lowerCollection: undefined,
    });

    const wrapper = makeWrapper('/proj/A');
    const { result } = renderHook(() => useWorkbenchTabsContext('upper'), { wrapper });

    // Wait for the spawn effect to fire.
    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [spawnedId, opts] = ptySpawnClaude().mock.calls[0] as [string, Record<string, unknown>];

    // Invariant: the id passed to spawnClaude is the same id the context exposes as active.
    expect(spawnedId).toBe(result.current.activeTabId);

    // Policy: no resumeMode ever on cold start.
    expect(opts.resumeMode).toBeUndefined();

    // Policy: exactly one CC spawn.
    expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
  });

  it('(b) restored-collection cold start: spawned id === activeTabId from restored collection', async () => {
    // Simulate a prior session having persisted a CC tab.
    const { useWorkbenchRestore } = await import('./useWorkbenchRestore');
    const restoredTabId = 'tab-prior-session-cc';
    const restoredCollection: TabCollection = {
      activeTabId: restoredTabId,
      tabs: [
        {
          id: restoredTabId,
          label: 'claude',
          sessionId: 'sess-prior-123',
          kind: 'cc',
          createdAt: 1716000000000,
        },
      ],
    };

    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: restoredCollection,
      lowerCollection: { activeTabId: null, tabs: [] },
    });

    const wrapper = makeWrapper('/proj/A');
    const { result } = renderHook(() => useWorkbenchTabsContext('upper'), { wrapper });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [spawnedId, opts] = ptySpawnClaude().mock.calls[0] as [string, Record<string, unknown>];

    // Invariant: spawned id === the restored tab's id (which the context exposes as active).
    expect(spawnedId).toBe(restoredTabId);
    expect(result.current.activeTabId).toBe(restoredTabId);

    // Policy: no resumeMode ever — always fresh.
    expect(opts.resumeMode).toBeUndefined();

    // Policy: exactly one CC spawn.
    expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
  });
});
