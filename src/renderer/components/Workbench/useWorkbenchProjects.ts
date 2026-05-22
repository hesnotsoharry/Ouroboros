/**
 * useWorkbenchProjects — derives the live project list for the canon workbench
 * from ProjectContext (open roots) + config.recentProjects (recently-visited).
 *
 * For each project:
 *   name    = basename of the path
 *   initial = name[0].toUpperCase()
 *   active  = path === useProject().projectRoot
 *   color   = deterministic HSL from a djb2 hash of the path (data-derived
 *             project identity color — not a hardcoded hex; sanctioned exception
 *             per renderer color rule)
 *
 * The list is open roots first (in order), then recents not already in open
 * roots (deduplication by path). No dirty badge — deferred to a follow-up.
 */

import { useMemo } from 'react';

import { useProject } from '../../contexts/ProjectContext';
import { useConfig } from '../../hooks/useConfig';

// ── types ─────────────────────────────────────────────────────────────────────

export interface WorkbenchProject {
  path: string;
  name: string;
  initial: string;
  /** Deterministic HSL color derived from the path. */
  color: string;
  active: boolean;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** djb2 hash — fast, deterministic, good enough for color derivation. */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

/**
 * Convert a path to an HSL color string.
 * Hue spans the full wheel; saturation and lightness are locked to a range
 * that stays readable against both dark and light workbench backgrounds.
 * Data-derived, not a hardcoded hex — sanctioned per renderer color rule.
 */
function pathToColor(path: string): string {
  const hue = djb2(path) % 360;
  return `hsl(${hue}, 65%, 62%)`;
}

function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? filePath;
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useWorkbenchProjects(): WorkbenchProject[] {
  const { projectRoots, projectRoot } = useProject();
  const { config } = useConfig();

  return useMemo(() => {
    const recentProjects: string[] = Array.isArray(config?.recentProjects)
      ? (config.recentProjects as string[])
      : [];

    // Open roots first, then recents not already open — dedup by path.
    const seen = new Set<string>(projectRoots);
    const combined = [...projectRoots];
    for (const p of recentProjects) {
      if (!seen.has(p)) {
        seen.add(p);
        combined.push(p);
      }
    }

    return combined.map((path) => {
      const name = basename(path);
      return {
        path,
        name,
        initial: name.length > 0 ? name[0].toUpperCase() : '?',
        color: pathToColor(path),
        active: path === projectRoot,
      };
    });
  }, [projectRoots, projectRoot, config?.recentProjects]);
}
