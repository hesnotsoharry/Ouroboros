/**
 * extensionStoreCache.ts — Session cache for extension contribution queries.
 *
 * `getThemeContributions`, `getIconThemeContributions`, and
 * `getProductIconThemeContributions` each walk the full installed-extension list
 * and load theme JSON from disk, costing 600–1800 ms per call. On a 3-window boot
 * the renderer calls these multiple times, accumulating ~6 seconds of IPC latency.
 *
 * Policy (Wave 16 Phase 2):
 * - Results cached for session lifetime on first successful load.
 * - Cache is invalidated on extension install, uninstall, enable-contributions,
 *   or disable-contributions — the only events that can change which themes are
 *   present or active.
 * - All three query types share one invalidation gate (any extension state change
 *   invalidates all three, which is conservative and correct: an install could add
 *   themes, icon themes, or product icon themes in one operation).
 * - Module-scoped so all windows share the same warm cache.
 *
 * Dogpile fix (Wave 16 Phase 7):
 * - Three independent pending slots (one per contribution type) prevent concurrent
 *   callers from each spawning a full disk walk. Each type fetches different data
 *   so slots are NOT shared.
 * - clearExtensionContributionsCache() also nulls pending slots so a mid-flight
 *   fetch cannot overwrite a just-cleared cache with stale data. The `.then`
 *   callback checks identity against the module-level slot before writing — if
 *   clear() ran while the fetch was in-flight, the slot no longer matches and the
 *   stale result is discarded.
 */

import type {
  ExtensionIconThemeData,
  ExtensionProductIconThemeData,
} from '../contributions/iconThemeLoader';
import type { OuroborosTheme } from '../contributions/themeLoader';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeCache = { themes: OuroborosTheme[] };
export type IconThemeCache = { iconThemes: ExtensionIconThemeData[] };
export type ProductIconThemeCache = { productIconThemes: ExtensionProductIconThemeData[] };

// ─── Module-scoped cache + pending entries ────────────────────────────────────

let themeCache: ThemeCache | undefined;
let iconThemeCache: IconThemeCache | undefined;
let productIconThemeCache: ProductIconThemeCache | undefined;

let themePending: Promise<ThemeCache> | null = null;
let iconThemePending: Promise<IconThemeCache> | null = null;
let productIconThemePending: Promise<ProductIconThemeCache> | null = null;

// ─── Theme contributions ──────────────────────────────────────────────────────

export function getCachedThemeContributions(): ThemeCache | undefined {
  return themeCache;
}

export function setCachedThemeContributions(value: ThemeCache): void {
  themeCache = value;
}

/**
 * Returns a deduplicated theme-contributions fetch. Concurrent callers share one
 * in-flight Promise. The resolved value is written to cache only if the pending
 * slot still points to this Promise (guards against a clear() racing the fetch).
 */
export function getOrFetchThemeContributions(
  fetchFn: () => Promise<ThemeCache>,
): Promise<ThemeCache> {
  if (themeCache) return Promise.resolve(themeCache);
  if (themePending) return themePending;
  const promise = fetchFn().then(
    (result) => {
      if (themePending === promise) {
        themeCache = result;
        themePending = null;
      }
      return result;
    },
    (err: unknown) => {
      if (themePending === promise) themePending = null;
      throw err;
    },
  );
  themePending = promise;
  return promise;
}

// ─── Icon theme contributions ─────────────────────────────────────────────────

export function getCachedIconThemeContributions(): IconThemeCache | undefined {
  return iconThemeCache;
}

export function setCachedIconThemeContributions(value: IconThemeCache): void {
  iconThemeCache = value;
}

/**
 * Returns a deduplicated icon-theme-contributions fetch. Concurrent callers share
 * one in-flight Promise. Guards against stale writes after clear() via identity check.
 */
export function getOrFetchIconThemeContributions(
  fetchFn: () => Promise<IconThemeCache>,
): Promise<IconThemeCache> {
  if (iconThemeCache) return Promise.resolve(iconThemeCache);
  if (iconThemePending) return iconThemePending;
  const promise = fetchFn().then(
    (result) => {
      if (iconThemePending === promise) {
        iconThemeCache = result;
        iconThemePending = null;
      }
      return result;
    },
    (err: unknown) => {
      if (iconThemePending === promise) iconThemePending = null;
      throw err;
    },
  );
  iconThemePending = promise;
  return promise;
}

// ─── Product icon theme contributions ────────────────────────────────────────

export function getCachedProductIconThemeContributions(): ProductIconThemeCache | undefined {
  return productIconThemeCache;
}

export function setCachedProductIconThemeContributions(value: ProductIconThemeCache): void {
  productIconThemeCache = value;
}

/**
 * Returns a deduplicated product-icon-theme-contributions fetch. Concurrent callers
 * share one in-flight Promise. Guards against stale writes after clear() via identity check.
 */
export function getOrFetchProductIconThemeContributions(
  fetchFn: () => Promise<ProductIconThemeCache>,
): Promise<ProductIconThemeCache> {
  if (productIconThemeCache) return Promise.resolve(productIconThemeCache);
  if (productIconThemePending) return productIconThemePending;
  const promise = fetchFn().then(
    (result) => {
      if (productIconThemePending === promise) {
        productIconThemeCache = result;
        productIconThemePending = null;
      }
      return result;
    },
    (err: unknown) => {
      if (productIconThemePending === promise) productIconThemePending = null;
      throw err;
    },
  );
  productIconThemePending = promise;
  return promise;
}

// ─── Invalidation ────────────────────────────────────────────────────────────

/**
 * Clears all contribution caches and pending slots. Call this whenever the installed
 * or enabled extension list changes (install, uninstall, enableContributions,
 * disableContributions) so the next query re-loads fresh data from disk.
 *
 * Pending slots are nulled so that any in-flight fetch resolving after this call
 * fails the identity check in its `.then` and does NOT overwrite the cleared cache.
 */
export function clearExtensionContributionsCache(): void {
  themeCache = undefined;
  iconThemeCache = undefined;
  productIconThemeCache = undefined;
  themePending = null;
  iconThemePending = null;
  productIconThemePending = null;
}
