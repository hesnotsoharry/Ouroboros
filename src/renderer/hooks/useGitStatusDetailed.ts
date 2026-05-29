import { useCallback, useEffect, useRef, useState } from 'react';

export interface DetailedGitStatus {
  /** Files staged in the git index: relative path -> status char (M/A/D/R) */
  staged: Map<string, string>;
  /** Unstaged working tree changes: relative path -> status char (M/A/D/?) */
  unstaged: Map<string, string>;
}

export interface UseGitStatusDetailedReturn {
  status: DetailedGitStatus;
  isRepo: boolean;
  /** Force-refresh the status (e.g. after staging/unstaging) */
  refresh: () => void;
}

const POLL_INTERVAL_MS = 8000;
const FILE_CHANGE_DEBOUNCE_MS = 150;

const EMPTY_STATUS: DetailedGitStatus = {
  staged: new Map(),
  unstaged: new Map(),
};

function toMap(record: Record<string, string> | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!record) return map;
  for (const [key, value] of Object.entries(record)) {
    map.set(key, value);
  }
  return map;
}

/**
 * useGitStatusDetailed - polls `git status --porcelain` and returns separate
 * staged vs. unstaged file maps. Uses the `git:statusDetailed` IPC channel
 * which parses the two-column porcelain output.
 */
function resetDetailedState(
  setStatus: React.Dispatch<React.SetStateAction<DetailedGitStatus>>,
  setIsRepo: React.Dispatch<React.SetStateAction<boolean>>,
  isRepoRef: React.MutableRefObject<boolean>,
): void {
  setStatus(EMPTY_STATUS);
  setIsRepo(false);
  isRepoRef.current = false;
}

interface DetailedWatcherOptions {
  timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  scheduleDetailedRefresh: (root: string) => void;
}

function setupDetailedFileWatcher(
  projectRoot: string,
  isRepoRef: React.MutableRefObject<boolean>,
  activeRef: { current: boolean },
  opts: DetailedWatcherOptions,
): (() => void) | null {
  const { timeoutRef, scheduleDetailedRefresh } = opts;
  try {
    return window.electronAPI.files.onFileChange(() => {
      if (!activeRef.current || !isRepoRef.current) return;
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        scheduleDetailedRefresh(projectRoot);
      }, FILE_CHANGE_DEBOUNCE_MS);
    });
  } catch {
    return null;
  }
}

interface UseGitStatusEffectOptions {
  projectRoot: string | null;
  setStatus: React.Dispatch<React.SetStateAction<DetailedGitStatus>>;
  setIsRepo: React.Dispatch<React.SetStateAction<boolean>>;
  isRepoRef: React.MutableRefObject<boolean>;
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  fetchStatus: (root: string) => Promise<void>;
  scheduleDetailedRefresh: (root: string) => void;
}

function useGitStatusEffect(options: UseGitStatusEffectOptions): void {
  const {
    projectRoot, setStatus, setIsRepo, isRepoRef,
    intervalRef, timeoutRef, fetchStatus, scheduleDetailedRefresh,
  } = options;
  useEffect(() => {
    if (!projectRoot) {
      resetDetailedState(setStatus, setIsRepo, isRepoRef);
      return;
    }
    const activeRef = { current: true };

    window.electronAPI.git.isRepo(projectRoot).then((result) => {
      if (!activeRef.current) return;
      const repo = !!(result.success && result.isRepo);
      setIsRepo(repo);
      isRepoRef.current = repo;
      if (repo) {
        void fetchStatus(projectRoot);
        intervalRef.current = setInterval(() => {
          if (activeRef.current) void fetchStatus(projectRoot);
        }, POLL_INTERVAL_MS);
      }
    });

    const cleanupWatcher = setupDetailedFileWatcher(
      projectRoot, isRepoRef, activeRef, { timeoutRef, scheduleDetailedRefresh },
    );
    return () => {
      activeRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      cleanupWatcher?.();
    };
  }, [projectRoot, fetchStatus, scheduleDetailedRefresh, setStatus, setIsRepo, isRepoRef, intervalRef, timeoutRef]);
}

type FetchStatusFn = (root: string) => Promise<void>;

interface DetailedFetchArgs {
  root: string;
  isRepoRef: React.MutableRefObject<boolean>;
  inFlightRef: React.MutableRefObject<boolean>;
  pendingRef: React.MutableRefObject<boolean>;
  rootRef: React.MutableRefObject<string | null>;
  setStatus: React.Dispatch<React.SetStateAction<DetailedGitStatus>>;
  fetchStatus: FetchStatusFn;
}

async function executeDetailedFetch(args: DetailedFetchArgs): Promise<void> {
  const { root, isRepoRef, inFlightRef, pendingRef, rootRef, setStatus, fetchStatus } = args;
  inFlightRef.current = true;
  try {
    const result = await window.electronAPI.git.statusDetailed(root);
    if (isRepoRef.current && rootRef.current === root && result.success)
      setStatus({ staged: toMap(result.staged), unstaged: toMap(result.unstaged) });
  } catch {
    /* silently ignore */
  } finally {
    inFlightRef.current = false;
    if (pendingRef.current && isRepoRef.current && rootRef.current === root) {
      pendingRef.current = false;
      void fetchStatus(root);
    }
  }
}

export function useGitStatusDetailed(projectRoot: string | null): UseGitStatusDetailedReturn {
  const [status, setStatus] = useState<DetailedGitStatus>(EMPTY_STATUS);
  const [isRepo, setIsRepo] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRepoRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const rootRef = useRef(projectRoot);
  rootRef.current = projectRoot;

  const fetchStatus: FetchStatusFn = useCallback(async (root) => {
    if (!isRepoRef.current) return;
    if (inFlightRef.current) { pendingRef.current = true; return; }
    await executeDetailedFetch({ root, isRepoRef, inFlightRef, pendingRef, rootRef, setStatus, fetchStatus });
  }, []); // refs and setStatus are stable — empty dep array is correct

  const scheduleDetailedRefresh = useCallback((root: string): void => {
    if (isRepoRef.current && rootRef.current === root) void fetchStatus(root);
  }, [fetchStatus]);

  const refresh = useCallback(() => {
    if (rootRef.current && isRepoRef.current) void fetchStatus(rootRef.current);
  }, [fetchStatus]);

  useGitStatusEffect({
    projectRoot, setStatus, setIsRepo, isRepoRef,
    intervalRef, timeoutRef, fetchStatus, scheduleDetailedRefresh,
  });

  return { status, isRepo, refresh };
}
