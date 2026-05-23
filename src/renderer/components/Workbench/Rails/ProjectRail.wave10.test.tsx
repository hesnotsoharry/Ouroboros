/**
 * @vitest-environment jsdom
 *
 * ProjectRail.wave10.test.tsx — Wave 10 Phase 2 per-surface render tests.
 *
 * Covers:
 *   - Chip click fires setActiveProjectRoot with the chip's path
 *   - AddProjectButton click opens directory picker and calls addProjectRoot
 *   - FooterButton (Layout) click dispatches DOM CustomEvent + toggles label
 *   - UserAvatar click opens profile menu with the stub entry
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

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { recentProjects: [] },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// WorkbenchProjects hook returns two projects derived from mocked context.
// We do NOT mock useWorkbenchProjects — it runs against the mocked ProjectContext above.
// This tests the real chip-click → setActiveProjectRoot path end-to-end in the renderer.

import { ProjectRail } from './ProjectRail';

// ── Test helpers ──────────────────────────────────────────────────────────────

function stubSelectFolder(path: string | null): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    files: {
      selectFolder: path
        ? vi.fn().mockResolvedValue({ success: true, path })
        : vi.fn().mockResolvedValue({ success: false }),
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectRail — Wave 10 wiring', () => {
  beforeEach(() => {
    stubSelectFolder(null); // default: cancelled
  });

  it('chip click calls setActiveProjectRoot with the project path', () => {
    render(<ProjectRail />);
    // The first chip is 'alpha' (active), the second is 'beta'
    const betaChip = screen.getByTestId('project-chip-beta');
    fireEvent.click(betaChip);
    expect(mockSetActiveProjectRoot).toHaveBeenCalledWith('/projects/beta');
  });

  it('AddProjectButton click — cancelled picker does not call addProjectRoot', async () => {
    stubSelectFolder(null);
    render(<ProjectRail />);
    const btn = screen.getByTestId('add-project-btn');
    fireEvent.click(btn);
    // Give async handler a tick
    await waitFor(() => {
      expect(mockAddProjectRoot).not.toHaveBeenCalled();
    });
  });

  it('AddProjectButton click — successful picker calls addProjectRoot with chosen path', async () => {
    stubSelectFolder('/projects/gamma');
    render(<ProjectRail />);
    const btn = screen.getByTestId('add-project-btn');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockAddProjectRoot).toHaveBeenCalledWith('/projects/gamma');
    });
  });

  it('FooterButton (Layout) click dispatches agent-ide:workbench-layout-toggle CustomEvent', () => {
    const dispatched: CustomEvent[] = [];
    window.addEventListener('agent-ide:workbench-layout-toggle', (e) => {
      dispatched.push(e as CustomEvent);
    });
    render(<ProjectRail />);
    const btn = screen.getByTitle(/Layout/);
    fireEvent.click(btn);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].detail).toHaveProperty('layout');
    window.removeEventListener('agent-ide:workbench-layout-toggle', () => undefined);
  });

  it('UserAvatar click opens profile menu with stub entry', () => {
    render(<ProjectRail />);
    const avatar = screen.getByTestId('user-avatar-btn');
    fireEvent.click(avatar);
    expect(screen.getByTestId('profile-menu')).toBeTruthy();
    expect(screen.getByTestId('profile-menu-stub-entry')).toBeTruthy();
    expect(screen.getByTestId('profile-menu-stub-entry').textContent).toContain('stub');
  });

  it('UserAvatar menu closes on Esc', () => {
    render(<ProjectRail />);
    fireEvent.click(screen.getByTestId('user-avatar-btn'));
    expect(screen.queryByTestId('profile-menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('profile-menu')).toBeNull();
  });
});
