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
 * Dogpile fix (Wave 16 Phase 7):
 * - Pending Promise map prevents concurrent callers from each spawning a git exec.
 *   All callers arriving while a fetch is in-flight share the single pending Promise.
 * - clearRepoStatusCache() also clears the pending map so a mid-flight fetch that
 *   resolves after clear() fails an identity check and does NOT overwrite the cache.
 *
 * Cache key is the normalized absolute root path; module-scoped so all windows share.
 */

const NEGATIVE_TTL_MS = 30_000;

type Entry = { isRepo: true } | { isRepo: false; expires: number };

const cache = new Map<string, Entry>();
const pendingMap = new Map<string, Promise<boolean>>();

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

/**
 * Returns a deduplicated result for the given root. If a fetch is already in-flight
 * for this root, callers share the same Promise rather than spawning a second git exec.
 *
 * The resolved value is written to the result cache only if the pending slot still
 * holds this Promise (guards against clearRepoStatusCache() racing the fetch).
 *
 * `fetchFn` must return a boolean (true = is repo, false = is not). Failures should
 * be caught inside `fetchFn` and returned as `false` — matching gitIsRepo semantics.
 */
export function getOrFetchRepoStatus(
  root: string,
  fetchFn: () => Promise<boolean>,
  now: number = Date.now(),
): Promise<boolean> {
  const cached = getCachedRepoStatus(root, now);
  if (cached !== undefined) return Promise.resolve(cached);

  const key = normalize(root);
  const inflight = pendingMap.get(key);
  if (inflight) return inflight;

  const promise = fetchFn().then(
    (result) => {
      if (pendingMap.get(key) === promise) {
        setCachedRepoStatus(root, result, now);
        pendingMap.delete(key);
      }
      return result;
    },
    (err: unknown) => {
      if (pendingMap.get(key) === promise) pendingMap.delete(key);
      throw err;
    },
  );

  pendingMap.set(key, promise);
  return promise;
}

export function clearRepoStatusCache(): void {
  cache.clear();
  pendingMap.clear();
}

function normalize(root: string): string {
  return root.replace(/[\\/]+$/, '').toLowerCase();
}
