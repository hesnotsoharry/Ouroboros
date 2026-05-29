import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearBranchCache, getOrFetchBranch, invalidateBranchCache } from './gitBranchCache';

const ROOT_A = 'C:\\projects\\repoA';
const ROOT_B = 'C:\\projects\\repoB';
const NOW = 1_000_000;
const TTL_MS = 5_000;

describe('getOrFetchBranch — in-flight deduplication', () => {
  afterEach(() => {
    clearBranchCache();
  });

  it('calls fetchFn exactly once when N concurrent callers race for the same root', async () => {
    const fetchFn = vi.fn(async () => 'main');
    const results = await Promise.all(
      Array.from({ length: 9 }, () => getOrFetchBranch(ROOT_A, fetchFn, NOW)),
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r).toBe('main');
  });

  it('serves the second call within TTL from cache without calling fetchFn again', async () => {
    const fetch1 = vi.fn(async () => 'main');
    await getOrFetchBranch(ROOT_A, fetch1, NOW);

    const fetch2 = vi.fn(async () => 'other');
    const result = await getOrFetchBranch(ROOT_A, fetch2, NOW + TTL_MS - 1);

    expect(fetch2).not.toHaveBeenCalled();
    expect(result).toBe('main');
  });

  it('calls fetchFn again after the TTL expires', async () => {
    const fetch1 = vi.fn(async () => 'main');
    await getOrFetchBranch(ROOT_A, fetch1, NOW);

    const fetch2 = vi.fn(async () => 'feature');
    const result = await getOrFetchBranch(ROOT_A, fetch2, NOW + TTL_MS + 1);

    expect(fetch2).toHaveBeenCalledTimes(1);
    expect(result).toBe('feature');
  });

  it('refetches after invalidateBranchCache regardless of TTL', async () => {
    const fetch1 = vi.fn(async () => 'main');
    await getOrFetchBranch(ROOT_A, fetch1, NOW);

    invalidateBranchCache(ROOT_A);

    const fetch2 = vi.fn(async () => 'hotfix');
    const result = await getOrFetchBranch(ROOT_A, fetch2, NOW + 100);

    expect(fetch2).toHaveBeenCalledTimes(1);
    expect(result).toBe('hotfix');
  });

  it('caches different roots independently', async () => {
    const fetchA = vi.fn(async () => 'main');
    const fetchB = vi.fn(async () => 'dev');

    const [a, b] = await Promise.all([
      getOrFetchBranch(ROOT_A, fetchA, NOW),
      getOrFetchBranch(ROOT_B, fetchB, NOW),
    ]);

    expect(a).toBe('main');
    expect(b).toBe('dev');
    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(fetchB).toHaveBeenCalledTimes(1);

    // Second call within TTL — each served from its own cache slot
    const fetch2 = vi.fn(async () => 'should-not-be-called');
    const [a2, b2] = await Promise.all([
      getOrFetchBranch(ROOT_A, fetch2, NOW + 100),
      getOrFetchBranch(ROOT_B, fetch2, NOW + 100),
    ]);
    expect(fetch2).not.toHaveBeenCalled();
    expect(a2).toBe('main');
    expect(b2).toBe('dev');
  });

  it('does not cache a fetch rejection — next caller retries independently', async () => {
    const failFn = vi.fn(async (): Promise<string> => {
      throw new Error('git not found');
    });

    await expect(getOrFetchBranch(ROOT_A, failFn, NOW)).rejects.toThrow('git not found');

    const recoverFn = vi.fn(async () => 'main');
    const result = await getOrFetchBranch(ROOT_A, recoverFn, NOW);

    expect(recoverFn).toHaveBeenCalledTimes(1);
    expect(result).toBe('main');
  });
});

describe('invalidateBranchCache', () => {
  afterEach(() => {
    clearBranchCache();
  });

  it('normalizes trailing slashes and case — invalidation hits the right key', async () => {
    const fetch1 = vi.fn(async () => 'main');
    await getOrFetchBranch('C:\\Repo\\', fetch1, NOW);

    // Invalidate with different casing / trailing slash
    invalidateBranchCache('c:\\repo');

    const fetch2 = vi.fn(async () => 'after-invalidate');
    const result = await getOrFetchBranch('C:\\Repo\\', fetch2, NOW + 100);

    expect(fetch2).toHaveBeenCalledTimes(1);
    expect(result).toBe('after-invalidate');
  });

  it('does not affect a different root', async () => {
    const fetchA = vi.fn(async () => 'main');
    await getOrFetchBranch(ROOT_A, fetchA, NOW);

    invalidateBranchCache(ROOT_B);

    const fetch2 = vi.fn(async () => 'should-not-be-called');
    const result = await getOrFetchBranch(ROOT_A, fetch2, NOW + 100);

    expect(fetch2).not.toHaveBeenCalled();
    expect(result).toBe('main');
  });
});

describe('clearBranchCache', () => {
  afterEach(() => {
    clearBranchCache();
  });

  it('clears all roots so the next call refetches', async () => {
    const fetchA = vi.fn(async () => 'main');
    const fetchB = vi.fn(async () => 'dev');
    await getOrFetchBranch(ROOT_A, fetchA, NOW);
    await getOrFetchBranch(ROOT_B, fetchB, NOW);

    clearBranchCache();

    const refetchA = vi.fn(async () => 'main-after-clear');
    const refetchB = vi.fn(async () => 'dev-after-clear');
    const [a, b] = await Promise.all([
      getOrFetchBranch(ROOT_A, refetchA, NOW + 100),
      getOrFetchBranch(ROOT_B, refetchB, NOW + 100),
    ]);

    expect(refetchA).toHaveBeenCalledTimes(1);
    expect(refetchB).toHaveBeenCalledTimes(1);
    expect(a).toBe('main-after-clear');
    expect(b).toBe('dev-after-clear');
  });
});
