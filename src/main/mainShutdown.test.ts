/**
 * mainShutdown.test.ts — Smoke tests for performWillQuitShutdown.
 *
 * Verifies the ordering invariants that matter for clean Electron exit:
 *   - async writers are awaited before sync stores close
 *   - a failing subsystem does not abort the shutdown sequence
 *
 * codebase-graph disposal removed in Wave 22 (codebaseGraph deleted).
 * research writer mocks removed in Wave 101 Phase 5 (research subsystem deleted).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const calls: string[] = [];

function recorder(name: string, async = false): (() => unknown) {
  if (async) return vi.fn(async () => { calls.push(name); });
  return vi.fn(() => { calls.push(name); });
}

vi.mock('./claudeUsagePoller', () => ({ stopClaudeUsagePoller: recorder('stopClaudeUsagePoller', true) }));
vi.mock('./costHistory', () => ({ closeCostHistoryDb: recorder('closeCostHistoryDb') }));
vi.mock('./extensionHost/extensionHostProxy', () => ({
  shutdownExtensionHost: recorder('shutdownExtensionHost', true),
}));
vi.mock('./ipc', () => ({ cleanupIpcHandlers: recorder('cleanupIpcHandlers', true) }));
vi.mock('./logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
// closeEditProvenance mock removed in Wave 101 Phase 4 (editProvenance store deleted)
// disposeCodebaseGraph removed in Wave 22 (codebaseGraph deleted)
// Wave 60 Phase E: mcpHost subsystem removed alongside internalMcpServer.
// contextDecisionWriter + contextOutcomeWriter mocks removed in Wave 100 Phase F
//   (closeDecisionWriter/closeOutcomeWriter removed from mainShutdown during context-intelligence cut)
vi.mock('./pipeAuth', () => ({ deleteTokenFile: recorder('deleteTokenFile') }));
// research writer mocks removed in Wave 101 Phase 5 (closeCorrectionWriter/closeResearchOutcomeWriter deleted)
// router/qualitySignalCollector + router/retrainTrigger mocks removed in Wave 100 Phase G (router CUT)
vi.mock('./session/sessionStartup', () => ({ closeSessionServices: recorder('closeSessionServices') }));
// telemetry mock removed in Wave 101 Phase 4 (telemetry pipeline deleted)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('performWillQuitShutdown', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.resetModules();
  });

  it('runs through the full shutdown sequence in dependency order', async () => {
    const { performWillQuitShutdown } = await import('./mainShutdown');
    await performWillQuitShutdown();

    expect(calls).toContain('closeSessionServices');
    // closeDecisionWriter removed in Wave 100 Phase F (context-intelligence cut)
    // closeResearchOutcomeWriter/closeCorrectionWriter removed in Wave 101 Phase 5 (research subsystem deleted)
    // closeTelemetryStore removed in Wave 101 Phase 4 (telemetry pipeline deleted)
    expect(calls).toContain('stopClaudeUsagePoller');
    expect(calls).toContain('cleanupIpcHandlers');
    // closeThreadStore removed in Wave 100 Phase D (agentChat deleted)
    // disposeCodebaseGraph removed in Wave 22 (codebaseGraph deleted)
    // shutdownCodexAppServerProcesses removed in Wave 100 Phase E (chat adapters deleted)
    expect(calls).toContain('shutdownExtensionHost');

    // IPC cleanup runs before subsystem disposal.
    expect(calls.indexOf('cleanupIpcHandlers')).toBeLessThan(calls.indexOf('shutdownExtensionHost'));
  });

  it('swallows subsystem errors via tryShutdown so later steps still run', async () => {
    // extensionHost throws; shutdown must still complete without throwing.
    const extMod = await import('./extensionHost/extensionHostProxy');
    (extMod.shutdownExtensionHost as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => {
        calls.push('shutdownExtensionHost');
        throw new Error('extension host dispose failed');
      },
    );

    const { performWillQuitShutdown } = await import('./mainShutdown');
    await expect(performWillQuitShutdown()).resolves.toBeUndefined();

    // Shutdown completed despite the extension host throwing.
    expect(calls).toContain('shutdownExtensionHost');
  });
});
