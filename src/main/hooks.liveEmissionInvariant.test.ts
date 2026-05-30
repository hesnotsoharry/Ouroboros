/**
 * Wave 101 invariant guard: the live hooks:event emission (AgentSidebar feed)
 * must fire independently of the telemetry SQLite store. Must stay green
 * through the telemetry-pipeline removal (Phases 2-7).
 *
 * The test exercises the real dispatchSyntheticHookEvent → sendPayload →
 * webContents.mainFrame.send flow with mocked window/telemetry at the leaves.
 * Assertion: hooks:event is sent to the renderer REGARDLESS of whether
 * getTelemetryStore() returns null or a real store.
 */

import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({ BrowserWindow: class {} }));
vi.mock('./claudeMdGenerator', () => ({ generateClaudeMd: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./codebaseGraph/graphController', () => ({
  getGraphController: vi.fn().mockReturnValue(null),
}));
vi.mock('./config', () => ({ getConfigValue: vi.fn().mockReturnValue(undefined) }));
vi.mock('./contextLayer/contextLayerController', () => ({
  getContextLayerController: vi.fn().mockReturnValue(null),
}));
vi.mock('./extensions', () => ({ dispatchActivationEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./hooksAgentStartEnrich', () => ({
  enrichAgentStartPayload: vi.fn((p) => p),
}));
vi.mock('./hooksChatLaunch', () => ({
  getChatLaunchesInFlight: vi.fn().mockReturnValue(0),
}));
vi.mock('./hooksCorrelationPairing', () => ({
  pairCorrelationId: vi.fn(),
}));
vi.mock('./hooksDispatchLogic', () => ({
  drainQueue: vi.fn((q) => {
    const drained = [...q];
    q.length = 0;
    return drained;
  }),
  evictOrphanedSessions: vi.fn().mockReturnValue([]),
  inferSessionId: vi.fn((s) => s),
  queuePayload: vi.fn((q, p) => q.push(p)),
  shouldSuppressDispatch: vi.fn().mockReturnValue(false),
  traceInstructionsLoaded: vi.fn(),
  trackSessionLifecycle: vi.fn(),
  truncatePayloadForDispatch: vi.fn((p) => p),
}));
vi.mock('./hooksLifecycleHandlers', () => ({
  enrichFromPermissionRequest: vi.fn(),
  handleConfigChange: vi.fn(),
  handleCwdChanged: vi.fn(),
  handleFileChanged: vi.fn(),
}));
vi.mock('./hooksNet', () => ({
  getHooksNetAddress: vi.fn().mockReturnValue(null),
  startHooksNetServer: vi.fn().mockResolvedValue({ port: 9999 }),
  stopHooksNetServer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./hooksSessionHandlers', () => ({
  handleSessionEnd: vi.fn(),
  handleSessionStart: vi.fn(),
  handleSessionStop: vi.fn(),
}));
vi.mock('./hooksTapRunner', () => ({
  runHookTaps: vi.fn(),
}));
vi.mock('./ipc-handlers/agentChat', () => ({ invalidateSnapshotCache: vi.fn() }));
vi.mock('./logger', () => ({ default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./web/webServer', () => ({ broadcastToWebClients: vi.fn() }));

// Telemetry mocks — two variations for the test cases
const getTelemetryStoreRef = { fn: vi.fn<() => null>() };
const getOutcomeObserverRef = { fn: vi.fn<() => null>() };

vi.mock('./telemetry', () => ({
  getTelemetryStore: () => getTelemetryStoreRef.fn(),
  getOutcomeObserver: () => getOutcomeObserverRef.fn(),
}));

// Window mock — will be configured per test
const mockWindowSend = vi.fn();
const mockWindow = {
  webContents: {
    mainFrame: {
      send: mockWindowSend,
    },
  },
  isDestroyed: vi.fn().mockReturnValue(false),
};

vi.mock('./windowManager', () => ({
  getAllActiveWindows: () => [mockWindow as unknown as BrowserWindow],
}));

import { dispatchSyntheticHookEvent, type HookPayload } from './hooks';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('dispatchSyntheticHookEvent — live emission invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowSend.mockClear();
    getTelemetryStoreRef.fn = vi.fn().mockReturnValue(null);
    getOutcomeObserverRef.fn = vi.fn().mockReturnValue(null);
  });

  it('sends hooks:event to renderer when getTelemetryStore() returns null', () => {
    // Simulate post-Phase-4 state: telemetry store deleted
    getTelemetryStoreRef.fn.mockReturnValue(null);

    const payload: HookPayload = {
      type: 'agent_start',
      sessionId: 'test-session-1',
      timestamp: 1234567890,
    };

    dispatchSyntheticHookEvent(payload);

    // Assert: mainFrame.send('hooks:event', ...) was called
    expect(mockWindowSend).toHaveBeenCalledWith('hooks:event', expect.objectContaining({
      type: 'agent_start',
      sessionId: 'test-session-1',
      timestamp: 1234567890,
      ideSpawned: true,
    }));
  });

  it('sends hooks:event to renderer even when telemetry store is present', () => {
    // Simulate post-Phase-4 state: telemetry store module still returns a value
    // (e.g. during a partial migration), but the persistence call is severed —
    // hooks.ts no longer calls store.record(). Live emission must still fire.
    const mockStore = {
      record: vi.fn().mockReturnValue('rowId123'),
    };
    getTelemetryStoreRef.fn.mockReturnValue(mockStore);

    const payload: HookPayload = {
      type: 'tool_use',
      sessionId: 'test-session-2',
      toolName: 'read',
      timestamp: 1234567891,
    };

    dispatchSyntheticHookEvent(payload);

    // Assert: mainFrame.send('hooks:event', ...) was called regardless of store presence
    expect(mockWindowSend).toHaveBeenCalledWith('hooks:event', expect.objectContaining({
      type: 'tool_use',
      sessionId: 'test-session-2',
      toolName: 'read',
      timestamp: 1234567891,
      ideSpawned: true,
    }));

    // Assert: store.record was NOT called — the persistence seam is severed (Phase 4)
    expect(mockStore.record).not.toHaveBeenCalled();
  });

  it('proves emission is independent of store presence by dispatching with store then null', () => {
    // First dispatch: store present
    const mockStore = {
      record: vi.fn().mockReturnValue('rowId456'),
    };
    getTelemetryStoreRef.fn.mockReturnValue(mockStore);

    const payload1: HookPayload = {
      type: 'agent_start',
      sessionId: 'session-a',
      timestamp: 1111,
    };

    dispatchSyntheticHookEvent(payload1);
    const firstCallCount = mockWindowSend.mock.calls.length;
    expect(firstCallCount).toBe(1);

    // Clear mocks between dispatches
    mockWindowSend.mockClear();
    mockStore.record.mockClear();

    // Second dispatch: store returns null
    getTelemetryStoreRef.fn.mockReturnValue(null);

    const payload2: HookPayload = {
      type: 'agent_end',
      sessionId: 'session-a',
      timestamp: 2222,
    };

    dispatchSyntheticHookEvent(payload2);

    // Assert: mainFrame.send('hooks:event', ...) was called on BOTH dispatches
    expect(mockWindowSend).toHaveBeenCalledWith('hooks:event', expect.objectContaining({
      type: 'agent_end',
      sessionId: 'session-a',
      timestamp: 2222,
    }));

    // Contrast: store.record was NOT called (it's null now)
    expect(mockStore.record).not.toHaveBeenCalled();
  });

  it('does not throw when getTelemetryStore() is null and getOutcomeObserver() is null', () => {
    getTelemetryStoreRef.fn.mockReturnValue(null);
    getOutcomeObserverRef.fn.mockReturnValue(null);

    const payload: HookPayload = {
      type: 'post_tool_use',
      sessionId: 'test-session-3',
      timestamp: 1234567892,
    };

    expect(() => {
      dispatchSyntheticHookEvent(payload);
    }).not.toThrow();

    // Still sent the event
    expect(mockWindowSend).toHaveBeenCalledWith('hooks:event', expect.any(Object));
  });

  it('sets ideSpawned to true on the emitted payload', () => {
    getTelemetryStoreRef.fn.mockReturnValue(null);

    const payload: HookPayload = {
      type: 'agent_start',
      sessionId: 'ide-session',
      timestamp: 9999,
    };

    dispatchSyntheticHookEvent(payload);

    expect(mockWindowSend).toHaveBeenCalledWith(
      'hooks:event',
      expect.objectContaining({
        ideSpawned: true,
      }),
    );
  });
});
