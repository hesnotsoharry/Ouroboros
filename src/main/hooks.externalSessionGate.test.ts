/**
 * hooks.externalSessionGate.test.ts — Regression tests for the ownership gate
 * added to dispatchToRenderer.
 *
 * Owner decision (locked): the IDE must IGNORE every session it did NOT spawn.
 * External sessions are dropped at the gate — no renderer send, no approval response.
 *
 * Four contracts:
 *  1. External pre_tool_use (no paneId, unknown sessionId): renderer send NOT
 *     called; gate just returns (fire-and-forget, no approval response).
 *  2. Owned event (has paneId): renderer send IS called (full dispatch path).
 *  3. Synthetic agent_stop (no paneId) for a sessionId previously seen WITH a
 *     paneId: dispatched (ownedSessionIds recognises it as owned).
 *  4. Synthetic agent_stop for a never-owned sessionId: skipped — no renderer send.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted spies — must be declared before vi.mock factories run ─────────────
const { mockFrameSend, mockGetAllActiveWindows } =
  vi.hoisted(() => ({
    mockFrameSend: vi.fn(),
    mockGetAllActiveWindows: vi.fn(),
  }));

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({ BrowserWindow: class {} }));

vi.mock('./agentChat/subagentLinkTrace', () => ({ traceLink: vi.fn() }));
vi.mock('./agentChat/subagentTracker', () => ({ get: vi.fn().mockReturnValue(null) }));
vi.mock('./claudeMdGenerator', () => ({
  generateClaudeMd: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./codebaseGraph/graphController', () => ({
  getGraphController: vi.fn().mockReturnValue(null),
}));
vi.mock('./config', () => ({ getConfigValue: vi.fn().mockReturnValue(undefined) }));
vi.mock('./contextLayer/contextLayerController', () => ({
  getContextLayerController: vi.fn().mockReturnValue(null),
}));
vi.mock('./extensions', () => ({
  dispatchActivationEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./hooksAgentStartEnrich', () => ({
  enrichAgentStartPayload: vi.fn((p) => p),
}));
vi.mock('./hooksChatLaunch', () => ({
  beginChatSessionLaunch: vi.fn(),
  endChatSessionLaunch: vi.fn(),
  getChatLaunchesInFlight: vi.fn().mockReturnValue(0),
}));
vi.mock('./hooksCorrelationPairing', () => ({ pairCorrelationId: vi.fn() }));
vi.mock('./hooksDispatchLogic', () => ({
  drainQueue: vi.fn().mockReturnValue([]),
  evictOrphanedSessions: vi.fn().mockReturnValue([]),
  inferSessionId: vi.fn((_, p) => p),
  queuePayload: vi.fn(),
  shouldSuppressDispatch: vi.fn().mockReturnValue(false),
  shouldSuppressHookEvent: vi.fn().mockReturnValue(false),
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
vi.mock('./hooksSkillExecutionTap', () => ({ tapSkillExecution: vi.fn() }));
vi.mock('./hooksTapRunner', () => ({ runHookTaps: vi.fn() }));
vi.mock('./ipc-handlers/agentChat', () => ({ invalidateSnapshotCache: vi.fn() }));
vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./web/webServer', () => ({ broadcastToWebClients: vi.fn() }));

// ── Window mock ───────────────────────────────────────────────────────────────
// Provide a fake BrowserWindow with a webContents.mainFrame.send spy so we can
// assert whether the renderer actually received the event.

const fakeWindow = {
  isDestroyed: () => false,
  webContents: { mainFrame: { send: mockFrameSend } },
};

vi.mock('./windowManager', () => ({
  getAllActiveWindows: mockGetAllActiveWindows,
}));

// ── Imports (after all mocks are in place) ────────────────────────────────────

import { _dispatchToRenderer, _resetOwnedSessionIds } from './hooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<Parameters<typeof _dispatchToRenderer>[0]>) {
  return {
    type: 'pre_tool_use' as const,
    sessionId: 'sess-ext-1',
    timestamp: Date.now(),
    toolName: 'Bash',
    requestId: 'req-1',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('dispatchToRenderer — external session gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetOwnedSessionIds();
    // Default: one renderable window available
    mockGetAllActiveWindows.mockReturnValue([fakeWindow]);
  });

  it('1. external pre_tool_use: renderer send NOT called; gate returns without dispatching', () => {
    const payload = makePayload({ sessionId: 'sess-external', paneId: undefined });

    _dispatchToRenderer(payload);

    expect(mockFrameSend).not.toHaveBeenCalled();
  });

  it('2. owned event (paneId present): renderer send IS called for full dispatch', () => {
    const payload = makePayload({
      type: 'agent_start',
      sessionId: 'sess-owned-1',
      paneId: 'pane-abc',
      requestId: undefined,
      toolName: undefined,
    });

    _dispatchToRenderer(payload);

    expect(mockFrameSend).toHaveBeenCalledOnce();
    expect(mockFrameSend).toHaveBeenCalledWith('hooks:event', expect.objectContaining({
      sessionId: 'sess-owned-1',
      type: 'agent_start',
    }));
  });

  it('3. synthetic agent_stop (no paneId) for a previously paneId-bearing session: dispatched', () => {
    const sessionId = 'sess-owned-then-synth';

    // First event from this session carries paneId — registers it as owned
    _dispatchToRenderer(makePayload({
      type: 'agent_start',
      sessionId,
      paneId: 'pane-xyz',
      requestId: undefined,
      toolName: undefined,
    }));
    mockFrameSend.mockClear();

    // Synthetic disconnect event — no paneId, same sessionId
    _dispatchToRenderer({
      type: 'agent_stop',
      sessionId,
      timestamp: Date.now(),
    });

    // Must have been dispatched because the session is in ownedSessionIds
    expect(mockFrameSend).toHaveBeenCalledOnce();
    expect(mockFrameSend).toHaveBeenCalledWith('hooks:event', expect.objectContaining({
      sessionId,
      type: 'agent_stop',
    }));
  });

  it('4. synthetic agent_stop for a never-owned sessionId: NOT dispatched', () => {
    _dispatchToRenderer({
      type: 'agent_stop',
      sessionId: 'sess-never-owned',
      timestamp: Date.now(),
    });

    expect(mockFrameSend).not.toHaveBeenCalled();
  });

  it('5. turn-2 pre_tool_use (no paneId) still dispatched after turn-1 session_stop', () => {
    // session_stop fires at END OF EVERY TURN (Claude Code Stop hook), not session end.
    // Ownership MUST persist across turns; only agent_end / agent_stop releases it.
    const sessionId = 'sess-multiturn';

    // Turn 1 start — paneId present, registers ownership
    _dispatchToRenderer(makePayload({
      type: 'agent_start',
      sessionId,
      paneId: 'pane-multiturn',
      requestId: undefined,
      toolName: undefined,
    }));
    mockFrameSend.mockClear();

    // End of turn 1 — session_stop fires (per-turn Stop hook), no paneId
    _dispatchToRenderer({
      type: 'session_stop',
      sessionId,
      timestamp: Date.now(),
    });
    mockFrameSend.mockClear();

    // Turn 2 tool call — no paneId; must STILL reach the renderer
    _dispatchToRenderer(makePayload({
      type: 'pre_tool_use',
      sessionId,
      paneId: undefined,
      toolName: 'Read',
      requestId: 'req-turn2',
    }));

    expect(mockFrameSend).toHaveBeenCalledOnce();
    expect(mockFrameSend).toHaveBeenCalledWith('hooks:event', expect.objectContaining({
      sessionId,
      type: 'pre_tool_use',
      toolName: 'Read',
    }));
  });
});
