/**
 * types.ts — DiffReview domain types.
 *
 * Describes the multi-project review state for per-hunk accept/reject of agent changes.
 * Wave 95 Phase G: extended from single-project to multi-project keyed by projectRoot.
 */

export type HunkDecision = 'pending' | 'accepted' | 'rejected';

export interface ReviewHunk {
  id: string;
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
  rawPatch: string;
  decision: HunkDecision;
}

export interface ReviewFile {
  filePath: string;
  relativePath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  hunks: ReviewHunk[];
  oldPath?: string;
}

/** A staged git operation waiting for the user to confirm despite file staleness. */
export interface StalePendingOp {
  kind: 'stage' | 'revert';
  fileIdx: number;
  hunkIdx: number;
}

/** Per-project review state — one entry per active project root. */
export interface ProjectReview {
  /** Unique key — absolute path to the project root. */
  projectRoot: string;
  /** Display name derived from the last path segment. Computed once at OPEN time. */
  projectLabel: string;
  /** Session that most recently emitted the diff_review_ready event for this project. */
  sessionId: string;
  snapshotHash: string;
  filePaths?: string[];
  files: ReviewFile[];
  loading: boolean;
  error: string | null;
  /** Hunk IDs from the most recently user-initiated accept action. Null = no rollback available. */
  lastAcceptedBatch: string[] | null;
  /**
   * Paths (relative) of files that have been modified externally since the diff was loaded.
   * Any stage/revert against these files will surface a re-prompt before proceeding.
   */
  staleFiles: string[];
  /**
   * When the user tries to stage/revert a stale file this holds the pending op
   * so the confirmation dialog can re-invoke it on approval.
   */
  stalePendingOp: StalePendingOp | null;
}

/**
 * Multi-project diff review state. null = panel closed (no active reviews).
 *
 * Wave 95 Phase G: replaces the old flat single-project DiffReviewState.
 * The null closed-state is preserved for backward-compat with the Wave 94
 * Phase E acceptance test's null-state semantics.
 */
export interface DiffReviewState {
  /** Ordered list of active project reviews; first = most recently opened. */
  projects: ProjectReview[];
  /** Which project's files the user is currently navigating. null when no reviews open. */
  activeProjectRoot: string | null;
}
