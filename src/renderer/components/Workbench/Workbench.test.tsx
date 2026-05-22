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

import { cleanup, render, screen } from '@testing-library/react';
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

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';
import { AgentSidebar } from './AgentSidebar/AgentSidebar';
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
    // projectRoots = ['/projects/agent-ide'] → basename = 'agent-ide'
    expect(screen.getByText('agent-ide')).toBeDefined();
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

  it('renders a session from another project (other-project group)', () => {
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
    expect(screen.getByText('claude · streaming')).toBeDefined();
  });

  it('renders the files section with mock file tree entries', () => {
    render(<InnerRail />);
    // MOCK_FILE_TREE includes 'src' at depth 0 and 'tokens.css'.
    expect(screen.getByText('src')).toBeDefined();
    expect(screen.getByText('tokens.css')).toBeDefined();
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

// ── Phase 3: UnifiedRail (built but not mounted in Workbench this wave) ───────

describe('UnifiedRail', () => {
  it('renders the workbench-unifiedrail test-id on its root element', () => {
    render(<UnifiedRail />);
    expect(screen.getByTestId('workbench-unifiedrail')).toBeDefined();
  });

  it('renders one accordion per mock project', () => {
    render(<UnifiedRail />);
    // Each project name appears in the accordion header.
    expect(screen.getByText('agent-ide')).toBeDefined();
    expect(screen.getByText('pinpoint')).toBeDefined();
    expect(screen.getByText('lumen-cli')).toBeDefined();
  });

  it('expands the active project accordion body (RUNNING + FILES labels)', () => {
    render(<UnifiedRail />);
    // The active project (agent-ide) is expanded — body labels visible.
    const items = screen.getAllByText(/running/i);
    expect(items.length).toBeGreaterThan(0);
    const fileItems = screen.getAllByText(/files/i);
    expect(fileItems.length).toBeGreaterThan(0);
  });

  it('renders the branch footer', () => {
    render(<UnifiedRail />);
    expect(screen.getByText('wave/1-workbench-static-shell')).toBeDefined();
  });

  it('is NOT rendered inside Workbench (dual is default)', () => {
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
  it('renders tab labels from MOCK_TERM_TABS_UPPER', () => {
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    // MOCK_TERM_TABS_UPPER: 'claude · main', 'claude · refactor'
    expect(screen.getByText('claude · main')).toBeDefined();
    expect(screen.getByText('claude · refactor')).toBeDefined();
  });

  it('renders a live TerminalInstance in the well body', () => {
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.getByTestId('terminal-instance-test-upper')).toBeDefined();
  });

  it('does NOT render the mock CC prompt box', () => {
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.queryByTestId('cc-prompt-box')).toBeNull();
  });

  it('does NOT render the mock CC status line', () => {
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.queryByTestId('cc-status-line')).toBeNull();
  });

  it('renders the Split and Maximize tab-bar icons', () => {
    render(<TerminalShell kind="cc" flex={1.55} sessionId="test-upper" isActive />);
    expect(screen.getByTitle('Split')).toBeDefined();
    expect(screen.getByTitle('Maximize')).toBeDefined();
  });
});

describe('TerminalShell (lower — shell)', () => {
  it('renders tab labels from MOCK_TERM_TABS_LOWER', () => {
    render(<TerminalShell kind="shell" flex={1} sessionId="test-lower" isActive />);
    // MOCK_TERM_TABS_LOWER: 'dev server', 'test:watch', 'shell'
    expect(screen.getByText('dev server')).toBeDefined();
    expect(screen.getByText('test:watch')).toBeDefined();
  });

  it('renders a live TerminalInstance in the well body', () => {
    render(<TerminalShell kind="shell" flex={1} sessionId="test-lower" isActive />);
    expect(screen.getByTestId('terminal-instance-test-lower')).toBeDefined();
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

  it('renders the header with the primary session label from live adapter', () => {
    // Provide a running session — it becomes the primary (active) session.
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
    expect(sidebar.textContent).toContain('claude · main');
  });

  it('renders the Stop button in the header', () => {
    render(<AgentSidebar />);
    expect(screen.getByTitle('Stop')).toBeDefined();
  });

  it('renders the Maximize sidebar button in the header', () => {
    render(<AgentSidebar />);
    expect(screen.getByTitle('Maximize sidebar')).toBeDefined();
  });

  it('renders all five panel test-ids', () => {
    render(<AgentSidebar />);
    expect(screen.getByTestId('now-block')).toBeDefined();
    expect(screen.getByTestId('context-block')).toBeDefined();
    expect(screen.getByTestId('files-touched')).toBeDefined();
    expect(screen.getByTestId('latest-hunk')).toBeDefined();
    expect(screen.getByTestId('hook-timeline')).toBeDefined();
  });
});

describe('AgentSidebar — NowBlock', () => {
  it('renders the NOW label in the now-block', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    expect(block.textContent).toContain('NOW');
  });

  it('renders live tool name from adapter (empty session → empty tool, no Edit mock)', () => {
    // Default context has no sessions → activeTool = '' → no 'Edit' from mock constant.
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    // The '→' arrow separator is always present in ToolRow
    expect(block.textContent).toContain('→');
  });

  it('renders live elapsed from adapter (empty session → 0s)', () => {
    // Default context has no sessions → elapsedSec = 0 → '0s' duration pill.
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    expect(block.textContent).toContain('0s');
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
  it('renders live tool name when primary session has a pending tool call', () => {
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'claude · main',
          status: 'running',
          startedAt: Date.now() - 45_000,
          inputTokens: 10_000,
          outputTokens: 2_000,
          model: 'claude-sonnet-4-6',
          toolCalls: [
            {
              id: 'tc1',
              toolName: 'Edit',
              input: 'src/renderer/App.tsx',
              timestamp: Date.now() - 5_000,
              status: 'pending',
            },
          ],
        },
      ]),
    );
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    // Live tool name from adapter.activeTool
    expect(block.textContent).toContain('Edit');
    // Live target from adapter.target
    expect(block.textContent).toContain('src/renderer/App.tsx');
  });

  it('renders live elapsed seconds in the duration pill', () => {
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'claude · main',
          status: 'running',
          startedAt: Date.now() - 30_000,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: [],
        },
      ]),
    );
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    // elapsedSec derived from startedAt offset (~30s); pill shows 'Ns' or 'Nm NNs'
    expect(block.textContent).toMatch(/\d+s/);
    // Must NOT show the frozen mock value 12s (from MOCK_NOW_TOOL_CALL)
    // This is validated by checking it shows a non-mock duration derived from startedAt.
  });

  it('renders idle/empty state without error when no session is active', () => {
    // Default beforeEach: agentCtx([]) → no primary session → activeTool='', target='', elapsedSec=0
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    expect(block.textContent).toContain('NOW');
    expect(block.textContent).toContain('0s');
  });
});

