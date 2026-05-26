import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearShellHistoryCache,
  getCachedShellHistory,
  getOrFetchShellHistory,
  setCachedShellHistory,
} from './shellHistoryCache';

describe('shellHistoryCache', () => {
  afterEach(() => {
    clearShellHistoryCache();
  });

  it('returns undefined before any entry is set', () => {
    expect(getCachedShellHistory()).toBeUndefined();
  });

  it('returns the stored commands after set', () => {
    setCachedShellHistory(['git status', 'npm run dev']);
    expect(getCachedShellHistory()).toEqual(['git status', 'npm run dev']);
  });

  it('caches for session lifetime — result is unchanged after repeated gets', () => {
    setCachedShellHistory(['ls', 'pwd']);
    expect(getCachedShellHistory()).toEqual(['ls', 'pwd']);
    expect(getCachedShellHistory()).toEqual(['ls', 'pwd']);
  });

  it('overwrites a previous entry when set is called again', () => {
    setCachedShellHistory(['old']);
    setCachedShellHistory(['new-a', 'new-b']);
    expect(getCachedShellHistory()).toEqual(['new-a', 'new-b']);
  });

  it('clearShellHistoryCache resets the cache to empty', () => {
    setCachedShellHistory(['git log']);
    clearShellHistoryCache();
    expect(getCachedShellHistory()).toBeUndefined();
  });

  it('stores an empty array without treating it as a cache miss', () => {
    setCachedShellHistory([]);
    expect(getCachedShellHistory()).toEqual([]);
  });
});

describe('getOrFetchShellHistory — dogpile dedup', () => {
  afterEach(() => {
    clearShellHistoryCache();
  });

  it('calls fetchFn exactly once when two concurrent callers race', async () => {
    const fetchFn = vi.fn(async () => ['git status', 'npm run dev']);
    const [a, b] = await Promise.all([
      getOrFetchShellHistory(fetchFn),
      getOrFetchShellHistory(fetchFn),
    ]);
    expect(a).toEqual(['git status', 'npm run dev']);
    expect(b).toEqual(['git status', 'npm run dev']);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch on second call after first settles', async () => {
    const fetchFn = vi.fn(async () => ['ls']);
    await getOrFetchShellHistory(fetchFn);
    const fetchFn2 = vi.fn(async () => ['pwd']);
    const result = await getOrFetchShellHistory(fetchFn2);
    expect(result).toEqual(['ls']);
    expect(fetchFn2).not.toHaveBeenCalled();
  });

  it('clears pending slot after success so next call after cache clear re-fetches', async () => {
    const fetchFn = vi.fn(async () => ['ls']);
    await getOrFetchShellHistory(fetchFn);
    clearShellHistoryCache();
    const fetchFn2 = vi.fn(async () => ['pwd']);
    const result = await getOrFetchShellHistory(fetchFn2);
    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(result).toEqual(['pwd']);
  });

  it('clears pending slot on rejection so next caller retries independently', async () => {
    const fetchFn = vi.fn(async (): Promise<string[]> => {
      throw new Error('read failed');
    });
    await expect(getOrFetchShellHistory(fetchFn)).rejects.toThrow('read failed');
    const fetchFn2 = vi.fn(async () => ['git log']);
    const result = await getOrFetchShellHistory(fetchFn2);
    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(result).toEqual(['git log']);
  });

  it('clear during in-flight fetch prevents stale write to cache', async () => {
    let resolveOuter!: (v: string[]) => void;
    const inflightPromise = new Promise<string[]>((res) => {
      resolveOuter = res;
    });
    const fetchFn = vi.fn(() => inflightPromise);
    const inflight = getOrFetchShellHistory(fetchFn);

    // Invalidate before the fetch resolves.
    clearShellHistoryCache();

    // Let the original fetch resolve with stale data.
    resolveOuter(['stale-command']);
    await inflight;

    // Cache must still be empty — stale result discarded.
    expect(getCachedShellHistory()).toBeUndefined();
  });
});
