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

// ─── Module-scoped cache entries ─────────────────────────────────────────────

let themeCache: ThemeCache | undefined;
let iconThemeCache: IconThemeCache | undefined;
let productIconThemeCache: ProductIconThemeCache | undefined;

// ─── Theme contributions ──────────────────────────────────────────────────────

export function getCachedThemeContributions(): ThemeCache | undefined {
  return themeCache;
}

export function setCachedThemeContributions(value: ThemeCache): void {
  themeCache = value;
}

// ─── Icon theme contributions ─────────────────────────────────────────────────

export function getCachedIconThemeContributions(): IconThemeCache | undefined {
  return iconThemeCache;
}

export function setCachedIconThemeContributions(value: IconThemeCache): void {
  iconThemeCache = value;
}

// ─── Product icon theme contributions ────────────────────────────────────────

export function getCachedProductIconThemeContributions(): ProductIconThemeCache | undefined {
  return productIconThemeCache;
}

export function setCachedProductIconThemeContributions(value: ProductIconThemeCache): void {
  productIconThemeCache = value;
}

// ─── Invalidation ────────────────────────────────────────────────────────────

/**
 * Clears all contribution caches. Call this whenever the installed or enabled
 * extension list changes (install, uninstall, enableContributions,
 * disableContributions) so the next query re-loads fresh data from disk.
 */
export function clearExtensionContributionsCache(): void {
  themeCache = undefined;
  iconThemeCache = undefined;
  productIconThemeCache = undefined;
}
