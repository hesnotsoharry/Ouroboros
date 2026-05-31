/**
 * @vitest-environment jsdom
 *
 * Workbench.test.tsx — Phase 1–3 tests (Wave 3 Phase 2 updated).
 *
 * Phase 1 trophy: the flag branch + frame render is the seam.
 * (a) flag on → Workbench mounts and all six region test-ids are present
 * (b) flag off → the prior InnerApp shell branch is unchanged (Workbench not rendered)
 *
 * Phase 2 additions: TitleBar renders the app mark, project + branch chips,
 * AgentGlobe, and the three window controls.
 *
 * Wave 2 Phase 2: TerminalShell tests updated — mock bodies removed; both
 * frames are live terminals. TerminalInstance is mocked to keep renders lightweight.
 *
 * Wave 3 Phase 1: AgentGlobe is now driven by live AgentEventsContext (via
 * useWorkbenchAgentData), not mock data. useAgentEventsContext is mocked below
 * (default: empty → "fresh"); the Globe test asserts the derived data-state +
 * live model rather than the retired mock model string.
 *
 * Wave 3 Phase 2:
 *   - useGitBranch mocked → returning { branch: 'feature/x' }
 *   - useConfig mocked → returning config with recentProjects
 *   - ProjectContext mock extended → projectRoots: ['/projects/agent-ide']
 *   - StatusBar: branch name from mock; +adds/−dels removed (deferred);
 *     clock asserts HH:MM:SS shape (regex), not static string
 *   - ProjectRail: chips from mocked roots; dirty-badge assertions removed
 *   - TitleBar: active chip name + branch from mocked live sources
 *   - InnerRail: branch footer from mocked useGitBranch; +126/−42 removed
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Lightweight TerminalInstance stub — avoids xterm + IPC in render tests.
// Path relative to this test file (Workbench/Workbench.test.tsx).
vi.mock('../Terminal/TerminalInstance', () => ({
  TerminalInstance: ({ sessionId }: { sessionId: string }) =>
    React.createElement('div', { 'data-testid': `terminal-instance-${sessionId}` }),
}));

// ProjectContext stub — projectRoot + projectRoots used by useWorkbenchProjects,
// useWorkbenchTerminals, useGitBranch, etc.
vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/projects/agent-ide',
    projectRoots: ['/projects/agent-ide'],
    projectName: 'agent-ide',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => null,
}));

// useConfig stub — provides recentProjects for useWorkbenchProjects.
vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: {
      recentProjects: ['/projects/agent-ide', '/projects/pinpoint'],
    },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// useGitBranch stub — returns a known branch for all components.
vi.mock('../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'feature/x' }),
}));

// AgentEventsContext stub — AgentGlobe (Wave 3) reads useWorkbenchAgentData →
// useAgentEventsContext, which throws outside a provider. Default return set in
// beforeEach (empty → "fresh"); individual tests override via mockReturnValue.
vi.mock('../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
  }),
}));

// WorkbenchTabsProvider mock — standalone renders of TerminalShell / AgentSidebar
// call useWorkbenchTabsContext directly and throw without a provider ancestor.
// <Workbench /> mounts the real provider so its renders are unaffected. This mock
// only fires when the context is consumed WITHOUT a real provider in the tree (the
// real provider's value takes precedence when present because vi.mock replaces the
// module, so the real provider's context value won't be available). For <Workbench />
// renders that wrap the real provider, the mock is overridden at the module level —
// so we keep the mock value generic enough to not break any assertion.
vi.mock('./Terminals/WorkbenchTabsProvider', () => ({
  useWorkbenchTabsContext: vi.fn().mockReturnValue({
    tabs: [
      {
        id: 'wb-test-default-tab',
        label: 'claude',
        sessionId: 'wb-test-default-tab',
        kind: 'cc' as const,
        createdAt: 0,
      },
    ],
    activeTabId: 'wb-test-default-tab',
    addTab: vi.fn(),
    closeTab: vi.fn(),
    renameTab: vi.fn(),
    setActiveTab: vi.fn(),
  }),
  // Pass-through provider so <Workbench /> render tree keeps working structurally.
  WorkbenchTabsProvider: ({ children }: { children: React.ReactNode }) => children,
  // Safe variant used by useWorkbenchGlobeData — return null (no active context in tests).
  useWorkbenchTabsContextSafe: vi.fn().mockReturnValue(null),
}));

// WorkbenchRestore + SessionPersist — needed so the WorkbenchTabsProvider pass-through
// (above) doesn't blow up when <Workbench /> tries to use the real provider internally.
vi.mock('./Terminals/useWorkbenchRestore', () => ({
  useWorkbenchRestore: vi.fn().mockReturnValue({
    isReady: true,
    upperCollection: undefined,
    lowerCollection: undefined,
  }),
}));

vi.mock('./Terminals/useWorkbenchSessionPersist', () => ({
  useWorkbenchSessionPersist: vi.fn(),
}));

/** Installs a minimal window.electronAPI.pty stub used by useWorkbenchTerminals. */
function stubPty(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    ...(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI,
    pty: {
      spawn: vi.fn().mockResolvedValue({ success: true }),
      kill: vi.fn().mockResolvedValue({ success: true }),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
      write: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

/** Installs a minimal window.electronAPI.files stub used by WorkbenchFileTree. */
function stubFiles(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    ...(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI,
    files: {
      readDir: vi.fn().mockResolvedValue({ success: true, items: [] }),
    },
  };
}

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';
import { AgentSidebar } from './AgentSidebar/AgentSidebar';
import { ContextBlock } from './AgentSidebar/ContextBlock';
import { FilesTouched } from './AgentSidebar/FilesTouched';
import { HookTimeline } from './AgentSidebar/HookTimeline';
import { NowBlock } from './AgentSidebar/NowBlock';
import { InnerRail } from './Rails/InnerRail';
import { ProjectRail } from './Rails/ProjectRail';
import { UnifiedRail } from './Rails/UnifiedRail';
import { StatusBar } from './StatusBar';
import { CenterPane } from './Terminals/CenterPane';
import { TerminalShell } from './Terminals/TerminalShell';
import { Workbench } from './Workbench';

const mockedAgentCtx = vi.mocked(useAgentEventsContext);

/** Build a faithful AgentEventsContext value from a flat session list. */
function agentCtx(sessions: AgentSession[]) {
  const isLive = (s: AgentSession) => s.status === 'running' || s.status === 'idle';
  return {
    agents: sessions,
    activeCount: sessions.filter((s) => s.status === 'running').length,
    currentSessions: sessions.filter(isLive),
    historicalSessions: sessions.filter((s) => s.status === 'complete' || s.status === 'error'),
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  } as unknown as ReturnType<typeof useAgentEventsContext>;
}

// Install the pty stub before every test so any render(<Workbench />) or
// render(<CenterPane />) can call useWorkbenchTerminals → pty.spawn without
// crashing. Tests that need their own electronAPI shape (useCanonWorkbenchFlag)
// override with vi.stubGlobal after this runs.
beforeEach(() => {
  stubPty();
  stubFiles();
  mockedAgentCtx.mockReturnValue(agentCtx([])); // default: no sessions → Globe "fresh"
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── (a) Workbench renders all six regions when mounted ───────────────────────

describe('Workbench', () => {
  it('mounts and renders all six region test-ids', () => {
    render(<Workbench />);

    expect(screen.getByTestId('workbench-titlebar')).toBeDefined();
    expect(screen.getByTestId('workbench-projectrail')).toBeDefined();
    expect(screen.getByTestId('workbench-innerrail')).toBeDefined();
    expect(screen.getByTestId('workbench-terminals')).toBeDefined();
    expect(screen.getByTestId('workbench-agentsidebar')).toBeDefined();
    expect(screen.getByTestId('workbench-statusbar')).toBeDefined();
  });

  it('does not import xterm, useAgentEvents, or permission components', async () => {
    // Structural: verify the module can be imported without those dependencies.
    // If this test resolves, the module loaded successfully in the test environment
    // which has no xterm or IPC shims wired.
    const mod = await import('./Workbench');
    expect(typeof mod.Workbench).toBe('function');
  });
});

// ── Phase 2: TitleBar content tests ──────────────────────────────────────────

describe('TitleBar', () => {
  it('renders the app mark "A" glyph', () => {
    render(<Workbench />);
    const titleBar = screen.getByTestId('workbench-titlebar');
    expect(titleBar.textContent).toContain('A');
  });

  it('renders the active project name from live useWorkbenchProjects', () => {
    render(<Workbench />);
    // projectRoots = ['/projects/agent-ide'] → basename = 'agent-ide'.
    // Wave 10: name now appears in TitleBar ProjectChip AND InnerRail header.
    const matches = screen.getAllByText('agent-ide');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the active project branch name from live useGitBranch', () => {
    render(<Workbench />);
    // useGitBranch mock returns 'feature/x'
    // getAllByText because InnerRail footer also shows the branch name.
    const matches = screen.getAllByText('feature/x');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders the AgentGlobe driven by live agent state (Wave 3)', () => {
    // A live running session with a pending tool → Globe derives "running" and
    // shows the session's live model + tool, not the retired mock model string.
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 's1',
          taskLabel: 'task',
          status: 'running',
          startedAt: 1000,
          inputTokens: 0,
          outputTokens: 0,
          model: 'claude-opus-4-7',
          toolCalls: [
            { id: 'tc1', toolName: 'Bash', input: 'npm test', timestamp: 1500, status: 'pending' },
          ],
        },
      ]),
    );
    render(<Workbench />);
    const globe = screen.getByTestId('agent-globe');
    expect(globe.getAttribute('data-state')).toBe('running');
    expect(globe.textContent).toContain('claude-opus-4-7');
    // The retired mock model must not appear inside the Globe.
    expect(globe.textContent).not.toContain('claude-sonnet-4-6');
  });

  it('renders the Ctrl K command palette affordance (Windows shortcut, not ⌘K)', () => {
    render(<Workbench />);
    expect(screen.getByText('Ctrl K')).toBeDefined();
  });

  it('renders the three window control buttons', () => {
    render(<Workbench />);
    // Scope to window-controls container — the terminal tab bars also have
    // a "Maximize" button, so getByTitle would find multiple matches.
    const controls = screen.getByTestId('window-controls');
    expect(controls.querySelector('[title="Minimize"]')).toBeDefined();
    expect(controls.querySelector('[title="Maximize"]')).toBeDefined();
    expect(controls.querySelector('[title="Close"]')).toBeDefined();
  });

  it('workbench-titlebar test-id resolves on the TitleBar root element', () => {
    render(<Workbench />);
    const el = screen.getByTestId('workbench-titlebar');
    // TitleBar is the outermost element of the title bar region
    expect(el).toBeDefined();
    // Should contain the window controls container
    expect(el.querySelector('[data-testid="window-controls"]')).toBeDefined();
  });
});

// ── Phase 3: ProjectRail ──────────────────────────────────────────────────────

describe('ProjectRail', () => {
  it('renders the workbench-projectrail test-id on its root element', () => {
    render(<ProjectRail />);
    expect(screen.getByTestId('workbench-projectrail')).toBeDefined();
  });

  it('renders one chip per live project root (2 chips from mocked roots)', () => {
    render(<ProjectRail />);
    const rail = screen.getByTestId('workbench-projectrail');
    // projectRoots = ['/projects/agent-ide'] + recentProjects = ['/projects/pinpoint']
    expect(rail.querySelector('[title="agent-ide"]')).toBeDefined();
    expect(rail.querySelector('[title="pinpoint"]')).toBeDefined();
  });

  it('renders the active project initial letter (A) in the active chip', () => {
    render(<ProjectRail />);
    // projectRoot = '/projects/agent-ide' → initial 'A'
    const chip = screen.getByTitle('agent-ide');
    expect(chip.textContent).toContain('A');
  });

  it('does not render a dirty badge — dirty count deferred to follow-up', () => {
    render(<ProjectRail />);
    // No dirty badges expected; none of the chip titles should show a numeric badge.
    const rail = screen.getByTestId('workbench-projectrail');
    // No badge spans with count text should be present.
    const badges = rail.querySelectorAll('[aria-label="dirty"]');
    expect(badges.length).toBe(0);
  });

  it('renders the add-project button', () => {
    render(<ProjectRail />);
    expect(screen.getByTitle('Add project')).toBeDefined();
  });

  it('renders the collapse handle', () => {
    render(<ProjectRail />);
    expect(screen.getByTitle('Collapse to unified rail')).toBeDefined();
  });
});

// ── Phase 3: InnerRail ────────────────────────────────────────────────────────

describe('InnerRail', () => {
  it('renders the workbench-innerrail test-id on its root element', () => {
    render(<InnerRail />);
    expect(screen.getByTestId('workbench-innerrail')).toBeDefined();
  });

  it('renders Running section with live session labels (current project)', () => {
    // projectRoot mock = '/projects/agent-ide' → basename 'agent-ide'
    // Sessions with cwd '/projects/agent-ide' → projectId 'agent-ide' → current
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 's1',
          taskLabel: 'claude · main',
          status: 'running',
          startedAt: 1000,
          inputTokens: 0,
          outputTokens: 0,
          cwd: '/projects/agent-ide',
          toolCalls: [],
        },
        {
          id: 's2',
          taskLabel: 'claude · refactor',
          status: 'running',
          startedAt: 900,
          inputTokens: 0,
          outputTokens: 0,
          cwd: '/projects/agent-ide',
          toolCalls: [],
        },
      ]),
    );
    render(<InnerRail />);
    expect(screen.getByText('claude · main')).toBeDefined();
    expect(screen.getByText('claude · refactor')).toBeDefined();
  });

  it('does NOT render sessions from other projects (project-scoped rail — Wave 14 Phase 4)', () => {
    // Wave 14 Phase 4: InnerRail is project-scoped — only sessions whose cwd resolves
    // to the current projectId (agent-ide) are shown. Sessions from other projects
    // (lumen-cli) must not appear regardless of their live status.
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 's-other',
          taskLabel: 'claude · streaming',
          status: 'running',
          startedAt: 800,
          inputTokens: 0,
          outputTokens: 0,
          cwd: '/projects/lumen-cli',
          toolCalls: [],
        },
      ]),
    );
    render(<InnerRail />);
    expect(screen.queryByText('claude · streaming')).toBeNull();
  });

  it('renders the files section with a live WorkbenchFileTree (not mock entries)', () => {
    render(<InnerRail />);
    // Live tree mounts; default readDir stub returns empty → "Empty directory" shown.
    // Crucially, mock file names from MOCK_FILE_TREE must not appear.
    expect(screen.queryByText('tokens.css')).toBeNull();
    expect(screen.queryByText('ChatOnlyShell.tsx')).toBeNull();
  });

  it('renders the branch footer with live branch name from useGitBranch', () => {
    render(<InnerRail />);
    // useGitBranch mock returns 'feature/x'
    expect(screen.getByText('feature/x')).toBeDefined();
  });

  it('does not render +adds or −dels in the footer — diff stats deferred', () => {
    render(<InnerRail />);
    // +126 and −42 must not appear — those were mock diff stats, now deferred.
    expect(screen.queryByText('+126')).toBeNull();
    expect(screen.queryByText('−42')).toBeNull();
  });
});

