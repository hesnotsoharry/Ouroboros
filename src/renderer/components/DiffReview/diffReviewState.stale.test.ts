/**
 * @vitest-environment jsdom
 *
 * diffReviewState.stale.test.ts — stale-file detection for diff review.
 *
 * Wave 95 Phase G: updated to use ProjectReview (per-project state) and
 * the new projectRoot-scoped dispatch signatures.
 *
 * Covers:
 * - MARK_STALE action sets staleFiles on the matching project
 * - isFileStale detects staleness on ProjectReview
 * - executeAcceptHunk / executeRejectHunk use ProjectReview + projectRoot
 * - confirmStaleOp re-invokes the IPC after user confirms
 * - dismissStaleOp clears the pending op without invoking IPC
 * - useStaleFileWatcher dispatches MARK_STALE with projectRoot
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { diffReviewReducer } from './diffReviewState';
import {
  executeAcceptHunk,
  executeRejectHunk,
  isFileStale,
  useConfirmStaleOp,
  useStaleFileWatcher,
} from './diffReviewState.stale';
import type { DiffReviewState, ProjectReview } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = '/proj';

function makeProject(overrides: Partial<ProjectReview> = {}): ProjectReview {
  return {
    projectRoot: PROJECT_ROOT,
    projectLabel: 'proj',
    sessionId: 'sess-1',
    snapshotHash: 'abc123',
    files: [
      {
        filePath: '/proj/src/foo.ts',
        relativePath: 'src/foo.ts',
        status: 'modified',
        hunks: [
          {
            id: 'src/foo.ts:0',
            header: '@@ -1,3 +1,3 @@',
            oldStart: 1,
            oldCount: 3,
            newStart: 1,
            newCount: 3,
            lines: [' a', '-b', '+c'],
            rawPatch: 'diff patch text',
            decision: 'pending',
          },
        ],
      },
    ],
    loading: false,
    error: null,
    lastAcceptedBatch: null,
    staleFiles: [],
    stalePendingOp: null,
    ...overrides,
  };
}

function makeState(projectOverrides: Partial<ProjectReview> = {}): DiffReviewState {
  return {
    activeProjectRoot: PROJECT_ROOT,
    projects: [makeProject(projectOverrides)],
  };
}

function activeProject(state: DiffReviewState | null): ProjectReview | undefined {
  return state?.projects.find((p) => p.projectRoot === state.activeProjectRoot);
}

// ---------------------------------------------------------------------------
// Mock window.electronAPI
// ---------------------------------------------------------------------------

const mockStageHunk = vi.fn().mockResolvedValue({ success: true });
const mockRevertHunk = vi.fn().mockResolvedValue({ success: true });
let fileChangeCallback: ((change: { type: string; path: string }) => void) | null = null;

beforeEach(() => {
  mockStageHunk.mockClear();
  mockRevertHunk.mockClear();
  fileChangeCallback = null;

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      git: { stageHunk: mockStageHunk, revertHunk: mockRevertHunk },
      files: {
        onFileChange: vi.fn((cb) => {
          fileChangeCallback = cb;
          return () => {
            fileChangeCallback = null;
          };
        }),
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Reducer — MARK_STALE
// ---------------------------------------------------------------------------

describe('diffReviewReducer MARK_STALE', () => {
  it('adds the relativePath to staleFiles on the correct project', () => {
    const state = makeState();
    const next = diffReviewReducer(state, {
      type: 'MARK_STALE',
      projectRoot: PROJECT_ROOT,
      relativePath: 'src/foo.ts',
    });
    expect(activeProject(next)?.staleFiles).toContain('src/foo.ts');
  });

  it('is idempotent — does not add duplicates', () => {
    const state = makeState({ staleFiles: ['src/foo.ts'] });
    const next = diffReviewReducer(state, {
      type: 'MARK_STALE',
      projectRoot: PROJECT_ROOT,
      relativePath: 'src/foo.ts',
    });
    const count = activeProject(next)?.staleFiles.filter((p) => p === 'src/foo.ts').length;
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Reducer — PEND_STALE_OP / DISMISS_STALE_OP
// ---------------------------------------------------------------------------

describe('diffReviewReducer PEND_STALE_OP / DISMISS_STALE_OP', () => {
  it('sets stalePendingOp on the correct project', () => {
    const state = makeState();
    const op = { kind: 'stage' as const, fileIdx: 0, hunkIdx: 0 };
    const next = diffReviewReducer(state, {
      type: 'PEND_STALE_OP',
      projectRoot: PROJECT_ROOT,
      op,
    });
    expect(activeProject(next)?.stalePendingOp).toEqual(op);
  });

  it('clears stalePendingOp on DISMISS_STALE_OP', () => {
    const state = makeState({ stalePendingOp: { kind: 'stage', fileIdx: 0, hunkIdx: 0 } });
    const next = diffReviewReducer(state, {
      type: 'DISMISS_STALE_OP',
      projectRoot: PROJECT_ROOT,
    });
    expect(activeProject(next)?.stalePendingOp).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isFileStale — operates on ProjectReview
// ---------------------------------------------------------------------------

describe('isFileStale', () => {
  it('returns false when file is not in staleFiles', () => {
    expect(isFileStale(makeProject(), 0)).toBe(false);
  });

  it('returns true when file relativePath is in staleFiles', () => {
    expect(isFileStale(makeProject({ staleFiles: ['src/foo.ts'] }), 0)).toBe(true);
  });

  it('returns false for an out-of-range fileIdx', () => {
    expect(isFileStale(makeProject({ staleFiles: ['src/foo.ts'] }), 99)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// executeAcceptHunk / executeRejectHunk — now accept ProjectReview + projectRoot
// ---------------------------------------------------------------------------

describe('executeAcceptHunk', () => {
  it('dispatches SET_DECISION + CAPTURE_BATCH with projectRoot and calls stageHunk', () => {
    const project = makeProject();
    const dispatch = vi.fn();
    executeAcceptHunk({ project, dispatch, projectRoot: PROJECT_ROOT, fileIdx: 0, hunkIdx: 0 });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_DECISION',
        projectRoot: PROJECT_ROOT,
        decision: 'accepted',
      }),
    );
    expect(mockStageHunk).toHaveBeenCalledWith(PROJECT_ROOT, 'diff patch text');
  });

  it('is a no-op when hunk decision is not pending', () => {
    const project = makeProject();
    project.files[0].hunks[0].decision = 'accepted';
    const dispatch = vi.fn();
    executeAcceptHunk({ project, dispatch, projectRoot: PROJECT_ROOT, fileIdx: 0, hunkIdx: 0 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockStageHunk).not.toHaveBeenCalled();
  });
});

describe('executeRejectHunk', () => {
  it('dispatches SET_DECISION + CAPTURE_BATCH with projectRoot and calls revertHunk', () => {
    const project = makeProject();
    const dispatch = vi.fn();
    executeRejectHunk({ project, dispatch, projectRoot: PROJECT_ROOT, fileIdx: 0, hunkIdx: 0 });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_DECISION',
        projectRoot: PROJECT_ROOT,
        decision: 'rejected',
      }),
    );
    expect(mockRevertHunk).toHaveBeenCalledWith(PROJECT_ROOT, 'diff patch text');
  });
});

// ---------------------------------------------------------------------------
// useConfirmStaleOp — now finds active project from DiffReviewState
// ---------------------------------------------------------------------------

describe('useConfirmStaleOp', () => {
  it('confirmStaleOp dispatches DISMISS + calls stageHunk for stage op', async () => {
    const state = makeState({
      staleFiles: ['src/foo.ts'],
      stalePendingOp: { kind: 'stage', fileIdx: 0, hunkIdx: 0 },
    });
    const dispatch = vi.fn();

    const { result } = renderHook(() => useConfirmStaleOp(state, dispatch));
    act(() => {
      result.current.confirmStaleOp();
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DISMISS_STALE_OP', projectRoot: PROJECT_ROOT }),
    );
    expect(mockStageHunk).toHaveBeenCalledWith(PROJECT_ROOT, 'diff patch text');
  });

  it('confirmStaleOp calls revertHunk for revert op', async () => {
    const state = makeState({
      staleFiles: ['src/foo.ts'],
      stalePendingOp: { kind: 'revert', fileIdx: 0, hunkIdx: 0 },
    });
    const dispatch = vi.fn();

    const { result } = renderHook(() => useConfirmStaleOp(state, dispatch));
    act(() => {
      result.current.confirmStaleOp();
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DISMISS_STALE_OP', projectRoot: PROJECT_ROOT }),
    );
    expect(mockRevertHunk).toHaveBeenCalledWith(PROJECT_ROOT, 'diff patch text');
  });

  it('dismissStaleOp dispatches DISMISS_STALE_OP without invoking IPC', () => {
    const state = makeState({ stalePendingOp: { kind: 'stage', fileIdx: 0, hunkIdx: 0 } });
    const dispatch = vi.fn();

    const { result } = renderHook(() => useConfirmStaleOp(state, dispatch));
    act(() => {
      result.current.dismissStaleOp();
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DISMISS_STALE_OP', projectRoot: PROJECT_ROOT }),
    );
    expect(mockStageHunk).not.toHaveBeenCalled();
  });

  it('confirmStaleOp is a no-op when stalePendingOp is null', () => {
    const state = makeState();
    const dispatch = vi.fn();

    const { result } = renderHook(() => useConfirmStaleOp(state, dispatch));
    act(() => {
      result.current.confirmStaleOp();
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(mockStageHunk).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useStaleFileWatcher — now watches across all projects
// ---------------------------------------------------------------------------

describe('useStaleFileWatcher', () => {
  it('dispatches MARK_STALE with projectRoot when a tracked file emits a change event', () => {
    const state = makeState();
    const dispatch = vi.fn();

    renderHook(() => useStaleFileWatcher(state, dispatch));

    act(() => {
      fileChangeCallback?.({ type: 'change', path: '/proj/src/foo.ts' });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'MARK_STALE',
      projectRoot: PROJECT_ROOT,
      relativePath: 'src/foo.ts',
    });
  });

  it('does not dispatch for untracked files', () => {
    const state = makeState();
    const dispatch = vi.fn();

    renderHook(() => useStaleFileWatcher(state, dispatch));

    act(() => {
      fileChangeCallback?.({ type: 'change', path: '/proj/src/other.ts' });
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch for non-change event types (e.g. add)', () => {
    const state = makeState();
    const dispatch = vi.fn();

    renderHook(() => useStaleFileWatcher(state, dispatch));

    act(() => {
      fileChangeCallback?.({ type: 'add', path: '/proj/src/foo.ts' });
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const state = makeState();
    const dispatch = vi.fn();

    const { unmount } = renderHook(() => useStaleFileWatcher(state, dispatch));
    unmount();

    expect(fileChangeCallback).toBeNull();
  });

  it('is a no-op when state is null', () => {
    const dispatch = vi.fn();
    renderHook(() => useStaleFileWatcher(null, dispatch));
    expect(window.electronAPI.files.onFileChange).not.toHaveBeenCalled();
  });
});
