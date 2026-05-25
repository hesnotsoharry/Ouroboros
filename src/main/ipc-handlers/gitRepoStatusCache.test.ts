import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRepoStatusCache,
  getCachedRepoStatus,
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
