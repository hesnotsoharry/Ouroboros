import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearRepoStatusCache,
  getCachedRepoStatus,
  getOrFetchRepoStatus,
  setCachedRepoStatus,
} from './gitRepoStatusCache';

describe('gitRepoStatusCache', () => {
  afterEach(() => {
    clearRepoStatusCache();
  });

  it('returns undefined for an unseen root', () => {
    expect(getCachedRepoStatus('C:\\foo')).toBeUndefined();
  });

  it('caches positive results indefinitely', () => {
    const now = 1_000_000;
    setCachedRepoStatus('C:\\foo', true, now);
    expect(getCachedRepoStatus('C:\\foo', now + 60 * 60 * 1000)).toBe(true);
    expect(getCachedRepoStatus('C:\\foo', now + 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('caches negative results for 30 seconds', () => {
    const now = 1_000_000;
    setCachedRepoStatus('C:\\foo', false, now);
    expect(getCachedRepoStatus('C:\\foo', now)).toBe(false);
    expect(getCachedRepoStatus('C:\\foo', now + 29_999)).toBe(false);
  });

  it('expires negative results after 30 seconds', () => {
    const now = 1_000_000;
    setCachedRepoStatus('C:\\foo', false, now);
    expect(getCachedRepoStatus('C:\\foo', now + 30_001)).toBeUndefined();
  });

  it('normalizes trailing slashes and case for the cache key', () => {
    const now = 1_000_000;
    setCachedRepoStatus('C:\\Foo\\', true, now);
    expect(getCachedRepoStatus('c:\\foo', now)).toBe(true);
    expect(getCachedRepoStatus('C:\\FOO\\\\', now)).toBe(true);
  });

  it('keys per root — different roots do not interfere', () => {
    const now = 1_000_000;
    setCachedRepoStatus('C:\\foo', true, now);
    setCachedRepoStatus('C:\\bar', false, now);
    expect(getCachedRepoStatus('C:\\foo', now)).toBe(true);
    expect(getCachedRepoStatus('C:\\bar', now)).toBe(false);
  });

  it('overwriting a negative with a positive removes the TTL', () => {
    const now = 1_000_000;
    setCachedRepoStatus('C:\\foo', false, now);
    setCachedRepoStatus('C:\\foo', true, now);
    expect(getCachedRepoStatus('C:\\foo', now + 60 * 60 * 1000)).toBe(true);
  });

  it('clearRepoStatusCache empties everything', () => {
    setCachedRepoStatus('C:\\foo', true);
    setCachedRepoStatus('C:\\bar', false);
    clearRepoStatusCache();
    expect(getCachedRepoStatus('C:\\foo')).toBeUndefined();
    expect(getCachedRepoStatus('C:\\bar')).toBeUndefined();
  });
});

describe('getOrFetchRepoStatus — dogpile dedup', () => {
  afterEach(() => {
    clearRepoStatusCache();
  });

  it('calls fetchFn exactly once when two concurrent callers race', async () => {
    const fetchFn = vi.fn(async () => true);
    const [a, b] = await Promise.all([
      getOrFetchRepoStatus('C:\\repo', fetchFn),
      getOrFetchRepoStatus('C:\\repo', fetchFn),
    ]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns cached value on second call after first settles — does not re-fetch', async () => {
    const fetchFn = vi.fn(async () => true);
    await getOrFetchRepoStatus('C:\\repo', fetchFn);
    const fetchFn2 = vi.fn(async () => false);
    const result = await getOrFetchRepoStatus('C:\\repo', fetchFn2);
    expect(result).toBe(true);
    expect(fetchFn2).not.toHaveBeenCalled();
  });

  it('clears pending slot after success so next call after cache clear re-fetches', async () => {
    const fetchFn = vi.fn(async () => true);
    await getOrFetchRepoStatus('C:\\repo', fetchFn);
    clearRepoStatusCache();
    const fetchFn2 = vi.fn(async () => false);
    const result = await getOrFetchRepoStatus('C:\\repo', fetchFn2);
    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });

  it('clears pending slot on rejection so next caller retries independently', async () => {
    const fetchFn = vi.fn(async (): Promise<boolean> => {
      throw new Error('git not found');
    });
    await expect(getOrFetchRepoStatus('C:\\repo', fetchFn)).rejects.toThrow('git not found');
    const fetchFn2 = vi.fn(async () => true);
    const result = await getOrFetchRepoStatus('C:\\repo', fetchFn2);
    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('uses independent pending slots per root so two different roots each fetch once', async () => {
    const fetchA = vi.fn(async () => true);
    const fetchB = vi.fn(async () => false);
    const [a, b] = await Promise.all([
      getOrFetchRepoStatus('C:\\repoA', fetchA),
      getOrFetchRepoStatus('C:\\repoB', fetchB),
    ]);
    expect(a).toBe(true);
    expect(b).toBe(false);
    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(fetchB).toHaveBeenCalledTimes(1);
  });
});