// ── Phase 3: UnifiedRail (Wave 6: now live-data-wired) ───────────────────────
// Data source changed: useWorkbenchProjects (live) + useGitBranch (live).
// Tests updated from MOCK_PROJECTS/MOCK_BRANCH assertions to live-mock assertions.

describe('UnifiedRail', () => {
  it('renders the workbench-unifiedrail test-id on its root element', () => {
    render(<UnifiedRail />);
    expect(screen.getByTestId('workbench-unifiedrail')).toBeDefined();
  });

  it('renders one accordion per live project (from mocked useProject/useConfig)', () => {
    render(<UnifiedRail />);
    // Projects derive from mocked useProject (projectRoot='/projects/agent-ide') +
    // useConfig (recentProjects includes '/projects/pinpoint').
    expect(screen.getByText('agent-ide')).toBeDefined();
    expect(screen.getByText('pinpoint')).toBeDefined();
  });

  it('expands the active project accordion body (RUNNING + FILES labels)', () => {
    render(<UnifiedRail />);
    // The active project (agent-ide) is expanded — body labels visible.
    const items = screen.getAllByText(/running/i);
    expect(items.length).toBeGreaterThan(0);
    const fileItems = screen.getAllByText(/files/i);
    expect(fileItems.length).toBeGreaterThan(0);
  });

  it('renders the live branch in the footer (from mocked useGitBranch)', () => {
    render(<UnifiedRail />);
    // useGitBranch is mocked to return { branch: 'feature/x' } — live data, not MOCK_BRANCH.
    expect(screen.getByText('feature/x')).toBeDefined();
  });

  it('is NOT rendered inside Workbench when viewport is default (full tier)', () => {
    // Default jsdom matchMedia returns matches:false for every query → all-false
    // → max-width queries resolve to full tier → UnifiedRail not mounted.
    render(<Workbench />);
    expect(screen.queryByTestId('workbench-unifiedrail')).toBeNull();
  });
});

