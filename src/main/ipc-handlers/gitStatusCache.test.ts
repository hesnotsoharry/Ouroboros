import { afterEach, describe, expect, it, vi } from 'vitest';

import { gitStatusCache, gitStatusDetailedCache, STATUS_TTL_MS } from './gitStatusCache';

const ROOT_A = 'C:\\projects\\repoA';
const ROOT_B = 'C:\\projects\\repoB';
const NOW = 1_000_000;

const RESULT_A: Record<string, string> = { 'src/foo.ts': 'M' };
const RESULT_B: Record<string, string> = { 'src/bar.ts': 'A' };

afterEach(() => {
  gitStatusCache.clear();
  gitStatusDetailedCache.clear();
});

describe('gitStatusCache — in-flight deduplication', () => {
  it('calls fetchFn exactly once when N concurrent callers race for the same root', async () => {
    const fetchFn = vi.fn(async () => RESULT_A);
    const results = await Promise.all(
      Array.from({ length: 9 }, () => gitStatusCache.getOrFetch(ROOT_A, fetchFn, NOW)),
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r).toEqual(RESULT_A);
  });

  it('serves the second call within TTL from cache without calling fetchFn again', async () => {
    const fetch1 = vi.fn(async () => RESULT_A);
    await gitStatusCache.getOrFetch(ROOT_A, fetch1, NOW);

    const fetch2 = vi.fn(async () => RESULT_B);
    const result = await gitStatusCache.getOrFetch(ROOT_A, fetch2, NOW + STATUS_TTL_MS - 1);

    expect(fetch2).not.toHaveBeenCalled();
    expect(result).toEqual(RESULT_A);
  });

  it('calls fetchFn again after the TTL expires', async () => {
    const fetch1 = vi.fn(async () => RESULT_A);
    await gitStatusCache.getOrFetch(ROOT_A, fetch1, NOW);

    const fetch2 = vi.fn(async () => RESULT_B);
    const result = await gitStatusCache.getOrFetch(ROOT_A, fetch2, NOW + STATUS_TTL_MS + 1);

    expect(fetch2).toHaveBeenCalledTimes(1);
    expect(result).toEqual(RESULT_B);
  });

  it('caches different roots independently', async () => {
    const fetchA = vi.fn(async () => RESULT_A);
    const fetchB = vi.fn(async () => RESULT_B);

    const [a, b] = await Promise.all([
      gitStatusCache.getOrFetch(ROOT_A, fetchA, NOW),
      gitStatusCache.getOrFetch(ROOT_B, fetchB, NOW),
    ]);

    expect(a).toEqual(RESULT_A);
    expect(b).toEqual(RESULT_B);
    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(fetchB).toHaveBeenCalledTimes(1);

    // Second call within TTL — each served from its own cache slot
    const fetch2 = vi.fn(async () => ({}));
    const [a2, b2] = await Promise.all([
      gitStatusCache.getOrFetch(ROOT_A, fetch2, NOW + 100),
      gitStatusCache.getOrFetch(ROOT_B, fetch2, NOW + 100),
    ]);
    expect(fetch2).not.toHaveBeenCalled();
    expect(a2).toEqual(RESULT_A);
    expect(b2).toEqual(RESULT_B);
  });

  it('does not cache a fetch rejection — next caller retries independently', async () => {
    const failFn = vi.fn(async (): Promise<Record<string, string>> => {
      throw new Error('git not found');
    });

    await expect(gitStatusCache.getOrFetch(ROOT_A, failFn, NOW)).rejects.toThrow('git not found');

    const recoverFn = vi.fn(async () => RESULT_A);
    const result = await gitStatusCache.getOrFetch(ROOT_A, recoverFn, NOW);

    expect(recoverFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual(RESULT_A);
  });
});

describe('gitStatusCache — invalidate', () => {
  it('normalizes trailing slashes and case — invalidation hits the right key', async () => {
    const fetch1 = vi.fn(async () => RESULT_A);
    await gitStatusCache.getOrFetch('C:\\Repo\\', fetch1, NOW);

    gitStatusCache.invalidate('c:\\repo');

    const fetch2 = vi.fn(async () => RESULT_B);
    const result = await gitStatusCache.getOrFetch('C:\\Repo\\', fetch2, NOW + 100);

    expect(fetch2).toHaveBeenCalledTimes(1);
    expect(result).toEqual(RESULT_B);
  });

  it('does not affect a different root', async () => {
    const fetchA = vi.fn(async () => RESULT_A);
    await gitStatusCache.getOrFetch(ROOT_A, fetchA, NOW);

    gitStatusCache.invalidate(ROOT_B);

    const fetch2 = vi.fn(async () => RESULT_B);
    const result = await gitStatusCache.getOrFetch(ROOT_A, fetch2, NOW + 100);

    expect(fetch2).not.toHaveBeenCalled();
    expect(result).toEqual(RESULT_A);
  });
});

describe('gitStatusCache — clear', () => {
  it('clears all roots so the next call refetches', async () => {
    const fetchA = vi.fn(async () => RESULT_A);
    const fetchB = vi.fn(async () => RESULT_B);
    await gitStatusCache.getOrFetch(ROOT_A, fetchA, NOW);
    await gitStatusCache.getOrFetch(ROOT_B, fetchB, NOW);

    gitStatusCache.clear();

    const refetchA = vi.fn(async () => ({ 'src/after.ts': 'M' }));
    const refetchB = vi.fn(async () => ({ 'src/new.ts': 'A' }));
    const [a, b] = await Promise.all([
      gitStatusCache.getOrFetch(ROOT_A, refetchA, NOW + 100),
      gitStatusCache.getOrFetch(ROOT_B, refetchB, NOW + 100),
    ]);

    expect(refetchA).toHaveBeenCalledTimes(1);
    expect(refetchB).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ 'src/after.ts': 'M' });
    expect(b).toEqual({ 'src/new.ts': 'A' });
  });
});

describe('gitStatusDetailedCache — in-flight deduplication (separate instance)', () => {
  const STAGED = { 'src/staged.ts': 'M' };
  const UNSTAGED = { 'src/unstaged.ts': 'M' };
  const DETAILED = { staged: STAGED, unstaged: UNSTAGED };

  it('calls fetchFn exactly once when N concurrent callers race for the same root', async () => {
    const fetchFn = vi.fn(async () => DETAILED);
    const results = await Promise.all(
      Array.from({ length: 9 }, () => gitStatusDetailedCache.getOrFetch(ROOT_A, fetchFn, NOW)),
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r).toEqual(DETAILED);
  });

  it('gitStatusCache and gitStatusDetailedCache are independent instances', async () => {
    const simpleFetch = vi.fn(async () => RESULT_A);
    const detailedFetch = vi.fn(async () => DETAILED);

    await gitStatusCache.getOrFetch(ROOT_A, simpleFetch, NOW);
    await gitStatusDetailedCache.getOrFetch(ROOT_A, detailedFetch, NOW);

    // Clearing one must not affect the other
    gitStatusCache.clear();

    const simpleFetch2 = vi.fn(async () => RESULT_B);
    const detailedFetch2 = vi.fn(async () => DETAILED);

    await gitStatusCache.getOrFetch(ROOT_A, simpleFetch2, NOW + 100);
    await gitStatusDetailedCache.getOrFetch(ROOT_A, detailedFetch2, NOW + 100);

    expect(simpleFetch2).toHaveBeenCalledTimes(1); // was cleared
    expect(detailedFetch2).not.toHaveBeenCalled(); // still cached
  });
});
