/**
 * Wave 10.1 — useWorkbenchProjects returns alphabetically-sorted projects.
 *
 * Per Cole's 2026-05-24 smoke feedback: the three switcher surfaces should
 * present projects in stable alphabetical order (find-by-name UX), not in
 * "active-at-top" order. The active project is marked via the `active: true`
 * flag regardless of position. ProjectContext's "active is [0]" convention
 * stays intact under the hood (persistence / restore key on [0]).
 *
 * @vitest-environment jsdom
 */

import { cleanup, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectProvider } from '../../contexts/ProjectContext';
import { useWorkbenchProjects } from './useWorkbenchProjects';

// useConfig stub — returns recentProjects so the hook merges them with projectRoots.
let mockRecents: string[] = [];
vi.mock('../../hooks/useConfig', () => ({
  useConfig: (): { config: { recentProjects: string[] } } => ({
    config: { recentProjects: mockRecents },
  }),
}));

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = (globalThis as any).window ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).electronAPI = {
    window: {
      getProjectRoots: vi.fn().mockResolvedValue({ roots: [] }),
      setProjectRoots: vi.fn().mockResolvedValue(undefined),
    },
  };
  mockRecents = [];
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

describe('Wave 10.1 — useWorkbenchProjects alphabetical sort', () => {
  it('sorts the merged projectRoots + recents list alphabetically by name', () => {
    // /zebra is the active root; recents include /alpha and /middle.
    // Expected sorted order by basename: alpha, middle, zebra.
    mockRecents = ['/repos/alpha', '/repos/middle'];
    const { result } = renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/zebra' }),
    });

    expect(result.current.map((p) => p.name)).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('sets active flag on the active project regardless of sorted position', () => {
    // /zebra is active but ends up at position [2] after alpha sort.
    mockRecents = ['/repos/alpha', '/repos/middle'];
    const { result } = renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/zebra' }),
    });

    const zebra = result.current.find((p) => p.name === 'zebra');
    expect(zebra?.active).toBe(true);
    expect(result.current.filter((p) => p.active)).toHaveLength(1);
    // Active project is NOT at position [0] anymore (proves sort-not-active-first).
    expect(result.current[0].name).toBe('alpha');
  });

  it('sorts case-insensitively (Aardvark before banana before Cherry)', () => {
    mockRecents = ['/repos/banana', '/repos/Cherry'];
    const { result } = renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/Aardvark' }),
    });

    expect(result.current.map((p) => p.name)).toEqual(['Aardvark', 'banana', 'Cherry']);
  });

  it('preserves a single-root list unchanged', () => {
    const { result } = renderHook(() => useWorkbenchProjects(), {
      wrapper: wrapper({ initialRoot: '/repos/only' }),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe('only');
    expect(result.current[0].active).toBe(true);
  });
});