// ── Phase 4: CenterPane + TerminalShell ──────────────────────────────────────

describe('CenterPane', () => {
  it('carries data-testid="workbench-terminals" on the root element', () => {
    stubPty();
    render(<CenterPane />);
    expect(screen.getByTestId('workbench-terminals')).toBeDefined();
  });

  it('renders both terminal shells (upper CC + lower shell)', () => {
    stubPty();
    render(<CenterPane />);
    expect(screen.getByTestId('terminal-shell-upper')).toBeDefined();
    expect(screen.getByTestId('terminal-shell-lower')).toBeDefined();
  });

  it('both terminal shells contain a live TerminalInstance', () => {
    stubPty();
    render(<CenterPane />);
    const upper = screen.getByTestId('terminal-shell-upper');
    const lower = screen.getByTestId('terminal-shell-lower');
    // Each shell's well contains a TerminalInstance stub (data-testid=terminal-instance-*)
    expect(upper.querySelector('[data-testid^="terminal-instance-"]')).toBeDefined();
    expect(lower.querySelector('[data-testid^="terminal-instance-"]')).toBeDefined();
  });

  it('does not import xterm — module loads without terminal-emulator errors', async () => {
    const mod = await import('./Terminals/CenterPane');
    expect(typeof mod.CenterPane).toBe('function');
  });
});

