/**
 * shellHistoryCache.ts — Per-session cache for `shellHistory:read` results.
 *
 * Shell history is read from a static file on disk (~540–610 ms per call on Windows,
 * ~2.3s cumulative across the ~4 calls observed in 3-window boot traces). The result
 * is stable during a session: shell history files are append-only, and autocomplete
 * suggestions do not require up-to-the-millisecond freshness.
 *
 * Policy (Wave 16 decision 3):
 * - Cached for session lifetime (no expiry, no TTL).
 * - Explicit invalidation via `clearShellHistoryCache()` — available if a future
 *   refresh channel is added.
 *
 * Dogpile fix (Wave 16 Phase 7):
 * - Single pending slot deduplicates concurrent callers. There is exactly one shell
 *   history per session (no per-key dimension) so one slot is sufficient.
 * - clearShellHistoryCache() nulls the pending slot so a mid-flight fetch that
 *   resolves after clear() fails an identity check and does NOT overwrite the
 *   cleared cache with stale data.
 *
 * Module-scoped so all windows share a single warm entry.
 */

const CACHE_KEY = 'shell-history';

const cache = new Map<string, string[]>();
let pending: Promise<string[]> | null = null;

export function getCachedShellHistory(): string[] | undefined {
  return cache.get(CACHE_KEY);
}

export function setCachedShellHistory(commands: string[]): void {
  cache.set(CACHE_KEY, commands);
}

/**
 * Returns a deduplicated shell-history fetch. Concurrent callers share one in-flight
 * Promise. The resolved value is written to cache only if the pending slot still
 * points to this Promise (guards against a clear() racing the fetch).
 */
export function getOrFetchShellHistory(fetchFn: () => Promise<string[]>): Promise<string[]> {
  const cached = getCachedShellHistory();
  if (cached !== undefined) return Promise.resolve(cached);
  if (pending) return pending;
  const promise = fetchFn().then(
    (result) => {
      if (pending === promise) {
        cache.set(CACHE_KEY, result);
        pending = null;
      }
      return result;
    },
    (err: unknown) => {
      if (pending === promise) pending = null;
      throw err;
    },
  );
  pending = promise;
  return promise;
}

export function clearShellHistoryCache(): void {
  cache.clear();
  pending = null;
}
