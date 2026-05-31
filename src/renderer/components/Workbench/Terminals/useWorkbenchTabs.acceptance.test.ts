/**
 * Orchestrator-owned acceptance test — Wave 12 Phase 3 (per-project tab state machine).
 *
 * Expresses the contract for `useWorkbenchTabs(frame, projectRoot)`:
 *   - addTab: appends a new TabState, makes it active, returns the new id
 *   - setActiveTab: updates activeTabId
 *   - renameTab: updates label in-place
 *   - closeTab: removes the tab, kills the pty, falls back activeTabId
 *   - Per-project isolation: different projectRoot → separate tab collections
 *   - Wave-9 regression: CC tab with a resumeSessionId auto-resumes via spawnClaude
 *   - Persistence round-trip: persisted state is restored on remount
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 3
 * implementer implements `useWorkbenchTabs` against THIS test and MAY NOT
 * modify it. The test is RED at Phase 3 dispatch; it goes green only when the
 * full tab state machine + persistence wiring lands.
 *
 * The lock-step contracts:
 *   - addTab({kind:'shell'}) on an empty upper frame returns a non-empty string id
 *     AND tabs[0].id === returned id AND activeTabId === returned id
 *   - setActiveTab(firstId) when secondId is active → activeTabId === firstId
 *   - renameTab(id, 'build') → tabs[0].label === 'build'
 *   - closeTab(activeId) of 2 tabs → tab gone + pty.kill called with closedId +
 *     activeTabId falls back to the remaining tab
 *   - Switching projectRoot resets/isolates tabs (no cross-project leak)
 *   - CC tab with resumeSessionId → pty.spawnClaude called with resumeMode
 *   - Tabs written to persist storage survive unmount+remount with same projectRoot
 *
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// The hook does not exist yet — this static import will cause test file failures
// (RED) until Phase 3 ships `useWorkbenchTabs.ts` at this path. This is the
// correct RED signal: "Cannot find module" at import time, not at runtime.
import { useWorkbenchTabs } from './useWorkbenchTabs';
import { WorkbenchTabsProvider } from './WorkbenchTabsProvider';

// ── Types (matches the Phase 3 contract shape) ────────────────────────────────

export interface TabState {
  id: string;
  label: string;
  sessionId: string;
  kind: 'cc' | 'shell';
  createdAt: number;
}

export interface TabCollection {
  activeTabId: string | null;
  tabs: TabState[];
}

export interface UseWorkbenchTabsResult {
  tabs: TabState[];
  activeTabId: string | null;
  addTab(opts: { kind?: 'cc' | 'shell' }): string;
  closeTab(id: string): void;
  renameTab(id: string, label: string): void;
  setActiveTab(id: string): void;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./useWorkbenchRestore', () => ({
  useWorkbenchRestore: vi.fn().mockReturnValue({
    isReady: true,
    upperCollection: { activeTabId: null, tabs: [] },
    lowerCollection: { activeTabId: null, tabs: [] },
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
    hooks: {
      onAgentEvent: vi.fn(() => () => {}),
    },
    config: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

function ptyKill(): Mock {
  return window.electronAPI.pty.kill as unknown as Mock;
}
function ptySpawnClaude(): Mock {
  return window.electronAPI.pty.spawnClaude as unknown as Mock;
}

/** Wraps renderHook children in WorkbenchTabsProvider for the given projectRoot. */
function makeWrapper(projectRoot: string): ({ children }: { children: React.ReactNode }) => React.ReactElement {
  return function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(WorkbenchTabsProvider, { projectRoot }, children);
  };
}

const wrapperA = makeWrapper('/proj/A');
const wrapperB = makeWrapper('/proj/B');

beforeEach(() => {
  installElectronAPI();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWorkbenchTabs — addTab (Wave 12 Phase 3)', () => {
  it('addTab returns id that appears in tabs and becomes activeTabId', async () => {
    const { result } = renderHook(() => useWorkbenchTabs('upper', '/proj/A'), {
      wrapper: wrapperA,
    });

    let returnedId!: string;
    act(() => {
      returnedId = result.current.addTab({ kind: 'shell' });
    });

    await waitFor(() => {
      expect(result.current.tabs.length).toBeGreaterThanOrEqual(1);
    });

    const added = result.current.tabs.find((t) => t.id === returnedId);
    expect(added).toBeDefined();
    expect(added!.kind).toBe('shell');
    expect(result.current.activeTabId).toBe(returnedId);
  });
});