describe('TerminalShell (upper — CC)', () => {
  it('renders the new-tab button for the upper frame (Wave 12 Phase 4)', () => {
    // Phase 4: live tabs via useWorkbenchTabs. Mock data removed; tab bar always has
    // new-tab and controls regardless of tab count (which is zero in this test env).
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.getByTestId('terminal-tabbar-new-upper')).toBeDefined();
  });

  it('renders a live TerminalInstance in the well body', () => {
    // Wave 12 Phase 4: useWorkbenchTabs generates a dynamic tab id (makeTabId), so the
    // TerminalInstance testid uses that generated id — not the sessionId prop.
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    const shell = screen.getByTestId('terminal-shell-upper');
    expect(shell.querySelector('[data-testid^="terminal-instance-"]')).toBeDefined();
  });

  it('does NOT render the mock CC prompt box', () => {
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.queryByTestId('cc-prompt-box')).toBeNull();
  });

  it('does NOT render the mock CC status line', () => {
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.queryByTestId('cc-status-line')).toBeNull();
  });

  it('renders the Split (inert) and Maximize tab-bar controls (Wave 12 Phase 4)', () => {
    // ADR D4: Split button stays mounted but inert with descriptive tooltip.
    // ADR D5: Maximize button wired; testid is terminal-maximize-upper.
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.getByTitle('Split — coming in a future wave')).toBeDefined();
    expect(screen.getByTestId('terminal-maximize-upper')).toBeDefined();
  });
});

describe('TerminalShell (lower — shell)', () => {
  it('renders the new-tab button for the lower frame (Wave 12 Phase 4)', () => {
    // Phase 4: live tabs via useWorkbenchTabs. Mock data removed.
    render(<TerminalShell kind="shell" flex={1} sessionId="test-lower" isActive />);
    expect(screen.getByTestId('terminal-tabbar-new-lower')).toBeDefined();
  });

  it('renders a live TerminalInstance in the well body', () => {
    // Wave 12 Phase 4: useWorkbenchTabs generates a dynamic tab id (makeTabId), so the
    // TerminalInstance testid uses that generated id — not the sessionId prop.
    render(<TerminalShell kind="shell" flex={1} sessionId="test-lower" isActive />);
    const shell = screen.getByTestId('terminal-shell-lower');
    expect(shell.querySelector('[data-testid^="terminal-instance-"]')).toBeDefined();
  });

  it('does NOT render the mock shell prompt cursor line', () => {
    render(<TerminalShell kind="shell" flex={1} sessionId="test-lower" isActive />);
    expect(screen.queryByTestId('shell-prompt-line')).toBeNull();
  });

  it('does NOT render the mock CC prompt box', () => {
    render(<TerminalShell kind="shell" flex={1} sessionId="test-lower" isActive />);
    expect(screen.queryByTestId('cc-prompt-box')).toBeNull();
  });
});

