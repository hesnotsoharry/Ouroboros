/**
 * gitRepoStatusCache.ts — Per-session cache for `git rev-parse --git-dir` results.
 *
 * On Windows, `git rev-parse` is the single most expensive git operation in the IDE's
 * IPC surface (1.5–3.8s per call observed in 3-window boot traces). The result is a
 * filesystem fact that changes only when a `.git/` directory is created or removed —
 * both rare manual operations.
 *
 * Policy (Wave 16 decision 1):
 * - Positive results cached for session lifetime (no expiry).
 * - Negative results TTL'd at 30s — picks up `git init` within a normal reaction window.
 *
 * Cache key is the normalized absolute root path; module-scoped so all windows share.
 */

const NEGATIVE_TTL_MS = 30_000;

type Entry = { isRepo: true } | { isRepo: false; expires: number };

const cache = new Map<string, Entry>();

export function getCachedRepoStatus(root: string, now: number = Date.now()): boolean | undefined {
  const key = normalize(root);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.isRepo) return true;
  if (entry.expires > now) return false;
  cache.delete(key);
  return undefined;
}

export function setCachedRepoStatus(root: string, isRepo: boolean, now: number = Date.now()): void {
  const key = normalize(root);
  if (isRepo) {
    cache.set(key, { isRepo: true });
  } else {
    cache.set(key, { isRepo: false, expires: now + NEGATIVE_TTL_MS });
  }
}

export function clearRepoStatusCache(): void {
  cache.clear();
}

function normalize(root: string): string {
  return root.replace(/[\\/]+$/, '').toLowerCase();
}
