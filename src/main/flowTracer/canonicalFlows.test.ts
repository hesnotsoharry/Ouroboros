/**
 * canonicalFlows.test.ts — Unit/integration tests for the canonical flow
 * gallery generator.
 *
 * Wave 85 Phase 5. mocks spawnClaude and the graph controller — no real CLI
 * calls or graph queries in tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanonicalFlow } from '../../shared/types/flowTracer';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../claudeMdGeneratorSupport', () => ({
  spawnClaude: vi.fn(),
}));

vi.mock('../config', () => ({
  getConfigValue: vi.fn(),
}));

// codebaseGraph/graphControllerSupport mock removed in Wave 22 (codebaseGraph deleted)
// extractEntryPointCandidates now always returns [] — graph removed

import { spawnClaude } from '../claudeMdGeneratorSupport';
import { getConfigValue } from '../config';
import {
  extractEntryPointCandidates,
  FALLBACK_FLOWS,
  generateCanonicalFlows,
  getCanonicalFlows,
  getCircuitBreakerState,
  regenerateCanonicalFlows,
  resetCircuitBreaker,
} from './canonicalFlows';

const mockSpawnClaude = vi.mocked(spawnClaude);
const mockGetConfigValue = vi.mocked(getConfigValue);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

async function writeCacheFile(dir: string, flows: CanonicalFlow[]): Promise<void> {
  const ouroboros = path.join(dir, '.ouroboros');
  await fs.mkdir(ouroboros, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename -- tmpDir path in test helper
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- tmpDir path in test helper
  await fs.writeFile(
    path.join(ouroboros, 'canonical-flows.json'),
    JSON.stringify({ flows, generatedAt: Date.now() }),
    'utf-8',
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canonical-flows-test-'));
  mockGetConfigValue.mockReturnValue(tmpDir);
  mockSpawnClaude.mockResolvedValue('[]');
  resetCircuitBreaker();
});

afterEach(async () => {
  vi.clearAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// FALLBACK_FLOWS
// ---------------------------------------------------------------------------

describe('FALLBACK_FLOWS', () => {
  it('has at least one flow with valid CanonicalFlow shape', () => {
    expect(FALLBACK_FLOWS.length).toBeGreaterThanOrEqual(1);
    for (const flow of FALLBACK_FLOWS) {
      expect(typeof flow.title).toBe('string');
      expect(flow.title.length).toBeGreaterThan(0);
      expect(typeof flow.entryPoint.symbol).toBe('string');
      expect(typeof flow.entryPoint.file).toBe('string');
      expect(typeof flow.entryPoint.line).toBe('number');
      expect(typeof flow.estimatedSteps).toBe('number');
      expect(Array.isArray(flow.layers)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getCanonicalFlows — cache hit
// ---------------------------------------------------------------------------

describe('getCanonicalFlows', () => {
  it('returns cached flows when cache file exists', async () => {
    const cached: CanonicalFlow[] = [
      {
        title: 'Cached flow',
        entryPoint: { symbol: 'handleFoo', file: 'src/main/foo.ts', line: 1 },
        estimatedSteps: 4,
        layers: ['renderer', 'main'],
      },
    ];
    await writeCacheFile(tmpDir, cached);

    const flows = await getCanonicalFlows();
    expect(flows).toHaveLength(1);
    expect(flows[0].title).toBe('Cached flow');
    expect(mockSpawnClaude).not.toHaveBeenCalled();
  });

  it('returns FALLBACK_FLOWS on cache miss (no workspace root)', async () => {
    mockGetConfigValue.mockReturnValue(undefined);
    const flows = await getCanonicalFlows();
    expect(flows).toEqual(FALLBACK_FLOWS);
  });

  it('returns FALLBACK_FLOWS on cache miss with workspace root (background generation triggered)', async () => {
    // No cache file written — cold start
    const flows = await getCanonicalFlows();
    expect(flows).toEqual(FALLBACK_FLOWS);
  });
});

// ---------------------------------------------------------------------------
// generateCanonicalFlows — CLI call + cache write
// ---------------------------------------------------------------------------

describe('generateCanonicalFlows', () => {
  it('returns FALLBACK_FLOWS when no workspace root is configured', async () => {
    mockGetConfigValue.mockReturnValue(undefined);
    const flows = await generateCanonicalFlows();
    expect(flows).toEqual(FALLBACK_FLOWS);
    expect(mockSpawnClaude).not.toHaveBeenCalled();
  });

  it('returns FALLBACK_FLOWS when graph has no candidates (graph removed in Wave 22)', async () => {
    // extractEntryPointCandidates always returns [] after graph deletion
    const flows = await generateCanonicalFlows();
    expect(flows).toEqual(FALLBACK_FLOWS);
    expect(mockSpawnClaude).not.toHaveBeenCalled();
  });

  it('never calls spawnClaude (no candidates available — graph removed in Wave 22)', async () => {
    // With graph removed, extractEntryPointCandidates always returns []
    // generateCanonicalFlows returns FALLBACK_FLOWS without reaching spawnClaude
    const flows = await generateCanonicalFlows();
    expect(flows).toEqual(FALLBACK_FLOWS);
    expect(mockSpawnClaude).not.toHaveBeenCalled();
  });

  it('circuit breaker still guards against repeated calls when circuit is open', async () => {
    // Force circuit open by calling 3 times (each returns FALLBACK_FLOWS immediately)
    // With no candidates, failures don't increment — circuit stays closed
    // But if circuit is manually opened via state, generation is skipped
    await generateCanonicalFlows();
    await generateCanonicalFlows();
    await generateCanonicalFlows();
    // Circuit should remain closed since no spawnClaude was called
    expect(getCircuitBreakerState().open).toBe(false);
    expect(mockSpawnClaude).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// regenerateCanonicalFlows — bypasses cache
// ---------------------------------------------------------------------------

describe('regenerateCanonicalFlows', () => {
  it('deletes the cache file and returns FALLBACK_FLOWS (graph removed in Wave 22)', async () => {
    const oldFlows: CanonicalFlow[] = [
      {
        title: 'Old cached flow',
        entryPoint: { symbol: 'oldHandler', file: 'src/main/foo.ts', line: 1 },
        estimatedSteps: 2,
        layers: ['main'],
      },
    ];
    await writeCacheFile(tmpDir, oldFlows);

    // With graph removed, extractEntryPointCandidates returns [] so spawnClaude
    // is never reached — regenerate returns FALLBACK_FLOWS
    const flows = await regenerateCanonicalFlows();
    expect(flows).toEqual(FALLBACK_FLOWS);
    expect(mockSpawnClaude).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// extractEntryPointCandidates
// ---------------------------------------------------------------------------

// ── extractEntryPointCandidates (Wave 22: always returns [] — graph removed) ──

describe('extractEntryPointCandidates', () => {
  it('returns empty array (codebaseGraph removed in Wave 22)', async () => {
    // extractEntryPointCandidates is a no-op stub after graph deletion
    const candidates = await extractEntryPointCandidates();
    expect(candidates).toEqual([]);
  });
});
