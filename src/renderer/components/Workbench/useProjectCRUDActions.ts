/**
 * useProjectCRUDActions — shared remove logic for all three project-switcher
 * surfaces (ProjectRail, TitleBarProjectDropdown, InnerRailProjectDropdown).
 *
 * When the user removes the currently-active project:
 *   - If other projects remain, the active switches to the next-alphabetical
 *     remaining project (matching the sorted order the user sees in the rail).
 *   - If no projects remain, removeProjectRoot alone is called; ProjectContext
 *     will leave projectRoot as null.
 *
 * When the user removes a NON-active project, only removeProjectRoot is called.
 */

import { useCallback } from 'react';

import { useProject } from '../../contexts/ProjectContext';
import { useWorkbenchProjects } from './useWorkbenchProjects';

export interface ProjectCRUDActions {
  /** Remove a project. Handles active-switch automatically. */
  removeProject: (path: string) => void;
}

export function useProjectCRUDActions(): ProjectCRUDActions {
  const { projectRoot, removeProjectRoot, setActiveProjectRoot } = useProject();
  const projects = useWorkbenchProjects();

  const removeProject = useCallback(
    (path: string): void => {
      if (path === projectRoot) {
        // Find the next-alphabetical remaining project (projects is already
        // sorted alphabetically by useWorkbenchProjects).
        const remaining = projects.filter((p) => p.path !== path);
        if (remaining.length > 0) {
          // Switch active BEFORE removing so ProjectContext sees the new active.
          setActiveProjectRoot(remaining[0].path);
        }
      }
      removeProjectRoot(path);
    },
    [projectRoot, projects, removeProjectRoot, setActiveProjectRoot],
  );

  return { removeProject };
}
