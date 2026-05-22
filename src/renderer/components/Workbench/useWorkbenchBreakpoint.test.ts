/**
 * @vitest-environment jsdom
 *
 * useWorkbenchBreakpoint.test.ts — unit tests for the breakpoint hook.
 *
 * Contract:
 *   width ≥ 1760  → 'full'
 *   1440–1759     → 'compact'
 *   < 1440        → 'unified'
 *
 * Uses max-width queries: (max-width:1439px) fires for unified,
 * (max-width:1759px) fires for compact-or-below.
 * All-false (default jsdom matchMedia) resolves to 'full'.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkbenchBreakpoint } from './useWorkbenchBreakpoint';

// ── matchMedia mock helpers ────────────────────────────────────────────────────

type ChangeHandler = () => void;

interface MockMQL {
  matches: boolean;
  media: string;
  listeners: ChangeHandler[];
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
  onchange: null;
}

function makeMql(matches: boolean, media: string): MockMQL {
  const mql: MockMQL = {
    matches,
    media,
    listeners: [],
    onchange: null,
    addEventListener: vi.fn((event: string, handler: ChangeHandler) => {
      if (event === 'change') mql.listeners.push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: ChangeHandler) => {
      if (event === 'change') {
        mql.listeners = mql.listeners.filter((l) => l !== handler);
      }
    }),
    dispatchEvent: vi.fn(),
  };
  return mql;
}

function fireChange(mql: MockMQL, newMatches: boolean): void {
  mql.matches = newMatches;
  mql.listeners.forEach((l) => l());
}

const realMatchMedia = window.matchMedia;

/**
 * Install a matchMedia that evaluates max-width / min-width queries against
 * `width`. Returns stable MQL instances keyed by query string so that both the
 * useState initializer and the useEffect inside the hook get the SAME object —
 * allowing tests to fire change events on the exact instance the hook
 * subscribed to.
 */
function setViewport(width: number): { unifiedMql: MockMQL; compactMql: MockMQL } {
  const cache = new Map<string, MockMQL>();

  window.matchMedia = ((query: string): MockMQL => {
    if (cache.has(query)) return cache.get(query)!;
    const max = /max-width:\s*(\d+)/.exec(query);
    const min = /min-width:\s*(\d+)/.exec(query);
    let matches = false;
    if (max) matches = width <= Number(max[1]);
    if (min) matches = width >= Number(min[1]);
    const mql = makeMql(matches, query);
    cache.set(query, mql);
    return mql;
  }) as unknown as typeof window.matchMedia;

  // Pre-warm the two queries so callers can access them before renderHook.
  const unifiedMql = window.matchMedia('(max-width: 1439px)') as unknown as MockMQL;
  const compactMql = window.matchMedia('(max-width: 1759px)') as unknown as MockMQL;
  return { unifiedMql, compactMql };
}

beforeEach(() => {
  // Default: no-op matchMedia (returns matches:false → 'full').
  window.matchMedia = vi.fn(() => makeMql(false, '')) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

// ── mode-at-initial-width ─────────────────────────────────────────────────────

describe('useWorkbenchBreakpoint — mode at initial width', () => {
  it('returns full when width is 1920 (≥1760)', () => {
    setViewport(1920);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('full');
  });

  it('returns full at exactly 1760', () => {
    setViewport(1760);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('full');
  });

  it('returns compact at 1759 (just below full boundary)', () => {
    setViewport(1759);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('compact');
  });

  it('returns compact at 1500 (mid compact band)', () => {
    setViewport(1500);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('compact');
  });

  it('returns compact at exactly 1440', () => {
    setViewport(1440);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('compact');
  });

  it('returns unified at 1439 (just below compact boundary)', () => {
    setViewport(1439);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('unified');
  });

  it('returns unified at 1300 (mid unified band)', () => {
    setViewport(1300);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('unified');
  });

  it('clamps <1180 to unified (no floating HUD, D3)', () => {
    setViewport(900);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('unified');
  });

  it('returns full when matchMedia is unavailable (SSR/guard)', () => {
    // Simulate missing matchMedia.
    (window as unknown as { matchMedia: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('full');
  });
});

// ── reactivity on change event ────────────────────────────────────────────────

describe('useWorkbenchBreakpoint — reacts to matchMedia change events', () => {
  it('updates full→compact when the 1759 boundary fires', () => {
    const { compactMql } = setViewport(1920);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('full');

    act(() => {
      fireChange(compactMql, true); // width dropped below 1760
    });
    expect(result.current).toBe('compact');
  });

  it('updates compact→unified when the 1439 boundary fires', () => {
    const { unifiedMql } = setViewport(1500);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('compact');

    act(() => {
      fireChange(unifiedMql, true); // width dropped below 1440
    });
    expect(result.current).toBe('unified');
  });

  it('updates unified→compact when the 1439 boundary clears', () => {
    const { unifiedMql } = setViewport(1200);
    const { result } = renderHook(() => useWorkbenchBreakpoint());
    expect(result.current).toBe('unified');

    act(() => {
      fireChange(unifiedMql, false); // width rose to ≥1440
    });
    expect(result.current).toBe('compact');
  });
});

// ── listener cleanup on unmount ───────────────────────────────────────────────

describe('useWorkbenchBreakpoint — listener cleanup on unmount', () => {
  it('removes change listeners from both MQLs on unmount', () => {
    const { unifiedMql, compactMql } = setViewport(1920);
    const { unmount } = renderHook(() => useWorkbenchBreakpoint());

    unmount();

    expect(unifiedMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(compactMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('leaves no active listeners after unmount (StrictMode-safe)', () => {
    const { unifiedMql, compactMql } = setViewport(1920);
    const { unmount } = renderHook(() => useWorkbenchBreakpoint());

    unmount();

    // After cleanup, firing change events must not throw or update state.
    expect(() => {
      act(() => {
        fireChange(unifiedMql, true);
        fireChange(compactMql, true);
      });
    }).not.toThrow();
    // Listeners array is empty (all removed).
    expect(unifiedMql.listeners).toHaveLength(0);
    expect(compactMql.listeners).toHaveLength(0);
  });
});
