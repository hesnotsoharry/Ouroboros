/**
 * Orchestrator-owned acceptance test — freeze-fix (2026-05-30), updated Wave 101.
 *
 * Guards the cc-spawn gate contract:
 *   CC tabs must NOT auto-spawn on cold start (token-cost gate, Wave 101).
 *   The "Start Claude" button calls spawnCcTab(tabId) to start the PTY on demand.
 *
 * Id-match invariant (still applies for the user-triggered path):
 *   The tab id passed to pty.spawnClaude via spawnCcTab MUST equal the
 *   activeTabId returned by useWorkbenchTabsContext(frame).
 *
 * The test renders the REAL WorkbenchTabsProvider (not a mock) so the invariant
 * is asserted against production wiring. It covers:
 *   (a) True cold start — no restore, no cache → cc NOT spawned.
 *   (b) Restored-collection cold start → cc NOT spawned automatically.
 *   (c) spawnCcTab call → cc IS spawned with the correct tab id (no resumeMode).
 *   (d) spawnedTabIds is empty before spawnCcTab; has the id after.
 *
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
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

describe('WorkbenchTabsProvider — cc-spawn gate (Start Claude, Wave 101)', () => {
  it('(a) true cold start: cc tab is NOT spawned automatically', async () => {
    // No restore, no cache — pure cold start.
    const { useWorkbenchRestore } = await import('./useWorkbenchRestore');
    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: undefined,
      lowerCollection: undefined,
    });

    const wrapper = makeWrapper('/proj/A');
    const { result } = renderHook(() => useWorkbenchTabsContext('upper'), { wrapper });

    // Wait long enough for any deferred effect to fire.
    await new Promise((resolve) => setTimeout(resolve, 30));

    // cc must NOT auto-spawn — user must click "Start Claude".
    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    // The context still has a valid activeTabId and the tab is in spawnedTabIds=false.
    expect(result.current.activeTabId).toBeTruthy();
    expect(result.current.spawnedTabIds.has(result.current.activeTabId!)).toBe(false);
  });

  it('(b) restored-collection cold start: cc tab is NOT auto-spawned', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 30));

    // Still no auto-spawn for cc.
    expect(ptySpawnClaude()).not.toHaveBeenCalled();
    expect(result.current.activeTabId).toBe(restoredTabId);
    expect(result.current.spawnedTabIds.has(restoredTabId)).toBe(false);
  });

  it('(c) spawnCcTab call starts the PTY with the correct id and no resumeMode', async () => {
    // Simulates the "Start Claude" button onClick path.
    const { useWorkbenchRestore } = await import('./useWorkbenchRestore');
    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: undefined,
      lowerCollection: undefined,
    });

    const wrapper = makeWrapper('/proj/A');
    const { result } = renderHook(() => useWorkbenchTabsContext('upper'), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ptySpawnClaude()).not.toHaveBeenCalled();

    const tabId = result.current.activeTabId!;
    act(() => {
      result.current.spawnCcTab(tabId);
    });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [spawnedId, opts] = ptySpawnClaude().mock.calls[0] as [string, Record<string, unknown>];
    // Id-match invariant: spawned id === the activeTabId the context exposes.
    expect(spawnedId).toBe(tabId);
    // Policy: no resumeMode ever.
    expect(opts.resumeMode).toBeUndefined();

    // Idempotent: calling again does nothing.
    act(() => {
      result.current.spawnCcTab(tabId);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
  });

  it('(d) spawnedTabIds is empty before spawnCcTab and contains the id after', async () => {
    const { useWorkbenchRestore } = await import('./useWorkbenchRestore');
    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: undefined,
      lowerCollection: undefined,
    });

    const wrapper = makeWrapper('/proj/A');
    const { result } = renderHook(() => useWorkbenchTabsContext('upper'), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const tabId = result.current.activeTabId!;
    expect(result.current.spawnedTabIds.has(tabId)).toBe(false);

    act(() => {
      result.current.spawnCcTab(tabId);
    });

    await waitFor(() => {
      expect(result.current.spawnedTabIds.has(tabId)).toBe(true);
    });
  });
});
