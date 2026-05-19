/**
 * diffReviewState.bulk.ts — Bulk review action hooks and flat-file-list helpers.
 *
 * Extracted from diffReviewState.ts to stay under the 300-line ESLint limit.
 *
 * Wave 95 Phase G: multi-project aware — all actions carry projectRoot.
 */

import type { Dispatch } from 'react';
import { useCallback } from 'react';

import type { DiffReviewAction, DiffReviewActions } from './diffReviewState';
import {
  getPendingEntries,
  getPendingEntriesForFile,
  revertPendingEntries,
  stagePendingEntries,
} from './diffReviewState.ops';
import type { DiffReviewState, ReviewFile } from './types';

type ReviewDispatch = Dispatch<DiffReviewAction>;

function useAcceptAllFile(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): (projectRoot: string, fileIdx: number) => void {
  return useCallback(
    (projectRoot: string, fileIdx: number) => {
      const project = state?.projects.find((p) => p.projectRoot === projectRoot);
      const file = project?.files[fileIdx];
      if (!project || !file) return;
      const hunkIds = file.hunks.filter((h) => h.decision === 'pending').map((h) => h.id);
      dispatch({ type: 'SET_FILE_DECISION', projectRoot, fileIdx, decision: 'accepted' });
      dispatch({ type: 'CAPTURE_BATCH', projectRoot, hunkIds });
      void stagePendingEntries({
        projectRoot,
        entries: getPendingEntriesForFile(file, fileIdx),
        files: project.files,
        dispatch,
        dispatchProjectRoot: projectRoot,
      });
    },
    [dispatch, state],
  );
}

function useRejectAllFile(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): (projectRoot: string, fileIdx: number) => void {
  return useCallback(
    (projectRoot: string, fileIdx: number) => {
      const project = state?.projects.find((p) => p.projectRoot === projectRoot);
      const file = project?.files[fileIdx];
      if (!project || !file) return;
      dispatch({ type: 'SET_FILE_DECISION', projectRoot, fileIdx, decision: 'rejected' });
      void revertPendingEntries({
        projectRoot,
        entries: getPendingEntriesForFile(file, fileIdx),
        dispatch,
        dispatchProjectRoot: projectRoot,
      });
    },
    [dispatch, state],
  );
}

function useAcceptAll(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): (projectRoot: string) => void {
  return useCallback(
    (projectRoot: string) => {
      const project = state?.projects.find((p) => p.projectRoot === projectRoot);
      if (!project) return;
      const hunkIds = project.files.flatMap((f) =>
        f.hunks.filter((h) => h.decision === 'pending').map((h) => h.id),
      );
      dispatch({ type: 'SET_ALL_DECISION', projectRoot, decision: 'accepted' });
      dispatch({ type: 'CAPTURE_BATCH', projectRoot, hunkIds });
      void stagePendingEntries({
        projectRoot,
        entries: getPendingEntries(project.files),
        files: project.files,
        dispatch,
        dispatchProjectRoot: projectRoot,
      });
    },
    [dispatch, state],
  );
}

function useRejectAll(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): (projectRoot: string) => void {
  return useCallback(
    (projectRoot: string) => {
      const project = state?.projects.find((p) => p.projectRoot === projectRoot);
      if (!project) return;
      dispatch({ type: 'SET_ALL_DECISION', projectRoot, decision: 'rejected' });
      dispatch({ type: 'CAPTURE_BATCH', projectRoot, hunkIds: [] });
      void revertPendingEntries({
        projectRoot,
        entries: getPendingEntries(project.files),
        dispatch,
        dispatchProjectRoot: projectRoot,
      });
    },
    [dispatch, state],
  );
}

export function useBulkReviewActions(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): Pick<DiffReviewActions, 'acceptAllFile' | 'rejectAllFile' | 'acceptAll' | 'rejectAll'> {
  return {
    acceptAllFile: useAcceptAllFile(state, dispatch),
    rejectAllFile: useRejectAllFile(state, dispatch),
    acceptAll: useAcceptAll(state, dispatch),
    rejectAll: useRejectAll(state, dispatch),
  };
}

export function useRollbackAction(
  state: DiffReviewState | null,
  dispatch: ReviewDispatch,
): { canRollback: boolean; rollback: (projectRoot: string) => void } {
  const activeProject = state?.projects.find((p) => p.projectRoot === state.activeProjectRoot);
  const canRollback = (activeProject?.lastAcceptedBatch?.length ?? 0) > 0;
  const rollback = useCallback(
    (projectRoot: string) => {
      dispatch({ type: 'ROLLBACK_LAST_BATCH', projectRoot });
    },
    [dispatch],
  );
  return { canRollback, rollback };
}

// ── Flat file list helpers ────────────────────────────────────────────────────

export interface FlatFileEntry {
  projectRoot: string;
  projectLabel: string;
  file: ReviewFile;
  /** Index within the project's files array. */
  fileIdx: number;
  /** Index in the flat list across all projects. */
  flatIdx: number;
}

export function buildFlatFileList(state: DiffReviewState): FlatFileEntry[] {
  const result: FlatFileEntry[] = [];
  let flatIdx = 0;
  for (const project of state.projects) {
    for (let fileIdx = 0; fileIdx < project.files.length; fileIdx += 1) {
      result.push({
        projectRoot: project.projectRoot,
        projectLabel: project.projectLabel,
        file: project.files[fileIdx],
        fileIdx,
        flatIdx,
      });
      flatIdx += 1;
    }
  }
  return result;
}

/** Returns the total number of pending-decision files across all projects. */
export function countPendingFiles(state: DiffReviewState | null): number {
  if (!state) return 0;
  return state.projects.reduce(
    (sum, p) => sum + p.files.filter((f) => f.hunks.some((h) => h.decision === 'pending')).length,
    0,
  );
}
