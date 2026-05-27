/**
 * ProjectRail.removeButton.acceptance.test.tsx
 *
 * Wave 12 Phase 2 orchestrator-owned boundary acceptance test (frozen).
 * The Phase 2 implementer MAY NOT modify this file.
 *
 * Source: roadmap/wave-12-terminal-and-project-crud-chrome/waveplan-12.md Phase 2.
 *
 * Tests the contract for the inline remove (X) button on the outer-rail
 * project chips:
 *   1. Each chip carries a remove button discoverable by test-id
 *      `remove-project-{name}`.
 *   2. Clicking the remove button calls `removeProjectRoot(path)` from
 *      ProjectContext.
 *   3. Stale chips (where `exists: false`) render with inline `opacity: 0.5`.
 *
 * The test does NOT constrain how the button is mounted (inside chip vs.
 * adjacent; icon vs. text) or the styling beyond the opacity contract — only
 * the behavioral contract.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectProvider, useProject } from '../../../contexts/ProjectContext';
import { ProjectRail } from './ProjectRail';

// ── Module mocks ──────────────────────────────────────────────────────────────

// useConfig stub — recents fed per test via mockRecents.
let mockRecents: string[] = [];
vi.mock('../../../hooks/useConfig', () => ({
  useConfig: (): { config: { recentProjects: string[] } } => ({
    config: { recentProjects: mockRecents },
  }),
}));

// pathExists mock — per-path lookup.
let mockPathExistsResults: Record<string, boolean> = {};
const mockPathExists = vi.fn(async (p: string): Promise<boolean> => {
  return mockPathExistsResults[p] ?? false;
});

// Capture removeProjectRoot calls — a probe rendered into the provider tree
// exposes the live context callbacks via window for the test to spy on.
function ContextCapture(): null {
  const ctx = useProject();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__test_removeProjectRoot = ctx.removeProjectRoot;
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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderRail(initialRoot: string): void {
  render(
    <ProjectProvider initialRoot={initialRoot}>
      <ContextCapture />
      <ProjectRail />
    </ProjectProvider>,
  );
}

describe('Wave 12 Phase 2 — ProjectRail inline remove (X) button', () => {
  it('renders a remove button with test-id `remove-project-{name}` for stale projects only (Wave 14 D1)', async () => {
    // alpha is stale (exists: false) → inline X present.
    // zebra is healthy (exists: true) → inline X absent (right-click path only).
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = { '/repos/alpha': false, '/repos/zebra': true };

    renderRail('/repos/zebra');

    await waitFor(() => {
      expect(screen.getByTestId('remove-project-alpha')).toBeTruthy();
    });
    expect(screen.queryByTestId('remove-project-zebra')).toBeNull();
  });

  it('clicking the stale-chip remove button invokes removeProjectRoot with the correct path', async () => {
    // alpha is stale → inline X present and clickable (Wave 14 D1 stale affordance).
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = { '/repos/alpha': false, '/repos/zebra': true };

    renderRail('/repos/zebra');

    // Spy on removeProjectRoot via the live context callback the
    // ContextCapture probe exposed.
    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((window as any).__test_removeProjectRoot).toBeDefined();
    });
    const removeSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origRemove = (window as any).__test_removeProjectRoot;
    // Patch the spy onto the context BEFORE click — simpler: monkey-patch
    // window so the test asserts via the original removeProjectRoot calling
    // setProjectRoots (the persist side effect).
    // Reset setProjectRoots mock so we can assert the final roots arg.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setRoots = (window as any).electronAPI.window.setProjectRoots as ReturnType<typeof vi.fn>;
    setRoots.mockClear();

    fireEvent.click(screen.getByTestId('remove-project-alpha'));

    // Persist call should fire with roots NOT containing /repos/alpha.
    await waitFor(() => {
      expect(setRoots).toHaveBeenCalled();
    });
    const persistedRoots = setRoots.mock.calls[setRoots.mock.calls.length - 1][0] as string[];
    expect(persistedRoots).not.toContain('/repos/alpha');
    // Use removeSpy / origRemove to silence unused-var lint — exposing the
    // capture surface is the test infra, not the assertion.
    void removeSpy;
    void origRemove;
  });

  it('renders stale chips (exists: false) with inline `opacity: 0.5`', async () => {
    mockRecents = ['/repos/alpha'];
    mockPathExistsResults = {
      '/repos/alpha': false, // ← stale
      '/repos/zebra': true,
    };

    renderRail('/repos/zebra');

    await waitFor(() => {
      const alphaChip = screen.getByTestId('project-chip-alpha');
      // Inline style attribute should contain opacity 0.5 (per ADR D2).
      // Accept both "opacity: 0.5" and "opacity:0.5" — prettier-flexible.
      const style = alphaChip.getAttribute('style') ?? '';
      expect(style.replace(/\s+/g, '')).toContain('opacity:0.5');
    });

    // Healthy chip (zebra) should NOT have opacity 0.5.
    const zebraChip = screen.getByTestId('project-chip-zebra');
    const zebraStyle = zebraChip.getAttribute('style') ?? '';
    expect(zebraStyle.replace(/\s+/g, '')).not.toContain('opacity:0.5');
  });

  it('healthy chips do NOT have an inline remove button (Wave 14 D1: right-click only)', async () => {
    mockRecents = [];
    mockPathExistsResults = { '/repos/zebra': true };

    renderRail('/repos/zebra');

    // Wave 14 D1 — healthy chips lose the inline-X entirely; the remove path
    // for healthy chips is right-click context menu. Stale chips retain the X.
    await waitFor(() => {
      expect(screen.getByTestId('project-chip-zebra')).toBeTruthy();
    });

    expect(screen.queryByTestId('remove-project-zebra')).toBeNull();
  });
});