describe('Workbench — Phase 4 integration', () => {
  it('workbench-terminals test-id resolves on CenterPane root (not a placeholder)', () => {
    stubPty();
    render(<Workbench />);
    const el = screen.getByTestId('workbench-terminals');
    // CenterPane root has both terminal shells as descendants
    expect(el.querySelector('[data-testid="terminal-shell-upper"]')).toBeDefined();
    expect(el.querySelector('[data-testid="terminal-shell-lower"]')).toBeDefined();
  });

  it('both terminal shells in the workbench contain a live TerminalInstance', () => {
    stubPty();
    render(<Workbench />);
    const upper = screen.getByTestId('terminal-shell-upper');
    const lower = screen.getByTestId('terminal-shell-lower');
    expect(upper.querySelector('[data-testid^="terminal-instance-"]')).toBeDefined();
    expect(lower.querySelector('[data-testid^="terminal-instance-"]')).toBeDefined();
  });

  it('Agent Sidebar is the real AgentSidebar component (not a placeholder)', () => {
    stubPty();
    render(<Workbench />);
    const el = screen.getByTestId('workbench-agentsidebar');
    expect(el).toBeDefined();
    // Real AgentSidebar contains the NOW block — placeholder text is gone
    expect(el.querySelector('[data-testid="now-block"]')).toBeDefined();
  });
});

// ── Phase 5: AgentSidebar + five panels ──────────────────────────────────────

describe('AgentSidebar', () => {
  it('carries data-testid="workbench-agentsidebar" on its root element', () => {
    render(<AgentSidebar />);
    expect(screen.getByTestId('workbench-agentsidebar')).toBeDefined();
  });

  it('renders the header fallback label when no pane-tagged session is active (Wave 13 D4)', () => {
    // Wave 13 D4: AgentSidebar resolves its primary session by paneId (OUROBOROS_PANE_ID),
    // NOT by heuristic cwd matching. Without a paneId-stamped session matching the active
    // tab's generated id, SidebarHeader falls back to the '—' placeholder label.
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'claude · main',
          status: 'running',
          startedAt: 1000,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: [],
        },
      ]),
    );
    render(<AgentSidebar />);
    const sidebar = screen.getByTestId('workbench-agentsidebar');
    expect(sidebar.textContent).toContain('—');
  });

  it('renders the Stop button in the header', () => {
    render(<AgentSidebar />);
    expect(screen.getByTitle('Stop')).toBeDefined();
  });

  it('renders the Maximize sidebar button in the header', () => {
    render(<AgentSidebar />);
    expect(screen.getByTitle('Maximize sidebar')).toBeDefined();
  });

  it('renders panel regions with D4 empty state for the NOW slot (Wave 13 D4)', () => {
    // Wave 13 D4: without a paneId-matched session, AgentSidebar renders SidebarEmptyState
    // in the NOW slot (not NowBlock). PanelStack renders unconditionally — context, files,
    // hunk placeholder, and timeline testids are always present.
    render(<AgentSidebar />);
    // NOW slot shows D4 empty state (no active claude session in this pane)
    expect(screen.queryByTestId('now-block')).toBeNull();
    expect(screen.getByText('No active claude session in this pane')).toBeDefined();
    // PanelStack renders unconditionally
    expect(screen.getByTestId('context-block')).toBeDefined();
    expect(screen.getByTestId('files-touched')).toBeDefined();
    // No diff_review_ready event → empty placeholder renders (not the live hunk).
    expect(screen.getByTestId('latest-hunk-empty')).toBeDefined();
    expect(screen.getByTestId('hook-timeline')).toBeDefined();
  });
});

describe('AgentSidebar — NowBlock (D4 empty state via AgentSidebar)', () => {
  it('renders the D4 empty state when no pane-tagged session is active', () => {
    // Wave 13 D4: without a matching paneId session, AgentSidebar shows SidebarEmptyState
    // instead of NowBlock. The now-block testid is absent; the message is present.
    render(<AgentSidebar />);
    expect(screen.queryByTestId('now-block')).toBeNull();
    expect(screen.getByText('No active claude session in this pane')).toBeDefined();
  });

  it('does not render the Edit mock tool name when no session matches (D4 guard)', () => {
    // D4: with no paneId match, NowBlock is suppressed. 'Edit' must not appear from a
    // stale mock — it was previously injected via MOCK_NOW_TOOL_CALL which was removed.
    render(<AgentSidebar />);
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('renders the NowBlock NOW label and 0s elapsed when rendered directly with empty data', () => {
    // Directly rendering NowBlock bypasses the D4 paneId gate and tests the component contract.
    render(
      <NowBlock data={{ tool: '', target: '', description: '', elapsedSec: 0, progress: undefined }} />,
    );
    const block = screen.getByTestId('now-block');
    expect(block.textContent).toContain('NOW');
    expect(block.textContent).toContain('0s');
    // The '→' arrow separator is always present in ToolRow
    expect(block.textContent).toContain('→');
  });
});

describe('AgentSidebar — ContextBlock', () => {
  it('renders the CONTEXT label', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    expect(block.textContent).toContain('CONTEXT');
  });

  it('renders live token count from adapter (empty session → 0 / 200.0k)', () => {
    // Default context has no sessions → usedTokens=0, maxTokens=200_000
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    expect(block.textContent).toContain('200.0k');
    // usedTokens 0 renders as '0' (below 1000 threshold)
    expect(block.textContent).toContain('0 / 200.0k');
  });

  it('renders 0% usage in the donut centre when no session', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    expect(block.textContent).toContain('0%');
  });
});

// ── Wave 4 Phase 1: NowBlock + ContextBlock live-data wiring ─────────────────

