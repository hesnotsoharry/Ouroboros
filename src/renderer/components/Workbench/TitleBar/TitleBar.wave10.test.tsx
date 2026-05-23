/**
 * @vitest-environment jsdom
 *
 * TitleBar.wave10.test.tsx — Wave 10 Phase 2 title-bar dropdown tests.
 *
 * Covers:
 *   - ProjectChip click opens TitleBarProjectDropdown
 *   - Selecting a project row calls setActiveProjectRoot + closes dropdown
 *   - BranchChip click opens TitleBarBranchDropdown
 *   - Branch dropdown lists branches from git.branches IPC
 *   - Selecting a branch calls git.checkout + closes dropdown
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockSetActiveProjectRoot = vi.fn();

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/projects/alpha',
    projectRoots: ['/projects/alpha', '/projects/beta'],
    projectName: 'alpha',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
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

vi.mock('../../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
  }),
}));

// Mock useGitBranches so branch dropdown has deterministic data
vi.mock('./useGitBranches', () => ({
  useGitBranches: () => ({
    branches: ['main', 'feature/test'],
    current: 'main',
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

const mockGitCheckout = vi.fn().mockResolvedValue({ success: true });

function stubGit(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    git: {
      branches: vi.fn().mockResolvedValue({ success: true, branches: ['main', 'feature/test'] }),
      checkout: mockGitCheckout,
    },
  };
}

import { TitleBar } from './TitleBar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('TitleBar — Wave 10 project dropdown', () => {
  beforeEach(() => stubGit());

  it('ProjectChip click opens TitleBarProjectDropdown', () => {
    render(<TitleBar />);
    // Find the project chip by its dropdown icon presence (TitleChipBase renders a button)
    const chip = screen.getAllByRole('button').find((b) => b.textContent?.includes('alpha'));
    expect(chip).toBeTruthy();
    fireEvent.click(chip!);
    expect(screen.getByTestId('titlebar-project-dropdown')).toBeTruthy();
  });

  it('selecting a project row calls setActiveProjectRoot and closes dropdown', () => {
    render(<TitleBar />);
    const chip = screen.getAllByRole('button').find((b) => b.textContent?.includes('alpha'));
    fireEvent.click(chip!);
    const betaRow = screen.getByTestId('titlebar-project-row-beta');
    fireEvent.click(betaRow);
    expect(mockSetActiveProjectRoot).toHaveBeenCalledWith('/projects/beta');
    expect(screen.queryByTestId('titlebar-project-dropdown')).toBeNull();
  });

  it('Esc closes TitleBarProjectDropdown', () => {
    render(<TitleBar />);
    const chip = screen.getAllByRole('button').find((b) => b.textContent?.includes('alpha'));
    fireEvent.click(chip!);
    expect(screen.queryByTestId('titlebar-project-dropdown')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('titlebar-project-dropdown')).toBeNull();
  });
});

describe('TitleBar — Wave 10 branch dropdown', () => {
  beforeEach(() => stubGit());

  it('BranchChip click opens TitleBarBranchDropdown with branch list', () => {
    render(<TitleBar />);
    const branchChip = screen.getAllByRole('button').find((b) => b.textContent?.includes('main'));
    expect(branchChip).toBeTruthy();
    fireEvent.click(branchChip!);
    expect(screen.getByTestId('titlebar-branch-dropdown')).toBeTruthy();
    expect(screen.getByTestId('titlebar-branch-row-main')).toBeTruthy();
    expect(screen.getByTestId('titlebar-branch-row-feature/test')).toBeTruthy();
  });

  it('selecting a branch calls git.checkout and closes dropdown', async () => {
    render(<TitleBar />);
    const branchChip = screen.getAllByRole('button').find((b) => b.textContent?.includes('main'));
    fireEvent.click(branchChip!);
    const featureRow = screen.getByTestId('titlebar-branch-row-feature/test');
    fireEvent.click(featureRow);
    await waitFor(() => {
      expect(mockGitCheckout).toHaveBeenCalledWith('/projects/alpha', 'feature/test');
    });
    expect(screen.queryByTestId('titlebar-branch-dropdown')).toBeNull();
  });
});
