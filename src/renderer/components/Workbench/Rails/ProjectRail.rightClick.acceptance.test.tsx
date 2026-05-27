/**
 * ProjectRail.rightClick.acceptance.test.tsx
 *
 * Wave 14 Phase 3 orchestrator-owned acceptance test (frozen).
 * The Phase 3 implementer MAY NOT modify this file.
 *
 * Tests the right-click context menu contract for the outer-rail project chips:
 *   1. Right-clicking a chip opens a context menu containing "Remove from workbench".
 *   2. Clicking the menu item calls removeProjectRoot with the correct path.
 *   3. Pressing Esc dismisses the menu.
 *   4. Clicking outside the menu dismisses it.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectProvider } from '../../../contexts/ProjectContext';
import { ProjectRail } from './ProjectRail';

// ── Module mocks ──────────────────────────────────────────────────────────────

let mockRecents: string[] = [];
vi.mock('../../../hooks/useConfig', () => ({
  useConfig: (): { config: { recentProjects: string[] } } => ({
    config: { recentProjects: mockRecents },
  }),
}));

let mockPathExistsResults: Record<string, boolean> = {};
const mockPathExists = vi.fn(async (p: string): Promise<boolean> => {
  return mockPathExistsResults[p] ?? false;
});

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = (globalThis as any).window ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).electronAPI = {
    window: {
      getProjectRoots: vi.fn().mockResolvedValue({ roots: [] }),
      setProjectRoots: vi.fn().mockResolvedValue(undefined),
    },
    files: {
      pathExists: mockPathExists,
      selectFolder: vi.fn().mockResolvedValue({ success: false }),
    },
  };
  mockRecents = [];
  mockPathExistsResults = {};
  mockPathExists.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderRail(initialRoot: string): void {
  render(
    <ProjectProvider initialRoot={initialRoot}>
      <ProjectRail />
    </ProjectProvider>,
  );
}

describe('Wave 14 Phase 3 — ProjectRail right-click context menu', () => {
  it('right-clicking a project chip opens a context menu with "Remove from workbench"', async () => {
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = { '/repos/alpha': true, '/repos/zebra': true };

    renderRail('/repos/zebra');

    await waitFor(() => {
      expect(screen.getByTestId('project-chip-alpha')).toBeTruthy();
    });

    fireEvent.contextMenu(screen.getByTestId('project-chip-alpha'));

    await waitFor(() => {
      expect(screen.getByTestId('project-context-menu')).toBeTruthy();
      expect(screen.getByText('Remove from workbench')).toBeTruthy();
    });
  });

  it('clicking "Remove from workbench" calls removeProjectRoot with the correct path', async () => {
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = { '/repos/alpha': true, '/repos/zebra': true };

    renderRail('/repos/zebra');

    await waitFor(() => {
      expect(screen.getByTestId('project-chip-alpha')).toBeTruthy();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setRoots = (window as any).electronAPI.window.setProjectRoots as ReturnType<typeof vi.fn>;
    setRoots.mockClear();

    fireEvent.contextMenu(screen.getByTestId('project-chip-alpha'));

    await waitFor(() => {
      expect(screen.getByText('Remove from workbench')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Remove from workbench'));

    // Removing a non-active project should call setProjectRoots without /repos/alpha.
    await waitFor(() => {
      expect(setRoots).toHaveBeenCalled();
    });
    const persistedRoots = setRoots.mock.calls[setRoots.mock.calls.length - 1][0] as string[];
    expect(persistedRoots).not.toContain('/repos/alpha');
  });

  it('pressing Esc dismisses the context menu', async () => {
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = { '/repos/alpha': true, '/repos/zebra': true };

    renderRail('/repos/zebra');

    await waitFor(() => {
      expect(screen.getByTestId('project-chip-alpha')).toBeTruthy();
    });

    fireEvent.contextMenu(screen.getByTestId('project-chip-alpha'));

    await waitFor(() => {
      expect(screen.getByTestId('project-context-menu')).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('project-context-menu')).toBeNull();
    });
  });

  it('clicking outside the menu dismisses it', async () => {
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = { '/repos/alpha': true, '/repos/zebra': true };

    renderRail('/repos/zebra');

    await waitFor(() => {
      expect(screen.getByTestId('project-chip-alpha')).toBeTruthy();
    });

    fireEvent.contextMenu(screen.getByTestId('project-chip-alpha'));

    await waitFor(() => {
      expect(screen.getByTestId('project-context-menu')).toBeTruthy();
    });

    // Click outside — fire mousedown on document body.
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId('project-context-menu')).toBeNull();
    });
  });
});
