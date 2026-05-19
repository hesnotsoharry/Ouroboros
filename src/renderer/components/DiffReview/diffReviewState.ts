import log from 'electron-log/renderer';
import type { Dispatch } from 'react';
import { useCallback } from 'react';

import { loadReviewFiles } from './diffReviewState.ops';
import type {
  DiffReviewState,
  HunkDecision,
  ProjectReview,
  ReviewFile,
  StalePendingOp,
} from './types';

export type { FlatFileEntry } from './diffReviewState.bulk';
export {
  buildFlatFileList,
  countPendingFiles,
  useBulkReviewActions,
  useRollbackAction,
} from './diffReviewState.bulk';
export { toReviewFiles } from './diffReviewState.ops';
export {
  useConfirmStaleOp,
  useSingleHunkActions,
  useStaleFileWatcher,
} from './diffReviewState.stale';

export type DiffReviewAction =
  | {
      type: 'OPEN';
      sessionId: string;
      snapshotHash: string;
      projectRoot: string;
      filePaths?: string[];
    }
  | { type: 'LOADED'; projectRoot: string; files: ReviewFile[] }
  | { type: 'ERROR'; projectRoot: string; error: string }
  | { type: 'CLOSE' }
  | { type: 'CLOSE_PROJECT'; projectRoot: string }
  | { type: 'SET_ACTIVE_PROJECT'; projectRoot: string }
  | {
      type: 'SET_DECISION';
      projectRoot: string;
      fileIdx: number;
      hunkIdx: number;
      decision: HunkDecision;
    }
  | { type: 'SET_FILE_DECISION'; projectRoot: string; fileIdx: number; decision: HunkDecision }
  | { type: 'SET_ALL_DECISION'; projectRoot: string; decision: HunkDecision }
  | { type: 'CAPTURE_BATCH'; projectRoot: string; hunkIds: string[] }
  | { type: 'ROLLBACK_LAST_BATCH'; projectRoot: string }
  | { type: 'MARK_STALE'; projectRoot: string; relativePath: string }
  | { type: 'PEND_STALE_OP'; projectRoot: string; op: StalePendingOp }
  | { type: 'DISMISS_STALE_OP'; projectRoot: string };

export interface DiffReviewActions {
  openReview: (
    sessionId: string,
    snapshotHash: string,
    projectRoot: string,
    filePaths?: string[],
  ) => void;
  closeReview: () => void;
  closeProjectReview: (projectRoot: string) => void;
  setActiveProject: (projectRoot: string) => void;
  acceptHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  rejectHunk: (projectRoot: string, fileIdx: number, hunkIdx: number) => void;
  acceptAllFile: (projectRoot: string, fileIdx: number) => void;
  rejectAllFile: (projectRoot: string, fileIdx: number) => void;
  acceptAll: (projectRoot: string) => void;
  rejectAll: (projectRoot: string) => void;
  rollback: (projectRoot: string) => void;
}

type ReviewDispatch = Dispatch<DiffReviewAction>;

// ── Project label derivation ──────────────────────────────────────────────────

function deriveProjectLabel(p: string): string {
  return (
    p
      .replace(/[\\/]$/, '')
      .split(/[\\/]/)
      .pop() ?? p
  );
}

// ── Per-project helpers ───────────────────────────────────────────────────────

