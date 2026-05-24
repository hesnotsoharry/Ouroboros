/**
 * Workbench.activeProjectRemoval.acceptance.test.tsx
 *
 * Wave 12 Phase 2 orchestrator-owned boundary acceptance test (frozen).
 * The Phase 2 implementer MAY NOT modify this file.
 *
 * Source: roadmap/wave-12-terminal-and-project-crud-chrome/waveplan-12.md Phase 2.
 *
 * Tests the contract for active-project handling when the user removes the
 * currently-active project from the workbench. Two sub-cases:
 *
 *   1. Remove the active project when N > 1 projects remain → active switches
 *      to the next ALPHABETICAL remaining project (NOT next-in-array, since
 *      useWorkbenchProjects sorts alphabetically — the user sees alpha order
 *      in the rail, so "next" should match what they see).
 *
 *   2. Remove the last remaining project → activeProjectRoot becomes null;
 *      projectRoots becomes empty array. Workbench renders the existing
 *      "no project" empty state (Wave 10 P3 `__no-project__` key fallback).
 *
 * The test exercises the flow through the ProjectRail X button (the user
 * surface). The implementer is free to wire next-alphabetical selection
 * either inside ProjectContext.removeProjectRoot OR in the rail's click
 * handler — either passes if the observable contract holds.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectProvider, useProject } from '../../contexts/ProjectContext';
import { ProjectRail } from './Rails/ProjectRail';

// ── Module mocks ──────────────────────────────────────────────────────────────

let mockRecents: string[] = [];
vi.mock('../../hooks/useConfig', () => ({
  useConfig: (): { config: { recentProjects: string[] } } => ({
    config: { recentProjects: mockRecents },
  }),
}));

let mockPathExistsResults: Record<string, boolean> = {};
const mockPathExists = vi.fn(async (p: string): Promise<boolean> => {
  return mockPathExistsResults[p] ?? false;
});

// Captures the live ProjectContext projectRoot so tests can assert.
let observedProjectRoot: string | null | undefined = undefined;
function ContextObserver(): null {
  const { projectRoot } = useProject();
  observedProjectRoot = projectRoot;
  return null;
}

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
  observedProjectRoot = undefined;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderWith(initialRoot: string): void {
  render(
    <ProjectProvider initialRoot={initialRoot}>
      <ContextObserver />
      <ProjectRail />
    </ProjectProvider>,
  );
}

describe('Wave 12 Phase 2 — Workbench active-project-removal', () => {
  it('removing the active project switches active to the next ALPHABETICAL remaining project', async () => {
    // Projects (sorted alphabetically by useWorkbenchProjects): alpha, middle, zebra.
    // zebra is initially active (initialRoot).
    mockRecents = ['/repos/alpha', '/repos/middle'];
    mockPathExistsResults = {
      '/repos/alpha': true,
      '/repos/middle': true,
      '/repos/zebra': true,
    };

    renderWith('/repos/zebra');

    // Wait for the rail to mount.
    await waitFor(() => {
      expect(screen.getByTestId('remove-project-zebra')).toBeTruthy();
      expect(observedProjectRoot).toBe('/repos/zebra');
    });

    // Click X on the active project (zebra).
    fireEvent.click(screen.getByTestId('remove-project-zebra'));

    // Active switches to the next-alphabetical remaining project: alpha.
    // (NOT middle — alphabetical, not "in original order.")
    await waitFor(() => {
      expect(observedProjectRoot).toBe('/repos/alpha');
    });
  });

  it('removing the only remaining project clears activeProjectRoot to null', async () => {
    mockRecents = [];
    mockPathExistsResults = { '/repos/solo': true };

    renderWith('/repos/solo');

    await waitFor(() => {
      expect(screen.getByTestId('remove-project-solo')).toBeTruthy();
      expect(observedProjectRoot).toBe('/repos/solo');
    });

    fireEvent.click(screen.getByTestId('remove-project-solo'));

    // No projects remain → active becomes null (Workbench renders empty state).
    await waitFor(() => {
      expect(observedProjectRoot).toBeNull();
    });
  });

  it('removing a NON-active project leaves activeProjectRoot unchanged', async () => {
    // Regression check: removing a non-active project must NOT shuffle the
    // active state — only the removed entry disappears.
    mockRecents = ['/repos/alpha', '/repos/middle'];
    mockPathExistsResults = {
      '/repos/alpha': true,
      '/repos/middle': true,
      '/repos/zebra': true,
    };

    renderWith('/repos/zebra');

    await waitFor(() => {
      expect(screen.getByTestId('remove-project-alpha')).toBeTruthy();
      expect(observedProjectRoot).toBe('/repos/zebra');
    });

    // Remove alpha (NOT the active one).
    fireEvent.click(screen.getByTestId('remove-project-alpha'));

    // Active stays at zebra; alpha gone.
    await waitFor(() => {
      // alpha's chip should be gone from the rail.
      expect(screen.queryByTestId('project-chip-alpha')).toBeNull();
    });
    expect(observedProjectRoot).toBe('/repos/zebra');
  });

  it('removing the active when only one OTHER project remains promotes that other to active', async () => {
    // Edge case: N==2, remove active → only one candidate, it becomes active.
    // (No alphabetical tie-breaking needed since there's only one option.)
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = {
      '/repos/alpha': true,
      '/repos/zebra': true,
    };

    renderWith('/repos/zebra');

    await waitFor(() => {
      expect(observedProjectRoot).toBe('/repos/zebra');
    });

    fireEvent.click(screen.getByTestId('remove-project-zebra'));

    await waitFor(() => {
      expect(observedProjectRoot).toBe('/repos/alpha');
    });
  });
});
