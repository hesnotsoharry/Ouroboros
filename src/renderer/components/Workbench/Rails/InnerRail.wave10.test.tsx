/**
 * @vitest-environment jsdom
 *
 * InnerRail.wave10.test.tsx — Wave 10 Phase 2 inner rail tests.
 *
 * Covers:
 *   - CommandPaletteButton renders at the top of the rail and dispatches the
 *     'agent-ide:command-palette' event on click
 *   - InnerRailAddProjectButton calls files.selectFolder + addProjectRoot
 *   - InnerRailProjectDropdown is NOT rendered (removed — titlebar owns it)
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAddProjectRoot = vi.fn();

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/projects/alpha',
    projectRoots: ['/projects/alpha', '/projects/beta'],
    projectName: 'alpha',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: mockAddProjectRoot,
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
    setActiveProjectRoot: vi.fn(),
  }),
  useProjectOptional: () => null,
}));

vi.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { recentProjects: [] },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'main' }),
}));

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(() => ({
    agents: [],
    activeCount: 0,
    currentSessions: [],
    historicalSessions: [],
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  })),
}));

// WorkbenchFileTree makes IPC calls — stub it out
vi.mock('./WorkbenchFileTree', () => ({
  WorkbenchFileTree: () => React.createElement('div', { 'data-testid': 'file-tree-stub' }),
}));

function stubFiles(path: string | null = null): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    files: {
      readDir: vi.fn().mockResolvedValue({ success: true, items: [] }),
      selectFolder: path
        ? vi.fn().mockResolvedValue({ success: true, path })
        : vi.fn().mockResolvedValue({ success: false }),
    },
  };
}

import { InnerRail } from './InnerRail';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('InnerRail — command palette button', () => {
  beforeEach(() => stubFiles());

  it('renders a command palette button at the top of the rail', () => {
    render(<InnerRail />);
    expect(screen.getByTitle('Command palette (Ctrl K)')).toBeTruthy();
  });

  it('command palette button dispatches agent-ide:command-palette on click', () => {
    render(<InnerRail />);
    const fired: string[] = [];
    const handler = (e: Event) => fired.push(e.type);
    window.addEventListener('agent-ide:command-palette', handler);
    fireEvent.click(screen.getByTitle('Command palette (Ctrl K)'));
    expect(fired).toHaveLength(1);
    expect(fired[0]).toBe('agent-ide:command-palette');
    window.removeEventListener('agent-ide:command-palette', handler);
  });

  it('does NOT render InnerRailProjectDropdown (removed — titlebar owns it)', () => {
    render(<InnerRail />);
    expect(screen.queryByTestId('innerrail-project-dropdown')).toBeNull();
    expect(screen.queryByTestId('innerrail-project-trigger')).toBeNull();
  });

  it('does NOT render the Running section header', () => {
    render(<InnerRail />);
    // The "Running" label was in the now-removed RunningSectionHeader
    const rail = screen.getByTestId('workbench-innerrail');
    expect(rail.textContent).not.toContain('Running');
  });

  it('does NOT render a git branch footer', () => {
    render(<InnerRail />);
    // BranchFooter was removed; useGitBranch returns 'main' but must not appear
    const rail = screen.getByTestId('workbench-innerrail');
    expect(rail.textContent).not.toContain('main');
  });
});

describe('InnerRail — add project button', () => {
  it('renders InnerRailAddProjectButton', () => {
    stubFiles();
    render(<InnerRail />);
    expect(screen.getByTestId('innerrail-add-project-btn')).toBeTruthy();
  });

  it('clicking with successful picker calls addProjectRoot', async () => {
    stubFiles('/projects/gamma');
    render(<InnerRail />);
    fireEvent.click(screen.getByTestId('innerrail-add-project-btn'));
    await waitFor(() => {
      expect(mockAddProjectRoot).toHaveBeenCalledWith('/projects/gamma');
    });
  });

  it('clicking with cancelled picker does not call addProjectRoot', async () => {
    stubFiles(null);
    render(<InnerRail />);
    fireEvent.click(screen.getByTestId('innerrail-add-project-btn'));
    await waitFor(() => {
      expect(mockAddProjectRoot).not.toHaveBeenCalled();
    });
  });
});