function buildProjectReview(action: Extract<DiffReviewAction, { type: 'OPEN' }>): ProjectReview {
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

function updateProject(
  projects: ProjectReview[],
  projectRoot: string,
  updater: (p: ProjectReview) => ProjectReview,
): ProjectReview[] {
  return projects.map((p) => (p.projectRoot === projectRoot ? updater(p) : p));
}

function updateProjectFile(
  files: ReviewFile[],
  fileIdx: number,
  updater: (file: ReviewFile) => ReviewFile,
): ReviewFile[] {
  return files.map((file, index) => (index === fileIdx ? updater(file) : file));
}

function updatePendingHunks(file: ReviewFile, decision: HunkDecision): ReviewFile {
  return {
    ...file,
    hunks: file.hunks.map((hunk) => (hunk.decision === 'pending' ? { ...hunk, decision } : hunk)),
  };
}

// ── Per-project state mutators ────────────────────────────────────────────────

function setHunkDecision(
  project: ProjectReview,
  fileIdx: number,
  hunkIdx: number,
  decision: HunkDecision,
): ProjectReview {
  const files = updateProjectFile(project.files, fileIdx, (file) => ({
    ...file,
    hunks: file.hunks.map((hunk, index) => (index === hunkIdx ? { ...hunk, decision } : hunk)),
  }));
  return { ...project, files };
}

function setFileDecision(p: ProjectReview, fileIdx: number, decision: HunkDecision): ProjectReview {
  return {
    ...p,
    files: updateProjectFile(p.files, fileIdx, (file) => updatePendingHunks(file, decision)),
  };
}

function setAllDecision(project: ProjectReview, decision: HunkDecision): ProjectReview {
  return { ...project, files: project.files.map((file) => updatePendingHunks(file, decision)) };
}

function rollbackBatch(project: ProjectReview): ProjectReview {
  if (!project.lastAcceptedBatch?.length) return project;
  const ids = new Set(project.lastAcceptedBatch);
  const files = project.files.map((file) => ({
    ...file,
    hunks: file.hunks.map((hunk) =>
      ids.has(hunk.id) && hunk.decision === 'accepted'
        ? { ...hunk, decision: 'pending' as HunkDecision }
        : hunk,
    ),
  }));
  return { ...project, files, lastAcceptedBatch: null };
}

// ── Stale action handler ──────────────────────────────────────────────────────

const UNHANDLED = Symbol('unhandled');

function applyStaleProjectAction(
  project: ProjectReview,
  action: DiffReviewAction,
): ProjectReview | typeof UNHANDLED {
  switch (action.type) {
    case 'MARK_STALE': {
      if (project.staleFiles.includes(action.relativePath)) return project;
      return { ...project, staleFiles: [...project.staleFiles, action.relativePath] };
    }
    case 'PEND_STALE_OP':
      return { ...project, stalePendingOp: action.op };
    case 'DISMISS_STALE_OP':
      return { ...project, stalePendingOp: null };
    default:
      return UNHANDLED;
  }
}

// ── Main reducer ──────────────────────────────────────────────────────────────

function applyLifecycleAction(
  state: DiffReviewState,
  action: DiffReviewAction,
): DiffReviewState | null | typeof UNHANDLED {
  switch (action.type) {
    case 'LOADED':
      return {
        ...state,
        projects: updateProject(state.projects, action.projectRoot, (p) => ({
          ...p,
          files: action.files,
          loading: false,
        })),
      };
    case 'ERROR':
      return {
        ...state,
        projects: updateProject(state.projects, action.projectRoot, (p) => ({
          ...p,
          error: action.error,
          loading: false,
        })),
      };
    case 'CLOSE':
      return null;
    case 'CLOSE_PROJECT': {
      const remaining = state.projects.filter((p) => p.projectRoot !== action.projectRoot);
      if (remaining.length === 0) return null;
      const nextActive =
        state.activeProjectRoot === action.projectRoot
          ? (remaining[0]?.projectRoot ?? null)
          : state.activeProjectRoot;
      return { projects: remaining, activeProjectRoot: nextActive };
    }
    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectRoot: action.projectRoot };
    default:
      return UNHANDLED;
  }
}

function applyStaleAction(state: DiffReviewState, action: DiffReviewAction): DiffReviewState {
  const staleAction = action as Extract<
    DiffReviewAction,
    { type: 'MARK_STALE' | 'PEND_STALE_OP' | 'DISMISS_STALE_OP' }
  >;
  const { projectRoot } = staleAction;
  if (!projectRoot) return state;
  const projects = updateProject(state.projects, projectRoot, (p) => {
    const result = applyStaleProjectAction(p, action);
    return result === UNHANDLED ? p : result;
  });
  return { ...state, projects };
}

