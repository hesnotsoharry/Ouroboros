/**
 * Orchestrator-owned acceptance test — Wave 2 Phase 1 (pty-mount boundary).
 *
 * Expresses the workbench terminal-mount contract from the CONSUMER's
 * perspective. The implementer implements `useWorkbenchTerminals` + the
 * TerminalShell→TerminalInstance wiring against THIS test and MAY NOT modify it.
 * (Orchestrator-owned acceptance test, per
 * ~/.claude/rules/orchestrator-owned-acceptance-tests.md.)
 *
 * Phase 1 contract (upper frame goes live):
 *   1. Mounting CenterPane spawns a workbench-owned pty (fresh string id).
 *   2. The spawned id is wired through as the mounted terminal's `sessionId`.
 *   3. Bytes streamed via `pty.onData` for that id reach the terminal bound to it.
 *   4. Unmounting CenterPane kills the pty (no session leak).
 *
 * The real `TerminalInstance` is stubbed with a faithful boundary recorder: on
 * mount it registers `pty.onData(sessionId)` exactly as the real component does
 * and records the bytes it receives — so the contract can be asserted without
 * standing up xterm. Phase 2 extends this additively to the lower frame
 * (orchestrator-owned; assertions may tighten, never loosen).
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
  return window.electronAPI.pty.spawn as unknown as Mock;
}
function ptyKill(): Mock {
  return window.electronAPI.pty.kill as unknown as Mock;
}
function firstSpawnedId(): string {
  return ptySpawn().mock.calls[0][0] as string;
}

describe('Wave 2 — workbench terminal mount (Phase 1 acceptance)', () => {
  it('spawns a workbench pty with a fresh string id and wires it to the upper terminal', async () => {
    render(<CenterPane />);
    await waitFor(() => expect(ptySpawn()).toHaveBeenCalled());

    const spawnedId = firstSpawnedId();
    expect(typeof spawnedId).toBe('string');
    expect(spawnedId.length).toBeGreaterThan(0);

    await waitFor(() => expect(instanceMounts.some((m) => m.sessionId === spawnedId)).toBe(true));
  });

  it('streams pty data to the terminal bound to the spawned id', async () => {
    render(<CenterPane />);
    await waitFor(() => expect(ptySpawn()).toHaveBeenCalled());
    const spawnedId = firstSpawnedId();

    await waitFor(() => expect(dataCallbacks.has(spawnedId)).toBe(true));
    act(() => {
      dataCallbacks.get(spawnedId)?.('hello\r\n');
    });

    const mount = instanceMounts.find((m) => m.sessionId === spawnedId);
    expect(mount?.received.join('')).toContain('hello');
  });

  it('kills the workbench pty on unmount (no session leak)', async () => {
    const { unmount } = render(<CenterPane />);
    await waitFor(() => expect(ptySpawn()).toHaveBeenCalled());
    const spawnedId = firstSpawnedId();

    unmount();
    await waitFor(() => expect(ptyKill()).toHaveBeenCalledWith(spawnedId));
  });

  // The app renders under <StrictMode> (src/renderer/index.tsx). StrictMode's
  // dev mount→cleanup→remount must NOT leave the upper terminal dead: the pty
  // stays alive across the double-invoke and is bound to the upper frame.
  it('survives StrictMode double-invoke — pty stays live, not net-killed', async () => {
    render(
      <StrictMode>
        <CenterPane />
      </StrictMode>,
    );
    await waitFor(() => expect(ptySpawn()).toHaveBeenCalled());
    const spawnedId = firstSpawnedId();

    // Let any deferred teardown macrotask fire; the remount should have cancelled it.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ptyKill()).not.toHaveBeenCalled();
    expect(instanceMounts.some((m) => m.sessionId === spawnedId)).toBe(true);
  });
});

// Phase 2 extended the contract: BOTH frames are live, each with its own pty.
describe('Wave 2 — both frames live (Phase 2 acceptance)', () => {
  function spawnedIds(): string[] {
    return ptySpawn().mock.calls.map((call) => call[0] as string);
  }

  it('spawns two distinct workbench ptys, one bound to each frame', async () => {
    render(<CenterPane />);
    await waitFor(() => expect(ptySpawn().mock.calls.length).toBeGreaterThanOrEqual(2));

    const ids = spawnedIds();
    expect(new Set(ids).size).toBe(2); // two distinct sessions

    await waitFor(() => {
      ids.forEach((id) => expect(instanceMounts.some((m) => m.sessionId === id)).toBe(true));
    });
  });

  it('kills both workbench ptys on unmount (no leak on either frame)', async () => {
    const { unmount } = render(<CenterPane />);
    await waitFor(() => expect(ptySpawn().mock.calls.length).toBeGreaterThanOrEqual(2));
    const ids = spawnedIds();

    unmount();
    await waitFor(() => {
      ids.forEach((id) => expect(ptyKill()).toHaveBeenCalledWith(id));
    });
  });
});
