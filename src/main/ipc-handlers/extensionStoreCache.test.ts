import { afterEach, describe, expect, it } from 'vitest';

import {
  clearExtensionContributionsCache,
  getCachedIconThemeContributions,
  getCachedProductIconThemeContributions,
  getCachedThemeContributions,
  setCachedIconThemeContributions,
  setCachedProductIconThemeContributions,
  setCachedThemeContributions,
} from './extensionStoreCache';

describe('extensionStoreCache', () => {
  afterEach(() => {
    clearExtensionContributionsCache();
  });

  // ─── Theme contributions ───────────────────────────────────────────────────

  it('returns undefined for theme contributions before any set', () => {
    expect(getCachedThemeContributions()).toBeUndefined();
  });

  it('returns the cached theme contributions after set', () => {
    const value = { themes: [{ label: 'Dark+', uiTheme: 'vs-dark' as const, path: '/a' }] };
    setCachedThemeContributions(value);
    expect(getCachedThemeContributions()).toBe(value);
  });

  it('returns the same object reference (no copy) for theme contributions', () => {
    const value = { themes: [] };
    setCachedThemeContributions(value);
    expect(getCachedThemeContributions()).toBe(value);
  });

  // ─── Icon theme contributions ──────────────────────────────────────────────

  it('returns undefined for icon theme contributions before any set', () => {
    expect(getCachedIconThemeContributions()).toBeUndefined();
  });

  it('returns the cached icon theme contributions after set', () => {
    const value = { iconThemes: [{ id: 'material', label: 'Material', path: '/b' }] };
    setCachedIconThemeContributions(value);
    expect(getCachedIconThemeContributions()).toBe(value);
  });

  // ─── Product icon theme contributions ─────────────────────────────────────

  it('returns undefined for product icon theme contributions before any set', () => {
    expect(getCachedProductIconThemeContributions()).toBeUndefined();
  });

  it('returns the cached product icon theme contributions after set', () => {
    const value = { productIconThemes: [{ id: 'fluent', label: 'Fluent', path: '/c' }] };
    setCachedProductIconThemeContributions(value);
    expect(getCachedProductIconThemeContributions()).toBe(value);
  });

  // ─── Invalidation ─────────────────────────────────────────────────────────

  it('clearExtensionContributionsCache clears all three caches', () => {
    setCachedThemeContributions({ themes: [] });
    setCachedIconThemeContributions({ iconThemes: [] });
    setCachedProductIconThemeContributions({ productIconThemes: [] });

    clearExtensionContributionsCache();

    expect(getCachedThemeContributions()).toBeUndefined();
    expect(getCachedIconThemeContributions()).toBeUndefined();
    expect(getCachedProductIconThemeContributions()).toBeUndefined();
  });

  it('clearExtensionContributionsCache is safe to call when nothing is cached', () => {
    expect(() => clearExtensionContributionsCache()).not.toThrow();
  });

  it('cache accepts a new value after being cleared', () => {
    const first = { themes: [{ label: 'A', uiTheme: 'vs-dark' as const, path: '/x' }] };
    const second = { themes: [{ label: 'B', uiTheme: 'vs' as const, path: '/y' }] };
    setCachedThemeContributions(first);
    clearExtensionContributionsCache();
    setCachedThemeContributions(second);
    expect(getCachedThemeContributions()).toBe(second);
  });

  it('three caches are independent — clearing is not scoped to one', () => {
    setCachedThemeContributions({ themes: [] });
    setCachedIconThemeContributions({ iconThemes: [] });
    // productIconTheme deliberately not set
    clearExtensionContributionsCache();
    expect(getCachedThemeContributions()).toBeUndefined();
    expect(getCachedIconThemeContributions()).toBeUndefined();
    expect(getCachedProductIconThemeContributions()).toBeUndefined();
  });
});
