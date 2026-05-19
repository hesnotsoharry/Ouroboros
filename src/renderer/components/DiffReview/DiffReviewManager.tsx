import log from 'electron-log/renderer';
import type { Dispatch } from 'react';
import React, { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';

import type { DiffReviewAction, DiffReviewActions } from './diffReviewState';
import {
  diffReviewReducer,
  useBulkReviewActions,
  useConfirmStaleOp,
  useReviewLifecycleActions,
  useRollbackAction,
  useSingleHunkActions,
  useStaleFileWatcher,
} from './diffReviewState';
import type { DiffReviewState } from './types';

export interface DiffReviewContextValue extends DiffReviewActions {
  state: DiffReviewState | null;
  canRollback: boolean;
  confirmStaleOp: () => void;
  dismissStaleOp: () => void;
}

const DiffReviewContext = createContext<DiffReviewContextValue | null>(null);

export function useDiffReview(): DiffReviewContextValue {
  const ctx = useContext(DiffReviewContext);
  if (!ctx) throw new Error('useDiffReview must be used within DiffReviewProvider');
  return ctx;
}

function useCheckpointGuard(state: DiffReviewState | null): () => Promise<void> {
  const firedRef = useRef(false);
  const prevStateNullRef = useRef(true);

  // Reset the guard whenever a new review session opens (null → non-null transition)
  if (state === null) prevStateNullRef.current = true;
  if (state !== null && prevStateNullRef.current) {
    prevStateNullRef.current = false;
    firedRef.current = false;
  }

  return useCallback(async () => {
    if (firedRef.current || !state) return;
    firedRef.current = true;
    const cfgResult = await window.electronAPI.config.get('autoCheckpoint').catch(() => null);
    if (cfgResult === false) return;
    // Checkpoint against the active project
    const active = state.projects.find((p) => p.projectRoot === state.activeProjectRoot);
    if (!active) return;
    const fileNames = active.files
      .map((f) => f.relativePath)
      .slice(0, 3)
      .join(', ');
    const suffix = active.files.length > 3 ? ` (+${active.files.length - 3} more)` : '';
    const msg = `before applying changes to ${fileNames}${suffix}`;
    await window.electronAPI.git.checkpoint(active.projectRoot, msg).catch((err) => {
      log.warn('[checkpoint] failed (non-blocking):', err);
    });
  }, [state]);
}

function useWrappedAcceptActions(
  base: Pick<DiffReviewActions, 'acceptHunk' | 'acceptAllFile' | 'acceptAll'>,
  checkpoint: () => Promise<void>,
): Pick<DiffReviewActions, 'acceptHunk' | 'acceptAllFile' | 'acceptAll'> {
  const acceptHunk = useCallback(
    (projectRoot: string, fileIdx: number, hunkIdx: number) => {
      void checkpoint().then(() => base.acceptHunk(projectRoot, fileIdx, hunkIdx));
    },
    [checkpoint, base],
  );
  const acceptAllFile = useCallback(
    (projectRoot: string, fileIdx: number) => {
      void checkpoint().then(() => base.acceptAllFile(projectRoot, fileIdx));
    },
    [checkpoint, base],
  );
  const acceptAll = useCallback(
    (projectRoot: string) => {
      void checkpoint().then(() => base.acceptAll(projectRoot));
    },
    [checkpoint, base],
  );
  return { acceptHunk, acceptAllFile, acceptAll };
}

type ReviewDispatch = Dispatch<DiffReviewAction>;

interface AllActions extends DiffReviewActions {
  canRollback: boolean;
  confirmStaleOp: () => void;
  dismissStaleOp: () => void;
}

function useAllActions(
  state: ReturnType<typeof diffReviewReducer>,
  dispatch: ReviewDispatch,
): AllActions {
  const lifecycle = useReviewLifecycleActions(dispatch);
  const { acceptHunk: baseAcceptHunk, rejectHunk } = useSingleHunkActions(state, dispatch);
  const {
    acceptAllFile: baseAcceptAllFile,
    rejectAllFile,
    acceptAll: baseAcceptAll,
    rejectAll,
  } = useBulkReviewActions(state, dispatch);
  const { acceptHunk, acceptAllFile, acceptAll } = useWrappedAcceptActions(
    { acceptHunk: baseAcceptHunk, acceptAllFile: baseAcceptAllFile, acceptAll: baseAcceptAll },
    useCheckpointGuard(state),
  );
  const { canRollback, rollback } = useRollbackAction(state, dispatch);
  const { confirmStaleOp, dismissStaleOp } = useConfirmStaleOp(state, dispatch);
  useStaleFileWatcher(state, dispatch);
  return {
    ...lifecycle,
    acceptHunk,
    rejectHunk,
    acceptAllFile,
    rejectAllFile,
    acceptAll,
    rejectAll,
    canRollback,
    rollback,
    confirmStaleOp,
    dismissStaleOp,
  };
}

function useDiffReviewContextValue(): DiffReviewContextValue {
  const [state, dispatch] = useReducer(diffReviewReducer, null);
  const actions = useAllActions(state, dispatch);
  return useMemo<DiffReviewContextValue>(() => ({ state, ...actions }), [state, actions]);
}

export function DiffReviewProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const value = useDiffReviewContextValue();
  return <DiffReviewContext.Provider value={value}>{children}</DiffReviewContext.Provider>;
}
