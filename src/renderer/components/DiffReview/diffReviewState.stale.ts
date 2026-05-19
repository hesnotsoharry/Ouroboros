/**
 * diffReviewState.stale.ts — Stale-file detection hooks for the diff review.
 *
 * Extracted from diffReviewState.ts to stay under the 300-line ESLint limit.
 *
 * Wave 95 Phase G: updated to operate on ProjectReview (per-project state)
 * rather than the old flat DiffReviewState. Hooks receive the active project's
 * data instead of the whole state, and all dispatches carry projectRoot.
 */

import log from 'electron-log/renderer';
import type { Dispatch } from 'react';
import { useCallback, useEffect } from 'react';

import type { DiffReviewAction, DiffReviewActions } from './diffReviewState';
import type { DiffReviewState, ProjectReview } from './types';

type ReviewDispatch = Dispatch<DiffReviewAction>;

/** Returns true if the file at fileIdx has been externally modified. */
export function isFileStale(project: ProjectReview, fileIdx: number): boolean {
  const relativePath = project.files[fileIdx]?.relativePath;
  return relativePath !== undefined && project.staleFiles.includes(relativePath);
}

interface HunkActionOpts {
  project: ProjectReview;
  dispatch: ReviewDispatch;
  projectRoot: string;
  fileIdx: number;
  hunkIdx: number;
}

export function executeAcceptHunk(opts: HunkActionOpts): void {
  const { project, dispatch, projectRoot, fileIdx, hunkIdx } = opts;
  const hunk = project.files[fileIdx]?.hunks[hunkIdx];
  if (!hunk || hunk.decision !== 'pending') return;
  const hunkId = hunk.id ?? '';
  dispatch({ type: 'SET_DECISION', projectRoot, fileIdx, hunkIdx, decision: 'accepted' });
  dispatch({ type: 'CAPTURE_BATCH', projectRoot, hunkIds: hunkId ? [hunkId] : [] });
  void window.electronAPI.git.stageHunk(project.projectRoot, hunk.rawPatch).catch((error) => {
    log.error('[trace:diff-review] Failed to stage hunk:', error);
    dispatch({ type: 'SET_DECISION', projectRoot, fileIdx, hunkIdx, decision: 'pending' });
    dispatch({ type: 'CAPTURE_BATCH', projectRoot, hunkIds: [] });
  });
}

export function executeRejectHunk(opts: HunkActionOpts): void {
  const { project, dispatch, projectRoot, fileIdx, hunkIdx } = opts;
  const hunk = project.files[fileIdx]?.hunks[hunkIdx];
  if (!hunk || hunk.decision !== 'pending') return;
  dispatch({ type: 'SET_DECISION', projectRoot, fileIdx, hunkIdx, decision: 'rejected' });
  dispatch({ type: 'CAPTURE_BATCH', projectRoot, hunkIds: [] });
  void window.electronAPI.git.revertHunk(project.projectRoot, hunk.rawPatch).catch((error) => {
    log.error('[trace:diff-review] Failed to revert hunk:', error);
    dispatch({ type: 'SET_DECISION', projectRoot, fileIdx, hunkIdx, decision: 'pending' });
  });
}

/**
 * Executes the pending stale op after the user has confirmed they want to proceed.
 * Operates on the active project's stale op.
 */
export function useConfirmStaleOp(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): { confirmStaleOp: () => void; dismissStaleOp: () => void } {
  const confirmStaleOp = useCallback(() => {
    if (!state) return;
    const project = state.projects.find((p) => p.projectRoot === state.activeProjectRoot);
    if (!project?.stalePendingOp) return;
    const { kind, fileIdx, hunkIdx } = project.stalePendingOp;
    const { projectRoot } = project;
    dispatch({ type: 'DISMISS_STALE_OP', projectRoot });
    const opts: HunkActionOpts = { project, dispatch, projectRoot, fileIdx, hunkIdx };
    if (kind === 'stage') {
      executeAcceptHunk(opts);
    } else {
      executeRejectHunk(opts);
    }
  }, [state, dispatch]);

  const dismissStaleOp = useCallback(() => {
    if (!state?.activeProjectRoot) return;
    dispatch({ type: 'DISMISS_STALE_OP', projectRoot: state.activeProjectRoot });
  }, [dispatch, state]);

  return { confirmStaleOp, dismissStaleOp };
}

/**
 * Subscribes to file-change events from the main process and marks files stale
 * when they are modified while the diff review is open.
 *
 * Watches across ALL open projects simultaneously.
 */
export function useStaleFileWatcher(state: DiffReviewState | null, dispatch: ReviewDispatch): void {
  useEffect(() => {
    if (!state || !window.electronAPI?.files?.onFileChange) return;
    // Build a map from absolute filePath → { relativePath, projectRoot }
    const pathMap = new Map<string, { relativePath: string; projectRoot: string }>();
    for (const project of state.projects) {
      for (const file of project.files) {
        pathMap.set(file.filePath, {
          relativePath: file.relativePath,
          projectRoot: project.projectRoot,
        });
      }
    }
    const cleanup = window.electronAPI.files.onFileChange((change) => {
      if (change.type !== 'change') return;
      const entry = pathMap.get(change.path);
      if (!entry) return;
      dispatch({
        type: 'MARK_STALE',
        projectRoot: entry.projectRoot,
        relativePath: entry.relativePath,
      });
    });
    return cleanup;
    // Re-subscribe when the set of tracked files changes across any project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.projects, dispatch]);
}

export function useSingleHunkActions(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): Pick<DiffReviewActions, 'acceptHunk' | 'rejectHunk'> {
  const acceptHunk = useCallback(
    (projectRoot: string, fileIdx: number, hunkIdx: number) => {
      if (!state) return;
      const project = state.projects.find((p) => p.projectRoot === projectRoot);
      if (!project) return;
      if (isFileStale(project, fileIdx)) {
        dispatch({ type: 'PEND_STALE_OP', projectRoot, op: { kind: 'stage', fileIdx, hunkIdx } });
        return;
      }
      executeAcceptHunk({ project, dispatch, projectRoot, fileIdx, hunkIdx });
    },
    [dispatch, state],
  );

  const rejectHunk = useCallback(
    (projectRoot: string, fileIdx: number, hunkIdx: number) => {
      if (!state) return;
      const project = state.projects.find((p) => p.projectRoot === projectRoot);
      if (!project) return;
      if (isFileStale(project, fileIdx)) {
        dispatch({ type: 'PEND_STALE_OP', projectRoot, op: { kind: 'revert', fileIdx, hunkIdx } });
        return;
      }
      executeRejectHunk({ project, dispatch, projectRoot, fileIdx, hunkIdx });
    },
    [dispatch, state],
  );

  return { acceptHunk, rejectHunk };
}
