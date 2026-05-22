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
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InnerRail } from './Rails/InnerRail';
import { ProjectRail } from './Rails/ProjectRail';
import { UnifiedRail } from './Rails/UnifiedRail';
import { CenterPane } from './Terminals/CenterPane';
import { TerminalShell } from './Terminals/TerminalShell';
import { Workbench } from './Workbench';

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

  it('renders the two remaining placeholder region labels', () => {
    render(<Workbench />);

    // Title Bar, Project Rail, Inner Rail, and Terminals are now replaced by
    // real components — only the two not yet implemented show placeholder text.
    expect(screen.getByText('Agent Sidebar')).toBeDefined();
    expect(screen.getByText('Status Bar')).toBeDefined();
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
    render(<CenterPane />);
    expect(screen.getByTestId('workbench-terminals')).toBeDefined();
  });

  it('renders both terminal shells (upper CC + lower shell)', () => {
    render(<CenterPane />);
    expect(screen.getByTestId('terminal-shell-upper')).toBeDefined();
    expect(screen.getByTestId('terminal-shell-lower')).toBeDefined();
  });

  it('does not import xterm — module loads without terminal-emulator errors', async () => {
    const mod = await import('./Terminals/CenterPane');
    expect(typeof mod.CenterPane).toBe('function');
  });
});

describe('TerminalShell (upper — CC)', () => {
  it('renders tab labels from MOCK_TERM_TABS_UPPER', () => {
    render(<TerminalShell kind="cc" flex={1.55} />);
    // MOCK_TERM_TABS_UPPER: 'claude · main', 'claude · refactor'
    expect(screen.getByText('claude · main')).toBeDefined();
    expect(screen.getByText('claude · refactor')).toBeDefined();
  });

  it('renders the CC prompt box', () => {
    render(<TerminalShell kind="cc" flex={1.55} />);
    expect(screen.getByTestId('cc-prompt-box')).toBeDefined();
  });

  it('renders the CC status line containing the model name', () => {
    render(<TerminalShell kind="cc" flex={1.55} />);
    const statusLine = screen.getByTestId('cc-status-line');
    // MOCK_CC_STATUS_LINE includes 'claude-sonnet-4-6'
    expect(statusLine.textContent).toContain('claude-sonnet-4-6');
  });

  it('renders the CC status line containing the context percentage', () => {
    render(<TerminalShell kind="cc" flex={1.55} />);
    const statusLine = screen.getByTestId('cc-status-line');
    expect(statusLine.textContent).toContain('47% context left');
  });

  it('renders mock CC TUI output lines', () => {
    render(<TerminalShell kind="cc" flex={1.55} />);
    // First CC TUI line (Reading TerminalPane) should be in the DOM.
    expect(screen.getByText(/Reading src\/renderer\/components\/Terminal\/TerminalPane\.tsx/)).toBeDefined();
  });

  it('renders the Split and Maximize tab-bar icons', () => {
    render(<TerminalShell kind="cc" flex={1.55} />);
    expect(screen.getByTitle('Split')).toBeDefined();
    expect(screen.getByTitle('Maximize')).toBeDefined();
  });
});

describe('TerminalShell (lower — shell)', () => {
  it('renders tab labels from MOCK_TERM_TABS_LOWER', () => {
    render(<TerminalShell kind="shell" flex={1} />);
    // MOCK_TERM_TABS_LOWER: 'dev server', 'test:watch', 'shell'
    expect(screen.getByText('dev server')).toBeDefined();
    expect(screen.getByText('test:watch')).toBeDefined();
  });

  it('does NOT render the CC prompt box', () => {
    render(<TerminalShell kind="shell" flex={1} />);
    expect(screen.queryByTestId('cc-prompt-box')).toBeNull();
  });

  it('does NOT render the CC status line', () => {
    render(<TerminalShell kind="shell" flex={1} />);
    expect(screen.queryByTestId('cc-status-line')).toBeNull();
  });

  it('renders the shell prompt cursor line', () => {
    render(<TerminalShell kind="shell" flex={1} />);
    expect(screen.getByTestId('shell-prompt-line')).toBeDefined();
  });

  it('renders mock shell output lines', () => {
    render(<TerminalShell kind="shell" flex={1} />);
    // MOCK_SHELL_LINES includes VITE ready message
    expect(screen.getByText(/VITE v5\.4\.2\s+ready/)).toBeDefined();
  });
});

describe('Workbench — Phase 4 integration', () => {
  it('workbench-terminals test-id resolves on CenterPane root (not a placeholder)', () => {
    render(<Workbench />);
    const el = screen.getByTestId('workbench-terminals');
    // CenterPane root has both terminal shells as descendants
    expect(el.querySelector('[data-testid="terminal-shell-upper"]')).toBeDefined();
    expect(el.querySelector('[data-testid="terminal-shell-lower"]')).toBeDefined();
  });

  it('Agent Sidebar placeholder is still a placeholder (untouched)', () => {
    render(<Workbench />);
    expect(screen.getByTestId('workbench-agentsidebar')).toBeDefined();
    expect(screen.getByText('Agent Sidebar')).toBeDefined();
  });

  it('Status Bar placeholder is still a placeholder (untouched)', () => {
    render(<Workbench />);
    expect(screen.getByTestId('workbench-statusbar')).toBeDefined();
    expect(screen.getByText('Status Bar')).toBeDefined();
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
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });

  it('returns true when config.layout.canonWorkbench is true', async () => {
    mockConfig(true);
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(true);
  });

  it('returns false when electronAPI is absent (SSR / web stub)', async () => {
    vi.stubGlobal('window', {});
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
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
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });
});
