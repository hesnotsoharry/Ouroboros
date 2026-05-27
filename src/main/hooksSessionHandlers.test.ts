/**
 * hooksSessionHandlers.test.ts — Unit tests for session lifecycle handlers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks (must use vi.hoisted so factories run before vi.mock) ───────

const {
  // mockGraphOnSessionStart removed in Wave 22 (codebaseGraph deleted)
  // mockGraphOnGitCommit removed in Wave 22 (codebaseGraph deleted)
  // mockOnSessionStart + mockOnGitCommit + mockInvalidateCache removed in Wave 100 Phase F
  //   (contextLayer and agentChat snapshot cache calls were deleted from hooksSessionHandlers)
  mockDispatchActivation,
  mockGenerateClaudeMd,
  mockGetConfigValue,
  mockTrackSessionEnd,
  mockEvaluateStop,
} = vi.hoisted(() => ({
  mockDispatchActivation: vi.fn().mockResolvedValue(undefined),
  mockGenerateClaudeMd: vi.fn().mockResolvedValue(undefined),
  mockGetConfigValue: vi.fn(),
  mockTrackSessionEnd: vi.fn(),
  mockEvaluateStop: vi.fn(),
}));

// contextLayer/contextLayerController mock removed in Wave 100 Phase F
// codebaseGraph/graphControllerSupport mock removed in Wave 22 (codebaseGraph deleted)

vi.mock('./extensions', () => ({
  dispatchActivationEvent: mockDispatchActivation,
}));

// ipc-handlers/agentChat invalidateSnapshotCache mock removed in Wave 100 Phase F

vi.mock('./claudeMdGenerator', () => ({
  generateClaudeMd: mockGenerateClaudeMd,
}));

vi.mock('./config', () => ({
  getConfigValue: mockGetConfigValue,
}));

vi.mock('./router/qualitySignalCollector', () => ({
  trackSessionEnd: mockTrackSessionEnd,
}));

vi.mock('./hooks/gotchaUpdateNudge', () => ({
  evaluateStop: mockEvaluateStop,
}));

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import type { HookPayload } from './hooks';
import {
  handleSessionEnd,
  handleSessionStart,
  handleSessionStop,
  triggerClaudeMdGeneration,
} from './hooksSessionHandlers';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<HookPayload> = {}): HookPayload {
  return {
    type: 'session_start',
    sessionId: 'test-session',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('handleSessionStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches activation event', () => {
    handleSessionStart(makePayload());
    expect(mockDispatchActivation).toHaveBeenCalledWith('onSessionStart', {
      sessionId: 'test-session',
    });
  });

  // contextLayer onSessionStart notifications removed in Wave 100 Phase F
  // (graph notification already removed in Wave 22 when codebaseGraph was deleted)
});

describe('handleSessionEnd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches onSessionEnd activation event', () => {
    handleSessionEnd(makePayload({ type: 'session_end' }));
    expect(mockDispatchActivation).toHaveBeenCalledWith('onSessionEnd', {
      sessionId: 'test-session',
    });
  });
});

describe('handleSessionStop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // contextLayer onGitCommit + agentChat invalidateSnapshotCache calls removed in Wave 100 Phase F

  it('tracks session end and triggers CLAUDE.md generation for external sessions', () => {
    mockGetConfigValue.mockReturnValue({ enabled: true, triggerMode: 'post-session' });
    const map = new Map<string, string>();
    handleSessionStop(makePayload({ type: 'session_stop', cwd: '/project' }), map);
    expect(mockTrackSessionEnd).toHaveBeenCalled();
    expect(mockGenerateClaudeMd).toHaveBeenCalledWith('/project');
  });

  it('skips all side effects for internal sessions', () => {
    mockGetConfigValue.mockReturnValue({ enabled: true, triggerMode: 'post-session' });
    const map = new Map<string, string>();
    handleSessionStop(makePayload({ type: 'session_stop', internal: true }), map);
    expect(mockTrackSessionEnd).not.toHaveBeenCalled();
    expect(mockGenerateClaudeMd).not.toHaveBeenCalled();
  });
});

describe('triggerClaudeMdGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when config is disabled', () => {
    mockGetConfigValue.mockReturnValue({ enabled: false, triggerMode: 'post-session' });
    const map = new Map<string, string>();
    triggerClaudeMdGeneration('post-session', makePayload({ cwd: '/project' }), map);
    expect(mockGenerateClaudeMd).not.toHaveBeenCalled();
  });

  it('skips when trigger mode does not match', () => {
    mockGetConfigValue.mockReturnValue({ enabled: true, triggerMode: 'post-commit' });
    const map = new Map<string, string>();
    triggerClaudeMdGeneration('post-session', makePayload({ cwd: '/project' }), map);
    expect(mockGenerateClaudeMd).not.toHaveBeenCalled();
  });

  it('generates when enabled and trigger matches, using payload.cwd', () => {
    mockGetConfigValue.mockReturnValue({ enabled: true, triggerMode: 'post-session' });
    const map = new Map<string, string>();
    triggerClaudeMdGeneration('post-session', makePayload({ cwd: '/project' }), map);
    expect(mockGenerateClaudeMd).toHaveBeenCalledWith('/project');
  });

  it('falls back to sessionCwdMap when payload.cwd is absent', () => {
    mockGetConfigValue.mockReturnValue({ enabled: true, triggerMode: 'post-session' });
    const map = new Map([['test-session', '/from-map']]);
    triggerClaudeMdGeneration('post-session', makePayload({ cwd: undefined }), map);
    expect(mockGenerateClaudeMd).toHaveBeenCalledWith('/from-map');
  });

  it('skips when no project root can be determined', () => {
    mockGetConfigValue.mockReturnValue({ enabled: true, triggerMode: 'post-session' });
    const map = new Map<string, string>();
    triggerClaudeMdGeneration('post-session', makePayload({ cwd: undefined }), map);
    expect(mockGenerateClaudeMd).not.toHaveBeenCalled();
  });
});
