/**
 * windowManagerRailSync.ts — Pure helpers for rail-root persistence.
 *
 * Extracted from windowManager.ts so the delta-computation and prune logic are
 * testable without launching Electron. No Electron imports allowed here.
 *
 * Fixes:
 *   - DEFECT 1: Removals never prune — compute removed roots and delete records.
 *   - DEFECT 2: Non-active adds are ephemeral — upsert a session for every root.
 */

import type { Session } from './session/session';
import type { SessionStore } from './session/sessionStore';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal view of ManagedWindow used for rail sync — avoids circular imports. */
export interface WindowRailView {
  projectRoots: string[];
  activeSessionId: string | null;
}

// ─── Pure delta helpers ───────────────────────────────────────────────────────

/**
 * Returns roots present in `oldRoots` but absent in `newRoots`.
 * Pure — no side effects.
 */
export function computeRemovedRoots(
  oldRoots: readonly string[],
  newRoots: readonly string[],
): string[] {
  const next = new Set(newRoots);
  return oldRoots.filter((r) => !next.has(r));
}

/**
 * Returns true if any currently-open window (other than `excludeWinId`)
 * has `root` in its projectRoots list.
 */
export function isRootUsedByOtherWindow(
  root: string,
  excludeWinId: number,
  allWindowRoots: ReadonlyMap<number, readonly string[]>,
): boolean {
  for (const [winId, roots] of allWindowRoots) {
    if (winId === excludeWinId) continue;
    if (roots.includes(root)) return true;
  }
  return false;
}

// ─── Store-mutating helpers ───────────────────────────────────────────────────

/**
 * Upsert a session record for every root that lacks one.
 * Keeps the first root's session as the active one (returned).
 * Side effects: calls store.upsert for missing roots.
 */
export function upsertSessionsForRoots(
  roots: readonly string[],
  store: SessionStore,
  makeSession: (root: string) => Session,
): Session | null {
  if (roots.length === 0) return null;
  let activeSession: Session | null = null;
  for (const root of roots) {
    const existing = store.listByProjectRoot(root).find((s) => !s.archivedAt);
    const session = existing ?? makeSession(root);
    if (!existing) store.upsert(session);
    if (activeSession === null) activeSession = session;
  }
  return activeSession;
}

/**
 * Prune session records for roots that were explicitly removed from the rail.
 * A root is only pruned when no other window still references it.
 *
 * CRITICAL: this function must ONLY be called from the explicit-removal code
 * path in setWindowProjectRoots — never from window-close or bounds-persist
 * paths, because closing a window must not destroy session records.
 */
export function pruneRemovedRoots(opts: {
  removedRoots: readonly string[];
  winId: number;
  allWindowRoots: ReadonlyMap<number, readonly string[]>;
  store: SessionStore;
}): void {
  const { removedRoots, winId, allWindowRoots, store } = opts;
  for (const root of removedRoots) {
    if (isRootUsedByOtherWindow(root, winId, allWindowRoots)) continue;
    const records = store.listByProjectRoot(root);
    for (const record of records) {
      store.delete(record.id);
    }
  }
}

// ─── Orchestrator (windows-map dependent) ────────────────────────────────────

/** Build a snapshot of all open windows' roots for prune-guard checking. */
export function buildAllWindowRootsMap(
  windows: ReadonlyMap<number, WindowRailView>,
): ReadonlyMap<number, readonly string[]> {
  const map = new Map<number, readonly string[]>();
  for (const [id, m] of windows) {
    map.set(id, m.projectRoots);
  }
  return map;
}

/**
 * Sync the session store when roots change on a window.
 * Called from setWindowProjectRoots after managed.projectRoots is already updated.
 * Passed `setActiveSession` is called with the winning session so windowManager
 * can update activeSessionId + windowSessionMap without circular deps.
 */
export function syncRailRootsToStore(opts: {
  winId: number;
  oldRoots: readonly string[];
  newRoots: readonly string[];
  store: SessionStore;
  windows: ReadonlyMap<number, WindowRailView>;
  makeSession: (root: string) => Session;
  setActiveSession: (sessionId: string) => void;
}): void {
  const { winId, oldRoots, newRoots, store, windows, makeSession, setActiveSession } = opts;
  const activeSession = upsertSessionsForRoots(newRoots, store, makeSession);
  if (activeSession) setActiveSession(activeSession.id);
  const allWindowRoots = buildAllWindowRootsMap(windows);
  const removedRoots = computeRemovedRoots(oldRoots, newRoots);
  pruneRemovedRoots({ removedRoots, winId, allWindowRoots, store });
}
