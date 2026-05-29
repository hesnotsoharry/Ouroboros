/**
 * activeOps.ts — In-flight operation registry for main-process diagnostics.
 *
 * Records named ops that are currently executing (e.g. watcher subscribes).
 * The jank detector snapshots this registry when it fires so each block log
 * includes which ops were in-flight and how long they had been held.
 *
 * Usage:
 *   const end = beginOp('watcher-subscribe:/some/dir');
 *   // ... do async work ...
 *   end();
 */

import { performance } from 'node:perf_hooks';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ActiveOpSnapshot {
  label: string;
  heldMs: number;
}

// ─── Registry ────────────────────────────────────────────────────────────

const registry = new Map<string, number>(); // label → startTime (performance.now)
let _seq = 0;

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Register an in-flight op. Returns a zero-arg function that deregisters it.
 * Labels need not be unique — a sequence suffix is appended internally.
 */
export function beginOp(label: string): () => void {
  const key = `${label}#${_seq++}`;
  registry.set(key, performance.now());
  return () => {
    registry.delete(key);
  };
}

/**
 * Snapshot all currently-registered ops with their elapsed time as of `now`.
 * `now` should be `performance.now()` captured at the call site so every
 * op in the snapshot is measured against the same instant.
 */
export function snapshotActiveOps(now: number): ActiveOpSnapshot[] {
  const result: ActiveOpSnapshot[] = [];
  for (const [key, startTime] of registry) {
    // Strip the internal sequence suffix for readability
    const label = key.replace(/#\d+$/, '');
    result.push({ label, heldMs: Math.round(now - startTime) });
  }
  return result;
}
