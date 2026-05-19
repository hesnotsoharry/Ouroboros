/**
 * memProbe.ts — Periodic memory diagnostic probe for leak investigation.
 *
 * DIAGNOSTIC — see roadmap/bugs/2026-05-20-packaged-ram-leak.md. Remove when leak is resolved.
 *
 * Logs one structured `[mem-probe]` line every 30 seconds covering:
 *   H1 — catalog hash pair (one-shot, logged at startup in mainStartup.ts)
 *   H2 — dedup Set sizes (spawnCostDrain + routerShadowDrain)
 *   H3 — systemTwoRegistry active watcher count
 *   H5 — file-snapshot cache entry count
 *   H6 — BrowserWindow count
 *   plus process.memoryUsage() and active handle counts by constructor name.
 *
 * Gate: set OURO_MEM_PROBE=0 to disable. Defaults ON.
 */

import { BrowserWindow } from 'electron';

import * as systemTwoRegistry from './codebaseGraph/systemTwoRegistry';
import log from './logger';
import { getPersistentSnapshotCache } from './orchestration/contextSelectionSupport';
import { getSpawnDedupSize } from './orchestration/providers/spawnCostDrainHandler';
import { getRouterShadowDedupSize } from './router/routerShadowDrainHandler';

// ─── Config ──────────────────────────────────────────────────────────────────

const PROBE_INTERVAL_MS = 30_000;

// ─── State ───────────────────────────────────────────────────────────────────

let timerId: ReturnType<typeof setInterval> | null = null;

// ─── Handle counting ─────────────────────────────────────────────────────────

interface HandleCounts {
  total: number;
  byType: Record<string, number>;
}

/**
 * Count active libuv handles by constructor name.
 * Mirrors the approach used in jankDetector.ts (describeFdPressure).
 * DIAGNOSTIC — see roadmap/bugs/2026-05-20-packaged-ram-leak.md. Remove when leak is resolved.
 */
function countActiveHandles(): HandleCounts {
  // process._getActiveHandles() is an internal Node.js API — not in @types/node,
  // but stable across all Node versions Electron ships with.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handles: unknown[] = (process as any)._getActiveHandles?.() ?? [];
  const byTypeMap = new Map<string, number>();
  for (const h of handles) {
    const name =
      (h as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown';
    byTypeMap.set(name, (byTypeMap.get(name) ?? 0) + 1);
  }
  const byType = Object.fromEntries(byTypeMap);
  return { total: handles.length, byType };
}

// ─── Probe tick ──────────────────────────────────────────────────────────────

function toMB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

function onProbeTick(): void {
  const mem = process.memoryUsage();
  const handles = countActiveHandles();

  log.info('[mem-probe]', {
    rssMB: toMB(mem.rss),
    heapUsedMB: toMB(mem.heapUsed),
    heapTotalMB: toMB(mem.heapTotal),
    externalMB: toMB(mem.external),
    handles,
    windows: BrowserWindow.getAllWindows().length,
    s2Active: systemTwoRegistry.listActive().length,
    snapshotCacheSize: getPersistentSnapshotCache().size,
    spawnDedupSize: getSpawnDedupSize(),
    routerShadowDedupSize: getRouterShadowDedupSize(),
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the 30-second memory probe timer.
 * No-ops if already running or if OURO_MEM_PROBE=0.
 * DIAGNOSTIC — see roadmap/bugs/2026-05-20-packaged-ram-leak.md. Remove when leak is resolved.
 */
export function startMemProbe(): void {
  if (process.env['OURO_MEM_PROBE'] === '0') return;
  if (timerId) return;
  timerId = setInterval(onProbeTick, PROBE_INTERVAL_MS);
  // Do not prevent shutdown — unref so this interval doesn't keep the process alive.
  if (timerId && typeof timerId === 'object' && 'unref' in timerId) {
    timerId.unref();
  }
  log.info('[mem-probe] started (30s interval) — DIAGNOSTIC for packaged RAM leak');
}

/**
 * Stop the probe timer. Safe to call even if not started.
 * DIAGNOSTIC — see roadmap/bugs/2026-05-20-packaged-ram-leak.md. Remove when leak is resolved.
 */
export function stopMemProbe(): void {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
  log.info('[mem-probe] stopped');
}
