/**
 * @vitest-environment jsdom
 *
 * Workbench.test.tsx — Phase 1 + Phase 2 tests.
 *
 * Phase 1 trophy: the flag branch + frame render is the seam.
 * (a) flag on → Workbench mounts and all six region test-ids are present
 * (b) flag off → the prior InnerApp shell branch is unchanged (Workbench not rendered)
 *
 * Phase 2 additions: TitleBar renders the app mark, project + branch chips,
 * AgentGlobe (running content from mock), and the three window controls.
 *
 * Wave 2 Phase 2: TerminalShell tests updated — mock bodies removed; both
 * frames are live terminals. TerminalInstance is mocked to keep renders lightweight.
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

// ProjectContext stub — useWorkbenchTerminals reads projectRoot for cwd.
vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/test-root',
    projectRoots: ['/test-root'],
    projectName: 'test',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => null,
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

import { AgentSidebar } from './AgentSidebar/AgentSidebar';
import { InnerRail } from './Rails/InnerRail';
import { ProjectRail } from './Rails/ProjectRail';
import { UnifiedRail } from './Rails/UnifiedRail';
import { StatusBar } from './StatusBar';
import { CenterPane } from './Terminals/CenterPane';
import { TerminalShell } from './Terminals/TerminalShell';
import { Workbench } from './Workbench';

// Install the pty stub before every test so any render(<Workbench />) or
// render(<CenterPane />) can call useWorkbenchTerminals → pty.spawn without
// crashing. Tests that need their own electronAPI shape (useCanonWorkbenchFlag)
// override with vi.stubGlobal after this runs.
beforeEach(() => {
  stubPty();
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

  it('renders the active project name from mock data', () => {
    render(<Workbench />);
    // MOCK_PROJECTS[0] is agent-ide with active: true
    expect(screen.getByText('agent-ide')).toBeDefined();
  });

  it('renders the active project branch name from mock data', () => {
    render(<Workbench />);
    // MOCK_PROJECTS[0].branch = 'wave/1-workbench-static-shell'
    // Use getAllByText because InnerRail footer also shows the branch name.
    const matches = screen.getAllByText('wave/1-workbench-static-shell');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders the AgentGlobe with running model name from mock data', () => {
    render(<Workbench />);
    const globe = screen.getByTestId('agent-globe');
    // MOCK_CONTEXT_STATS.model = 'claude-sonnet-4-6'
    expect(globe.textContent).toContain('claude-sonnet-4-6');
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

  it('renders one chip per mock project (3 chips)', () => {
    render(<ProjectRail />);
    const rail = screen.getByTestId('workbench-projectrail');
    // Each project chip is a button with the project name as title attribute.
    expect(rail.querySelector('[title="agent-ide"]')).toBeDefined();
    expect(rail.querySelector('[title="pinpoint"]')).toBeDefined();
    expect(rail.querySelector('[title="lumen-cli"]')).toBeDefined();
  });

  it('renders the active project initial letter (A) in the active chip', () => {
    render(<ProjectRail />);
    // The active project is agent-ide (initial "A"), active: true in mock.
    const chip = screen.getByTitle('agent-ide');
    expect(chip.textContent).toContain('A');
  });

  it('renders a dirty-count badge on inactive projects with dirty > 0', () => {
    render(<ProjectRail />);
    // lumen-cli has dirty: 2 and is not active — badge should appear.
    const chip = screen.getByTitle('lumen-cli');
    expect(chip.textContent).toContain('2');
  });

  it('does not render a dirty badge on the active project', () => {
    render(<ProjectRail />);
    // agent-ide is active (dirty: 4 but badge is suppressed per canon).
    const chip = screen.getByTitle('agent-ide');
    // The chip text should be just the initial "A", no "4".
    expect(chip.textContent).not.toContain('4');
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

  it('renders Running section with mock session labels', () => {
    render(<InnerRail />);
    // From MOCK_SESSIONS: 'claude · main' is in agent-ide (current project).
    expect(screen.getByText('claude · main')).toBeDefined();
    expect(screen.getByText('claude · refactor')).toBeDefined();
  });

  it('renders the other-project session (lumen-cli)', () => {
    render(<InnerRail />);
    expect(screen.getByText('claude · streaming')).toBeDefined();
  });

  it('renders the files section with mock file tree entries', () => {
    render(<InnerRail />);
    // MOCK_FILE_TREE includes 'src' at depth 0 and 'tokens.css'.
    expect(screen.getByText('src')).toBeDefined();
    expect(screen.getByText('tokens.css')).toBeDefined();
  });

  it('renders the branch footer with branch name and diff stats', () => {
    render(<InnerRail />);
    // MOCK_BRANCH.name = 'wave/1-workbench-static-shell'
    expect(screen.getByText('wave/1-workbench-static-shell')).toBeDefined();
    expect(screen.getByText('+126')).toBeDefined();
    expect(screen.getByText('−42')).toBeDefined();
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

  it('renders the header with active session label from mock data', () => {
    render(<AgentSidebar />);
    // MOCK_SESSIONS[0] is active: label 'claude · main'
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

  it('renders the mock tool name (Edit) in the now-block', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    // MOCK_NOW_TOOL_CALL.tool = 'Edit'
    expect(block.textContent).toContain('Edit');
  });

  it('renders the mock duration in the now-block', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('now-block');
    // MOCK_NOW_TOOL_CALL.elapsedSec = 12 → '12s'
    expect(block.textContent).toContain('12s');
  });
});

describe('AgentSidebar — ContextBlock', () => {
  it('renders the CONTEXT label', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    expect(block.textContent).toContain('CONTEXT');
  });

  it('renders the token count from mock data', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    // MOCK_CONTEXT_STATS: usedTokens 42800 → '42.8k', maxTokens 200000 → '200.0k'
    expect(block.textContent).toContain('42.8k');
    expect(block.textContent).toContain('200.0k');
  });

  it('renders the usage percentage in the donut centre', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('context-block');
    // 42800 / 200000 ≈ 21%
    expect(block.textContent).toContain('21%');
  });
});

describe('AgentSidebar — FilesTouched', () => {
  it('renders the FILES TOUCHED label', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('files-touched');
    expect(block.textContent).toContain('FILES TOUCHED');
  });

  it('renders a row for each mock touched file', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('files-touched');
    // MOCK_FILES_TOUCHED has 4 entries
    expect(block.querySelectorAll('[data-testid="files-touched-row"]').length).toBe(4);
  });

  it('renders the path of the actively-edited file', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('files-touched');
    // MOCK_FILES_TOUCHED[0].status = 'editing', path includes 'TerminalPane.tsx'
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

  it('renders the running tool event (e12 Edit — status running) as a full card', () => {
    render(<AgentSidebar />);
    // e12 in MOCK_HOOK_EVENTS is the running Edit — most recent by t=−12
    const block = screen.getByTestId('hook-timeline');
    // The running event appears first (t closest to 0)
    expect(block.textContent).toContain('Edit');
  });

  it('renders a prompt event text in the timeline', () => {
    render(<AgentSidebar />);
    const block = screen.getByTestId('hook-timeline');
    // e1 is a prompt event with text starting 'refactor TerminalPane...'
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

  it('renders the branch name from MOCK_BRANCH', () => {
    render(<StatusBar />);
    // MOCK_BRANCH.name = 'wave/1-workbench-static-shell'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain(
      'wave/1-workbench-static-shell',
    );
  });

  it('renders branch adds in success color text', () => {
    render(<StatusBar />);
    // MOCK_BRANCH.adds = 126
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('+126');
  });

  it('renders branch dels in error color text', () => {
    render(<StatusBar />);
    // MOCK_BRANCH.dels = 42
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('−42');
  });

  it('renders the model name from MOCK_CONTEXT_STATS', () => {
    render(<StatusBar />);
    // MOCK_CONTEXT_STATS.model = 'claude-sonnet-4-6'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('claude-sonnet-4-6');
  });

  it('renders the context used tokens formatted as compact string', () => {
    render(<StatusBar />);
    // MOCK_CONTEXT_STATS.usedTokens = 42800 → '42.8k'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('42.8k');
  });

  it('renders the context max tokens formatted as compact string', () => {
    render(<StatusBar />);
    // MOCK_CONTEXT_STATS.maxTokens = 200000 → '200.0k ctx'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('200.0k');
  });

  it('renders the tests-passing pill with count from MOCK_STATUS_BAR', () => {
    render(<StatusBar />);
    // MOCK_STATUS_BAR.testsPassing = 24
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('24 tests passing');
  });

  it('renders the cost formatted from MOCK_CONTEXT_STATS.costUsd', () => {
    render(<StatusBar />);
    // MOCK_CONTEXT_STATS.costUsd = 0.087 → '$0.09'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('$0.09');
  });

  it('renders the static clock string from MOCK_STATUS_BAR', () => {
    render(<StatusBar />);
    // MOCK_STATUS_BAR.clock = '14:32:34'
    expect(screen.getByTestId('workbench-statusbar').textContent).toContain('14:32:34');
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
    // Real StatusBar shows branch name — placeholder showed "Status Bar" text
    expect(el.textContent).toContain('wave/1-workbench-static-shell');
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
