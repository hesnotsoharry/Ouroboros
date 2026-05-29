/**
 * gitStatusCache.ts — Per-root TTL cache for `git status --porcelain` results.
 *
 * `git:status` and `git:statusDetailed` share the same underlying git exec
 * (`git status --porcelain=v1`). Without caching, every `files:change` event
 * fired by active Claude terminals spawns a fresh git subprocess per root —
 * with 3 roots × N terminals this becomes a subprocess storm that causes
 * main-thread jank.
 *
 * Policy (mirrors gitBranchCache.ts Wave M-30 pattern):
 * - Results are TTL'd at 5 seconds — same as `git:branch` / `git:isRepo`
 *   caches. Short enough to feel live; long enough to collapse the burst
 *   of simultaneous file-change-triggered calls into one exec per root.
 * - Failures are NOT cached — the next caller retries independently.
 *
 * Dogpile fix (same pattern as gitBranchCache.ts):
 * - `pendingMap` collapses concurrent in-flight requests for the same root
 *   to ONE git exec. All callers share the single pending Promise.
 *
 * Two separate cache instances are created: one for `git:status` results
 * (shape: `{ files }`) and one for `git:statusDetailed` results (shape:
 * `{ staged, unstaged }`). Each instance is module-scoped so all windows
 * share the same cache across the process lifetime.
 *
 * Cache key is the normalized absolute root path (trailing slashes stripped,
 * lowercased on Windows).
 */

const STATUS_TTL_MS = 5_000;

function normalize(root: string): string {
  return root.replace(/[\\/]+$/, '').toLowerCase();
}

interface StatusCacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface StatusCache<T> {
  /** Returns a deduplicated, TTL-cached value for the given root. */
  getOrFetch: (root: string, fetchFn: () => Promise<T>, now?: number) => Promise<T>;
  /** Drop the cached entry and any in-flight promise for `root`. */
  invalidate: (root: string) => void;
  /** Clear all cached entries and in-flight promises (test / session-reset use). */
  clear: () => void;
}

function getCachedEntry<T>(
  cache: Map<string, StatusCacheEntry<T>>,
  key: string,
  now: number,
): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt > now) return entry.value;
  cache.delete(key);
  return undefined;
}

function buildGetOrFetch<T>(
  cache: Map<string, StatusCacheEntry<T>>,
  pendingMap: Map<string, Promise<T>>,
): (root: string, fetchFn: () => Promise<T>, now?: number) => Promise<T> {
  return function getOrFetch(root, fetchFn, now = Date.now()) {
    const key = normalize(root);
    const cached = getCachedEntry(cache, key, now);
    if (cached !== undefined) return Promise.resolve(cached);

    const inflight = pendingMap.get(key);
    if (inflight) return inflight;

    const promise = fetchFn().then(
      (value) => {
        if (pendingMap.get(key) === promise) {
          cache.set(key, { value, expiresAt: now + STATUS_TTL_MS });
          pendingMap.delete(key);
        }
        return value;
      },
      (err: unknown) => {
        if (pendingMap.get(key) === promise) pendingMap.delete(key);
        throw err;
      },
    );
    pendingMap.set(key, promise);
    return promise;
  };
}

function makeStatusCache<T>(): StatusCache<T> {
  const cache = new Map<string, StatusCacheEntry<T>>();
  const pendingMap = new Map<string, Promise<T>>();
  return {
    getOrFetch: buildGetOrFetch(cache, pendingMap),
    invalidate: (root) => { const k = normalize(root); cache.delete(k); pendingMap.delete(k); },
    clear: () => { cache.clear(); pendingMap.clear(); },
  };
}

/** Cache for `git:status` results (shape: `{ files: Record<string, string> }`). */
export const gitStatusCache = makeStatusCache<Record<string, string>>();

/**
 * Cache for `git:statusDetailed` results
 * (shape: `{ staged: Record<string, string>; unstaged: Record<string, string> }`).
 */
export const gitStatusDetailedCache = makeStatusCache<{
  staged: Record<string, string>;
  unstaged: Record<string, string>;
}>();

/** TTL value in milliseconds — exposed for tests. */
export { STATUS_TTL_MS };
