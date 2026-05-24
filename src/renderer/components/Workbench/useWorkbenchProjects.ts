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
 *   exists  = boolean from pathExists IPC (optimistic true until IPC resolves)
 *
 * Order: case-insensitive alphabetical by name (Wave 10.1 — UX preference
 * for find-by-name across all three switcher surfaces). The "active is [0]"
 * convention in ProjectContext stays intact for restore/persistence; the
 * `active: boolean` flag is set on whichever entry matches `projectRoot`,
 * independent of position. No dirty badge — deferred to a follow-up.
 */

import { useEffect, useMemo, useState } from 'react';

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
  /** Whether the path exists on disk. Optimistic true until the IPC resolves. */
  exists: boolean;
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

// ── helpers ───────────────────────────────────────────────────────────────────

type ProjectBase = Omit<WorkbenchProject, 'exists'>;

function deriveProjects(
  projectRoots: string[],
  projectRoot: string | null,
  recentProjects: string[],
  excluded: ReadonlySet<string>,
): ProjectBase[] {
  const seen = new Set<string>(projectRoots);
  const combined = [...projectRoots].filter((p) => !excluded.has(p));
  for (const p of recentProjects) {
    if (!seen.has(p) && !excluded.has(p)) {
      seen.add(p);
      combined.push(p);
    }
  }
  return combined
    .map((path) => {
      const name = basename(path);
      return {
        path,
        name,
        initial: name.length > 0 ? name[0].toUpperCase() : '?',
        color: pathToColor(path),
        active: path === projectRoot,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

async function fetchExistsMap(paths: string[]): Promise<Record<string, boolean>> {
  const pathExists = window.electronAPI?.files?.pathExists;
  if (!pathExists || paths.length === 0) return {};
  const results = await Promise.all(paths.map((p) => pathExists(p)));
  const map: Record<string, boolean> = {};
  for (let i = 0; i < paths.length; i++) map[paths[i]] = results[i];
  return map;
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useWorkbenchProjects(): WorkbenchProject[] {
  const { projectRoots, projectRoot, excludedPaths: rawExcluded } = useProject();
  const { config } = useConfig();
  const [existsMap, setExistsMap] = useState<Record<string, boolean>>({});

  const projects = useMemo(() => {
    // Defensive: older ProjectContext stubs in tests may not include excludedPaths.
    const excluded: ReadonlySet<string> = rawExcluded ?? new Set<string>();
    const recents: string[] = Array.isArray(config?.recentProjects)
      ? (config.recentProjects as string[])
      : [];
    return deriveProjects(projectRoots, projectRoot, recents, excluded);
  }, [projectRoots, projectRoot, rawExcluded, config?.recentProjects]);

  useEffect(() => {
    void fetchExistsMap(projects.map((p) => p.path)).then(setExistsMap);
  }, [projects]);

  return useMemo(
    () => projects.map((p) => ({ ...p, exists: existsMap[p.path] ?? true })),
    [projects, existsMap],
  );
}
