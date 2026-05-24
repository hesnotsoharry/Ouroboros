/**
 * Wave 11 Phase 1 — orchestrator-owned acceptance test (frozen).
 *
 * Expresses the click contract for WorkbenchFileTree's NodeRow:
 *
 *   1. Clicking a FILE row calls `onSelectFile(node.path)` exactly once;
 *      directory toggle is NOT fired.
 *   2. Clicking a DIRECTORY row calls `onToggle(node.path)` exactly once;
 *      `onSelectFile` is NOT fired.
 *   3. If `onSelectFile` is omitted (legacy callers), file rows are inert
 *      (no error, no callback). The prop is optional — additive.
 *
 * Wave 8 P2 shipped the tree with directory expand/collapse but file rows
 * have no onClick. Wave 11 P1 adds the file-click → modal wiring via a new
 * optional `onSelectFile` prop threaded down from Workbench.tsx through
 * InnerRail/FilesSection.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 1
 * implementer implements against THIS test and MAY NOT modify it. RED at
 * dispatch; goes green when `onSelectFile` is wired into NodeRow.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveFileNode } from './useWorkbenchFileTree';
import { WorkbenchFileTree } from './WorkbenchFileTree';

// Mock the data hook so the test controls the rendered nodes directly.
const mockToggleDir = vi.fn();
const mockNodes: LiveFileNode[] = [
  { key: 'k-dir', type: 'dir', depth: 0, name: 'src', path: '/proj/src', open: false, badge: null },
  {
    key: 'k-file',
    type: 'file',
    depth: 1,
    name: 'index.ts',
    path: '/proj/src/index.ts',
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
      nodes: mockNodes,
      isLoading: false,
      error: null,
      toggleDir: mockToggleDir,
    })),
  };
});

beforeEach(() => {
  mockToggleDir.mockReset();
});

afterEach(() => {
  cleanup();
});

function findRowByName(container: HTMLElement, name: string): HTMLElement {
  // Each NodeRow renders a wrapper div containing a FileNode that displays
  // the name. Walk up from the matched text element to the nearest div
  // ancestor that has either role="button" (dir) or an onClick handler (file).
  const candidates = Array.from(container.querySelectorAll('div'));
  for (const div of candidates) {
    if (div.textContent?.trim().endsWith(name)) {
      // Walk up until we find the row wrapper (it's the outermost div whose
      // direct child is the FileNode display).
      let cur: HTMLElement | null = div;
      while (cur && cur.parentElement && cur.parentElement !== container) {
        cur = cur.parentElement;
      }
      if (cur) return cur;
    }
  }
  throw new Error(`row "${name}" not found in tree`);
}

describe('Wave 11 P1 — WorkbenchFileTree NodeRow click contract', () => {
  it('clicking a FILE row calls onSelectFile(path) once and does NOT call toggleDir', () => {
    const onSelectFile = vi.fn();
    const { getByTestId } = render(
      <WorkbenchFileTree rootPath="/proj" onSelectFile={onSelectFile} />,
    );
    const tree = getByTestId('workbench-filetree');
    const fileRow = findRowByName(tree, 'index.ts');

    fireEvent.click(fileRow);

    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith('/proj/src/index.ts');
    expect(mockToggleDir).not.toHaveBeenCalled();
  });

  it('clicking a DIRECTORY row calls toggleDir(path) once and does NOT call onSelectFile', () => {
    const onSelectFile = vi.fn();
    const { getByTestId } = render(
      <WorkbenchFileTree rootPath="/proj" onSelectFile={onSelectFile} />,
    );
    const tree = getByTestId('workbench-filetree');
    const dirRow = findRowByName(tree, 'src');

    fireEvent.click(dirRow);

    expect(mockToggleDir).toHaveBeenCalledTimes(1);
    expect(mockToggleDir).toHaveBeenCalledWith('/proj/src');
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it('file rows are inert (no error) when onSelectFile is omitted', () => {
    const { getByTestId } = render(<WorkbenchFileTree rootPath="/proj" />);
    const tree = getByTestId('workbench-filetree');
    const fileRow = findRowByName(tree, 'index.ts');

    expect(() => fireEvent.click(fileRow)).not.toThrow();
    expect(mockToggleDir).not.toHaveBeenCalled();
  });
});
