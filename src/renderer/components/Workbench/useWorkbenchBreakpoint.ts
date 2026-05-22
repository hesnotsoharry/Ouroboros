/**
 * useWorkbenchBreakpoint — returns the current responsive mode of the
 * canon workbench shell (canon §16, ADR D1/D3).
 *
 * Three tiers (HUD dropped per D3):
 *   full    — width ≥ 1760
 *   compact — 1440 ≤ width < 1760
 *   unified — width < 1440 (covers canon 1180–1439 Unified + <1180 clamp)
 *
 * Uses max-width queries so an environment where matchMedia returns
 * `matches: false` for every query (e.g. the vitest jsdom default) resolves
 * to 'full' — preserving the existing Workbench.test.tsx test suite that
 * renders <Workbench/> without setting a viewport.
 *
 * StrictMode-safe: listeners are cleaned up on unmount via the useEffect
 * return. Adding then removing listeners twice (StrictMode double-invoke)
 * leaves no leaked listener after the second cleanup.
 */

import { useEffect, useState } from 'react';

export type WorkbenchBreakpointMode = 'full' | 'compact' | 'unified';

/** True when running in a context that has matchMedia (guard for SSR / jsdom setups). */
function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function computeMode(unifiedMql: MediaQueryList, compactMql: MediaQueryList): WorkbenchBreakpointMode {
  if (unifiedMql.matches) return 'unified';
  if (compactMql.matches) return 'compact';
  return 'full';
}

export function useWorkbenchBreakpoint(): WorkbenchBreakpointMode {
  const [mode, setMode] = useState<WorkbenchBreakpointMode>(() => {
    if (!hasMatchMedia()) return 'full';
    const unified = window.matchMedia('(max-width: 1439px)');
    const compact = window.matchMedia('(max-width: 1759px)');
    return computeMode(unified, compact);
  });

  useEffect(() => {
    if (!hasMatchMedia()) return;
    const unifiedMql = window.matchMedia('(max-width: 1439px)');
    const compactMql = window.matchMedia('(max-width: 1759px)');

    const update = (): void => {
      setMode(computeMode(unifiedMql, compactMql));
    };

    unifiedMql.addEventListener('change', update);
    compactMql.addEventListener('change', update);

    // Sync in case state drifted between the initial read and this effect.
    update();

    return (): void => {
      unifiedMql.removeEventListener('change', update);
      compactMql.removeEventListener('change', update);
    };
  }, []);

  return mode;
}
