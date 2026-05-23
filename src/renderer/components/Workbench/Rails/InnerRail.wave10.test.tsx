/**
 * @vitest-environment jsdom
 *
 * InnerRail.wave10.test.tsx — Wave 10 Phase 2 inner rail tests.
 *
 * Covers:
 *   - InnerRailProjectDropdown renders at the header
 *   - Selecting a project calls setActiveProjectRoot
 *   - InnerRailAddProjectButton calls files.selectFolder + addProjectRoot
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockSetActiveProjectRoot = vi.fn();
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
    setActiveProjectRoot: mockSetActiveProjectRoot,
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

describe('InnerRail — Wave 10 project dropdown header', () => {
  beforeEach(() => stubFiles());

  it('renders InnerRailProjectDropdown trigger at the header', () => {
    render(<InnerRail />);
    expect(screen.getByTestId('innerrail-project-dropdown')).toBeTruthy();
    expect(screen.getByTestId('innerrail-project-trigger')).toBeTruthy();
  });

  it('trigger shows the active project name', () => {
    render(<InnerRail />);
    const trigger = screen.getByTestId('innerrail-project-trigger');
    expect(trigger.textContent).toContain('alpha');
  });

  it('clicking trigger opens the project list', () => {
    render(<InnerRail />);
    fireEvent.click(screen.getByTestId('innerrail-project-trigger'));
    expect(screen.getByTestId('innerrail-project-row-beta')).toBeTruthy();
  });

  it('selecting a project calls setActiveProjectRoot with the correct path', () => {
    render(<InnerRail />);
    fireEvent.click(screen.getByTestId('innerrail-project-trigger'));
    fireEvent.click(screen.getByTestId('innerrail-project-row-beta'));
    expect(mockSetActiveProjectRoot).toHaveBeenCalledWith('/projects/beta');
  });

  it('Esc closes the project dropdown', () => {
    render(<InnerRail />);
    fireEvent.click(screen.getByTestId('innerrail-project-trigger'));
    expect(screen.queryByTestId('innerrail-project-row-beta')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('innerrail-project-row-beta')).toBeNull();
  });
});

describe('InnerRail — Wave 10 add project button', () => {
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
