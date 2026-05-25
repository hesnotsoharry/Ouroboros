/**
 * Wave 11 Phase 1 — InnerRail file-click integration (frozen).
 *
 * Exercises the prop-chain wiring contract from D1 (the Wave 11 ADR): a
 * Workbench-level `setOpenFilePath` callback, passed as `onSelectFile` to
 * <InnerRail>, must reach WorkbenchFileTree's NodeRow and fire on file
 * click. The hop sequence is:
 *
 *   Workbench (setOpenFilePath) → MiddleRow → InnerRail (onSelectFile prop)
 *     → FilesSection (threads it) → WorkbenchFileTree (forwards) → NodeRow
 *
 * The contract: clicking a file row at the InnerRail level fires the prop
 * callback with the file's absolute path. The acceptance test
 * (WorkbenchFileTree.fileClick.acceptance.test.tsx) covers the row-level
 * behavior; this test covers the prop-chain stitching.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 1
 * implementer MAY NOT modify this test.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InnerRail } from './InnerRail';
import type { LiveFileNode } from './useWorkbenchFileTree';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Project context — InnerRail reads projectRoot to render the file tree
// and the branch footer.
vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoots: ['/proj'],
    projectRoot: '/proj',
    projectName: 'proj',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    setActiveProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => ({
    projectRoots: ['/proj'],
    projectRoot: '/proj',
    projectName: 'proj',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    setActiveProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
}));

// File tree data hook — return one dir + one file.
const mockToggleDir = vi.fn();
const mockFileNodes: LiveFileNode[] = [
  {
    key: 'k-dir',
    type: 'dir',
    depth: 0,
    name: 'src',
    path: '/proj/src',
    open: false,
    badge: null,
  },
  {
    key: 'k-file',
    type: 'file',
    depth: 1,
    name: 'app.ts',
    path: '/proj/src/app.ts',
    open: false,
    badge: null,
  },
];
vi.mock('./useWorkbenchFileTree', async () => {
  const actual =
    await vi.importActual<typeof import('./useWorkbenchFileTree')>('./useWorkbenchFileTree');
  return {
    ...actual,
    useWorkbenchFileTree: vi.fn(() => ({
      nodes: mockFileNodes,
      isLoading: false,
      error: null,
      toggleDir: mockToggleDir,
    })),
  };
});

// Other InnerRail dependencies — minimum-viable stubs so the component renders.
vi.mock('../../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'main', isLoading: false, error: null }),
}));

vi.mock('../useWorkbenchProjects', () => ({
  useWorkbenchProjects: () => [
    { path: '/proj', name: 'proj', initial: 'P', color: 'hsl(120, 65%, 62%)', active: true },
  ],
}));

vi.mock('../useWorkbenchAgentData', () => ({
  useWorkbenchAgentData: () => ({
    sessions: [],
    primary: null,
    now: null,
    context: null,
  }),
}));

// File picker / drag-drop event listeners — InnerRail's "Search files" button
// dispatches a DOM CustomEvent; we don't need to observe it here.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = (globalThis as any).window ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).electronAPI = (window as any).electronAPI ?? {
    files: {
      readDir: vi.fn().mockResolvedValue({ entries: [] }),
    },
  };
  mockToggleDir.mockReset();
});

afterEach(() => {
  cleanup();
});

function findRowWrapper(start: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = start;
  while (cur && cur.parentElement) {
    const tree = cur.closest('[data-testid="workbench-filetree"]');
    if (cur.parentElement === tree) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function findFileRow(container: HTMLElement, name: string): HTMLElement {
  // Find the file row by walking the rendered tree for the matching name.
  // NodeRow renders <div onClick><FileNode node /></div> where FileNode
  // displays the name text inside nested spans.
  const candidates = Array.from(container.querySelectorAll('div'));
  for (const div of candidates) {
    const text = div.textContent?.trim();
    if (text && text.endsWith(name)) {
      const row = findRowWrapper(div);
      if (row) return row;
    }
  }
  throw new Error(`row "${name}" not found in tree`);
}

// ── Test ──────────────────────────────────────────────────────────────────────

describe('Wave 11 P1 — InnerRail prop-chain integration: file click → onSelectFile', () => {
  it('clicking a file row in the InnerRail file tree fires onSelectFile(path)', () => {
    const onSelectFile = vi.fn();
    const { container } = render(<InnerRail onSelectFile={onSelectFile} />);
    const fileRow = findFileRow(container, 'app.ts');

    fireEvent.click(fileRow);

    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith('/proj/src/app.ts');
  });

  it('clicking a directory row in the InnerRail file tree does NOT fire onSelectFile', () => {
    const onSelectFile = vi.fn();
    const { container } = render(<InnerRail onSelectFile={onSelectFile} />);
    const dirRow = findFileRow(container, 'src');

    fireEvent.click(dirRow);

    expect(onSelectFile).not.toHaveBeenCalled();
    expect(mockToggleDir).toHaveBeenCalledTimes(1);
    expect(mockToggleDir).toHaveBeenCalledWith('/proj/src');
  });
});
