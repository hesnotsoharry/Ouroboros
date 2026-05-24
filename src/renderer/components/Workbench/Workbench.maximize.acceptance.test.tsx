/**
 * Orchestrator-owned acceptance test — Wave 12 Phase 4 (maximize toggle).
 *
 * Expresses the contract for the ephemeral maximize toggle (ADR D5):
 *   1. Initial state — both terminal-shell-upper and terminal-shell-lower are
 *      present in the DOM; the divider is present.
 *   2. Clicking the Maximize button in the upper frame (data-testid=
 *      "terminal-maximize-upper") hides terminal-shell-lower and the divider.
 *      terminal-shell-upper remains visible.
 *   3. Clicking the same button again restores dual-frame view — both shells
 *      present, divider present.
 *   4. Same lifecycle for the lower frame (data-testid="terminal-maximize-lower"):
 *      maximizes lower, hides upper + divider; click again restores.
 *
 * Architecture note (Phase 4 spec):
 *   - `Workbench.tsx` adds `const [maximizedFrame, setMaximizedFrame] = useState<
 *     'upper' | 'lower' | null>(null)`.
 *   - `CenterPane` receives `maximizedFrame` + `onSetMaximizedFrame` (or equivalent
 *     callback). It conditionally renders only the live frame's `<TerminalShell>`
 *     and hides/removes the other frame and divider.
 *   - `TerminalShell` receives `onMaximize` (or accesses it via context/prop from
 *     `CenterPane`) so `TabBarControls.Maximize` can fire `setMaximizedFrame`.
 *   - The divider element MUST carry data-testid="terminal-divider" so the
 *     test can assert its presence/absence deterministically.
 *
 * Test mount strategy:
 *   We render `<Workbench />` (the full component), using the same mock stack as
 *   `Workbench.test.tsx`. This gives us the real `maximizedFrame` state machine
 *   without having to simulate prop threads manually. The heavy deps (xterm,
 *   AgentSidebar, etc.) are stubbed using the proven pattern from the companion
 *   test file. The mock for `useWorkbenchTabs` is intentionally absent — the real
 *   hook is allowed to run (it reads from `useWorkbenchRestore` which returns
 *   empty, so no PTY spawn happens for tabs). This avoids the worker-crash that
 *   results from double-registering the module in vitest's hoisting cache.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 4
 * implementer implements the maximize feature against THIS test and MAY NOT
 * modify it. The test is RED at Phase 4 dispatch; it goes green when maximize
 * state management lands in Workbench.tsx + CenterPane.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import { Workbench } from './Workbench';

// ── Module mocks (mirrors Workbench.test.tsx pattern exactly) ─────────────────

// TerminalInstance — xterm crashes jsdom at module-init time.
vi.mock('../Terminal/TerminalInstance', () => ({
  TerminalInstance: ({ sessionId }: { sessionId: string }) =>
    React.createElement('div', { 'data-testid': `terminal-instance-stub-${sessionId}` }),
}));

// ProjectContext.
vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/proj/maximize-test',
    projectRoots: ['/proj/maximize-test'],
    projectName: 'maximize-test',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => ({
    projectRoot: '/proj/maximize-test',
  }),
}));

// useConfig.
vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: {
      recentProjects: ['/proj/maximize-test'],
      persistTerminalSessions: true,
    },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// useGitBranch.
vi.mock('../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'wave/12' }),
}));

// AgentEventsContext — AgentGlobe requires this.
vi.mock('../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

// ToastContext — WorkbenchBell requires this.
vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
  }),
}));

// ── electronAPI harness (mirrors Workbench.test.tsx stubPty + stubFiles) ──────

const mockedAgentCtx = vi.mocked(useAgentEventsContext);

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
      getProjectRoots: vi.fn().mockResolvedValue({ roots: ['/proj/maximize-test'] }),
      setProjectRoots: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

beforeEach(() => {
  stubElectronAPI();
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the element is present in the DOM and not display:none. */
function isVisible(testId: string): boolean {
  const el = screen.queryByTestId(testId);
  if (!el) return false;
  const style = el.getAttribute('style') ?? '';
  return !style.includes('display: none') && !style.includes('display:none');
}

