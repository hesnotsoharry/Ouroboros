/**
 * Wave 10.1 regression — `setActiveProjectRoot` silent no-op on recent-only paths.
 *
 * Wave 10 Phase 1 added `setActiveProjectRoot(path)` with semantics documented
 * as "move to [0] if present, silent no-op if absent." Phase 2 wired all three
 * project-switching UI surfaces (outer rail, title bar dropdown, inner rail
 * dropdown) to call it. `useWorkbenchProjects` populates those surfaces with
 * projects from BOTH `projectRoots` AND `config.recentProjects`. A user
 * clicking a recent-only project chip hits the silent-no-op branch and gets
 * nothing — state never changes, no re-render. Wave 10's 322/322 tests passed
 * because no test exercised the absent-path case.
 *
 * Wave 11 Phase 0 manual smoke (2026-05-24) surfaced this in production. Fix:
 * `setActiveProjectRoot` always promotes the path to [0] — add-if-absent,
 * move-if-present.
 *
 * This test is the regression guard. RED before fix; GREEN after.
 *
 * @vitest-environment jsdom
 */

import { act, cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectProvider, useProject } from './ProjectContext';

// Stub the per-window electronAPI surface ProjectContext reads on mount + write.
// We want an empty getProjectRoots() so the initial roots state stays at the
// `initialRoot` we pass in — that's the well-defined seed for the regression.
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Test harness: child component renders projectRoots as a JSON string and
// exposes setActiveProjectRoot via a ref so the test can call it imperatively.
type Capture = {
  getRoots: () => string[];
  setActive: (path: string) => void;
};

function Probe({ captureRef }: { captureRef: { current: Capture | null } }): React.ReactElement {
  const { projectRoots, projectRoot, setActiveProjectRoot } = useProject();
  captureRef.current = {
    getRoots: () => projectRoots,
    setActive: setActiveProjectRoot,
  };
  return <div data-testid="active">{projectRoot ?? '(none)'}</div>;
}

describe('Wave 10.1 — setActiveProjectRoot regression: recent-only path promotion', () => {
  it('promotes a path NOT in projectRoots to position [0] (add-if-absent)', async () => {
    const captureRef: { current: Capture | null } = { current: null };
    const { getByTestId } = render(
      <ProjectProvider initialRoot="/proj/a">
        <Probe captureRef={captureRef} />
      </ProjectProvider>,
    );

    // Initial state: only /proj/a is in projectRoots.
    expect(captureRef.current?.getRoots()).toEqual(['/proj/a']);
    expect(getByTestId('active').textContent).toBe('/proj/a');

    // Switch to a recent-only path (NOT in projectRoots).
    act(() => {
      captureRef.current?.setActive('/proj/c');
    });

    // After fix: /proj/c is now [0] (the active root) and /proj/a remains in the list.
    // Before fix (Wave 10 silent-no-op guard): projectRoots would still be ['/proj/a'].
    expect(captureRef.current?.getRoots()).toEqual(['/proj/c', '/proj/a']);
    expect(getByTestId('active').textContent).toBe('/proj/c');
  });

  it('moves an existing root to [0] (existing behavior preserved)', async () => {
    const captureRef: { current: Capture | null } = { current: null };
    const { getByTestId } = render(
      <ProjectProvider initialRoot="/proj/a">
        <Probe captureRef={captureRef} />
      </ProjectProvider>,
    );

    // Add /proj/b so projectRoots has two entries with /proj/a active.
    act(() => {
      // setActiveProjectRoot also promotes-if-absent now, so this seeds /proj/b.
      captureRef.current?.setActive('/proj/b');
    });
    expect(captureRef.current?.getRoots()).toEqual(['/proj/b', '/proj/a']);

    // Switch back to /proj/a — should move it to [0], not duplicate.
    act(() => {
      captureRef.current?.setActive('/proj/a');
    });
    expect(captureRef.current?.getRoots()).toEqual(['/proj/a', '/proj/b']);
    expect(getByTestId('active').textContent).toBe('/proj/a');
  });

  it('is idempotent when the path is already at [0]', async () => {
    const captureRef: { current: Capture | null } = { current: null };
    render(
      <ProjectProvider initialRoot="/proj/a">
        <Probe captureRef={captureRef} />
      </ProjectProvider>,
    );

    expect(captureRef.current?.getRoots()).toEqual(['/proj/a']);
    act(() => {
      captureRef.current?.setActive('/proj/a');
    });
    expect(captureRef.current?.getRoots()).toEqual(['/proj/a']);
  });
});
