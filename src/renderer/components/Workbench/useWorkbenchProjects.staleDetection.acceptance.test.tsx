/**
 * useWorkbenchProjects.staleDetection.acceptance.test.tsx
 *
 * Wave 12 Phase 2 orchestrator-owned boundary acceptance test (frozen).
 * The Phase 2 implementer MAY NOT modify this file.
 *
 * Source: roadmap/wave-12-terminal-and-project-crud-chrome/waveplan-12.md Phase 2.
 *
 * Tests the contract for stale-path detection in useWorkbenchProjects:
 * given a set of project paths and a `pathExists` IPC that returns true/false
 * per path, the hook returns each WorkbenchProject with an `exists: boolean`
 * flag matching the IPC result. The flag derivation runs on mount AND
 * re-runs when the projectRoots array changes (so post-addProjectRoot
 * staleness is correctly re-computed).
 *
 * @vitest-environment jsdom
 */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectProvider } from '../../contexts/ProjectContext';
import { useWorkbenchProjects } from './useWorkbenchProjects';

// useConfig stub — empty recents by default.
let mockRecents: string[] = [];
vi.mock('../../hooks/useConfig', () => ({
  useConfig: (): { config: { recentProjects: string[] } } => ({
    config: { recentProjects: mockRecents },
  }),
}));

// pathExists IPC mock — keyed lookup so each path can return true/false independently.
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

function wrapper({ initialRoot }: { initialRoot: string }) {
  function TestProviderWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return <ProjectProvider initialRoot={initialRoot}>{children}</ProjectProvider>;
  }
  return TestProviderWrapper;
}

describe('Wave 12 Phase 2 — useWorkbenchProjects stale-path detection', () => {
  it('flags every project with `exists: true` when pathExists returns true for all paths', async () => {
    mockRecents = ['/repos/alpha', '/repos/middle'];
    mockPathExistsResults = {
      '/repos/alpha': true,
      '/repos/middle': true,
      '/repos/zebra': true,
    };

    const { result } = renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/zebra' }),
    });

    await waitFor(() => {
      // All three projects should have exists: true once IPC resolves.
      expect(result.current.every((p) => p.exists === true)).toBe(true);
    });
    // Sort order preserved (alphabetical sort is a Wave 10.1 contract).
    expect(result.current.map((p) => p.name)).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('flags only the missing project with `exists: false`', async () => {
    mockRecents = ['/repos/alpha', '/repos/middle'];
    mockPathExistsResults = {
      '/repos/alpha': true,
      '/repos/middle': false, // ← stale (renamed/deleted on disk)
      '/repos/zebra': true,
    };

    const { result } = renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/zebra' }),
    });

    await waitFor(() => {
      const middle = result.current.find((p) => p.name === 'middle');
      expect(middle?.exists).toBe(false);
    });
    expect(result.current.find((p) => p.name === 'alpha')?.exists).toBe(true);
    expect(result.current.find((p) => p.name === 'zebra')?.exists).toBe(true);
  });

  it('calls pathExists once per project path (no duplicate IPC fan-out)', async () => {
    mockRecents = ['/repos/alpha', '/repos/middle'];
    mockPathExistsResults = {
      '/repos/alpha': true,
      '/repos/middle': true,
      '/repos/zebra': true,
    };

    renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/zebra' }),
    });

    await waitFor(() => {
      // 3 projects → 3 pathExists calls (one per unique path).
      expect(mockPathExists).toHaveBeenCalledTimes(3);
    });
    const calledPaths = mockPathExists.mock.calls.map((c) => c[0]).sort();
    expect(calledPaths).toEqual(['/repos/alpha', '/repos/middle', '/repos/zebra']);
  });

  it('does NOT throw when window.electronAPI.files.pathExists is missing', async () => {
    // Defensive: a renderer environment without the IPC (e.g. SSR / early
    // boot before preload bridge attaches) must not crash. Hook should treat
    // unknown existence as `exists: true` (optimistic — don't dim everything
    // when we can't tell), OR `exists: undefined` (consumer decides), but
    // NEVER throw.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI.files = {}; // pathExists absent
    mockRecents = ['/repos/alpha'];

    expect(() => {
      renderHook(() => useWorkbenchProjects(), {
        wrapper: wrapper({ initialRoot: '/repos/zebra' }),
      });
    }).not.toThrow();
  });

  it('initial mount renders with synchronous projects then re-renders with exists flags', async () => {
    // First synchronous render (before pathExists resolves) must return the
    // project list — UI can render dimmed-pending-check or just render
    // un-checked. Either way the projects MUST be present at render 1, not
    // gated on the async pathExists.
    mockPathExistsResults = {
      '/repos/zebra': true,
      '/repos/alpha': true,
    };
    mockRecents = ['/repos/alpha'];

    const { result } = renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/zebra' }),
    });

    // Synchronous: projects exist immediately. exists flag may be undefined
    // / null / true (implementer's call for the pre-resolved state) but the
    // list itself is present.
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.map((p) => p.name).sort()).toEqual(['alpha', 'zebra']);

    // After IPC resolves, exists flags settle to the IPC results.
    await waitFor(() => {
      expect(result.current.every((p) => p.exists === true)).toBe(true);
    });
  });
});
