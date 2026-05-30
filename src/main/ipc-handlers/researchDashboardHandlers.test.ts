/**
 * researchDashboardHandlers.test.ts — Unit tests for the research metrics
 * dashboard aggregator (Wave 30 Phase H).
 *
 * Tests cover:
 *   - Empty DB + no JSONL → all zeros, no NaN/Infinity
 *   - Populated data: byTrigger breakdown, cacheHitRate, p95, FP rate
 *   - 60 s result cache: second call returns cached result
 *   - Range filter: 7d excludes records older than 7 days
 */

import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock electron app
vi.mock('electron', () => ({
  app: { getPath: () => '/mock/userData' },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

// Module-level mock state for TelemetryStore
let mockInvocationRows: Record<string, unknown>[] = [];

vi.mock('../telemetry', () => ({
  getTelemetryStore: () => ({
    queryInvocations: (filter: { since?: number; until?: number } = {}) => {
      return mockInvocationRows.filter((r) => {
        if (filter.since !== undefined && (r.timestamp as number) < filter.since) return false;
        return true;
      });
    },
  }),
}));

// Captured fs.readdir / readFile calls for control
let mockFsEntries: Record<string, string[]> = {};
let mockFsFiles: Record<string, string> = {};

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: async (dir: string) => {
      const key = dir.replace(/\\/g, '/');
      // eslint-disable-next-line security/detect-object-injection -- test mock map keyed by trusted path string
      const entries = mockFsEntries[key];
      if (!entries) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return entries;
    },
    readFile: async (fp: string) => {
      const key = (fp as string).replace(/\\/g, '/');
      // eslint-disable-next-line security/detect-object-injection -- test mock map keyed by trusted path string
      const content = mockFsFiles[key];
      if (content === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return content;
    },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_DIR = '/mock/userData';

function makeInvRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'inv-1',
    correlationId: 'corr-1',
    sessionId: 'sess-1',
    topic: 'react',
    triggerReason: 'hook',
    artifactHash: null,
    hitCache: false,
    latencyMs: 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

function toJsonl(records: Record<string, unknown>[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Test setup ───────────────────────────────────────────────────────────────

let getDashboardMetrics: typeof import('./researchDashboardHandlers').getDashboardMetrics;

beforeEach(async () => {
  // Reset mocks
  mockInvocationRows = [];
  mockFsEntries = {};
  mockFsFiles = {};

  // Reset cache between tests by re-importing with a fresh module
  vi.resetModules();

  // Re-mock after resetModules
  vi.mock('electron', () => ({
    app: { getPath: () => '/mock/userData' },
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  }));
  vi.mock('../telemetry', () => ({
    getTelemetryStore: () => ({
      queryInvocations: (filter: { since?: number } = {}) =>
        mockInvocationRows.filter(
          (r) => filter.since === undefined || (r.timestamp as number) >= filter.since,
        ),
    }),
  }));
  vi.mock('node:fs/promises', () => ({
    default: {
      readdir: async (dir: string) => {
        const key = (dir as string).replace(/\\/g, '/');
        // eslint-disable-next-line security/detect-object-injection -- test mock map keyed by trusted path string
        const entries = mockFsEntries[key];
        if (!entries) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return entries;
      },
      readFile: async (fp: string) => {
        const key = (fp as string).replace(/\\/g, '/');
        // eslint-disable-next-line security/detect-object-injection -- test mock map keyed by trusted path string
        const content = mockFsFiles[key];
        if (content === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return content;
      },
    },
  }));

  const mod = await import('./researchDashboardHandlers');
  getDashboardMetrics = mod.getDashboardMetrics;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getDashboardMetrics — empty state', () => {
  it('returns all zeros when DB has no rows and no JSONL files exist', async () => {
    const m = await getDashboardMetrics('7d');
    expect(m.range).toBe('7d');
    expect(m.invocations.total).toBe(0);
    expect(m.invocations.cacheHitRate).toBe(0);
    expect(m.invocations.avgLatencyMs).toBe(0);
    expect(m.invocations.p95LatencyMs).toBe(0);
    expect(m.outcomes.total).toBe(0);
    expect(m.outcomes.acceptanceRate).toBe(0);
    expect(m.correlated.falsePositiveRate).toBe(0);
    expect(m.corrections.total).toBe(0);
    expect(m.corrections.enhancedLibrariesCount).toBe(0);
  });

  it('has no NaN or Infinity in rates with zero data', async () => {
    const m = await getDashboardMetrics('30d');
    const nums = [
      m.invocations.cacheHitRate,
      m.invocations.avgLatencyMs,
      m.invocations.p95LatencyMs,
      m.outcomes.acceptanceRate,
      m.correlated.falsePositiveRate,
    ];
    for (const n of nums) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });
});

// Wave 101 Phase 4: invocation aggregation tests updated — telemetry store removed;
// aggregateInvocations now always returns empty rows.
describe('getDashboardMetrics — invocation aggregation', () => {
  it('returns zero invocations regardless of mock store (telemetry store removed)', async () => {
    // Mock rows are no longer consulted — aggregateInvocations always returns [].
    mockInvocationRows = [
      makeInvRow({ triggerReason: 'hook' }),
      makeInvRow({ triggerReason: 'hook' }),
    ];
    const m = await getDashboardMetrics('all');
    expect(m.invocations.total).toBe(0);
    expect(m.invocations.cacheHitRate).toBe(0);
    expect(m.invocations.avgLatencyMs).toBe(0);
    expect(m.invocations.p95LatencyMs).toBe(0);
  });
});

describe('getDashboardMetrics — outcome aggregation', () => {
  it('aggregates JSONL outcome records correctly', async () => {
    const stamp = today();
    const file = `research-outcomes-${stamp}.jsonl`;
    const records = [
      { outcomeSignal: 'accepted', timestamp: Date.now(), sessionId: 's1', library: 'react' },
      { outcomeSignal: 'accepted', timestamp: Date.now(), sessionId: 's1', library: 'react' },
      { outcomeSignal: 'reverted', timestamp: Date.now(), sessionId: 's1', library: 'zod' },
      { outcomeSignal: 'unknown', timestamp: Date.now(), sessionId: 's1', library: 'other' },
    ];
    // eslint-disable-next-line security/detect-object-injection -- test fixture, key is a trusted constant
    mockFsEntries[BASE_DIR] = [file];
    mockFsFiles[path.posix.join(BASE_DIR, file)] = toJsonl(records);

    const m = await getDashboardMetrics('all');
    expect(m.outcomes.total).toBe(4);
    expect(m.outcomes.accepted).toBe(2);
    expect(m.outcomes.reverted).toBe(1);
    expect(m.outcomes.unknown).toBe(1);
    // acceptanceRate = 2 / (2+1) ≈ 0.667
    expect(m.outcomes.acceptanceRate).toBeCloseTo(2 / 3);
  });

  it('computes false positive rate (firedCount from invocations — now always 0 post-Wave-101)', async () => {
    // Wave 101 Phase 4: firedCount = invocations.total = 0 (telemetry store removed)
    // FP rate = 0 when firedCount = 0
    const stamp = today();
    const file = `research-outcomes-${stamp}.jsonl`;
    const records = [
      { outcomeSignal: 'accepted', timestamp: Date.now() },
      { outcomeSignal: 'reverted', timestamp: Date.now() },
    ];
    // eslint-disable-next-line security/detect-object-injection -- test fixture, key is a trusted constant
    mockFsEntries[BASE_DIR] = [file];
    mockFsFiles[path.posix.join(BASE_DIR, file)] = toJsonl(records);

    const m = await getDashboardMetrics('all');
    // firedCount = invocations.total = 0 (store removed); FP rate = 0
    expect(m.correlated.firedCount).toBe(0);
    expect(m.correlated.falsePositiveRate).toBe(0);
    // falsePositiveCount comes from reverted outcomes
    expect(m.correlated.falsePositiveCount).toBe(1);
  });
});

describe('getDashboardMetrics — corrections aggregation', () => {
  it('counts unique libraries from corrections JSONL', async () => {
    const stamp = today();
    const file = `corrections-${stamp}.jsonl`;
    const records = [
      { library: 'react', timestamp: Date.now(), sessionId: 's1' },
      { library: 'react', timestamp: Date.now(), sessionId: 's1' },
      { library: 'zod', timestamp: Date.now(), sessionId: 's1' },
    ];
    // eslint-disable-next-line security/detect-object-injection -- test fixture, key is a trusted constant
    mockFsEntries[BASE_DIR] = [file];
    mockFsFiles[path.posix.join(BASE_DIR, file)] = toJsonl(records);

    const m = await getDashboardMetrics('all');
    expect(m.corrections.total).toBe(3);
    expect(m.corrections.enhancedLibrariesCount).toBe(2);
  });
});

describe('getDashboardMetrics — range filter', () => {
  it('invocations are always zero after telemetry store removal (Wave 101)', async () => {
    // Range filter on invocations is now moot — aggregateInvocations always returns [].
    const m = await getDashboardMetrics('7d');
    expect(m.invocations.total).toBe(0);
  });

  it('excludes outcome records outside the 7d window', async () => {
    const stamp = today();
    const file = `research-outcomes-${stamp}.jsonl`;
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const records = [
      { outcomeSignal: 'accepted', timestamp: eightDaysAgo }, // excluded
      { outcomeSignal: 'reverted', timestamp: Date.now() }, // included
    ];
    // eslint-disable-next-line security/detect-object-injection -- test fixture, key is a trusted constant
    mockFsEntries[BASE_DIR] = [file];
    mockFsFiles[path.posix.join(BASE_DIR, file)] = toJsonl(records);

    const m = await getDashboardMetrics('7d');
    expect(m.outcomes.total).toBe(1);
    expect(m.outcomes.reverted).toBe(1);
  });
});

describe('getDashboardMetrics — 60 s cache', () => {
  it('returns cached result on second call within 60 s', async () => {
    const first = await getDashboardMetrics('7d');

    // Second call should return same cached reference
    const second = await getDashboardMetrics('7d');

    expect(second).toBe(first); // same reference
    // invocations.total is always 0 post-Wave-101 (telemetry store removed)
    expect(second.invocations.total).toBe(0);
  });

  it('recomputes after cache expires (mock time)', async () => {
    const realDateNow = Date.now;
    const first = await getDashboardMetrics('30d');

    // Advance time beyond TTL
    vi.spyOn(Date, 'now').mockReturnValue(realDateNow() + 61_000);

    const second = await getDashboardMetrics('30d');
    expect(second).not.toBe(first);
    // invocations.total is always 0 post-Wave-101 (telemetry store removed)
    expect(second.invocations.total).toBe(0);

    vi.restoreAllMocks();
  });
});
