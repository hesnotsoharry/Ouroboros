import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface ProjectContextValue {
  projectRoots: string[];
  projectRoot: string | null;
  projectName: string;
  /**
   * `true` once the initial async hydration from `getProjectRoots()` has
   * settled (resolved or failed). Consumers that validate against
   * `projectRoots` on cold boot must wait for this to avoid acting on
   * the empty initial state.
   */
  isLoaded: boolean;
  /**
   * Wave 12 Phase 2 — paths that have been explicitly removed via
   * `removeProjectRoot`. Used by `useWorkbenchProjects` to filter out
   * recently-removed paths that still appear in `config.recentProjects`
   * (recents come from a separate config key and are not automatically
   * stripped when a project is removed from the active roots).
   */
  excludedPaths: ReadonlySet<string>;
  setProjectRoot: (path: string) => void;
  addProjectRoot: (path: string) => void;
  removeProjectRoot: (path: string) => void;
  clearProject: () => void;
  /**
   * Wave 10 — switch active project by moving `path` to position [0] (the
   * "active is [0]" convention). Wave 10.1 fix: if `path` is not in
   * `projectRoots`, ADD it at [0] (recents-list paths shown in switcher UI
   * surfaces must be promotable). Phase 2 wires UI callers.
   */
  setActiveProjectRoot: (path: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? filePath;
}

function persistRoots(roots: string[]): void {
  if (typeof window === 'undefined' || !('electronAPI' in window)) return;
  void window.electronAPI.window.setProjectRoots(roots);
}

function mergeSavedRoots(savedRoots: string[], initialRoot: string | null): string[] {
  if (!initialRoot || savedRoots.includes(initialRoot)) return savedRoots;
  return [initialRoot, ...savedRoots.filter((root) => root !== initialRoot)];
}

function useProjectRootState(
  initialRoot: string | null,
): [string[], React.Dispatch<React.SetStateAction<string[]>>, boolean] {
  const [projectRoots, setProjectRoots] = useState<string[]>(() =>
    initialRoot ? [initialRoot] : [],
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const initialRootRef = useRef(initialRoot);

  useEffect(() => {
    if (typeof window === 'undefined' || !('electronAPI' in window)) {
      setIsLoaded(true);
      return;
    }

    void window.electronAPI.window
      .getProjectRoots()
      .then((result) => {
        const savedRoots = result.roots;
        if (Array.isArray(savedRoots) && savedRoots.length > 0) {
          setProjectRoots(mergeSavedRoots(savedRoots, initialRootRef.current));
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  return [projectRoots, setProjectRoots, isLoaded];
}

type UpdateRoots = (updater: (roots: string[]) => string[]) => void;

function useUpdateRoots(
  setProjectRoots: React.Dispatch<React.SetStateAction<string[]>>,
): UpdateRoots {
  return useCallback(
    (updater: (roots: string[]) => string[]) => {
      setProjectRoots((prev) => {
        const next = updater(prev);
        persistRoots(next);
        return next;
      });
    },
    [setProjectRoots],
  );
}

type SetExcluded = React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;

/** Add a path to the excluded set (idempotent). */
function excludeAdd(set: SetExcluded, path: string): void {
  set((prev) => {
    const next = new Set(prev);
    next.add(path);
    return next;
  });
}

/** Remove a path from the excluded set; no-op if absent (stable ref). */
function excludeDelete(set: SetExcluded, path: string): void {
  set((prev) => {
    if (!prev.has(path)) return prev;
    const next = new Set(prev);
    next.delete(path);
    return next;
  });
}

type RootActions = Pick<
  ProjectContextValue,
  | 'setProjectRoot'
  | 'addProjectRoot'
  | 'removeProjectRoot'
  | 'clearProject'
  | 'setActiveProjectRoot'
>;

function useProjectRootActions(
  setProjectRoots: React.Dispatch<React.SetStateAction<string[]>>,
  setExcludedPaths: SetExcluded,
): RootActions {
  const updateRoots = useUpdateRoots(setProjectRoots);

  const setProjectRoot = useCallback(
    (path: string): void => {
      updateRoots(() => [path]);
    },
    [updateRoots],
  );

  const addProjectRoot = useCallback(
    (path: string): void => {
      excludeDelete(setExcludedPaths, path);
      updateRoots((prev) => (prev.includes(path) ? prev : [...prev, path]));
    },
    [updateRoots, setExcludedPaths],
  );

  const removeProjectRoot = useCallback(
    (path: string): void => {
      // Track removed path so useWorkbenchProjects can filter it from recents.
      excludeAdd(setExcludedPaths, path);
      updateRoots((prev) => prev.filter((root) => root !== path));
    },
    [updateRoots, setExcludedPaths],
  );

  const clearProject = useCallback((): void => {
    updateRoots(() => []);
  }, [updateRoots]);

  const setActiveProjectRoot = useCallback(
    (path: string): void => {
      // Wave 10.1: add-if-absent + move-if-present. Un-exclude if previously removed.
      excludeDelete(setExcludedPaths, path);
      updateRoots((prev) => [path, ...prev.filter((root) => root !== path)]);
    },
    [updateRoots, setExcludedPaths],
  );

  return { setProjectRoot, addProjectRoot, removeProjectRoot, clearProject, setActiveProjectRoot };
}

export interface ProjectProviderProps {
  initialRoot?: string | null;
  children: React.ReactNode;
}

export function ProjectProvider({
  initialRoot = null,
  children,
}: ProjectProviderProps): React.ReactElement {
  const [projectRoots, setProjectRoots, isLoaded] = useProjectRootState(initialRoot);
  const [excludedPaths, setExcludedPaths] = useState<ReadonlySet<string>>(new Set());
  const projectActions = useProjectRootActions(setProjectRoots, setExcludedPaths);
  const projectRoot = projectRoots[0] ?? null;
  const projectName = projectRoot ? basename(projectRoot) : '';

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectRoots,
      projectRoot,
      projectName,
      isLoaded,
      excludedPaths,
      ...projectActions,
    }),
    [isLoaded, excludedPaths, projectActions, projectName, projectRoot, projectRoots],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
}

/** Non-throwing variant — returns null if used outside <ProjectProvider>. */
export function useProjectOptional(): ProjectContextValue | null {
  return useContext(ProjectContext);
}
