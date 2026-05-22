/**
 * @vitest-environment jsdom
 *
 * WorkbenchFileViewerModal.test.tsx — Wave 8 Phase 3.
 *
 * Contracts tested:
 *   (a) Renders nothing when openFilePath is null.
 *   (b) Renders the FileViewer sentinel when openFilePath is set and
 *       readFile resolves with content (file content path is live).
 *   (c) Calls onClose when the close button is clicked (no dirty state).
 *   (d) Calls onClose when Escape is pressed (no dirty state).
 *   (e) Does NOT call onClose on Escape when isDirty and confirm returns false.
 *   (f) Calls onClose on Escape when isDirty and confirm returns true.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Monaco + heavy deps — cut them off entirely ──────────────────────────────
vi.mock('monaco-editor', () => ({
  editor: {
    setTheme: vi.fn(),
    defineTheme: vi.fn(),
    create: vi.fn(),
    createModel: vi.fn(),
    getModel: vi.fn(),
    setModelMarkers: vi.fn(),
  },
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    setLanguageConfiguration: vi.fn(),
    registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerInlineCompletionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerDefinitionProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerReferenceProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerDocumentSymbolProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerSignatureHelpProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerDocumentFormattingEditProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerCodeActionProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerRenameProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerDocumentHighlightProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerFoldingRangeProvider: vi.fn(() => ({ dispose: vi.fn() })),
    CompletionItemKind: {},
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
  },
  Range: class {
    constructor(
      public s: number,
      public sc: number,
      public e: number,
      public ec: number,
    ) {}
  },
  Position: class {
    constructor(
      public l: number,
      public c: number,
    ) {}
  },
  Uri: { parse: (s: string) => s, file: (s: string) => s },
  KeyMod: {},
  KeyCode: {},
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
}));

// ContentRouter and PdfViewer pull in Monaco/pdfjs — mock them at the boundary.
vi.mock('../../FileViewer/ContentRouter', () => ({ ContentRouter: () => null }));
vi.mock('../../FileViewer/PdfViewer', () => ({ PdfViewer: () => null }));

// ── Sentinel mock for FileViewer ─────────────────────────────────────────────
// Mock at the FileViewer boundary, not the modal. Sentinel exposes key props via
// data-attrs so tests can assert the file content path was threaded correctly.
vi.mock('../../FileViewer/FileViewer', () => ({
  FileViewer: ({
    filePath,
    content,
    isLoading,
    error,
    onContentChange,
  }: {
    filePath: string | null;
    content: string | null;
    isLoading: boolean;
    error: string | null;
    onContentChange?: (c: string) => void;
  }) =>
    React.createElement('div', {
      'data-testid': 'file-viewer-sentinel',
      'data-filepath': filePath ?? '',
      'data-content': content ?? '',
      'data-loading': String(isLoading),
      'data-error': error ?? '',
      // Simulate a content change so dirty-guard tests can mark isDirty.
      onClick: () => onContentChange?.('changed content'),
    }),
}));

// ── ProjectContext stub ───────────────────────────────────────────────────────
vi.mock('../../../contexts/ProjectContext', () => ({
  useProjectOptional: () => ({
    projectRoot: '/projects/test',
    projectRoots: ['/projects/test'],
    projectName: 'test',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
}));

// ── window.electronAPI stub ───────────────────────────────────────────────────
const mockReadFile = vi.fn();
const mockReadBinaryFile = vi.fn();
const mockSaveFile = vi.fn();

beforeEach(() => {
  mockReadFile.mockResolvedValue({ success: true, content: 'file content here' });
  mockReadBinaryFile.mockResolvedValue({ success: false });
  mockSaveFile.mockResolvedValue({ success: true });

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      files: {
        readFile: mockReadFile,
        readBinaryFile: mockReadBinaryFile,
        saveFile: mockSaveFile,
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { WorkbenchFileViewerModal } from './WorkbenchFileViewerModal';

// ── (a) null path renders nothing ────────────────────────────────────────────

describe('WorkbenchFileViewerModal — null path', () => {
  it('renders nothing when openFilePath is null', () => {
    render(<WorkbenchFileViewerModal openFilePath={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('file-viewer-sentinel')).toBeNull();
  });
});

// ── (b) file content path ─────────────────────────────────────────────────────

describe('WorkbenchFileViewerModal — file content path', () => {
  it('mounts FileViewer with the correct filePath after readFile resolves', async () => {
    render(<WorkbenchFileViewerModal openFilePath="/projects/test/README.md" onClose={vi.fn()} />);

    // React.lazy + Suspense: sentinel appears after the lazy chunk resolves.
    // waitFor polls until the lazy boundary clears and readFile resolves.
    await waitFor(() => {
      const sentinel = screen.getByTestId('file-viewer-sentinel');
      expect(sentinel.getAttribute('data-content')).toBe('file content here');
    });

    const sentinel = screen.getByTestId('file-viewer-sentinel');
    expect(sentinel.getAttribute('data-filepath')).toBe('/projects/test/README.md');
    expect(sentinel.getAttribute('data-error')).toBe('');
  });

  it('threads the error when readFile fails', async () => {
    mockReadFile.mockResolvedValue({ success: false, error: 'Permission denied' });

    render(<WorkbenchFileViewerModal openFilePath="/projects/test/secret.txt" onClose={vi.fn()} />);

    await waitFor(() => {
      const sentinel = screen.getByTestId('file-viewer-sentinel');
      expect(sentinel.getAttribute('data-error')).toBe('Permission denied');
    });
  });
});

// ── (c) close button ─────────────────────────────────────────────────────────

describe('WorkbenchFileViewerModal — close button', () => {
  it('calls onClose when close button is clicked and file is not dirty', async () => {
    const onClose = vi.fn();
    render(<WorkbenchFileViewerModal openFilePath="/projects/test/README.md" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-viewer-sentinel').getAttribute('data-content')).toBe(
        'file content here',
      );
    });

    act(() => {
      fireEvent.click(screen.getByTitle('Close'));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── (d) Escape key ───────────────────────────────────────────────────────────

describe('WorkbenchFileViewerModal — Escape key', () => {
  it('calls onClose when Escape is pressed and file is not dirty', async () => {
    const onClose = vi.fn();
    render(<WorkbenchFileViewerModal openFilePath="/projects/test/README.md" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-viewer-sentinel').getAttribute('data-content')).toBe(
        'file content here',
      );
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── (e) dirty guard — confirm false ──────────────────────────────────────────

describe('WorkbenchFileViewerModal — dirty guard', () => {
  it('does NOT call onClose on Escape when dirty and user cancels confirm', async () => {
    const onClose = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<WorkbenchFileViewerModal openFilePath="/projects/test/README.md" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-viewer-sentinel').getAttribute('data-content')).toBe(
        'file content here',
      );
    });

    // Simulate a content change via the sentinel's onClick (marks isDirty).
    act(() => {
      fireEvent.click(screen.getByTestId('file-viewer-sentinel'));
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  // ── (f) dirty guard — confirm true ─────────────────────────────────────────

  it('calls onClose on Escape when dirty and user confirms discard', async () => {
    const onClose = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<WorkbenchFileViewerModal openFilePath="/projects/test/README.md" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-viewer-sentinel').getAttribute('data-content')).toBe(
        'file content here',
      );
    });

    act(() => {
      fireEvent.click(screen.getByTestId('file-viewer-sentinel'));
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalledOnce();

    vi.restoreAllMocks();
  });
});
