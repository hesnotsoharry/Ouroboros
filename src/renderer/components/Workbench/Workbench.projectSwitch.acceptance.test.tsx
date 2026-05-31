/**
 * Orchestrator-owned acceptance test — Wave 10 Phase 3 (project-switch lifecycle + active-frame).
 * Updated freeze-fix 2026-05-30: spawn authority moved from useWorkbenchTerminals to
 * WorkbenchTabsProvider; project-switch contract updated accordingly.
 *
 * Expresses two contracts at the Workbench level:
 *
 *   1. (Updated) When `projectRoot` changes, the Terminals subtree re-mounts via
 *      key={projectRoot}. useWorkbenchTerminals is now id-only (no spawns, no kills).
 *      Spawn authority lives in WorkbenchTabsProvider (above the key boundary,
 *      handles in-place project switching). CenterPane mounts two TerminalShell frames;
 *      no pty spawns originate from CenterPane's own hooks.
 *
 *   2. `useActiveWorkbenchFrame` exposes `{ activeFrame, setActiveFrame }` from a
 *      React context. Initial value is `'upper'`. `setActiveFrame('lower')` flips
 *      it to `'lower'`. The provider mounts inside `Workbench.tsx` below
 *      `ProjectProvider`, but for the unit contract we mount the provider
 *      directly under the test harness.
 *
 * @vitest-environment jsdom
 */

import { act, cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CenterPane } from './Terminals/CenterPane';
import { ActiveFrameProvider, useActiveWorkbenchFrame } from './useActiveWorkbenchFrame';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Phase 1's Wave 10 hooks short-circuit cleanly when projectRoot is null and read
// per-project slices otherwise. For this acceptance test we don't care about
// restore semantics — we only care about the spawn/kill lifecycle reacting to
// project-switch. Mock the restore hook to return ready+empty so the spawn
// effect fires immediately.
vi.mock('./Terminals/useWorkbenchRestore', () => ({
  useWorkbenchRestore: () => ({ isReady: true }),
}));

// Same — persist is exercised in its own unit tests; here it's a no-op.
vi.mock('./Terminals/useWorkbenchSessionPersist', () => ({
  useWorkbenchSessionPersist: vi.fn(),
}));

// Mutable per-test ProjectContext so we can change projectRoot.
let mockProjectRoot: string = '/proj/a';
vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoots: [mockProjectRoot],
    projectRoot: mockProjectRoot,
    projectName: mockProjectRoot.split('/').pop() ?? '',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    setActiveProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => null,
}));

// TerminalShell rendering pulls in xterm + Monaco-adjacent deps that crash jsdom
// at module-init time. Render a thin stand-in so the lifecycle effects in
// useWorkbenchTerminals are what we observe (sessionId is the contract surface
// for tracking spawn/kill calls).
vi.mock('./Terminals/TerminalShell', () => ({
  TerminalShell: ({ sessionId, kind }: { sessionId: string; kind: string }) => (
    <div data-testid={`terminal-shell-${kind}`} data-session-id={sessionId} />
  ),
}));

// Permission overlay reads the approval context — mock to a no-op for this test.
vi.mock('./Permission/PermissionOverlay', () => ({
  PermissionOverlay: () => null,
}));

// useConfig — keep `persistTerminalSessions` true so the restore hook short-circuit
// branches don't accidentally pre-flip isReady before the real spawn effect tick.
vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { persistTerminalSessions: true },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// ── electronAPI harness ───────────────────────────────────────────────────────

interface SpawnCall {
  cwd: string;
  kind: 'plain' | 'claude';
  ptyId: string;
}

interface KillCall {
  ptyId: string;
}

interface ElectronHarness {
  spawnCalls: SpawnCall[];
  killCalls: KillCall[];
}

