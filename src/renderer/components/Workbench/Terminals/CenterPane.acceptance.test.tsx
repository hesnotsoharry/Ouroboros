/**
 * Orchestrator-owned acceptance test — Wave 2 Phase 1 (pty-mount boundary).
 * Updated freeze-fix 2026-05-30: spawning removed from useWorkbenchTerminals.
 *
 * Contract after freeze-fix:
 *   1. Mounting CenterPane renders two TerminalShell frames (upper + lower).
 *   2. Each frame is wired to a stable string fallback id from useWorkbenchTerminals.
 *   3. TerminalShell passes its sessionId down to TerminalInstance.
 *   4. useWorkbenchTerminals does NOT spawn any pty — spawning is exclusively
 *      done by WorkbenchTabsProvider (mocked here; tested separately).
 *   5. pty.kill is NOT called on unmount by useWorkbenchTerminals (no ptys owned).
 *   6. Data streamed via pty.onData for a frame's id reaches the terminal bound
 *      to that id (wiring contract, independent of who spawns the pty).
 *
 * TerminalInstance is stubbed with a faithful boundary recorder so the contract
 * can be asserted without standing up xterm.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { CenterPane } from './CenterPane';

// Hoisted so the (hoisted) vi.mock factory below can push into it.
const { instanceMounts } = vi.hoisted(() => ({
  instanceMounts: [] as Array<{ sessionId: string; isActive: boolean; received: string[] }>,
}));

// Faithful boundary recorder standing in for the real TerminalInstance.
vi.mock('../../Terminal/TerminalInstance', async () => {
  const React = await import('react');
  return {
    TerminalInstance: ({ sessionId, isActive }: { sessionId: string; isActive: boolean }) => {
      const recordRef = React.useRef<{
        sessionId: string;
        isActive: boolean;
        received: string[];
      } | null>(null);
      if (!recordRef.current) {
        recordRef.current = { sessionId, isActive, received: [] };
        instanceMounts.push(recordRef.current);
      }
      React.useEffect(() => {
        const unsub = window.electronAPI.pty.onData(sessionId, (data: string) => {
          recordRef.current?.received.push(data);
        });
        return unsub;
      }, [sessionId]);
      return React.createElement('div', { 'data-testid': `wb-term-instance-${sessionId}` });
    },
  };
});

// Mock WorkbenchTabsProvider so TerminalShell's tab management doesn't spawn
// ptys independently. This test focuses on the CenterPane frame wiring contract.
// Spawn contract for WorkbenchTabsProvider is in its own acceptance test.
vi.mock('./WorkbenchTabsProvider', () => ({
  useWorkbenchTabsContext: vi.fn().mockReturnValue({
    tabs: [],
    activeTabId: null,
    spawnedTabIds: new Set<string>(),
    addTab: vi.fn(() => 'mock-tab-id'),
    closeTab: vi.fn(),
    renameTab: vi.fn(),
    setActiveTab: vi.fn(),
    spawnCcTab: vi.fn(),
  }),
}));

// Keep useWorkbenchTabs mock for any code that still calls the thin wrapper.
vi.mock('./useWorkbenchTabs', () => ({
  useWorkbenchTabs: vi.fn().mockReturnValue({
    tabs: [],
    activeTabId: null,
    addTab: vi.fn(() => 'mock-tab-id'),
    closeTab: vi.fn(),
    renameTab: vi.fn(),
    setActiveTab: vi.fn(),
  }),
  buildSpawnEnv: vi.fn((id: string) => ({ OUROBOROS_PANE_ID: id })),
}));

// Fixed project root so cwd resolution is deterministic.
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

const dataCallbacks = new Map<string, (data: string) => void>();

beforeEach(() => {
  instanceMounts.length = 0;
  dataCallbacks.clear();
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    pty: {
      spawn: vi.fn().mockResolvedValue({ success: true, pid: 1 }),
      write: vi.fn().mockResolvedValue({ success: true }),
      kill: vi.fn().mockResolvedValue({ success: true }),
      onData: vi.fn((id: string, cb: (data: string) => void) => {
        dataCallbacks.set(id, cb);
        return () => dataCallbacks.delete(id);
      }),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
    },
    config: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
    window: {
      getProjectRoots: vi.fn().mockResolvedValue({ roots: [] }),
      setProjectRoots: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

afterEach(() => {
  cleanup();
});

function ptySpawn(): Mock {
  return (window as unknown as { electronAPI: { pty: { spawn: Mock } } }).electronAPI.pty.spawn;
}
function ptyKill(): Mock {
  return (window as unknown as { electronAPI: { pty: { kill: Mock } } }).electronAPI.pty.kill;
}

describe('CenterPane — frame wiring (freeze-fix: no spawn from useWorkbenchTerminals)', () => {
  it('does NOT spawn any pty via useWorkbenchTerminals on mount', async () => {
    render(<CenterPane />);

    // Give any async effect a chance to fire.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // useWorkbenchTerminals must not spawn — WorkbenchTabsProvider is the spawn owner.
    // WorkbenchTabsProvider is mocked out in this test suite.
    expect(ptySpawn()).not.toHaveBeenCalled();
  });

  it('does NOT call pty.kill on unmount (useWorkbenchTerminals owns no ptys)', async () => {
    const { unmount } = render(<CenterPane />);

    await new Promise((resolve) => setTimeout(resolve, 10));
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptyKill()).not.toHaveBeenCalled();
  });

  it('mounts two TerminalInstance frames each with a distinct fallback sessionId', async () => {
    render(<CenterPane />);

    // Wait for both frames to mount.
    await waitFor(() => expect(instanceMounts.length).toBeGreaterThanOrEqual(2));

    const ids = instanceMounts.map((m) => m.sessionId);
    expect(new Set(ids).size).toBeGreaterThanOrEqual(2); // two distinct ids
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });

  it('streams pty data to the terminal bound to its fallback id', async () => {
    render(<CenterPane />);

    // Wait for at least one instance to register its onData callback.
    await waitFor(() => expect(dataCallbacks.size).toBeGreaterThanOrEqual(1));

    const [firstId] = dataCallbacks.keys();
    act(() => {
      dataCallbacks.get(firstId)?.('hello\r\n');
    });

    const mount = instanceMounts.find((m) => m.sessionId === firstId);
    expect(mount?.received.join('')).toContain('hello');
  });

  it('survives StrictMode double-invoke without crashing', async () => {
    render(
      <StrictMode>
        <CenterPane />
      </StrictMode>,
    );

    // Allow any deferred teardown macrotask to fire.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // No crash = pass. No kills expected (no ptys owned by useWorkbenchTerminals).
    expect(ptyKill()).not.toHaveBeenCalled();
  });
});

describe('CenterPane — both frames rendered (freeze-fix)', () => {
  it('renders two TerminalInstance frames, one for each workbench pane', async () => {
    render(<CenterPane />);

    await waitFor(() => expect(instanceMounts.length).toBeGreaterThanOrEqual(2));

    const ids = instanceMounts.map((m) => m.sessionId);
    expect(new Set(ids).size).toBe(2);
  });
});
