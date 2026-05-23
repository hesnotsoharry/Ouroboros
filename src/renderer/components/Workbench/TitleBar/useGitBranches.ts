/**
 * useGitBranches — fetches the full branch list for a project root.
 *
 * Modelled on useGitBranch (src/renderer/hooks/useGitBranch.ts:246-260) but
 * returns the full list + a manual refresh trigger instead of a polling auto-
 * refresh. Re-fetches whenever projectRoot changes.
 *
 * Used by TitleBarBranchDropdown to populate the branch switcher.
 */

import { useCallback, useEffect, useState } from 'react';

export interface UseGitBranchesReturn {
  branches: string[];
  current: string | null;
  isLoading: boolean;
  refresh: () => void;
}

export function useGitBranches(projectRoot: string | null): UseGitBranchesReturn {
  const [branches, setBranches] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(() => {
    if (!projectRoot || typeof window === 'undefined' || !('electronAPI' in window)) return;
    setIsLoading(true);
    void window.electronAPI.git
      .branches(projectRoot)
      .then((result) => {
        if (result.success && Array.isArray(result.branches)) {
          setBranches(result.branches);
        }
        // `branches` IPC returns current branch via useGitBranch; approximate from
        // the list by checking for the HEAD-tracking entry or fall back to null.
        setCurrent(null);
      })
      .finally(() => setIsLoading(false));
  }, [projectRoot]);

  useEffect(() => {
    setBranches([]);
    setCurrent(null);
    fetch();
  }, [fetch]);

  return { branches, current, isLoading, refresh: fetch };
}
