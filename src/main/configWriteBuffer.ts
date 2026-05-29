/**
 * configWriteBuffer.ts — Debounced write-buffer for electron-store config writes.
 *
 * Problem: electron-store's `.set()` does a synchronous full-file readFileSync +
 * writeFileSync on the main thread for every call. Frequent bursts (window-bounds,
 * sessionsData, terminalSessions, etc.) block the event loop for up to ~1083ms.
 *
 * Solution:
 *  - `enqueueWrite` updates an in-memory pending map synchronously (read-your-writes
 *    consistency) then schedules a debounced flush.
 *  - `flushPendingWrites` applies all buffered keys in one pass (one disk write per key
 *    or a merged batch if the store supports it).
 *  - `flushPendingWritesSync` is called on quit — synchronous path that MUST NOT lose
 *    any acknowledged write.
 */

import type Store from 'electron-store';

import type { AppConfig } from './configTypes';
import log from './logger';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Keys that have been set but not yet flushed to disk. */
const pendingWrites = new Map<keyof AppConfig, AppConfig[keyof AppConfig]>();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_MS = 200;

// ---------------------------------------------------------------------------
// Store accessor (injected to avoid circular deps)
// ---------------------------------------------------------------------------

type StoreRef = { current: Store<AppConfig> | null };
const storeRef: StoreRef = { current: null };

/** Called once by config.ts after the store is constructed. */
export function setWriteBufferStore(store: Store<AppConfig>): void {
  storeRef.current = store;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyPendingToStore(store: Store<AppConfig>): void {
  if (pendingWrites.size === 0) return;
  // Apply each buffered key directly on the store object.
  // electron-store writes synchronously per .set() call; batching via the
  // store object is not exposed, so we call .set() once per pending key.
  for (const [k, v] of pendingWrites) {
    try {
      store.set(k, v);
    } catch (err) {
      log.warn(`[configWriteBuffer] flush failed for key "${String(k)}":`, err);
    }
  }
  pendingWrites.clear();
}

function cancelDebounce(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enqueue a write. Updates in-memory state immediately (read-your-writes) and
 * schedules a debounced flush to disk. Multiple calls within DEBOUNCE_MS
 * collapse into a single disk write.
 */
export function enqueueWrite<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  pendingWrites.set(key, value);
  cancelDebounce();
  debounceTimer = setTimeout(flushPendingWrites, DEBOUNCE_MS);
}

/**
 * Flush all pending writes asynchronously (after the debounce window).
 * Also exported so callers can force a flush without waiting.
 */
export function flushPendingWrites(): void {
  cancelDebounce();
  const store = storeRef.current;
  if (!store) return;
  applyPendingToStore(store);
}

/**
 * Flush all pending writes SYNCHRONOUSLY. Must be called on process quit to
 * ensure no acknowledged writes are lost. This is the data-safety crux.
 */
export function flushPendingWritesSync(): void {
  cancelDebounce();
  const store = storeRef.current;
  if (!store) {
    if (pendingWrites.size > 0) {
      log.warn('[configWriteBuffer] flushSync called but store not initialised — writes lost');
    }
    return;
  }
  applyPendingToStore(store);
}

/**
 * Read a value from the pending-writes buffer. Returns undefined if the key
 * has no buffered write. Used by getConfigValue to implement read-your-writes.
 */
export function peekPendingWrite<K extends keyof AppConfig>(
  key: K,
): AppConfig[K] | undefined {
  if (!pendingWrites.has(key)) return undefined;
  return pendingWrites.get(key) as AppConfig[K];
}

/**
 * Drop a key from the pending buffer. Called by setConfigValueImmediate so a
 * stale debounced value can't later flush and clobber the value just written
 * synchronously to disk.
 */
export function clearPendingWrite<K extends keyof AppConfig>(key: K): void {
  pendingWrites.delete(key);
}

/** Returns true if there are any buffered writes not yet flushed. */
export function hasPendingWrites(): boolean {
  return pendingWrites.size > 0;
}
