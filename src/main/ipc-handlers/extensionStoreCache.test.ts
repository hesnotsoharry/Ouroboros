import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearExtensionContributionsCache,
  getCachedIconThemeContributions,
  getCachedProductIconThemeContributions,
  getCachedThemeContributions,
  getOrFetchIconThemeContributions,
  getOrFetchProductIconThemeContributions,
  getOrFetchThemeContributions,
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

describe('getOrFetchThemeContributions — dogpile dedup', () => {
  afterEach(() => {
    clearExtensionContributionsCache();
  });

  it('calls fetchFn exactly once when two concurrent callers race', async () => {
    const result = { themes: [] as never[] };
    const fetchFn = vi.fn(async () => result);
    const [a, b] = await Promise.all([
      getOrFetchThemeContributions(fetchFn),
      getOrFetchThemeContributions(fetchFn),
    ]);
    expect(a).toBe(result);
    expect(b).toBe(result);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch on second call after first settles', async () => {
    const result = { themes: [] as never[] };
    const fetchFn = vi.fn(async () => result);
    await getOrFetchThemeContributions(fetchFn);
    const fetchFn2 = vi.fn(async () => ({ themes: [] as never[] }));
    await getOrFetchThemeContributions(fetchFn2);
    expect(fetchFn2).not.toHaveBeenCalled();
  });

  it('clears pending slot on rejection so next caller retries', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('disk error');
    });
    await expect(getOrFetchThemeContributions(fetchFn)).rejects.toThrow('disk error');
    const result2 = { themes: [] as never[] };
    const fetchFn2 = vi.fn(async () => result2);
    const r = await getOrFetchThemeContributions(fetchFn2);
    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(r).toBe(result2);
  });

  it('clear during in-flight fetch prevents stale write to cache', async () => {
    let resolveOuter!: (v: { themes: never[] }) => void;
    const inflightPromise = new Promise<{ themes: never[] }>((res) => {
      resolveOuter = res;
    });
    const fetchFn = vi.fn(() => inflightPromise);
    const inflight = getOrFetchThemeContributions(fetchFn);

    // Invalidate before the fetch resolves — simulates extension install/uninstall.
    clearExtensionContributionsCache();

    // Now let the original fetch resolve with stale data.
    resolveOuter({ themes: [] });
    await inflight;

    // Cache must still be empty; the stale resolution must not have overwritten it.
    expect(getCachedThemeContributions()).toBeUndefined();
  });
});

describe('getOrFetchIconThemeContributions — dogpile dedup', () => {
  afterEach(() => {
    clearExtensionContributionsCache();
  });

  it('calls fetchFn exactly once when two concurrent callers race', async () => {
    const result = { iconThemes: [] as never[] };
    const fetchFn = vi.fn(async () => result);
    const [a, b] = await Promise.all([
      getOrFetchIconThemeContributions(fetchFn),
      getOrFetchIconThemeContributions(fetchFn),
    ]);
    expect(a).toBe(result);
    expect(b).toBe(result);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('clear during in-flight fetch prevents stale write to icon-theme cache', async () => {
    let resolveOuter!: (v: { iconThemes: never[] }) => void;
    const inflightPromise = new Promise<{ iconThemes: never[] }>((res) => {
      resolveOuter = res;
    });
    const fetchFn = vi.fn(() => inflightPromise);
    const inflight = getOrFetchIconThemeContributions(fetchFn);
    clearExtensionContributionsCache();
    resolveOuter({ iconThemes: [] });
    await inflight;
    expect(getCachedIconThemeContributions()).toBeUndefined();
  });
});

describe('getOrFetchProductIconThemeContributions — dogpile dedup', () => {
  afterEach(() => {
    clearExtensionContributionsCache();
  });

  it('calls fetchFn exactly once when two concurrent callers race', async () => {
    const result = { productIconThemes: [] as never[] };
    const fetchFn = vi.fn(async () => result);
    const [a, b] = await Promise.all([
      getOrFetchProductIconThemeContributions(fetchFn),
      getOrFetchProductIconThemeContributions(fetchFn),
    ]);
    expect(a).toBe(result);
    expect(b).toBe(result);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('clear during in-flight fetch prevents stale write to product-icon-theme cache', async () => {
    let resolveOuter!: (v: { productIconThemes: never[] }) => void;
    const inflightPromise = new Promise<{ productIconThemes: never[] }>((res) => {
      resolveOuter = res;
    });
    const fetchFn = vi.fn(() => inflightPromise);
    const inflight = getOrFetchProductIconThemeContributions(fetchFn);
    clearExtensionContributionsCache();
    resolveOuter({ productIconThemes: [] });
    await inflight;
    expect(getCachedProductIconThemeContributions()).toBeUndefined();
  });

  it('theme / icon-theme / product-icon-theme pending slots are independent', async () => {
    const fetchTheme = vi.fn(async () => ({ themes: [] as never[] }));
    const fetchIcon = vi.fn(async () => ({ iconThemes: [] as never[] }));
    const fetchProduct = vi.fn(async () => ({ productIconThemes: [] as never[] }));
    await Promise.all([
      getOrFetchThemeContributions(fetchTheme),
      getOrFetchThemeContributions(fetchTheme),
      getOrFetchIconThemeContributions(fetchIcon),
      getOrFetchIconThemeContributions(fetchIcon),
      getOrFetchProductIconThemeContributions(fetchProduct),
      getOrFetchProductIconThemeContributions(fetchProduct),
    ]);
    expect(fetchTheme).toHaveBeenCalledTimes(1);
    expect(fetchIcon).toHaveBeenCalledTimes(1);
    expect(fetchProduct).toHaveBeenCalledTimes(1);
  });
});
