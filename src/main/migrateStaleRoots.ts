/**
 * migrateStaleRoots.ts — Startup migration that drops persisted config entries
 * pointing at project-root paths that no longer exist on disk.
 *
 * Policy: drop-if-missing. Any entry whose path does not pass the `exists`
 * check is removed. No rename-merge. Data loss is acceptable — these reference
 * renamed or deleted folders.
 *
 * Defensive: each key is pruned independently so one bad key cannot abort the
 * whole migration or block app launch.
 *
 * Naturally idempotent: re-running on already-pruned data finds nothing to drop.
 */

import fs from 'fs';

import { getConfigValue, setConfigValue } from './config';
import type { TerminalSessionSnapshot } from './configTypes';
import log from './logger';
import type { Session } from './session';

// ---------------------------------------------------------------------------
// Injected exists dependency — injected so tests don't touch the real FS
// ---------------------------------------------------------------------------

export type ExistsFn = (p: string) => boolean;

// ---------------------------------------------------------------------------
// Per-key prune helpers (each catches its own errors defensively)
// ---------------------------------------------------------------------------

function pruneArrayOfPaths(
  key: 'multiRoots' | 'recentProjects' | 'trustedWorkspaces',
  exists: ExistsFn,
): void {
  try {
    const raw = getConfigValue(key);
    if (!Array.isArray(raw)) return;
    const before = raw as string[];
    const after = before.filter((p) => typeof p === 'string' && exists(p));
    const dropped = before.length - after.length;
    if (dropped > 0) {
      setConfigValue(key, after);
      log.info('[migrate:stale-roots]', { key, dropped });
    }
  } catch (err) {
    log.warn('[migrate:stale-roots] error pruning', key, err);
  }
}

function pruneDefaultProjectRoot(exists: ExistsFn): void {
  try {
    const raw = getConfigValue('defaultProjectRoot');
    if (typeof raw !== 'string' || raw === '') return;
    if (!exists(raw)) {
      setConfigValue('defaultProjectRoot', '');
      log.info('[migrate:stale-roots]', { key: 'defaultProjectRoot', dropped: raw });
    }
  } catch (err) {
    log.warn('[migrate:stale-roots] error pruning defaultProjectRoot', err);
  }
}

function pruneSessionsData(exists: ExistsFn): void {
  try {
    const raw = getConfigValue('sessionsData');
    if (!Array.isArray(raw)) return;
    const before = raw as Session[];
    const after = before.filter(
      (s) => s && typeof s.projectRoot === 'string' && exists(s.projectRoot),
    );
    const dropped = before.length - after.length;
    if (dropped > 0) {
      setConfigValue('sessionsData', after);
      log.info('[migrate:stale-roots]', { key: 'sessionsData', dropped });
    }
  } catch (err) {
    log.warn('[migrate:stale-roots] error pruning sessionsData', err);
  }
}

function prunePathKeyedObject(
  key: 'canonWorkbenchSessions' | 'terminalSessionsPerProject',
  exists: ExistsFn,
): void {
  try {
    const raw = getConfigValue(key);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const record = raw as Record<string, unknown>;
    const droppedKeys: string[] = [];
    for (const k of Object.keys(record)) {
      if (!exists(k)) droppedKeys.push(k);
    }
    if (droppedKeys.length > 0) {
      const pruned = Object.fromEntries(
        Object.entries(record).filter(([k]) => !droppedKeys.includes(k)),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AppConfig key type can't narrow Record here
      setConfigValue(key, pruned as any);
      log.info('[migrate:stale-roots]', { key, dropped: droppedKeys.length });
    }
  } catch (err) {
    log.warn('[migrate:stale-roots] error pruning', key, err);
  }
}

function pruneTerminalSessions(exists: ExistsFn): void {
  try {
    const raw = getConfigValue('terminalSessions');
    if (!Array.isArray(raw)) return;
    const before = raw as TerminalSessionSnapshot[];
    const after = before.filter(
      (s) => s && typeof s.cwd === 'string' && exists(s.cwd),
    );
    const dropped = before.length - after.length;
    if (dropped > 0) {
      setConfigValue('terminalSessions', after);
      log.info('[migrate:stale-roots]', { key: 'terminalSessions', dropped });
    }
  } catch (err) {
    log.warn('[migrate:stale-roots] error pruning terminalSessions', err);
  }
}

// ---------------------------------------------------------------------------
// workspaceSnapshots — SKIPPED
//
// WorkspaceSnapshot contains { id, commitHash, sessionId, sessionLabel,
// timestamp, type, fileCount } — no project-root or path field. There is no
// safe path-based prune. Skipped intentionally.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * pruneStaleRoots — drop every persisted config entry whose project-root path
 * is absent on disk according to `exists`.
 *
 * Call BEFORE restoreWindowSessions() so the window-restore pass reads
 * already-cleaned data.
 */
export function pruneStaleRoots(exists: ExistsFn): void {
  pruneArrayOfPaths('multiRoots', exists);
  pruneArrayOfPaths('recentProjects', exists);
  pruneArrayOfPaths('trustedWorkspaces', exists);
  pruneDefaultProjectRoot(exists);
  pruneSessionsData(exists);
  prunePathKeyedObject('canonWorkbenchSessions', exists);
  prunePathKeyedObject('terminalSessionsPerProject', exists);
  pruneTerminalSessions(exists);
}

/**
 * runStaleRootsMigration — production entry point that wires `fs.existsSync`.
 *
 * Call from main.ts startup BEFORE restoreWindowSessions. The thin wrapper
 * exists so main.ts does not need to import `fs` just for this migration; and
 * so tests can call `pruneStaleRoots` with a fake exists fn directly.
 *
 * Path values come from the app's own electron-store, not from user-supplied
 * renderer input — they are trusted internal data.
 */
export function runStaleRootsMigration(): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths from internal config, not renderer input
  pruneStaleRoots((p) => fs.existsSync(p));
}