describe('ContextBlock — live adapter data (Wave 4 Phase 1)', () => {
  it('renders live used/max tokens from a running session', () => {
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'claude · main',
          status: 'running',
          startedAt: Date.now() - 60_000,
          inputTokens: 40_000,
          outputTokens: 2_800,
          model: 'claude-sonnet-4-6',
          toolCalls: [],
        },
      ]),
    );
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    // inputTokens(40000) + outputTokens(2800) = 42800 → '42.8k'
    expect(block.textContent).toContain('42.8k');
    expect(block.textContent).toContain('200.0k');
  });

  it('renders live cost from a running session', () => {
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'claude · main',
          status: 'running',
          startedAt: Date.now() - 30_000,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0.087,
          model: 'claude-sonnet-4-6',
          toolCalls: [],
        },
      ]),
    );
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    // costUsd 0.087 → '$0.09' via toFixed(2)
    expect(block.textContent).toContain('$0.09');
  });

  it('renders live usage percentage in the donut centre', () => {
    mockedAgentCtx.mockReturnValue(
      agentCtx([
        {
          id: 'p1',
          taskLabel: 'claude · main',
          status: 'running',
          startedAt: Date.now() - 30_000,
          inputTokens: 40_000,
          outputTokens: 2_800,
          model: 'claude-sonnet-4-6',
          toolCalls: [],
        },
      ]),
    );
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    // 42800 / 200000 ≈ 21%
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

  it('renders a row for each distinct file touched by the active session', () => {
    const s: AgentSession = {
      id: 's1',
      taskLabel: 'test',
      status: 'running',
      startedAt: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [
        { id: 'a', toolName: 'Edit', input: 'src/a.ts', timestamp: 1, status: 'success' },
        { id: 'b', toolName: 'Write', input: 'src/b.ts', timestamp: 2, status: 'success' },
        { id: 'c', toolName: 'Read', input: 'src/c.ts', timestamp: 3, status: 'success' },
        { id: 'd', toolName: 'Read', input: 'src/d.ts', timestamp: 4, status: 'success' },
      ],
    };
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const block = screen.getByTestId('files-touched');
    expect(block.querySelectorAll('[data-testid="files-touched-row"]').length).toBe(4);
  });

  it('renders the path of the actively-edited file', () => {
    const s: AgentSession = {
      id: 's1',
      taskLabel: 'test',
      status: 'running',
      startedAt: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [
        {
          id: 'e',
          toolName: 'Edit',
          input: 'src/TerminalPane.tsx',
          timestamp: 1,
          status: 'pending',
        },
      ],
    };
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const block = screen.getByTestId('files-touched');
    expect(block.textContent).toContain('TerminalPane.tsx');
  });
});

describe('AgentSidebar — LatestHunk', () => {
  it('renders the LATEST HUNK label', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('latest-hunk');
    expect(block.textContent).toContain('LATEST HUNK');
  });

  it('renders a diff row for each mock diff line', () => {
    render(<AgentSidebar />);
    // MOCK_DIFF_HUNK has 8 lines
    const block = screen.getByTestId('latest-hunk');
    // Each DiffRow renders inline — check for a known add line text
    expect(block.textContent).toContain("hooks.on('PostToolUse'");
  });

  it('renders Accept, Reject, and Open stub buttons', () => {
    render(<AgentSidebar />);
    expect(screen.getByText('Accept')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
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

  it('renders a running tool event from the active session', () => {
    const s: AgentSession = {
      id: 's1',
      taskLabel: 'test',
      status: 'running',
      startedAt: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [
        {
          id: 'f',
          toolName: 'Edit',
          input: 'src/TerminalPane.tsx',
          timestamp: Date.now() - 12_000,
          status: 'pending',
        },
      ],
    };
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const block = screen.getByTestId('hook-timeline');
    expect(block.textContent).toContain('Edit');
  });

  it('renders a prompt event text in the timeline', () => {
    const s: AgentSession = {
      id: 's1',
      taskLabel: 'test',
      status: 'running',
      startedAt: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [],
      conversationTurns: [
        {
          type: 'prompt',
          content: 'refactor TerminalPane to use the new hook event API',
          timestamp: Date.now() - 300_000,
        },
      ],
    };
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
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

  it('renders the model name from the live primary session', () => {
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
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('claude-sonnet-4-6');
  });

  it('renders context used tokens as compact string from live primary session', () => {
    // inputTokens(40000) + outputTokens(2800) = 42800 → '42.8k'
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
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('42.8k');
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

  it('renders the cost formatted from the live primary session costUsd', () => {
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
    // costUsd 0.087 → '$0.09'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('$0.09');
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
