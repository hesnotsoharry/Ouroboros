/**
 * mainTelemetryHandlers.test.ts — smoke tests for the aggregated registrar.
 *
 * Verifies all three per-surface registrars are invoked exactly once when
 * registerAllTelemetryDrainHandlers() runs.
 *
 * registerRouterShadowHandler removed in Wave 100 Phase G (router CUT).
 */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registerSpawnCostHandler: vi.fn(),
  registerHookEventsHandler: vi.fn(),
  registerSpawnTraceHandler: vi.fn(),
}));

vi.mock('./orchestration/providers/spawnCostDrainHandler', () => ({
  registerSpawnCostHandler: mocks.registerSpawnCostHandler,
}));
vi.mock('./telemetry/hookEventsDrainHandler', () => ({
  registerHookEventsHandler: mocks.registerHookEventsHandler,
}));
vi.mock('./telemetry/spawnTraceDrainHandler', () => ({
  registerSpawnTraceHandler: mocks.registerSpawnTraceHandler,
}));

describe('registerAllTelemetryDrainHandlers', () => {
  it('invokes all three per-surface registrars exactly once', async () => {
    const { registerAllTelemetryDrainHandlers } = await import('./mainTelemetryHandlers');
    registerAllTelemetryDrainHandlers();
    expect(mocks.registerSpawnCostHandler).toHaveBeenCalledTimes(1);
    expect(mocks.registerHookEventsHandler).toHaveBeenCalledTimes(1);
    expect(mocks.registerSpawnTraceHandler).toHaveBeenCalledTimes(1);
  });
});