function applyHunkAction(state: DiffReviewState, action: DiffReviewAction): DiffReviewState {
  switch (action.type) {
    case 'SET_DECISION':
      return {
        ...state,
        projects: updateProject(state.projects, action.projectRoot, (p) =>
          setHunkDecision(p, action.fileIdx, action.hunkIdx, action.decision),
        ),
      };
    case 'SET_FILE_DECISION':
      return {
        ...state,
        projects: updateProject(state.projects, action.projectRoot, (p) =>
          setFileDecision(p, action.fileIdx, action.decision),
        ),
      };
    case 'SET_ALL_DECISION':
      return {
        ...state,
        projects: updateProject(state.projects, action.projectRoot, (p) =>
          setAllDecision(p, action.decision),
        ),
      };
    case 'CAPTURE_BATCH':
      return {
        ...state,
        projects: updateProject(state.projects, action.projectRoot, (p) => ({
          ...p,
          lastAcceptedBatch: action.hunkIds,
        })),
      };
    case 'ROLLBACK_LAST_BATCH':
      return {
        ...state,
        projects: updateProject(state.projects, action.projectRoot, (p) => rollbackBatch(p)),
      };
    default:
      return applyStaleAction(state, action);
  }
}

function applyProjectAction(
  state: DiffReviewState,
  action: DiffReviewAction,
): DiffReviewState | null {
  const lifecycle = applyLifecycleAction(state, action);
  if (lifecycle !== UNHANDLED) return lifecycle;
  return applyHunkAction(state, action);
}

export function diffReviewReducer(
  state: DiffReviewState | null,
  action: DiffReviewAction,
): DiffReviewState | null {
  if (action.type === 'OPEN') {
    log.info('[trace:diff-review] OPEN', {
      projectRoot: action.projectRoot,
      sessionId: action.sessionId,
    });
    if (!state) {
      return {
        projects: [buildProjectReview(action)],
        activeProjectRoot: action.projectRoot,
      };
    }
    const existingIdx = state.projects.findIndex((p) => p.projectRoot === action.projectRoot);
    if (existingIdx !== -1) {
      // Replace entry for same project — latest snapshot supersedes
      const projects = state.projects.map((p, i) =>
        i === existingIdx ? buildProjectReview(action) : p,
      );
      return { ...state, projects };
    }
    // Append new project — don't change activeProjectRoot (don't interrupt current review)
    return {
      ...state,
      projects: [buildProjectReview(action), ...state.projects],
    };
  }
  if (!state) return action.type === 'CLOSE' ? null : state;
  return applyProjectAction(state, action);
}

// ── Action hooks ──────────────────────────────────────────────────────────────

export function useReviewLifecycleActions(
  dispatch: ReviewDispatch,
): Pick<
  DiffReviewActions,
  'openReview' | 'closeReview' | 'closeProjectReview' | 'setActiveProject'
> {
  const openReview = useCallback(
    (sessionId: string, snapshotHash: string, projectRoot: string, filePaths?: string[]) => {
      log.info('[trace:diff-review] openReview called', { projectRoot, sessionId });
      dispatch({ type: 'OPEN', sessionId, snapshotHash, projectRoot, filePaths });
      loadReviewFiles(dispatch, projectRoot, snapshotHash, filePaths);
    },
    [dispatch],
  );

  const closeReview = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, [dispatch]);

  const closeProjectReview = useCallback(
    (projectRoot: string) => {
      log.info('[trace:diff-review] closeProjectReview', { projectRoot });
      dispatch({ type: 'CLOSE_PROJECT', projectRoot });
    },
    [dispatch],
  );

  const setActiveProject = useCallback(
    (projectRoot: string) => {
      dispatch({ type: 'SET_ACTIVE_PROJECT', projectRoot });
    },
    [dispatch],
  );

  return { openReview, closeReview, closeProjectReview, setActiveProject };
}
