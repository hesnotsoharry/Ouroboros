import { afterEach, describe, expect, it } from 'vitest';

import {
  clearShellHistoryCache,
  getCachedShellHistory,
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