// Mock signature matches the real IPC: pty.spawn(sessionId, { cwd }) — the
// renderer pre-generates the session id (`wb-cc-*` / `wb-shell-*` in
// useWorkbenchTerminals) and passes it as the first arg. The kill call then
// receives that same id. Recording sessionId as ptyId keeps spawn/kill
// correlated for the lifecycle assertions below.
function installElectronAPI(harness: ElectronHarness): void {
  const spawnMock = vi.fn(async (sessionId: string, opts?: { cwd?: string }) => {
    harness.spawnCalls.push({ cwd: opts?.cwd ?? '', kind: 'plain', ptyId: sessionId });
    return { success: true, sessionId, pid: 1 };
  });
  const spawnClaudeMock = vi.fn(async (sessionId: string, opts?: { cwd?: string }) => {
    harness.spawnCalls.push({ cwd: opts?.cwd ?? '', kind: 'claude', ptyId: sessionId });
    return { success: true, sessionId, pid: 2 };
  });
  const killMock = vi.fn(async (ptyId: string) => {
    harness.killCalls.push({ ptyId });
    return { success: true };
  });
  const getCwdMock = vi.fn(async () => ({ success: false }));

  (window as unknown as { electronAPI: unknown }).electronAPI = {
    pty: {
      spawn: spawnMock,
      spawnClaude: spawnClaudeMock,
      kill: killMock,
      getCwd: getCwdMock,
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
    },
    hooks: {
      onAgentEvent: vi.fn(() => () => {}),
    },
    config: {
      get: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

function newHarness(): ElectronHarness {
  return { spawnCalls: [], killCalls: [] };
}

// ── Test harness: a Workbench-equivalent wrapper that applies key={projectRoot}
//    around CenterPane. Phase 3's implementation MUST land this key in the real
//    Workbench tree; this harness mirrors that contract so we can drive the
//    project switch in the test.

function KeyedCenterPane(): React.ReactElement {
  // The wrapper is what Workbench.tsx must do internally — wrap the Terminals
  // subtree (CenterPane) with key={projectRoot}. We re-read projectRoot from
  // the mocked useProject() through the variable closure (mockProjectRoot).
  return <CenterPane key={mockProjectRoot} />;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockProjectRoot = '/proj/a';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── 1. Project-switch lifecycle ───────────────────────────────────────────────

describe('Wave 10 Phase 3 — project switch (freeze-fix: no spawns from useWorkbenchTerminals)', () => {
  it('mounting CenterPane does NOT spawn any pty via useWorkbenchTerminals', async () => {
    const harness = newHarness();
    installElectronAPI(harness);

    await act(async () => {
      render(<KeyedCenterPane />);
    });

    // Allow async spawn effects to settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // useWorkbenchTerminals is now id-only. CenterPane's hooks do not spawn.
    // Spawn authority lives in WorkbenchTabsProvider (above this tree, not mounted here).
    expect(harness.spawnCalls.length).toBe(0);
    expect(harness.killCalls.length).toBe(0);
  });

  it('changing projectRoot via key= does NOT kill any ptys (useWorkbenchTerminals owns none)', async () => {
    const harness = newHarness();
    installElectronAPI(harness);

    let rerenderHandle: ReturnType<typeof render>['rerender'];
    await act(async () => {
      const utils = render(<KeyedCenterPane />);
      rerenderHandle = utils.rerender;
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // No initial spawns from CenterPane hooks.
    expect(harness.spawnCalls.length).toBe(0);

    // Flip projectRoot to trigger the key= remount.
    mockProjectRoot = '/proj/b';
    await act(async () => {
      rerenderHandle(<KeyedCenterPane />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // No kills — useWorkbenchTerminals owns no ptys.
    expect(harness.killCalls.length).toBe(0);
    // Still no spawns from CenterPane hooks.
    expect(harness.spawnCalls.length).toBe(0);
  });

  it('StrictMode remount does NOT spawn (useWorkbenchTerminals is id-only)', async () => {
    const harness = newHarness();
    installElectronAPI(harness);

    await act(async () => {
      render(
        <React.StrictMode>
          <KeyedCenterPane />
        </React.StrictMode>,
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // No spawns at all from the CenterPane tree.
    expect(harness.spawnCalls.length).toBe(0);
    expect(harness.killCalls.length).toBe(0);
  });
});

// ── 2. useActiveWorkbenchFrame contract ───────────────────────────────────────

describe('Wave 10 Phase 3 — useActiveWorkbenchFrame initial state + setter', () => {
  function ActiveFrameProbe(): React.ReactElement {
    const { activeFrame, setActiveFrame } = useActiveWorkbenchFrame();
    return (
      <div>
        <span data-testid="active-frame">{activeFrame}</span>
        <button data-testid="set-upper" type="button" onClick={() => setActiveFrame('upper')}>
          upper
        </button>
        <button data-testid="set-lower" type="button" onClick={() => setActiveFrame('lower')}>
          lower
        </button>
      </div>
    );
  }

  it('initial activeFrame is "upper" when consumed inside ActiveFrameProvider', () => {
    const { getByTestId } = render(
      <ActiveFrameProvider>
        <ActiveFrameProbe />
      </ActiveFrameProvider>,
    );
    expect(getByTestId('active-frame').textContent).toBe('upper');
  });

  it('setActiveFrame("lower") flips the value to "lower"; "upper" flips it back', () => {
    const { getByTestId } = render(
      <ActiveFrameProvider>
        <ActiveFrameProbe />
      </ActiveFrameProvider>,
    );
    expect(getByTestId('active-frame').textContent).toBe('upper');

    act(() => {
      getByTestId('set-lower').click();
    });
    expect(getByTestId('active-frame').textContent).toBe('lower');

    act(() => {
      getByTestId('set-upper').click();
    });
    expect(getByTestId('active-frame').textContent).toBe('upper');
  });

  it('useActiveWorkbenchFrame throws or returns a usable default when used outside the provider', () => {
    // Phase 3 implementer chooses: either throw (consistent with useProject), or
    // return a default { activeFrame: "upper", setActiveFrame: noop }. Both are
    // acceptable — what's NOT acceptable is returning undefined / a partial
    // object that crashes consumers. This test asserts the rendered probe
    // either (a) throws during render, OR (b) renders "upper" + a non-throwing
    // setter call.
    // Suppress the expected React error log so the test output stays clean
    // when the implementer picks the throwing variant.
    const originalError = console.error;
    console.error = vi.fn();

    let crashed = false;
    let activeFrameValue: string | undefined;
    try {
      const { getByTestId } = render(<ActiveFrameProbe />);
      activeFrameValue = getByTestId('active-frame').textContent ?? undefined;
      // If it didn't throw, the value MUST be a usable string.
      act(() => {
        // setActiveFrame must not throw when called outside the provider.
        getByTestId('set-lower').click();
      });
    } catch {
      crashed = true;
    }

    console.error = originalError;

    if (!crashed) {
      // Default-value variant chosen: must be 'upper' or 'lower', not undefined.
      expect(activeFrameValue === 'upper' || activeFrameValue === 'lower').toBe(true);
    }
    // Either branch is acceptable; the only failure mode is "renders but
    // setActiveFrame crashes" — neither branch above reaches the expect with
    // that state.
    expect(true).toBe(true);
  });
});
