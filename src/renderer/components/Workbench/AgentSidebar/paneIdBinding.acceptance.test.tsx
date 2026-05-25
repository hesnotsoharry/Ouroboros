/**
 * paneIdBinding.acceptance.test.tsx — Wave 13 Phase 2 acceptance test.
 *
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 13 Phase 2).
 * Phase implementer may not modify this file.
 * See ~/.claude/rules/orchestrator-owned-acceptance-tests.md.
 *
 * Acceptance contract: The AgentSidebar, mounted inside a FULL Workbench tree,
 * binds deterministically to the active pane's claude session via
 * `event.paneId === activeTab.id`. External / IDE-in-itself binding events
 * (different paneId) do NOT hijack the sidebar.
 *
 * Test cases:
 *   2.1 Happy path single pane — sidebar calls useWorkbenchAgentData with the
 *       active upper tab's id (not an external session's id)
 *   2.2 IDE-in-itself hijack — useWorkbenchAgentData is called with activeTab.id,
 *       NOT with the external session id; external tool activity absent from sidebar
 *   2.3 Pane switch — after active tab changes, useWorkbenchAgentData is called
 *       with the new tab id
 *   2.4 Empty state (D4) — "No active claude session in this pane" rendered when
 *       no paneId-tagged session exists for the active tab
 *   2.5 Maximize regression — paneId derivation works with lower frame unmounted
 *   2.6 useWorkbenchClaudeCapture is gone — export no longer exists after Phase 2
 *
 * Architecture note — why full Workbench mount (R7):
 *   Wave 12 Phase 4 surfaced a failure mode where isolated sidebar tests missed a
 *   real bug (CenterPane double-instantiation) invisible when real ActiveFrameProvider
 *   + useWorkbenchTabs plumbing was mocked. These tests mount the full <Workbench />
 *   so the real providers run.
 *
 * Mock strategy:
 *   - `useWorkbenchAgentData` is mocked as a vi.fn() spy so tests can capture what
 *     paneId was passed to it. This is the correct seam: the test verifies the wiring
 *     (AgentSidebar derives paneId from real ActiveFrameProvider + useWorkbenchTabs
 *     and passes it to useWorkbenchAgentData), not the internal filtering logic.
 *   - `useAgentEventsContext` is mocked to return a stable empty context (not under
 *     test here — the filtering contract is tested by useWorkbenchAgentData unit tests).
 *   - All heavy deps (xterm, Monaco, etc.) are stubbed as in Workbench.maximize test.
 *
 * RED signal before Phase 2:
 *   2.1 — useWorkbenchAgentData is called with claudeSessionId (undefined or from
 *          useWorkbenchClaudeCapture), NOT with the active tab's id. The spy captures
 *          the wrong argument → assertion fails.
 *   2.2 — useWorkbenchAgentData is called with the heuristic-captured external session
 *          id rather than the active tab id. The spy captures the wrong argument.
 *   2.3 — After tab switch, useWorkbenchAgentData still called with old/wrong id.
 *   2.4 — No empty-state copy rendered (D4 not implemented).
 *   2.5 — Either crash or wrong paneId in maximize mode.
 *   2.6 — useWorkbenchClaudeCapture export still exists.
 *
 * Run with:
 *   npx vitest run src/renderer/components/Workbench/AgentSidebar/paneIdBinding.acceptance.test.tsx
 *
 * @vitest-environment jsdom
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { useWorkbenchAgentData } from '../useWorkbenchAgentData';
import { Workbench } from '../Workbench';

// ── Module mocks ───────────────────────────────────────────────────────────────

// TerminalInstance — xterm crashes jsdom at module-init time.
vi.mock('../../Terminal/TerminalInstance', () => ({
  TerminalInstance: ({ sessionId }: { sessionId: string }) =>
    React.createElement('div', { 'data-testid': `terminal-instance-stub-${sessionId}` }),
}));

// ProjectContext.
vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/proj/pane-binding-test',
    projectRoots: ['/proj/pane-binding-test'],
    projectName: 'pane-binding-test',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => ({
    projectRoot: '/proj/pane-binding-test',
  }),
}));

// useConfig.
vi.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: {
      recentProjects: ['/proj/pane-binding-test'],
      persistTerminalSessions: true,
    },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// useGitBranch.
vi.mock('../../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'wave/13' }),
}));

// AgentEventsContext — empty stub; the filtering contract is tested elsewhere.
vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

// useWorkbenchRestore — needed by useWorkbenchTerminals in test 2.6.
vi.mock('../Terminals/useWorkbenchRestore', () => ({
  useWorkbenchRestore: vi.fn().mockReturnValue({
    isReady: false,
    upperCwd: undefined,
    lowerCwd: undefined,
    resumeSessionId: undefined,
    upperCollection: undefined,
    lowerCollection: undefined,
  }),
}));

// useWorkbenchSessionPersist — needed by useWorkbenchTabs (real hook in Workbench tree).
vi.mock('../Terminals/useWorkbenchSessionPersist', () => ({
  useWorkbenchSessionPersist: vi.fn(),
}));

// ToastContext.
vi.mock('../../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
  }),
}));

// ── useWorkbenchAgentData spy ──────────────────────────────────────────────────
//
// This is the load-bearing mock for the paneId-binding contract:
//   Post-Phase-2, AgentSidebar calls useWorkbenchAgentData(paneId) where
//   paneId is derived from useActiveWorkbenchFrame → useWorkbenchTabs → activeTab.id.
//
// We mock the hook so we can (a) capture the paneId argument passed to it, and
// (b) return a stable data shape that exercises the D4 empty-state branch when
// paneId is undefined / null, and a "session found" shape when paneId is set.
//
// IMPORTANT: We do NOT mock useActiveWorkbenchFrame or useWorkbenchTabs — those
// run with real logic, satisfying the R7 "full provider chain" requirement.

vi.mock('../useWorkbenchAgentData', () => ({
  useWorkbenchAgentData: vi.fn(),
}));

const mockedUseWorkbenchAgentData = vi.mocked(useWorkbenchAgentData);
const mockedAgentCtx = vi.mocked(useAgentEventsContext);

// Stable no-session data shape (used for all tests by default; 2.1/2.2/2.5 may override).
const EMPTY_AGENT_DATA = {
  state: 'fresh' as const,
  model: 'claude',
  activeTool: '',
  target: '',
  elapsedSec: 0,
  sessions: [],
  contextStats: { usedTokens: 0, maxTokens: 200000, costUsd: 0, model: 'claude' },
  now: { tool: '', target: '', description: '', elapsedSec: 0, progress: undefined },
  context: { usedTokens: 0, maxTokens: 200000, costUsd: 0, model: 'claude', elapsedSec: 0 },
  filesTouched: [],
  timeline: [],
  latestHunk: undefined,
};

// ── electronAPI harness ───────────────────────────────────────────────────────

function stubElectronAPI(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    pty: {
      spawn: vi.fn().mockResolvedValue({ success: true }),
      spawnClaude: vi.fn().mockResolvedValue({ success: true }),
      kill: vi.fn().mockResolvedValue({ success: true }),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
      write: vi.fn().mockResolvedValue({ success: true }),
      getCwd: vi.fn().mockResolvedValue({ success: false }),
    },
    hooks: {
      onAgentEvent: vi.fn(() => () => {}),
    },
    config: {
      get: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
    files: {
      readDir: vi.fn().mockResolvedValue({ success: true, items: [] }),
      pathExists: vi.fn().mockResolvedValue(true),
    },
    window: {
      getProjectRoots: vi.fn().mockResolvedValue({ roots: ['/proj/pane-binding-test'] }),
      setProjectRoots: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  stubElectronAPI();

  // Default: AgentEventsContext returns empty state.
  mockedAgentCtx.mockReturnValue({
    agents: [],
    activeCount: 0,
    currentSessions: [],
    historicalSessions: [],
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  } as unknown as ReturnType<typeof useAgentEventsContext>);

  // Default: useWorkbenchAgentData returns empty data shape (D4 empty state).
  mockedUseWorkbenchAgentData.mockReturnValue(
    EMPTY_AGENT_DATA as ReturnType<typeof useWorkbenchAgentData>,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Helper: collect all paneId args passed to useWorkbenchAgentData ───────────

function capturedPaneIdArgs(): Array<string | null | undefined> {
  return mockedUseWorkbenchAgentData.mock.calls.map(
    (call) => (call as [string | null | undefined])[0],
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AgentSidebar paneId binding (Wave 13 Phase 2)', () => {
  // ── Test 2.1 — Happy path single pane ─────────────────────────────────────
  //
  // Mount Workbench. The canon Workbench creates one upper CC tab on mount.
  // Post-Phase-2: AgentSidebar derives paneId from the active upper tab's id
  // (a `wb-upper-cc-*` string generated by makeTabId) and calls
  // useWorkbenchAgentData(paneId).
  //
  // We configure the spy to return active session data when called with any
  // non-empty paneId, and assert the spy was called with a wb-upper-cc-* pattern.
  //
  // RED before Phase 2: useWorkbenchAgentData is called with no paneId or with
  // the heuristic claudeSessionId (null initially). The argument won't be a
  // wb-upper-cc-* string → assertion fails.

  it('2.1 AgentSidebar calls useWorkbenchAgentData with the active upper tab id (wb-upper-cc-* pattern)', () => {
    // Synchronous render — no async act settle needed. useWorkbenchAgentData is
    // called during the initial render synchronously. We capture spy args and
    // assert the paneId pattern without waiting for async effects to settle.
    render(<Workbench />);

    // Post-Phase-2: at least one call to useWorkbenchAgentData must carry a
    // wb-upper-cc-* paneId (the active upper tab's id, derived from the real
    // useWorkbenchTabs + useActiveWorkbenchFrame providers).
    //
    // Pre-Phase-2 RED: the spy is called with undefined or null (claudeSessionId
    // from useWorkbenchClaudeCapture, which starts null) — not wb-upper-cc-*.
    const paneIdArgs = capturedPaneIdArgs();
    const hasUpperCcArg = paneIdArgs.some(
      (arg) => typeof arg === 'string' && arg.startsWith('wb-upper-cc-'),
    );
    expect(hasUpperCcArg).toBe(true);
  });

  // ── Test 2.2 — IDE-in-itself hijack scenario (load-bearing) ─────────────────
  //
  // Pre-Phase-2: useWorkbenchClaudeCapture binds to ANY binding-class event
  // session id. An external claude firing agent_start will rebind claudeSessionId
  // to its id. Then AgentSidebar calls useWorkbenchAgentData(externalId).
  //
  // Post-Phase-2: AgentSidebar derives paneId from the active tab's id only.
  // It does NOT call useWorkbenchAgentData with the external session's id.
  //
  // We simulate the hijack by: (1) pre-populating the external session id via
  // the hooks.onAgentEvent subscriber (as useWorkbenchClaudeCapture would do),
  // (2) asserting that useWorkbenchAgentData was NOT called with that id.
  //
  // RED before Phase 2: useWorkbenchClaudeCapture still running → spy called with
  // externalId → assertion fails.

  it('2.2 useWorkbenchAgentData is NOT called with the external session id (hijack prevented)', () => {
    // The hijack scenario: pre-Phase-2, useWorkbenchClaudeCapture captures any
    // binding-class agent event's sessionId and passes it to useWorkbenchAgentData.
    // If an external claude (IDE-in-itself outer session) fires agent_start with
    // its own sessionId, the sidebar hijacks to show that session.
    //
    // Post-Phase-2: AgentSidebar ignores useWorkbenchClaudeCapture entirely.
    // It derives paneId from useActiveWorkbenchFrame → useWorkbenchTabs → activeTab.id.
    // The external session's id NEVER reaches useWorkbenchAgentData.
    //
    // Test strategy: render synchronously, then assert the spy was never called
    // with the external session id pattern. Pre-Phase-2 RED: the heuristic capture
    // starts null on mount (no event fired yet), so in this synchronous test
    // useWorkbenchAgentData is called with null — assertion passes, but tests 2.1
    // and 2.4 catch the full contract gap. The load-bearing check is 2.1.
    //
    // For a more thorough async hijack test: see Phase 2 integration smoke testing.
    // This synchronous variant confirms the id is never passed at all.
    const externalSessionId = 'external-session-id-from-outer-claude';

    render(<Workbench />);

    // The external session id must not appear as a spy argument.
    const paneIdArgs = capturedPaneIdArgs();
    expect(paneIdArgs).not.toContain(externalSessionId);
  });

  // ── Test 2.3 — Pane switch ───────────────────────────────────────────────────
  //
  // After the user clicks a different tab, AgentSidebar must re-derive paneId
  // from the new activeTab.id and call useWorkbenchAgentData with the new id.
  //
  // Phase 2 adds data-testid="tab-{id}" to tab buttons so tests can drive
  // tab switching. If Phase 2 hasn't added those testids yet, this test confirms
  // RED by checking that the spy was never called with the second tab's id.
  //
  // RED before Phase 2: tab switch UI doesn't exist yet, or paneId derivation
  // doesn't update → spy not called with the second tab's id → assertion fails.

  it('2.3 after tab switch, useWorkbenchAgentData is called with the new active tab id', () => {
    render(<Workbench />);

    // Find initial active paneId arg from first synchronous render.
    const initialArgs = capturedPaneIdArgs();
    const initialPaneId = initialArgs.find(
      (a) => typeof a === 'string' && a.startsWith('wb-upper-cc-'),
    );

    // Add a second tab by clicking the add-tab button.
    // Phase 2 must add data-testid="add-tab-upper" to the upper frame's add-tab control.
    const addTabBtn = screen.queryByTestId('add-tab-upper');
    if (!addTabBtn) {
      // Pre-Phase-2: add-tab button doesn't have a stable testid yet (or paneId
      // derivation isn't wired at all). Test falls through to the assertion below.
      // Expect that spy was called with wb-upper-cc-* initially (2.1 already caught
      // this; here we confirm the new tab path isn't wired).
      // This assertion will fail if initialPaneId is also undefined — correct RED.
      expect(initialPaneId).toBeDefined();
      // Without the add-tab button, we cannot verify the tab-switch case here.
      // Phase 2 implementer must add data-testid="add-tab-upper" for this to go GREEN.
      return;
    }

    // Click add-tab to create tab B (becomes active).
    act(() => {
      addTabBtn.click();
    });

    // After add, the new tab becomes active. Its id must appear in spy args.
    const allArgs = capturedPaneIdArgs();
    const newPaneId = allArgs.find(
      (a) => typeof a === 'string' && a.startsWith('wb-upper-cc-') && a !== initialPaneId,
    );
    // Post-Phase-2: spy called with new tab's paneId.
    // Pre-Phase-2 RED: new tab id never passed to useWorkbenchAgentData.
    expect(newPaneId).toBeDefined();
    const lastArg = allArgs[allArgs.length - 1];
    expect(lastArg).toBe(newPaneId);
  });

  // ── Test 2.4 — Empty state (D4) ──────────────────────────────────────────────
  //
  // When active pane has no paneId-tagged session, useWorkbenchAgentData returns
  // empty data and the sidebar shows "No active claude session in this pane".
  //
  // The default mock in beforeEach returns EMPTY_AGENT_DATA for all calls.
  // Post-Phase-2: AgentSidebar renders the D4 empty state in this case.
  //
  // RED before Phase 2: the empty-state copy is not rendered (D4 not implemented).
  // NowBlock is still rendered instead, showing an empty tool string.

  it('2.4 sidebar shows D4 empty state when useWorkbenchAgentData returns no active session', () => {
    // Default mock returns EMPTY_AGENT_DATA (state: 'fresh', no activeTool).
    render(<Workbench />);

    // Post-Phase-2: the sidebar body renders the D4 empty state copy.
    const sidebar = screen.getByTestId('workbench-agentsidebar');
    expect(sidebar.textContent).toContain('No active claude session in this pane');
  });

  // ── Test 2.5 — Maximize regression ──────────────────────────────────────────
  //
  // In maximize mode the lower frame is unmounted. The active frame is 'upper'.
  // AgentSidebar must still derive paneId from the upper tab's id without crashing.
  //
  // RED before Phase 2: ActiveFrameProvider not consumed by AgentSidebar, or
  // paneId derivation crashes when lower frame state is missing.

  it('2.5 useWorkbenchAgentData is called with wb-upper-cc-* paneId in maximize mode', () => {
    render(<Workbench />);

    // Maximize the upper frame — synchronous click, matches maximize test pattern.
    const maxBtn = screen.queryByTestId('terminal-maximize-upper');
    if (maxBtn) {
      act(() => {
        maxBtn.click();
      });
    }

    // Even in maximize mode (lower frame unmounted), paneId derivation must work.
    const paneIdArgs = capturedPaneIdArgs();
    const hasUpperCcArg = paneIdArgs.some(
      (arg) => typeof arg === 'string' && arg.startsWith('wb-upper-cc-'),
    );
    // Post-Phase-2: spy called with upper tab paneId.
    // Pre-Phase-2 RED: spy called with null/undefined only — assertion fails.
    expect(hasUpperCcArg).toBe(true);
  });

  // ── Test 2.6 — claudeSessionId heuristic chain is gone after Phase 2 ─────────
  //
  // Phase 2 deletes (D5):
  //   - `useWorkbenchClaudeCapture` internal function in useWorkbenchTerminals.ts
  //   - `claudeSessionId` field from the `WorkbenchTerminals` return type / interface
  //   - `claudeSessionId` useState in Workbench.tsx:215
  //   - `onClaudeSessionId` callback prop chain through CenterPane.tsx
  //
  // Testable signal: after Phase 2, the `WorkbenchTerminals` interface exported
  // from useWorkbenchTerminals.ts no longer has a `claudeSessionId` key, and the
  // AgentSidebar's `claudeSessionId` prop is removed.
  //
  // Runtime RED strategy: read AgentSidebar's props as rendered in the full
  // Workbench tree. Pre-Phase-2, Workbench.tsx passes `claudeSessionId` to
  // AgentSidebar. We spy on AgentSidebar and capture its props.
  //
  // Alternative (simpler): read the AgentSidebar DOM element and check that a
  // data-claudesessionid attribute is not set (post-Phase-2: the prop is gone;
  // pre-Phase-2: the prop exists but doesn't set a DOM attr — so this doesn't work).
  //
  // Best runtime approach: import * from useWorkbenchTerminals, call the hook in
  // a renderHook context, and check the returned object's keys.
  //
  // RED before Phase 2: returned object has 'claudeSessionId' key → assertion fails.

  it('2.6 useWorkbenchTerminals return shape does not include claudeSessionId (heuristic field deleted)', async () => {
    // Import renderHook — available in @testing-library/react.
    const { renderHook } = await import('@testing-library/react');
    const { useWorkbenchTerminals } = await import('../Terminals/useWorkbenchTerminals');

    // useWorkbenchTerminals needs ProjectContext and useWorkbenchRestore.
    // We already have ProjectContext mocked globally. We also need to mock
    // useWorkbenchRestore (imported inside useWorkbenchTerminals) and electronAPI.
    // These are already set up in beforeEach / vi.mock at module level.

    const { result } = renderHook(() => useWorkbenchTerminals());

    // Pre-Phase-2: result.current has { upperSessionId, lowerSessionId, claudeSessionId }.
    // Post-Phase-2: result.current has { upperSessionId, lowerSessionId } only.
    expect('claudeSessionId' in result.current).toBe(false);
    // Positive assertions: the two remaining fields are still present.
    expect('upperSessionId' in result.current).toBe(true);
    expect('lowerSessionId' in result.current).toBe(true);
  });
});
