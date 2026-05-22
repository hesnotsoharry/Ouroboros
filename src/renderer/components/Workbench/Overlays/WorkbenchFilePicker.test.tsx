/**
 * @vitest-environment jsdom
 *
 * WorkbenchFilePicker.test.tsx — Wave 8 Phase 3.
 *
 * Contracts tested:
 *   (a) Dispatching 'agent-ide:open-file-picker' opens the FilePicker
 *       (sentinel receives isOpen=true).
 *   (b) The picker is NOT open before the event fires.
 *   (c) onSelectFile is called with the selected path and the picker closes.
 *   (d) onClose from FilePicker closes the picker.
 *   (e) InnerRail "Search files" button dispatches 'agent-ide:open-file-picker'.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sentinel mock for FilePicker ─────────────────────────────────────────────
// Mock at the boundary dependency; assert isOpen + onSelectFile via data-testid.
vi.mock('../../CommandPalette/FilePicker', () => ({
  FilePicker: ({
    isOpen,
    onClose,
    onSelectFile,
  }: {
    isOpen: boolean;
    onClose: () => void;
    projectRoot: string | null;
    onSelectFile: (p: string) => void;
  }) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'file-picker-sentinel' },
          React.createElement(
            'button',
            {
              'data-testid': 'fp-select',
              onClick: () => onSelectFile('/projects/test/README.md'),
            },
            'Select',
          ),
          React.createElement(
            'button',
            {
              'data-testid': 'fp-close',
              onClick: onClose,
            },
            'Close',
          ),
        )
      : null,
}));

// ── Stub ProjectContext ───────────────────────────────────────────────────────
const PROJECT_STUB = {
  projectRoot: '/projects/test',
  projectRoots: ['/projects/test'],
  projectName: 'test',
  isLoaded: true,
  setProjectRoot: vi.fn(),
  addProjectRoot: vi.fn(),
  removeProjectRoot: vi.fn(),
  clearProject: vi.fn(),
};

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => PROJECT_STUB,
  useProjectOptional: () => PROJECT_STUB,
}));

import { WorkbenchFilePicker } from './WorkbenchFilePicker';

afterEach(() => {
  cleanup();
});

describe('WorkbenchFilePicker', () => {
  it('does not render the file picker before the event fires', () => {
    render(<WorkbenchFilePicker onSelectFile={vi.fn()} />);
    expect(screen.queryByTestId('file-picker-sentinel')).toBeNull();
  });

  it("renders the file picker when 'agent-ide:open-file-picker' is dispatched", () => {
    render(<WorkbenchFilePicker onSelectFile={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:open-file-picker'));
    });

    expect(screen.getByTestId('file-picker-sentinel')).toBeDefined();
  });

  it('calls onSelectFile with the chosen path and closes the picker', () => {
    const onSelectFile = vi.fn();
    render(<WorkbenchFilePicker onSelectFile={onSelectFile} />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:open-file-picker'));
    });

    act(() => {
      fireEvent.click(screen.getByTestId('fp-select'));
    });

    expect(onSelectFile).toHaveBeenCalledWith('/projects/test/README.md');
    // picker should be closed after selection
    expect(screen.queryByTestId('file-picker-sentinel')).toBeNull();
  });

  it('closes the picker when onClose is called without selecting', () => {
    const onSelectFile = vi.fn();
    render(<WorkbenchFilePicker onSelectFile={onSelectFile} />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:open-file-picker'));
    });

    act(() => {
      fireEvent.click(screen.getByTestId('fp-close'));
    });

    expect(onSelectFile).not.toHaveBeenCalled();
    expect(screen.queryByTestId('file-picker-sentinel')).toBeNull();
  });

  it('can be re-opened after being closed', () => {
    render(<WorkbenchFilePicker onSelectFile={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:open-file-picker'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('fp-close'));
    });
    expect(screen.queryByTestId('file-picker-sentinel')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:open-file-picker'));
    });
    expect(screen.getByTestId('file-picker-sentinel')).toBeDefined();
  });
});

// ── InnerRail "Search files" button dispatches the event ─────────────────────

// Additional stubs needed for InnerRail render.
vi.mock('../../shared/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

vi.mock('../../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'main' }),
}));

vi.mock('../useWorkbenchAgentData', () => ({
  useWorkbenchAgentData: () => ({ sessions: [] }),
}));

vi.mock('../useWorkbenchProjects', () => ({
  useWorkbenchProjects: () => [],
}));

vi.mock('./WorkbenchFileTree', () => ({
  WorkbenchFileTree: () => null,
}));

import { InnerRail } from '../Rails/InnerRail';

describe('InnerRail "Search files" button', () => {
  let dispatchedEvents: string[];

  beforeEach(() => {
    dispatchedEvents = [];
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatchedEvents.push((event as CustomEvent).type);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("clicking 'Search files' dispatches 'agent-ide:open-file-picker'", () => {
    render(<InnerRail />);

    act(() => {
      fireEvent.click(screen.getByTitle('Search files'));
    });

    expect(dispatchedEvents).toContain('agent-ide:open-file-picker');
  });
});