describe('useWorkbenchTabs — setActiveTab (Wave 12 Phase 3)', () => {
  it('setActiveTab(firstId) switches activeTabId away from secondId', async () => {
    const { result } = renderHook(() => useWorkbenchTabs('upper', '/proj/A'), {
      wrapper: wrapperA,
    });

    let firstId!: string;
    let secondId!: string;
    act(() => {
      firstId = result.current.addTab({ kind: 'shell' });
      secondId = result.current.addTab({ kind: 'shell' });
    });

    // After two adds the second becomes active.
    await waitFor(() => {
      expect(result.current.activeTabId).toBe(secondId);
    });

    act(() => {
      result.current.setActiveTab(firstId);
    });

    await waitFor(() => {
      expect(result.current.activeTabId).toBe(firstId);
    });
  });
});

describe('useWorkbenchTabs — renameTab (Wave 12 Phase 3)', () => {
  it('renameTab updates the label in the tabs array', async () => {
    const { result } = renderHook(() => useWorkbenchTabs('upper', '/proj/A'), {
      wrapper: wrapperA,
    });

    let tabId!: string;
    act(() => {
      tabId = result.current.addTab({ kind: 'shell' });
    });

    await waitFor(() => {
      expect(result.current.tabs.find((t) => t.id === tabId)).toBeDefined();
    });

    act(() => {
      result.current.renameTab(tabId, 'build');
    });

    await waitFor(() => {
      const tab = result.current.tabs.find((t) => t.id === tabId);
      expect(tab?.label).toBe('build');
    });
  });
});

describe('useWorkbenchTabs — closeTab (Wave 12 Phase 3)', () => {
  // NOTE (Wave 13 Phase 2): useWorkbenchTabs now initialises with one default
  // tab in useState (gives AgentSidebar a stable pane-id before isReady fires).
  // Tests that assert exact tab counts account for this +1 default tab by
  // capturing the initial tab set before calling addTab.

  it('closeTab removes tab, kills pty, and falls back activeTabId to remaining tab', async () => {
    const { result } = renderHook(() => useWorkbenchTabs('upper', '/proj/A'), {
      wrapper: wrapperA,
    });

    // Capture the initial default tab so we know the pre-existing count.
    const initialTabCount = result.current.tabs.length; // 1 (default tab from Wave 13)

    let firstId!: string;
    let secondId!: string;
    act(() => {
      firstId = result.current.addTab({ kind: 'shell' });
      secondId = result.current.addTab({ kind: 'shell' });
    });

    // After 2 addTabs: initial + 2 tabs; secondId is active (addTab activates each new tab).
    await waitFor(() => {
      expect(result.current.tabs.length).toBe(initialTabCount + 2);
      expect(result.current.activeTabId).toBe(secondId);
    });

    act(() => {
      result.current.closeTab(secondId);
    });

    await waitFor(() => {
      // (a) tab is gone
      expect(result.current.tabs.find((t) => t.id === secondId)).toBeUndefined();
      // (b) pty.kill was called with the closed tab's id
      expect(ptyKill()).toHaveBeenCalledWith(secondId);
      // (c) activeTabId falls back to the remaining tab (firstId, the most-recently-added)
      expect(result.current.activeTabId).toBe(firstId);
    });
  });

  it('closeTab sets activeTabId to null when all tabs are closed', async () => {
    const { result } = renderHook(() => useWorkbenchTabs('upper', '/proj/A'), {
      wrapper: wrapperA,
    });

    // Capture all pre-existing tab ids (the default tab from Wave 13 Phase 2).
    const initialIds = result.current.tabs.map((t) => t.id);

    let addedId!: string;
    act(() => {
      addedId = result.current.addTab({ kind: 'shell' });
    });

    await waitFor(() => {
      expect(result.current.tabs.find((t) => t.id === addedId)).toBeDefined();
    });

    // Close all tabs (added tab first, then any pre-existing ones).
    act(() => {
      result.current.closeTab(addedId);
      for (const id of initialIds) {
        result.current.closeTab(id);
      }
    });

    await waitFor(() => {
      expect(result.current.tabs.length).toBe(0);
      expect(result.current.activeTabId).toBeNull();
    });
  });
});

