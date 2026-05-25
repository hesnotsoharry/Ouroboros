/**
 * usageSnapshotCoalescer.test.ts
 *
 * Contracts under test:
 * - Concurrent calls share a single in-flight Promise (dedup).
 * - A call within the TTL returns the cached value without calling fetchFn again.
 * - A call after TTL expiry re-invokes fetchFn.
 * - A failed fetch clears the pending slot so the next caller retries.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the poller so tests don't import node-pty or spawn anything.
vi.mock('../claudeUsagePoller', () => ({
  POLL_INTERVAL_MS: 300_000,
}));

import type { UsageWindowPayload } from './usageSnapshotCoalescer';
import { getCoalescedSnapshot, resetCoalescerState } from './usageSnapshotCoalescer';

const SNAPSHOT_A: UsageWindowPayload = { fetchedAt: 1_000, claude: null, codex: null };
const SNAPSHOT_B: UsageWindowPayload = { fetchedAt: 2_000, claude: null, codex: null };

afterEach(() => {
  resetCoalescerState();
  vi.restoreAllMocks();
});

describe('getCoalescedSnapshot — dedup (concurrent in-flight calls)', () => {
  it('invokes fetchFn only once when two calls arrive before the first resolves', async () => {
    let resolveFirst!: (v: UsageWindowPayload) => void;
    const first = new Promise<UsageWindowPayload>((res) => {
      resolveFirst = res;
    });
    const fetchFn = vi.fn().mockReturnValueOnce(first);

    const p1 = getCoalescedSnapshot(fetchFn, 0);
    const p2 = getCoalescedSnapshot(fetchFn, 0);

    resolveFirst(SNAPSHOT_A);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(r1).toBe(SNAPSHOT_A);
    expect(r2).toBe(SNAPSHOT_A);
  });
});

describe('getCoalescedSnapshot — result cache (within TTL)', () => {
  it('returns cached value without calling fetchFn again within TTL', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(SNAPSHOT_A);

    const now = 1_000_000;
    const r1 = await getCoalescedSnapshot(fetchFn, now);
    // Second call well within the 300 s TTL.
    const r2 = await getCoalescedSnapshot(fetchFn, now + 1_000);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(r1).toBe(SNAPSHOT_A);
    expect(r2).toBe(SNAPSHOT_A);
  });

  it('calls fetchFn again when cache has expired', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(SNAPSHOT_A).mockResolvedValueOnce(SNAPSHOT_B);

    const now = 1_000_000;
    await getCoalescedSnapshot(fetchFn, now);
    // 300 001 ms later — one millisecond past the TTL.
    const r2 = await getCoalescedSnapshot(fetchFn, now + 300_001);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(r2).toBe(SNAPSHOT_B);
  });

  it('re-fetches when the injected now equals exactly the expiry timestamp', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(SNAPSHOT_A);

    const now = 1_000_000;
    await getCoalescedSnapshot(fetchFn, now);
    // expiresAt = now + 300_000.  At now+300_000: expiresAt > now+300_000 → false → re-fetch.
    const fetchFn2 = vi.fn().mockResolvedValueOnce(SNAPSHOT_B);
    const r2 = await getCoalescedSnapshot(fetchFn2, now + 300_000);

    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(r2).toBe(SNAPSHOT_B);
  });
});

describe('getCoalescedSnapshot — failure recovery', () => {
  it('clears pending so a subsequent call retries after a fetch failure', async () => {
    const error = new Error('fetch failed');
    const fetchFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(SNAPSHOT_A);

    await expect(getCoalescedSnapshot(fetchFn, 0)).rejects.toThrow('fetch failed');

    // After rejection the pending slot must be cleared — next call should retry.
    const result = await getCoalescedSnapshot(fetchFn, 0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result).toBe(SNAPSHOT_A);
  });

  it('does not cache a failed result', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(SNAPSHOT_A);

    await expect(getCoalescedSnapshot(fetchFn, 0)).rejects.toThrow();

    // Immediate retry — no cached value should be present from the failed call.
    const result = await getCoalescedSnapshot(fetchFn, 0);
    expect(result).toBe(SNAPSHOT_A);
  });
});
