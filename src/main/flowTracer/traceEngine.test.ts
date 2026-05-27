/**
 * traceEngine.test.ts — Wave 85 Phase 2.
 *
 * Tests for traceFlow(): graph-unavailable fallback, minimal contract
 * enforcement (≥2 steps, ≥2 layers, ≥1 boundary), depth-cap wiring,
 * and correct FlowTrace envelope shape. Graph and config are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FlowTrace, SymbolRef } from '../../shared/types/flowTracer';

// ── mocks set up before module import ────────────────────────────────────────

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config', () => ({
  getConfigValue: vi.fn().mockReturnValue({ maxDepth: 6, saveSharedFlows: false }),
}));

// codebaseGraph/graphControllerSupport mock removed in Wave 22 (codebaseGraph deleted)
// traceEngine now always uses the walking-skeleton fallback path

vi.mock('./boundaryRegistry', () => ({
  getBoundaryRegistry: vi.fn(async () => ({
    ipcMainHandlers: new Map(),
    preloadBridge: new Map(),
    builtAt: Date.now(),
  })),
}));

import { traceFlow } from './traceEngine';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENTRY: SymbolRef = {
  symbol: 'registerMessageHandlers',
  file: 'src/main/ipc-handlers/agentChat.ts',
  line: 163,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('traceFlow — envelope shape', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a FlowTrace with required top-level fields', async () => {
    const flow: FlowTrace = await traceFlow(ENTRY);
    expect(typeof flow.id).toBe('string');
    expect(flow.id.length).toBeGreaterThan(0);
    expect(typeof flow.title).toBe('string');
    expect(typeof flow.generatedAt).toBe('number');
    expect(typeof flow.graphVersion).toBe('string');
    expect(typeof flow.metadata.layerCount).toBe('number');
    expect(typeof flow.metadata.boundaryCount).toBe('number');
    expect(typeof flow.metadata.depthCapHit).toBe('boolean');
  });

  it('entryPoint in result matches the entry passed in', async () => {
    const flow = await traceFlow(ENTRY);
    expect(flow.entryPoint.symbol).toBe(ENTRY.symbol);
    expect(flow.entryPoint.file).toBe(ENTRY.file);
    expect(flow.entryPoint.line).toBe(ENTRY.line);
  });
});

describe('traceFlow — minimal contract enforcement', () => {
  afterEach(() => vi.clearAllMocks());

  it('always returns ≥2 steps (walking-skeleton fallback — graph removed in Wave 22)', async () => {
    const flow = await traceFlow(ENTRY);
    expect(flow.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('always returns ≥2 distinct layers', async () => {
    const flow = await traceFlow(ENTRY);
    const layers = new Set(flow.steps.map((s) => s.layer));
    expect(layers.size).toBeGreaterThanOrEqual(2);
  });

  it('always returns ≥1 boundary edge', async () => {
    const flow = await traceFlow(ENTRY);
    const boundary = flow.edges.filter((e) => e.kind === 'boundary');
    expect(boundary.length).toBeGreaterThanOrEqual(1);
  });

  it('boundary edges carry a boundaryChannel string', async () => {
    const flow = await traceFlow(ENTRY);
    for (const edge of flow.edges.filter((e) => e.kind === 'boundary')) {
      expect(typeof edge.boundaryChannel).toBe('string');
    }
  });
});

// ── graph-unavailable fallback (Wave 22: graph removed — always uses fallback) ─

describe('traceFlow — walking-skeleton fallback (graph removed in Wave 22)', () => {
  it('always returns graphVersion containing "fallback"', async () => {
    const flow = await traceFlow(ENTRY);
    expect(flow.graphVersion).toContain('fallback');
    expect(flow.steps.length).toBeGreaterThanOrEqual(2);
    expect(flow.edges.some((e) => e.kind === 'boundary')).toBe(true);
  });

  it('returns valid FlowTrace on every call', async () => {
    const flow = await traceFlow(ENTRY);
    expect(flow.graphVersion).toContain('fallback');
    expect(flow.steps.length).toBeGreaterThanOrEqual(2);
  });
});

// ── depth cap (Wave 22: graph removed — fallback path ignores maxDepth) ────────

describe('traceFlow — depth cap', () => {
  afterEach(() => vi.clearAllMocks());

  it('depthCapHit is false — fallback path does not apply depth limiting', async () => {
    // With graph removed, traceFlow always uses walking-skeleton fallback which
    // sets depthCapHit: false unconditionally (maxDepth opts are ignored).
    const flow = await traceFlow(ENTRY, { maxDepth: 3 });
    expect(flow.metadata.depthCapHit).toBe(false);
  });
});

describe('traceFlow — every step has valid shape', () => {
  afterEach(() => vi.clearAllMocks());

  it('all steps have required fields with correct types', async () => {
    const flow = await traceFlow(ENTRY);
    for (const step of flow.steps) {
      expect(typeof step.id).toBe('string');
      expect(step.id.length).toBeGreaterThan(0);
      expect(typeof step.symbol).toBe('string');
      expect(typeof step.file).toBe('string');
      expect(typeof step.line).toBe('number');
    }
  });

  it('all edges reference existing step ids', async () => {
    const flow = await traceFlow(ENTRY);
    const stepIds = new Set(flow.steps.map((s) => s.id));
    for (const edge of flow.edges) {
      expect(stepIds.has(edge.from)).toBe(true);
      expect(stepIds.has(edge.to)).toBe(true);
    }
  });
});
