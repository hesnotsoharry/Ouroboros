/**
 * ProjectRail.staleChipX.acceptance.test.tsx
 *
 * Wave 14 Phase 3 orchestrator-owned acceptance test (frozen).
 * The Phase 3 implementer MAY NOT modify this file.
 *
 * Tests the stale-chip inline-X contract after the Wave 14 UX revision (D1):
 *   1. Stale chips (exists: false) retain the inline-X button always-visible in
 *      the DOM (Wave 12 safety affordance preserved).
 *   2. Healthy chips (exists: true) do NOT have an inline-X button in the DOM
 *      (Wave 14 change: healthy chip remove path is right-click only).
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

describe('Wave 14 Phase 3 — ProjectRail stale-chip inline-X retention', () => {
  it('stale chip (exists: false) retains the inline-X button in the DOM (always visible)', async () => {
    mockRecents = ['/repos/stale-project'];
    mockPathExistsResults = {
      '/repos/stale-project': false, // ← stale
      '/repos/healthy': true,
    };

    renderRail('/repos/healthy');

    await waitFor(() => {
      // Stale chip should have the inline remove button present and visible.
      expect(screen.getByTestId('remove-project-stale-project')).toBeTruthy();
    });

    const staleRemoveBtn = screen.getByTestId('remove-project-stale-project');
    // The remove button should not be hidden — stale chips keep it always-visible.
    expect(staleRemoveBtn.getAttribute('aria-hidden')).not.toBe('true');
    const btnStyle = staleRemoveBtn.getAttribute('style') ?? '';
    expect(btnStyle.replace(/\s+/g, '')).not.toContain('display:none');
  });

  it('healthy chip (exists: true) does NOT have an inline-X button in the DOM', async () => {
    mockRecents = [];
    mockPathExistsResults = { '/repos/healthy': true };

    renderRail('/repos/healthy');

    await waitFor(() => {
      // The healthy chip itself should be present.
      expect(screen.getByTestId('project-chip-healthy')).toBeTruthy();
    });

    // No inline remove button for healthy chips — Wave 14 removes it.
    // The remove path for healthy chips is right-click context menu only.
    expect(screen.queryByTestId('remove-project-healthy')).toBeNull();
  });

  it('stale chip remove button click still calls removeProjectRoot (fallback path works)', async () => {
    mockRecents = ['/repos/stale-project'];
    mockPathExistsResults = {
      '/repos/stale-project': false, // ← stale
      '/repos/healthy': true,
    };

    renderRail('/repos/healthy');

    await waitFor(() => {
      expect(screen.getByTestId('remove-project-stale-project')).toBeTruthy();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setRoots = (window as any).electronAPI.window.setProjectRoots as ReturnType<typeof vi.fn>;
    setRoots.mockClear();

    fireEvent.click(screen.getByTestId('remove-project-stale-project'));

    await waitFor(() => {
      expect(setRoots).toHaveBeenCalled();
    });
    const persistedRoots = setRoots.mock.calls[setRoots.mock.calls.length - 1][0] as string[];
    expect(persistedRoots).not.toContain('/repos/stale-project');
  });
});
