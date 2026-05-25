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
 * Module-scoped so all windows share a single warm entry.
 */

const CACHE_KEY = 'shell-history';

const cache = new Map<string, string[]>();

export function getCachedShellHistory(): string[] | undefined {
  return cache.get(CACHE_KEY);
}

export function setCachedShellHistory(commands: string[]): void {
  cache.set(CACHE_KEY, commands);
}

export function clearShellHistoryCache(): void {
  cache.clear();
}