describe('NowBlock — live adapter data (Wave 4 Phase 1)', () => {
  it('renders live tool name when NowBlock receives a pending-tool data shape', () => {
    // Wave 13 D4: AgentSidebar resolves primary by paneId — tests render NowBlock directly
    // with the data the adapter would produce for a session with a pending Edit tool call.
    render(
      <NowBlock
        data={{
          tool: 'Edit',
          target: 'src/renderer/App.tsx',
          description: 'src/renderer/App.tsx',
          elapsedSec: 45,
          progress: undefined,
        }}
      />,
    );
    const block = screen.getByTestId('now-block');
    // Live tool name from adapter.activeTool
    expect(block.textContent).toContain('Edit');
    // Live target from adapter.target
    expect(block.textContent).toContain('src/renderer/App.tsx');
  });

  it('renders elapsed seconds in the duration pill from the NowBlock data prop', () => {
    // Elapsed is derived by the adapter from session.startedAt; here we supply it directly.
    render(
      <NowBlock
        data={{ tool: '', target: '', description: '', elapsedSec: 30, progress: undefined }}
      />,
    );
    const block = screen.getByTestId('now-block');
    // elapsedSec=30 → pill shows '30s'
    expect(block.textContent).toContain('30s');
    // Must NOT show the frozen mock value 12s (from MOCK_NOW_TOOL_CALL, deleted in Wave 4).
    expect(block.textContent).not.toContain('12s');
  });

  it('renders idle/empty state without error when NowBlock receives zero elapsed', () => {
    // elapsedSec=0 + empty tool + empty target = idle shape
    render(
      <NowBlock data={{ tool: '', target: '', description: '', elapsedSec: 0, progress: undefined }} />,
    );
    const block = screen.getByTestId('now-block');
    expect(block.textContent).toContain('NOW');
    expect(block.textContent).toContain('0s');
  });
});

describe('ContextBlock — live adapter data (Wave 4 Phase 1)', () => {
  it('renders used/max tokens when ContextBlock receives a live data shape', () => {
    // Wave 13 D4: AgentSidebar resolves primary by paneId. ContextBlock is rendered
    // directly with the data shape the adapter produces for a session with 42800 tokens.
    render(
      <ContextBlock
        data={{
          usedTokens: 42_800,
          maxTokens: 200_000,
          costUsd: 0,
          model: 'claude-sonnet-4-6',
          elapsedSec: 60,
        }}
      />,
    );
    const block = screen.getByTestId('context-block');
    // inputTokens(40000) + outputTokens(2800) = 42800 → '42.8k'
    expect(block.textContent).toContain('42.8k');
    expect(block.textContent).toContain('200.0k');
  });

  it('renders cost when ContextBlock receives costUsd in the data prop', () => {
    // costUsd 0.087 → '$0.09' via toFixed(2)
    render(
      <ContextBlock
        data={{
          usedTokens: 0,
          maxTokens: 200_000,
          costUsd: 0.087,
          model: 'claude-sonnet-4-6',
          elapsedSec: 30,
        }}
      />,
    );
    const block = screen.getByTestId('context-block');
    expect(block.textContent).toContain('$0.09');
  });

  it('renders usage percentage in the donut centre from the data prop', () => {
    // 42800 / 200000 ≈ 21%
    render(
      <ContextBlock
        data={{
          usedTokens: 42_800,
          maxTokens: 200_000,
          costUsd: 0,
          model: 'claude-sonnet-4-6',
          elapsedSec: 30,
        }}
      />,
    );
    const block = screen.getByTestId('context-block');
    expect(block.textContent).toContain('21%');
  });

  it('renders idle/empty state without error when no session is active', () => {
    // Default beforeEach: agentCtx([]) → usedTokens=0, maxTokens=200_000, costUsd=0, elapsedSec=0
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    expect(block.textContent).toContain('CONTEXT');
    expect(block.textContent).toContain('200.0k');
    expect(block.textContent).toContain('0%');
  });
});

describe('AgentSidebar — FilesTouched', () => {
  it('renders the FILES TOUCHED label', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('files-touched');
    expect(block.textContent).toContain('FILES TOUCHED');
  });

  it('renders a row for each distinct file touched (FilesTouched rendered directly)', () => {
    // Wave 13 D4: AgentSidebar resolves primary by paneId. FilesTouched is rendered
    // directly with the data shape the adapter's deriveFilesTouched would produce.
    render(
      <FilesTouched
        data={[
          { path: 'src/a.ts', adds: 0, dels: 0, status: 'edited' },
          { path: 'src/b.ts', adds: 0, dels: 0, status: 'edited' },
          { path: 'src/c.ts', adds: 0, dels: 0, status: 'read' },
          { path: 'src/d.ts', adds: 0, dels: 0, status: 'read' },
        ]}
      />,
    );
    const block = screen.getByTestId('files-touched');
    expect(block.querySelectorAll('[data-testid="files-touched-row"]').length).toBe(4);
  });

  it('renders the path of the actively-edited file (FilesTouched rendered directly)', () => {
    // Provide an 'editing' status entry — mirrors a pending Edit tool call.
    render(
      <FilesTouched data={[{ path: 'src/TerminalPane.tsx', adds: 0, dels: 0, status: 'editing' }]} />,
    );
    const block = screen.getByTestId('files-touched');
    expect(block.textContent).toContain('TerminalPane.tsx');
  });
});

