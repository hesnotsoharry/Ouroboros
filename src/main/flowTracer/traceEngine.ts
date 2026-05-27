/**
 * traceEngine.ts — Wave 85 Phase 2.
 *
 * Public API: traceFlow(entry, opts) → Promise<FlowTrace>.
 *
 * Resolves arbitrary IPC entry-point symbols into a FlowTrace by walking the
 * codebase-memory graph (Layer 1 static call chain), detecting boundary
 * patterns (Layer 2), resolving IPC bridge crossings (Layer 3), and tagging
 * async edges (Layer 4). Falls back to the walking-skeleton stub when the
 * graph is unavailable (test environment or pre-first-index).
 *
 * Helper logic lives in traceEngineSupport.ts (kept there to satisfy the
 * 40-line / complexity-10 per-function ESLint limits).
 * Fallback data lives in traceEngineFallback.ts.
 *
 * Per Decision 9 (wave-85-decisions.md): depth-limited to
 * flowTracer.maxDepth (default 6, range 3-12).
 */

import type { FlowTrace, SymbolRef } from '../../shared/types/flowTracer';
import log from '../logger';
import { getBoundaryRegistry } from './boundaryRegistry';
import { getWalkingSkeletonFallback } from './traceEngineFallback';
import { ensureMinimalContract } from './traceEngineSupport';

// ─── Fallback path ────────────────────────────────────────────────────────────

function getFallbackTrace(
  entry: SymbolRef,
  reason: string,
): { steps: FlowStep[]; edges: FlowEdge[]; depthCapHit: boolean; graphVersion: string } {
  log.info(`[traceEngine] ${reason} — using walking-skeleton fallback`);
  const fb = getWalkingSkeletonFallback(entry);
  return {
    steps: fb.steps,
    edges: fb.edges,
    depthCapHit: false,
    graphVersion: `fallback:${reason}`,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function traceFlow(
  entry: SymbolRef,
  opts: { maxDepth?: number } = {},
): Promise<FlowTrace> {
  void opts; // maxDepth unused — graph removed in Wave 22; fallback path doesn't use depth
  const registry = await getBoundaryRegistry();

  // Graph removed in Wave 22 — always use walking-skeleton fallback.
  const { steps, edges, depthCapHit, graphVersion } = getFallbackTrace(entry, 'no-graph');

  ensureMinimalContract(entry, steps, edges, registry);

  const distinctLayers = new Set(steps.map((s) => s.layer));
  const boundaryEdges = edges.filter((e) => e.kind === 'boundary');

  return {
    id: `trace-${entry.symbol}-${Date.now()}`,
    title: `Trace: ${entry.symbol}`,
    entryPoint: entry,
    steps,
    edges,
    generatedAt: Date.now(),
    graphVersion,
    metadata: {
      layerCount: distinctLayers.size,
      boundaryCount: boundaryEdges.length,
      depthCapHit,
    },
  };
}