describe('useWorkbenchTabs — per-project isolation (Wave 12 Phase 3)', () => {
  it('tabs added under projectRoot /A are NOT visible when rendering with projectRoot /B', async () => {
    // Render for project A
    const { result: resultA, unmount: unmountA } = renderHook(
      () => useWorkbenchTabs('upper', '/proj/A'),
      { wrapper: wrapperA },
    );

    act(() => {
      resultA.current.addTab({ kind: 'shell' });
    });

    await waitFor(() => {
      expect(resultA.current.tabs.length).toBeGreaterThanOrEqual(1);
    });
    unmountA();

    // Render fresh for project B (separate hook invocation, no restore from A)
    const { result: resultB } = renderHook(() => useWorkbenchTabs('upper', '/proj/B'), {
      wrapper: wrapperB,
    });

    // Give any async restore a chance to settle
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Project B must not contain any of project A's tab ids
    const aTabIds = new Set(resultA.current.tabs.map((t) => t.id));
    for (const bTab of resultB.current.tabs) {
      expect(aTabIds.has(bTab.id)).toBe(false);
    }
  });
});

describe('useWorkbenchTabs — restored CC tab spawns FRESH (no resume) on cold start', () => {
  it('CC tab that is active on mount triggers spawnClaude with NO resumeMode', async () => {
    // Arrange: inject a restore that surfaces a Wave-12 TabCollection with one
    // active CC tab. Cold-start policy: always spawn fresh — never resume a
    // stale session (the old session id is meaningless after restart).
    const { useWorkbenchRestore } = await import('./useWorkbenchRestore');
    const restoredTabId = 'tab-restored-cc';
    const restoredSessionId = 'sess-resume-123';

    const restoredUpperCollection: TabCollection = {
      activeTabId: restoredTabId,
      tabs: [
        {
          id: restoredTabId,
          label: 'claude',
          sessionId: restoredSessionId,
          kind: 'cc',
          createdAt: 1716000000000,
        },
      ],
    };

    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: restoredUpperCollection,
      lowerCollection: { activeTabId: null, tabs: [] },
    });

    renderHook(() => useWorkbenchTabs('upper', '/proj/A'), { wrapper: wrapperA });

    await waitFor(() => {
      expect(ptySpawnClaude()).toHaveBeenCalledTimes(1);
    });

    const [spawnedId, opts] = ptySpawnClaude().mock.calls[0] as [string, Record<string, unknown>];
    // Must be a fresh spawn — no resumeMode ever.
    expect(opts.resumeMode).toBeUndefined();
    // Spawned id must be the tab id from the restored collection (the displayed id).
    expect(spawnedId).toBe(restoredTabId);
  });
});

describe('useWorkbenchTabs — persistence round-trip (Wave 12 Phase 3)', () => {
  it('tab added in session N is present after remount with restored state from session N', async () => {
    const { useWorkbenchSessionPersist } = await import('./useWorkbenchSessionPersist');
    const { useWorkbenchRestore } = await import('./useWorkbenchRestore');

    // Capture what the hook writes to persistence.
    let capturedWrite: TabCollection | undefined;
    (useWorkbenchSessionPersist as Mock).mockImplementation(
      (args: { frame?: string; projectRoot?: string; tabCollection?: TabCollection }) => {
        if (args.frame === 'upper' && args.projectRoot === '/proj/A' && args.tabCollection) {
          capturedWrite = args.tabCollection;
        }
      },
    );

    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: { activeTabId: null, tabs: [] },
      lowerCollection: { activeTabId: null, tabs: [] },
    });

    const { result, unmount } = renderHook(() => useWorkbenchTabs('upper', '/proj/A'), {
      wrapper: wrapperA,
    });

    let savedTabId!: string;
    act(() => {
      savedTabId = result.current.addTab({ kind: 'shell' });
    });

    // Wait for the persistence effect to flush the write.
    await waitFor(() => {
      expect(capturedWrite).toBeDefined();
      expect(capturedWrite!.tabs.find((t) => t.id === savedTabId)).toBeDefined();
    });

    unmount();

    // Session N+1: restore from what was persisted.
    (useWorkbenchRestore as Mock).mockReturnValue({
      isReady: true,
      upperCollection: capturedWrite,
      lowerCollection: { activeTabId: null, tabs: [] },
    });

    const { result: result2 } = renderHook(() => useWorkbenchTabs('upper', '/proj/A'), {
      wrapper: wrapperA,
    });

    await waitFor(() => {
      expect(result2.current.tabs.find((t) => t.id === savedTabId)).toBeDefined();
    });
  });
});