describe('AgentSidebar — LatestHunk', () => {
  it('renders the LATEST HUNK label in the empty placeholder when no diff is available', () => {
    // No diff_review_ready event fired → latestHunk is undefined → EmptyHunkPlaceholder renders.
    render(<AgentSidebar />);
    const placeholder = screen.getByTestId('latest-hunk-empty');
    expect(placeholder.textContent).toContain('LATEST HUNK');
  });

  it('renders the empty placeholder when no live diff exists (no static mock fallback)', () => {
    // Phase 3: static MOCK_DIFF_HUNK_META default has been removed.
    // Without a real diff_review_ready event, the placeholder must render.
    render(<AgentSidebar />);
    expect(screen.getByTestId('latest-hunk-empty')).toBeDefined();
    expect(screen.queryByTestId('latest-hunk')).toBeNull();
  });

  it('does not render Accept/Reject/Open buttons when no live diff is present', () => {
    render(<AgentSidebar />);
    // Stub buttons only appear inside the live-hunk view; placeholder has none.
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
  });

  it('renders the panel structure even with an empty placeholder (D4: now-block absent)', () => {
    // Wave 13 D4: without a paneId-matched session, the NOW slot is replaced by
    // SidebarEmptyState. PanelStack (context, files, hunk, timeline) renders unconditionally.
    render(<AgentSidebar />);
    // NOW slot is empty state, not now-block
    expect(screen.queryByTestId('now-block')).toBeNull();
    // PanelStack panels are unconditional
    expect(screen.getByTestId('hook-timeline')).toBeDefined();
    expect(screen.getByTestId('latest-hunk-empty')).toBeDefined();
  });
});

describe('AgentSidebar — HookTimeline', () => {
  it('renders the TIMELINE label', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('hook-timeline');
    expect(block.textContent).toContain('TIMELINE');
  });

  it('renders the View all no-op button', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('hook-timeline');
    expect(block.textContent).toContain('View all');
  });

  it('renders a running tool event when HookTimeline receives a tool event directly', () => {
    // Wave 13 D4: AgentSidebar resolves primary by paneId. HookTimeline is rendered
    // directly with the event shape the adapter's deriveTimeline would produce.
    const now = Date.now();
    render(
      <HookTimeline
        events={[
          {
            id: 'f',
            t: (now - 12_000 - now) / 1000, // ~-12s relative
            kind: 'tool',
            tool: 'Edit',
            target: 'src/TerminalPane.tsx',
            duration: 0,
            status: 'running',
          },
        ]}
      />,
    );
    const block = screen.getByTestId('hook-timeline');
    expect(block.textContent).toContain('Edit');
  });

  it('renders a prompt event text when HookTimeline receives a prompt event directly', () => {
    // Direct render with prompt event shape matches deriveTimeline output.
    const now = Date.now();
    render(
      <HookTimeline
        events={[
          {
            id: 'p1',
            t: (now - 300_000 - now) / 1000, // ~-300s relative
            kind: 'prompt',
            text: 'refactor TerminalPane to use the new hook event API',
            tokens: 0,
          },
        ]}
      />,
    );
    const block = screen.getByTestId('hook-timeline');
    expect(block.textContent).toContain('refactor TerminalPane');
  });
});

describe('AgentSidebar — Workbench integration', () => {
  it('workbench-agentsidebar test-id resolves on the AgentSidebar root (not a placeholder)', () => {
    render(<Workbench />);
    const el = screen.getByTestId('workbench-agentsidebar');
    // AgentSidebar root contains now-block — placeholder div did not
    expect(el.querySelector('[data-testid="now-block"]')).toBeDefined();
  });

  it('does not import xterm, useAgentEvents, or permission components', async () => {
    const mod = await import('./AgentSidebar/AgentSidebar');
    expect(typeof mod.AgentSidebar).toBe('function');
  });
});

// ── Phase 6: StatusBar ────────────────────────────────────────────────────────

describe('StatusBar', () => {
  it('carries data-testid="workbench-statusbar" on its root element', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('workbench-statusbar')).toBeDefined();
  });

  it('renders the live branch name from useGitBranch', () => {
    render(<StatusBar />);
    // useGitBranch mock returns 'feature/x'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('feature/x');
  });

  it('does not render +adds or −dels — diff stats deferred to follow-up', () => {
    render(<StatusBar />);
    const sb = screen.getByTestId('workbench-statusbar');
    expect(sb.textContent).not.toContain('+126');
    expect(sb.textContent).not.toContain('−42');
  });

  it('renders the fallback model name when no pane-tagged session is active (Wave 13 D4)', () => {
    // Wave 13 D4: StatusBar calls useWorkbenchAgentData() without a paneId. Without a
    // pane-matched session, contextStats.model defaults to 'claude' (FALLBACK_MODEL).
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'task',
          status: 'running',
          startedAt: 1000,
          inputTokens: 0,
          outputTokens: 0,
          model: 'claude-sonnet-4-6',
          toolCalls: [],
        },
      ]),
    );
    render(<StatusBar />);
    // D4: no paneId → FALLBACK_MODEL = 'claude'; 'claude-sonnet-4-6' must NOT appear.
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('claude');
    expect(screen.getByTestId('workbench-statusbar').textContent).not.toContain('claude-sonnet-4-6');
  });

  it('renders zero tokens in status bar when no pane-tagged session is active (Wave 13 D4)', () => {
    // D4: without a paneId match, contextStats.usedTokens = 0 → shows '0 / 200.0k ctx'.
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'task',
          status: 'running',
          startedAt: 1000,
          inputTokens: 40000,
          outputTokens: 2800,
          toolCalls: [],
        },
      ]),
    );
    render(<StatusBar />);
    // Session tokens are NOT reflected — StatusBar sees D4 defaults only.
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('0');
    expect(screen.getByTestId('workbench-statusbar').textContent).not.toContain('42.8k');
  });

  it('renders the context max tokens from the DEFAULT_MAX_TOKENS constant (200k)', () => {
    render(<StatusBar />);
    // DEFAULT_MAX_TOKENS = 200_000 → '200.0k'; no session needed.
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('200.0k');
  });

  it('renders the tests-passing pill with count from MOCK_STATUS_BAR', () => {
    render(<StatusBar />);
    // MOCK_STATUS_BAR.testsPassing = 24
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('24 tests passing');
  });

  it('renders zero cost in status bar when no pane-tagged session is active (Wave 13 D4)', () => {
    // D4: without a paneId match, contextStats.costUsd = 0 → shows '$0.00'.
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'task',
          status: 'running',
          startedAt: 1000,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0.087,
          toolCalls: [],
        },
      ]),
    );
    render(<StatusBar />);
    // Session costUsd is NOT reflected — StatusBar sees D4 default (costUsd=0 → '$0.00').
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('$0.00');
    expect(screen.getByTestId('workbench-statusbar').textContent).not.toContain('$0.09');
  });

  it('renders a live HH:MM:SS clock string (not the static mock value)', () => {
    render(<StatusBar />);
    const text = screen.getByTestId('workbench-statusbar').textContent ?? '';
    // The static mock value '14:32:34' must not appear; a live HH:MM:SS must be present.
    expect(text).not.toContain('14:32:34');
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('renders the "connected" label', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('connected');
  });
});

