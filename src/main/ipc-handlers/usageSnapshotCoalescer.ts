/**
 * usageSnapshotCoalescer.ts — Deduplicates concurrent calls to the usage
 * snapshot fetch and caches results for the poller interval.
 *
 * Problem (Wave 16): `usage:getUsageWindowSnapshot` is called once per window
 * at boot. With N windows, N concurrent scans of up to 40 Codex JSONL files
 * each were measured at 2.5–3.4 s apiece (~15 s cumulative in a 3-window
 * session). Both operations are pure file-system reads that produce identical
 * data when called concurrently.
 *
 * Fix:
 * - In-flight dedup: all concurrent callers share a single pending Promise.
 * - Result cache: subsequent calls within the poll interval (300 s) skip
 *   the I/O entirely and return the cached value.
 *
 * Cache key: none — there is exactly one global snapshot (no per-user or
 * per-project variant). A single `pendingPromise` + `cached` entry suffices.
 *
 * TTL source: re-uses `POLL_INTERVAL_MS` from the poller so both agree on
 * the staleness window. If the poller writes a fresher file, the cache
 * naturally expires at the same cadence.
 */

import type { ClaudeUsageSnapshot } from '../claudeRateLimits';
import { POLL_INTERVAL_MS } from '../claudeUsagePoller';
import type { CodexUsageSnapshot } from '../codexRateLimits';

export interface UsageWindowPayload {
  fetchedAt: number;
  claude: ClaudeUsageSnapshot | null;
  codex: CodexUsageSnapshot | null;
}

type FetchFn = () => Promise<UsageWindowPayload>;

interface CachedEntry {
  value: UsageWindowPayload;
  expiresAt: number;
}

// Module-scope state — all windows share the same main-process singleton.
let pending: Promise<UsageWindowPayload> | null = null;
let cached: CachedEntry | null = null;

/**
 * Returns a snapshot, reusing an in-flight fetch or a fresh cache hit.
 * Calls `fetchFn` only when no fetch is in-flight and the cache has expired.
 *
 * `now` is injectable for testing.
 */
export async function getCoalescedSnapshot(
  fetchFn: FetchFn,
  now: number = Date.now(),
): Promise<UsageWindowPayload> {
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (pending) {
    return pending;
  }

  pending = fetchFn().then((result) => {
    cached = { value: result, expiresAt: now + POLL_INTERVAL_MS };
    pending = null;
    return result;
  });

  // On rejection, clear the pending slot so subsequent calls retry.
  pending.catch(() => {
    pending = null;
  });

  return pending;
}

/** Clears the cache and any in-flight dedup reference. Test helper only. */
export function resetCoalescerState(): void {
  pending = null;
  cached = null;
}
