/**
 * gitBranchCache.ts — Per-session cache for `git rev-parse --abbrev-ref HEAD` results.
 *
 * On Windows, spawning N concurrent `git` child processes at mount time causes
 * process-spawn contention (1.7–4.9 s handler latency observed). Nine separate
 * `useGitBranch` hook instances mount simultaneously; without deduplication each
 * fires its own git exec.
 *
 * Policy (Wave M-30 decision):
 * - Results are TTL'd at 5 seconds — short enough to feel live, long enough to
 *   collapse the 9-simultaneous-mount burst into one exec.
 * - The renderer hook polls at 30 s, so the 5 s TTL means every poll cycle hits
 *   git at most once across all consumers, not nine times.
 * - Failures are NOT cached — the next caller retries independently.
 *
 * Dogpile fix (mirrors gitRepoStatusCache.ts Wave 16 pattern):
 * - `pendingMap` collapses concurrent in-flight requests for the same root to ONE
 *   git exec. All callers share the single pending Promise.
 * - `invalidateBranchCache(root)` drops both the cached entry and any in-flight
 *   promise, so post-checkout refreshes are immediate.
 *
 * Cache key is the normalized absolute root path; module-scoped so all windows share.
 */

const BRANCH_TTL_MS = 5_000;

type BranchEntry = { branch: string; expiresAt: number };

const cache = new Map<string, BranchEntry>();
const pendingMap = new Map<string, Promise<string>>();

function normalize(root: string): string {
  return root.replace(/[\\/]+$/, '').toLowerCase();
}

function getCachedBranch(key: string, now: number): string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt > now) return entry.branch;
  cache.delete(key);
  return undefined;
}

/**
 * Returns a deduplicated, TTL-cached branch name for the given root.
 *
 * `fetchFn` must resolve to the branch string. On rejection, the pending slot is
 * cleared (so the next caller retries) and the error propagates to all waiters.
 * Failures are never written to the result cache.
 */
export function getOrFetchBranch(
  root: string,
  fetchFn: () => Promise<string>,
  now: number = Date.now(),
): Promise<string> {
  const key = normalize(root);

  const cached = getCachedBranch(key, now);
  if (cached !== undefined) return Promise.resolve(cached);

  const inflight = pendingMap.get(key);
  if (inflight) return inflight;

  const promise = fetchFn().then(
    (branch) => {
      if (pendingMap.get(key) === promise) {
        cache.set(key, { branch, expiresAt: now + BRANCH_TTL_MS });
        pendingMap.delete(key);
      }
      return branch;
    },
    (err: unknown) => {
      if (pendingMap.get(key) === promise) pendingMap.delete(key);
      throw err;
    },
  );

  pendingMap.set(key, promise);
  return promise;
}

/** Drop the cached entry and any in-flight promise for `root`. */
export function invalidateBranchCache(root: string): void {
  const key = normalize(root);
  cache.delete(key);
  pendingMap.delete(key);
}

/** Clear all cached entries and in-flight promises (test / session-reset use). */
export function clearBranchCache(): void {
  cache.clear();
  pendingMap.clear();
}