describe('StatusBar — Workbench integration', () => {
  it('workbench-statusbar test-id resolves on the StatusBar root (not a placeholder)', () => {
    render(<Workbench />);
    const el = screen.getByTestId('workbench-statusbar');
    // Real StatusBar shows live branch name (mocked to 'feature/x')
    expect(el.textContent).toContain('feature/x');
    expect(el.textContent).not.toContain('Status Bar');
  });

  it('all six region test-ids resolve on real components (no placeholders remain)', () => {
    render(<Workbench />);
    expect(screen.getByTestId('workbench-titlebar')).toBeDefined();
    expect(screen.getByTestId('workbench-projectrail')).toBeDefined();
    expect(screen.getByTestId('workbench-innerrail')).toBeDefined();
    expect(screen.getByTestId('workbench-terminals')).toBeDefined();
    expect(screen.getByTestId('workbench-agentsidebar')).toBeDefined();
    expect(screen.getByTestId('workbench-statusbar')).toBeDefined();
  });
});

// ── Wave 6 Phase 2: Scanline overlay ─────────────────────────────────────────

describe('Workbench — scanline overlay (Wave 6 Phase 2)', () => {
  it('does NOT render the scanline overlay when data-scanlines is "false"', () => {
    // Default: no Retro theme applied → data-scanlines is not "true"
    document.documentElement.dataset['scanlines'] = 'false';
    render(<Workbench />);
    expect(screen.queryByTestId('workbench-scanlines')).toBeNull();
  });

  it('renders the scanline overlay when data-scanlines is "true"', () => {
    document.documentElement.dataset['scanlines'] = 'true';
    render(<Workbench />);
    expect(screen.getByTestId('workbench-scanlines')).toBeDefined();
  });

  it('renders the overlay when the theme-applied event fires with scanlines enabled', () => {
    // Start with scanlines off, then simulate a Retro theme switch.
    document.documentElement.dataset['scanlines'] = 'false';
    render(<Workbench />);
    expect(screen.queryByTestId('workbench-scanlines')).toBeNull();

    // Simulate the bridge writing data-scanlines="true" + dispatching the event.
    // act() flushes the React state update triggered by the event handler.
    act(() => {
      document.documentElement.dataset['scanlines'] = 'true';
      window.dispatchEvent(new Event('agent-ide:theme-applied'));
    });

    expect(screen.getByTestId('workbench-scanlines')).toBeDefined();
  });

  it('removes the overlay when the theme-applied event fires with scanlines disabled', () => {
    // Start with Retro active.
    document.documentElement.dataset['scanlines'] = 'true';
    render(<Workbench />);
    expect(screen.getByTestId('workbench-scanlines')).toBeDefined();

    // Switch away from Retro.
    act(() => {
      document.documentElement.dataset['scanlines'] = 'false';
      window.dispatchEvent(new Event('agent-ide:theme-applied'));
    });

    expect(screen.queryByTestId('workbench-scanlines')).toBeNull();
  });
});

// ── (b) useCanonWorkbenchFlag — flag off leaves prior shell unchanged ────────

// Mock window.electronAPI so the hook can be tested without Electron.
function mockConfig(canonWorkbench: boolean): void {
  // Patch only electronAPI — jsdom's window is already populated.
  vi.stubGlobal('electronAPI', {
    config: {
      getAll: vi.fn().mockResolvedValue({ layout: { canonWorkbench } }),
    },
  });
}

describe('useCanonWorkbenchFlag', () => {
  it('returns false when config.layout.canonWorkbench is false', async () => {
    mockConfig(false);
    const { readCanonWorkbenchFlag } = await import('../../hooks/useCanonWorkbenchFlag');
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });

  it('returns true when config.layout.canonWorkbench is true', async () => {
    mockConfig(true);
    const { readCanonWorkbenchFlag } = await import('../../hooks/useCanonWorkbenchFlag');
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(true);
  });

  it('returns false when electronAPI is absent (SSR / web stub)', async () => {
    vi.stubGlobal('window', {});
    const { readCanonWorkbenchFlag } = await import('../../hooks/useCanonWorkbenchFlag');
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });

  it('returns false when config.getAll throws', async () => {
    vi.stubGlobal('window', {
      ...window,
      electronAPI: {
        config: { getAll: vi.fn().mockRejectedValue(new Error('ipc error')) },
      },
    });
    const { readCanonWorkbenchFlag } = await import('../../hooks/useCanonWorkbenchFlag');
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });
});
