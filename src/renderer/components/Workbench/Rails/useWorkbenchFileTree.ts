/**
 * useWorkbenchFileTree — lazy-expanding live file tree for the canon InnerRail.
 *
 * Each root directory is expanded on first render. Child directories expand
 * on click (lazy — no eager recursive read). File-change events from the
 * directory watch registry cause the affected directory to reload its listing.
 *
 * M/A git-status badges are deferred:
 *   roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md
 * The `badge` field is always null in this implementation.
 */

import { useCallback, useState } from 'react';

import { useFileWatcher } from '../../../hooks/useFileWatcher';

// ── Types ────────────────────────────────────────────────────────────────────

export type LiveFileNodeType = 'dir' | 'file';

/** Structurally compatible with MockFileNode — FileNode accepts this. */
export interface LiveFileNode {
  /** Unique stable key for React reconciliation. */
  key: string;
  type: LiveFileNodeType;
  depth: number;
  name: string;
  /** Full absolute path — used to load children when a dir is expanded. */
  path: string;
  /** Whether the directory is currently expanded (dirs only). */
  open: boolean;
  /** Git status badge — always null (deferred). */
  badge: null;
}

export interface UseWorkbenchFileTreeReturn {
  nodes: LiveFileNode[];
  isLoading: boolean;
  error: string | null;
  /** Toggle a directory open/closed by its path. */
  toggleDir: (path: string) => void;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Sort: directories first, then files, both alphabetical case-insensitive. */
export function compareEntries(a: LiveFileNode, b: LiveFileNode): number {
  if (a.type !== b.type) {
    return a.type === 'dir' ? -1 : 1;
  }
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

/** Build a stable key from path + depth (path alone is sufficient). */
function nodeKey(path: string): string {
  return path;
}

// ── Root directory watcher component hook ───────────────────────────────────

/**
 * useRootDir watches a single directory and exposes its flat entry list.
 * Callers compose multiple of these for multi-root support.
 */
export function useRootDir(rootPath: string | null): {
  entries: LiveFileNode[];
  isLoading: boolean;
  error: string | null;
} {
  const { files, isLoading, error } = useFileWatcher(rootPath);

  const entries: LiveFileNode[] = files
    .map((f) => ({
      key: nodeKey(f.path),
      type: (f.isDirectory ? 'dir' : 'file') as LiveFileNodeType,
      depth: 0,
      name: f.name,
      path: f.path,
      open: false,
      badge: null as null,
    }))
    .sort(compareEntries);

  return { entries, isLoading, error };
}

// ── Recursive expansion state ────────────────────────────────────────────────

interface ExpandedDirs {
  [dirPath: string]: LiveFileNode[];
}

function buildFlatTree(
  rootEntries: LiveFileNode[],
  expandedDirs: ExpandedDirs,
  depth: number,
): LiveFileNode[] {
  const result: LiveFileNode[] = [];
  for (const entry of rootEntries) {
    const node: LiveFileNode = { ...entry, depth };
    if (entry.type === 'dir' && expandedDirs[entry.path] !== undefined) {
      node.open = true;
      result.push(node);
      const children = buildFlatTree(
        expandedDirs[entry.path],
        expandedDirs,
        depth + 1,
      );
      for (const child of children) {
        result.push(child);
      }
    } else {
      result.push(node);
    }
  }
  return result;
}

// ── IPC helpers ──────────────────────────────────────────────────────────────

/** Read dirPath via IPC and return sorted LiveFileNode children, or null on failure. */
async function readDirSorted(dirPath: string): Promise<LiveFileNode[] | null> {
  const result = await window.electronAPI.files.readDir(dirPath);
  if (!result.success || !result.items) {
    return null;
  }
  return result.items
    .map((item) => ({
      key: nodeKey(item.path),
      type: (item.isDirectory ? 'dir' : 'file') as LiveFileNodeType,
      depth: 0,
      name: item.name,
      path: item.path,
      open: false,
      badge: null as null,
    }))
    .sort(compareEntries);
}

// ── Public hook ──────────────────────────────────────────────────────────────

/**
 * useWorkbenchFileTree manages a lazily-expanding file tree for ONE root path.
 *
 * - On mount: reads the root directory (via useFileWatcher → IPC readDir).
 * - toggleDir(path): collapses if already open; reads children via IPC and
 *   expands if not.
 * - File-change events reload the root listing automatically (debounced 100ms).
 */
export function useWorkbenchFileTree(rootPath: string | null): UseWorkbenchFileTreeReturn {
  const { entries: rootEntries, isLoading, error } = useRootDir(rootPath);
  const [expandedDirs, setExpandedDirs] = useState<ExpandedDirs>({});

  const toggleDir = useCallback(
    async (dirPath: string): Promise<void> => {
      if (expandedDirs[dirPath] !== undefined) {
        setExpandedDirs((prev) => {
          const next = { ...prev };
          collapseSubtree(next, dirPath);
          return next;
        });
        return;
      }
      const children = await readDirSorted(dirPath);
      if (children !== null) {
        setExpandedDirs((prev) => ({ ...prev, [dirPath]: children }));
      }
    },
    [expandedDirs],
  );

  const nodes = buildFlatTree(rootEntries, expandedDirs, 0);

  return {
    nodes,
    isLoading,
    error,
    toggleDir: (path: string) => {
      void toggleDir(path);
    },
  };
}

// ── Collapse helpers ─────────────────────────────────────────────────────────

/** Recursively remove dirPath and all its expanded children from the map. */
function collapseSubtree(expandedDirs: ExpandedDirs, dirPath: string): void {
  const children = expandedDirs[dirPath];
  if (children === undefined) {
    return;
  }
  delete expandedDirs[dirPath];
  for (const child of children) {
    if (child.type === 'dir') {
      collapseSubtree(expandedDirs, child.path);
    }
  }
}
