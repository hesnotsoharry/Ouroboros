/**
 * extensionStoreContributions.ts — Theme and icon-theme contribution loaders.
 *
 * Extracted from extensionStoreHelpers.ts to keep that file under 300 lines.
 */

import {
  type ExtensionIconThemeData,
  type ExtensionProductIconThemeData,
  loadExtensionIconThemes,
  loadExtensionProductIconThemes,
} from '../contributions/iconThemeLoader';
import { loadExtensionThemes, type OuroborosTheme } from '../contributions/themeLoader';
import {
  getCachedIconThemeContributions,
  getCachedProductIconThemeContributions,
  getCachedThemeContributions,
  setCachedIconThemeContributions,
  setCachedProductIconThemeContributions,
  setCachedThemeContributions,
} from './extensionStoreCache';
import { getDisabledList, refreshInstalledListFromDisk } from './extensionStoreHelpers';

export async function getThemeContributions(): Promise<{ themes: OuroborosTheme[] }> {
  const cached = getCachedThemeContributions();
  if (cached) return cached;
  const installed = await refreshInstalledListFromDisk();
  const disabled = new Set(getDisabledList());
  const allThemes: OuroborosTheme[] = [];
  for (const ext of installed) {
    if (disabled.has(ext.id) || !ext.contributes.themes?.length) continue;
    allThemes.push(...(await loadExtensionThemes(ext.id, ext.contributes.themes)));
  }
  const result = { themes: allThemes };
  setCachedThemeContributions(result);
  return result;
}

export async function getIconThemeContributions(): Promise<{
  iconThemes: ExtensionIconThemeData[];
}> {
  const cached = getCachedIconThemeContributions();
  if (cached) return cached;
  const installed = await refreshInstalledListFromDisk();
  const disabled = new Set(getDisabledList());
  const allIconThemes: ExtensionIconThemeData[] = [];
  for (const ext of installed) {
    if (disabled.has(ext.id) || !ext.contributes.iconThemes?.length) continue;
    allIconThemes.push(...(await loadExtensionIconThemes(ext.id, ext.contributes.iconThemes)));
  }
  const result = { iconThemes: allIconThemes };
  setCachedIconThemeContributions(result);
  return result;
}

export async function getProductIconThemeContributions(): Promise<{
  productIconThemes: ExtensionProductIconThemeData[];
}> {
  const cached = getCachedProductIconThemeContributions();
  if (cached) return cached;
  const installed = await refreshInstalledListFromDisk();
  const disabled = new Set(getDisabledList());
  const allProductIconThemes: ExtensionProductIconThemeData[] = [];
  for (const ext of installed) {
    if (disabled.has(ext.id) || !ext.contributes.productIconThemes?.length) continue;
    allProductIconThemes.push(
      ...(await loadExtensionProductIconThemes(ext.id, ext.contributes.productIconThemes)),
    );
  }
  const result = { productIconThemes: allProductIconThemes };
  setCachedProductIconThemeContributions(result);
  return result;
}
