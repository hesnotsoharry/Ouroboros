/**
 * diffReviewState.ops.ts - Async git operations for the diff review.
 * Handles per-hunk staging/reverting and bulk file operations.
 *
 * Wave 95 Phase G: all dispatches now carry projectRoot so the reducer can
 * target the correct entry in the multi-project state.
 */

import log from 'electron-log/renderer';
import type { Dispatch } from 'react';

import type { FileDiff } from '../../types/electron';
import type { DiffReviewAction } from './diffReviewState';
import type { HunkDecision, ReviewFile } from './types';

type ReviewDispatch = Dispatch<DiffReviewAction>;

interface PendingHunkRef {
  fileIdx: number;
  hunkIdx: number;
  rawPatch: string;
}

export function toReviewFiles(apiFiles: FileDiff[], stagedPatches?: Set<string>): ReviewFile[] {
  return apiFiles.map((file) => ({
    filePath: file.filePath,
    relativePath: file.relativePath,
    status: file.status,
    oldPath: file.oldPath,
    hunks: file.hunks.map((hunk, index) => ({
      id: `${file.relativePath}:${index}`,
      header: hunk.header,
      oldStart: hunk.oldStart,
      oldCount: hunk.oldCount,
      newStart: hunk.newStart,
      newCount: hunk.newCount,
      lines: hunk.lines,
      rawPatch: hunk.rawPatch,
      decision: (stagedPatches?.has(hunk.rawPatch) ? 'accepted' : 'pending') as HunkDecision,
    })),
  }));
}

export function buildStagedPatchSet(cachedFiles: FileDiff[]): Set<string> {
  const set = new Set<string>();
  for (const file of cachedFiles) {
    for (const hunk of file.hunks) set.add(hunk.rawPatch);
  }
  return set;
}

export function getPendingEntriesForFile(file: ReviewFile, fileIdx: number): PendingHunkRef[] {
  return file.hunks.reduceRight<PendingHunkRef[]>((entries, hunk, hunkIdx) => {
    if (hunk.decision === 'pending') entries.push({ fileIdx, hunkIdx, rawPatch: hunk.rawPatch });
    return entries;
  }, []);
}

export function getPendingEntries(files: ReviewFile[]): PendingHunkRef[] {
  const entries: PendingHunkRef[] = [];
  for (let fileIdx = files.length - 1; fileIdx >= 0; fileIdx -= 1) {
    entries.push(...getPendingEntriesForFile(files[fileIdx], fileIdx));
  }
  return entries;
}

interface RevertOpts {
  projectRoot: string;
  entries: PendingHunkRef[];
  dispatch: ReviewDispatch;
  dispatchProjectRoot: string;
}

export async function revertPendingEntries(opts: RevertOpts): Promise<void> {
  const { projectRoot, entries, dispatch, dispatchProjectRoot } = opts;
  for (const entry of entries) {
    const result = await window.electronAPI.git.revertHunk(projectRoot, entry.rawPatch);
    if (!result.success) {
      log.warn(
        '[trace:diff-review] revertHunk failed (project %s, file %d, hunk %d):',
        projectRoot,
        entry.fileIdx,
        entry.hunkIdx,
        result.error,
      );
      dispatch({
        type: 'SET_DECISION',
        projectRoot: dispatchProjectRoot,
        fileIdx: entry.fileIdx,
        hunkIdx: entry.hunkIdx,
        decision: 'pending',
      });
    }
  }
}

interface StageFileOpts {
  projectRoot: string;
  fileEntries: PendingHunkRef[];
  file: ReviewFile;
  dispatch: ReviewDispatch;
  dispatchProjectRoot: string;
}

async function stageFileEntries(opts: StageFileOpts): Promise<void> {
  const { projectRoot, fileEntries, file, dispatch, dispatchProjectRoot } = opts;
  const hasRejectedHunks = file.hunks.some((h) => h.decision === 'rejected');
  if (!hasRejectedHunks) {
    const result = await window.electronAPI.git.stage(projectRoot, file.filePath);
    if (result.success) return;
    log.warn(
      '[trace:diff-review] git add failed for %s, falling back to per-hunk staging:',
      file.filePath,
      result.error,
    );
  }
  for (const entry of fileEntries) {
    const result = await window.electronAPI.git.stageHunk(projectRoot, entry.rawPatch);
    if (!result.success) {
      log.warn(
        '[trace:diff-review] stageHunk failed (project %s, file %d, hunk %d):',
        projectRoot,
        entry.fileIdx,
        entry.hunkIdx,
        result.error,
      );
      dispatch({
        type: 'SET_DECISION',
        projectRoot: dispatchProjectRoot,
        fileIdx: entry.fileIdx,
        hunkIdx: entry.hunkIdx,
        decision: 'pending',
      });
    }
  }
}

interface StageOpts {
  projectRoot: string;
  entries: PendingHunkRef[];
  files: ReviewFile[];
  dispatch: ReviewDispatch;
  dispatchProjectRoot: string;
}

export async function stagePendingEntries(opts: StageOpts): Promise<void> {
  const { projectRoot, entries, files, dispatch, dispatchProjectRoot } = opts;
  const byFile = new Map<number, PendingHunkRef[]>();
  for (const entry of entries) {
    let group = byFile.get(entry.fileIdx);
    if (!group) {
      group = [];
      byFile.set(entry.fileIdx, group);
    }
    group.push(entry);
  }
  for (const [fileIdx, fileEntries] of byFile) {
    await stageFileEntries({
      projectRoot,
      fileEntries,
      file: files[fileIdx],
      dispatch,
      dispatchProjectRoot,
    });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function loadReviewFiles(
  dispatch: ReviewDispatch,
  projectRoot: string,
  snapshotHash: string,
  filePaths?: string[],
): void {
  void Promise.all([
    window.electronAPI.git.diffReview(projectRoot, snapshotHash, filePaths),
    window.electronAPI.git.diffCached(projectRoot, snapshotHash, filePaths).catch(() => null),
  ])
    .then(([workingResult, cachedResult]) => {
      if (!workingResult.success || !workingResult.files) {
        dispatch({
          type: 'ERROR',
          projectRoot,
          error: workingResult.error ?? 'Failed to load diff',
        });
        return;
      }
      const stagedPatches =
        cachedResult?.success && cachedResult.files
          ? buildStagedPatchSet(cachedResult.files)
          : undefined;
      dispatch({
        type: 'LOADED',
        projectRoot,
        files: toReviewFiles(workingResult.files, stagedPatches),
      });
    })
    .catch((error) => {
      dispatch({ type: 'ERROR', projectRoot, error: getErrorMessage(error) });
    });
}
