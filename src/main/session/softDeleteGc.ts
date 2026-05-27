/**
 * softDeleteGc.ts — GC task for soft-deleted sessions and threads.
 *
 * Purges entities whose deletedAt + 30 days < now.
 * Separate from sessionGc.ts (7-day archive GC) — different grace period.
 *
 * Pure function with injected dependencies (no direct Electron imports).
 */

import log from '../logger';
import type { SessionStore } from './sessionStore';

// ─── Constants ────────────────────────────────────────────────────────────────

export const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

// ─── Result ───────────────────────────────────────────────────────────────────

export interface SoftDeleteGcResult {
  purgedSessions: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the 30-day soft-delete GC pass.
 *
 * @param now   - Current epoch ms.
 * @param store - Session store instance.
 */
export async function runSoftDeleteGc(
  now: number,
  store: SessionStore | null,
): Promise<SoftDeleteGcResult> {
  const result: SoftDeleteGcResult = { purgedSessions: 0 };

  result.purgedSessions = purgeSessions(store, now);

  if (result.purgedSessions > 0) {
    log.info('[softDeleteGc] purged', result.purgedSessions, 'sessions');
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isExpiredDelete(deletedAt: number | undefined, now: number): boolean {
  if (deletedAt === undefined) return false;
  return deletedAt + THIRTY_DAYS_MS < now;
}

function purgeSessions(store: SessionStore | null, now: number): number {
  if (!store) return 0;
  const all = store.listAll();
  const expired = all.filter((s) => isExpiredDelete(s.deletedAt, now));
  for (const s of expired) {
    try {
      store.delete(s.id);
    } catch (err) {
      log.error('[softDeleteGc] session purge failed:', s.id, err);
    }
  }
  return expired.length;
}
