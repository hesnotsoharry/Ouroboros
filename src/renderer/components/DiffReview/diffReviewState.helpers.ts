/**
 * diffReviewState.helpers.ts — Pure project-level helper functions for the diff-review reducer.
 *
 * Extracted from diffReviewState.ts (Wave 95 Phase G lint cleanup) to satisfy
 * the ESLint max-lines (300) cap.
 */

import type { HunkDecision, ProjectReview, ReviewFile } from './types';

// ── Project label derivation ──────────────────────────────────────────────────

export function deriveProjectLabel(p: string): string {
  return (
    p
      .replace(/[\\/]$/, '')
      .split(/[\\/]/)
      .pop() ?? p
  );
}

// ── OPEN action shape (avoids circular import from diffReviewState.ts) ────────

export interface OpenAction {
  type: 'OPEN';
  sessionId: string;
  snapshotHash: string;
  projectRoot: string;
  filePaths?: string[];
}

// ── Per-project builders ──────────────────────────────────────────────────────

export function buildProjectReview(action: OpenAction): ProjectReview {
  return {
    projectRoot: action.projectRoot,
    projectLabel: deriveProjectLabel(action.projectRoot),
    sessionId: action.sessionId,
    snapshotHash: action.snapshotHash,
    filePaths: action.filePaths,
    files: [],
    loading: true,
    error: null,
    lastAcceptedBatch: null,
    staleFiles: [],
    stalePendingOp: null,
  };
}

export function updateProject(
  projects: ProjectReview[],
  projectRoot: string,
  updater: (p: ProjectReview) => ProjectReview,
): ProjectReview[] {
  return projects.map((p) => (p.projectRoot === projectRoot ? updater(p) : p));
}

export function updateProjectFile(
  files: ReviewFile[],
  fileIdx: number,
  updater: (file: ReviewFile) => ReviewFile,
): ReviewFile[] {
  return files.map((file, index) => (index === fileIdx ? updater(file) : file));
}

export function updatePendingHunks(file: ReviewFile, decision: HunkDecision): ReviewFile {
  return {
    ...file,
    hunks: file.hunks.map((hunk) => (hunk.decision === 'pending' ? { ...hunk, decision } : hunk)),
  };
}