/** Returns true if the element is absent from the DOM OR display:none. */
function isHidden(testId: string): boolean {
  const el = screen.queryByTestId(testId);
  if (!el) return true;
  const style = el.getAttribute('style') ?? '';
  return style.includes('display: none') || style.includes('display:none');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Wave 12 Phase 4 — initial dual-frame state', () => {
  it('both terminal-shell-upper and terminal-shell-lower are present before any maximize action', () => {
    render(<Workbench />);

    expect(screen.getByTestId('terminal-shell-upper')).toBeDefined();
    expect(screen.getByTestId('terminal-shell-lower')).toBeDefined();
  });

  it('the divider is present in dual-frame view (data-testid="terminal-divider")', () => {
    render(<Workbench />);

    // Phase 4 MUST add data-testid="terminal-divider" to the divider element in
    // CenterPane.tsx so this assertion can pass deterministically.
    expect(screen.getByTestId('terminal-divider')).toBeDefined();
  });
});

describe('Wave 12 Phase 4 — upper frame maximize', () => {
  it('clicking terminal-maximize-upper hides terminal-shell-lower', () => {
    render(<Workbench />);

    fireEvent.click(screen.getByTestId('terminal-maximize-upper'));

    expect(isHidden('terminal-shell-lower')).toBe(true);
  });

  it('clicking terminal-maximize-upper hides the divider', () => {
    render(<Workbench />);

    fireEvent.click(screen.getByTestId('terminal-maximize-upper'));

    expect(isHidden('terminal-divider')).toBe(true);
  });

  it('clicking terminal-maximize-upper keeps terminal-shell-upper visible', () => {
    render(<Workbench />);

    fireEvent.click(screen.getByTestId('terminal-maximize-upper'));

    expect(isVisible('terminal-shell-upper')).toBe(true);
  });

  it('clicking terminal-maximize-upper a second time restores both frames and the divider', () => {
    render(<Workbench />);

    const btn = screen.getByTestId('terminal-maximize-upper');
    // First click: maximize.
    fireEvent.click(btn);
    expect(isHidden('terminal-shell-lower')).toBe(true);

    // Second click: restore.
    fireEvent.click(btn);

    expect(isVisible('terminal-shell-upper')).toBe(true);
    expect(isVisible('terminal-shell-lower')).toBe(true);
    expect(isVisible('terminal-divider')).toBe(true);
  });
});

describe('Wave 12 Phase 4 — lower frame maximize', () => {
  it('clicking terminal-maximize-lower hides terminal-shell-upper', () => {
    render(<Workbench />);

    fireEvent.click(screen.getByTestId('terminal-maximize-lower'));

    expect(isHidden('terminal-shell-upper')).toBe(true);
  });

  it('clicking terminal-maximize-lower hides the divider', () => {
    render(<Workbench />);

    fireEvent.click(screen.getByTestId('terminal-maximize-lower'));

    expect(isHidden('terminal-divider')).toBe(true);
  });

  it('clicking terminal-maximize-lower keeps terminal-shell-lower visible', () => {
    render(<Workbench />);

    fireEvent.click(screen.getByTestId('terminal-maximize-lower'));

    expect(isVisible('terminal-shell-lower')).toBe(true);
  });

  it('clicking terminal-maximize-lower a second time restores both frames and the divider', () => {
    render(<Workbench />);

    const btn = screen.getByTestId('terminal-maximize-lower');
    fireEvent.click(btn);
    expect(isHidden('terminal-shell-upper')).toBe(true);

    fireEvent.click(btn);

    expect(isVisible('terminal-shell-upper')).toBe(true);
    expect(isVisible('terminal-shell-lower')).toBe(true);
    expect(isVisible('terminal-divider')).toBe(true);
  });
});
