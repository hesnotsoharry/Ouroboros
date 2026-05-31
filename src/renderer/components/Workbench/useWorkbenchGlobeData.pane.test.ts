/**
 * useWorkbenchGlobeData.pane.test.ts — behavioral tests for the pane-aware globe hook.
 *
 * Covers:
 *   1. Globe shows 'fresh' (idle/empty) after session_stop (lastTurnEndedAt set).
 *   2. Globe shows 'fresh' when paneId is resolved but no session matches it (Bug 2 fix).
 *   3. Globe does NOT show an ambient session when the active pane has no running session.
 *
 * The hook uses two context dependencies:
 *   - useAgentEventsContext — provides the session pool
 *   - useActiveWorkbenchFrame + useWorkbenchTabsContextSafe — provides paneId
 *
 * Both are mocked at their source. The derivation path in useWorkbenchGlobeData is REAL.
 *
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentSession } from '../AgentMonitor/types';

// Mock the two context dependencies at the source module boundary.
vi.mock('../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('./useActiveWorkbenchFrame', () => ({
  useActiveWorkbenchFrame: vi.fn(),
}));

vi.mock('./Terminals/WorkbenchTabsProvider', () => ({
  useWorkbenchTabsContextSafe: vi.fn(),
}));

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import { useWorkbenchTabsContextSafe } from './Terminals/WorkbenchTabsProvider';
import { useActiveWorkbenchFrame } from './useActiveWorkbenchFrame';
import { useWorkbenchGlobeData } from './useWorkbenchGlobeData';

const mockedCtx = vi.mocked(useAgentEventsContext);
const mockedFrame = vi.mocked(useActiveWorkbenchFrame);
const mockedTabs = vi.mocked(useWorkbenchTabsContextSafe);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AgentSession> & { id: string }): AgentSession {
  return {
    taskLabel: 'task',
    status: overrides.status ?? 'running',
    startedAt: overrides.startedAt ?? 1000,
    toolCalls: overrides.toolCalls ?? [],
    inputTokens: 0,
    outputTokens: 0,
    ...overrides,
  } as AgentSession;
}

function ctxFor(sessions: AgentSession[]) {
  const isLive = (s: AgentSession) => s.status === 'running' || s.status === 'idle';
  return {
    agents: sessions,
    activeCount: sessions.filter((s) => s.status === 'running').length,
    currentSessions: sessions.filter(isLive),
    historicalSessions: sessions.filter((s) => s.status === 'complete' || s.status === 'error'),
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  } as unknown as ReturnType<typeof useAgentEventsContext>;
}

/** Makes the hook believe the active pane has id = paneId (or null for outside provider). */
function setPaneId(paneId: string | null): void {
  if (paneId === null) {
    // Simulates outside WorkbenchTabsProvider: tabs context returns null.
    mockedFrame.mockReturnValue({ activeFrame: 'frame-a' } as ReturnType<typeof useActiveWorkbenchFrame>);
    mockedTabs.mockReturnValue(null);
  } else {
    mockedFrame.mockReturnValue({ activeFrame: 'frame-a' } as ReturnType<typeof useActiveWorkbenchFrame>);
    mockedTabs.mockReturnValue({
      tabs: [{ id: paneId }],
      activeTabId: paneId,
    } as unknown as ReturnType<typeof useWorkbenchTabsContextSafe>);
  }
}

function globeData(sessions: AgentSession[]) {
  mockedCtx.mockReturnValue(ctxFor(sessions));
  return renderHook(() => useWorkbenchGlobeData()).result.current;
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockedCtx.mockReset();
  mockedFrame.mockReset();
  mockedTabs.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Contract ──────────────────────────────────────────────────────────────────

describe('useWorkbenchGlobeData — idle-between-turns (Bug 1)', () => {
  it('returns idle state when session has lastTurnEndedAt set (session_stop arrived)', () => {
    // 'idle' = session bound, resting between turns (NOT 'fresh' = no session at all).
    setPaneId('pane-1');
    const session = makeSession({
      id: 'sess-1',
      paneId: 'pane-1',
      status: 'running',
      toolCalls: [],
      lastTurnEndedAt: 9000,
    });
    const data = globeData([session]);
    expect(data.state).toBe('idle');
  });

  it('returns running state when lastTurnEndedAt is absent and a tool is pending', () => {
    setPaneId('pane-1');
    const session = makeSession({
      id: 'sess-1',
      paneId: 'pane-1',
      status: 'running',
      toolCalls: [{ id: 'tc1', toolName: 'Bash', input: 'ls', timestamp: 2000, status: 'pending' }],
    });
    const data = globeData([session]);
    expect(data.state).toBe('running');
  });

  it('returns empty activeTool after session_stop (lastTurnEndedAt set, no pending tool)', () => {
    setPaneId('pane-1');
    const session = makeSession({
      id: 'sess-1',
      paneId: 'pane-1',
      status: 'running',
      toolCalls: [{ id: 'tc1', toolName: 'Bash', input: 'ls', timestamp: 2000, status: 'success' }],
      lastTurnEndedAt: 3000,
    });
    const data = globeData([session]);
    // activeTool must be '' — not the last completed tool 'Bash'
    expect(data.activeTool).toBe('');
  });
});

describe('useWorkbenchGlobeData — no-match pane shows idle/empty, not ambient session (Bug 2)', () => {
  it('shows fresh/empty when paneId is resolved but no session matches it', () => {
    setPaneId('pane-for-active-tab');
    // Pool has an ambient session with a DIFFERENT paneId (outer IDE session).
    const ambient = makeSession({
      id: 'ambient-outer',
      paneId: 'pane-outer',
      status: 'running',
      startedAt: 99_000, // very recent — would win selectPrimarySession
      toolCalls: [{ id: 'tc1', toolName: 'Bash', input: 'npm test', timestamp: 99_500, status: 'pending' }],
    });
    const data = globeData([ambient]);
    // The active pane has no matching session — globe must be fresh, NOT the ambient session.
    expect(data.state).toBe('fresh');
    expect(data.activeTool).toBe('');
  });

  it('shows the matched session when paneId resolves to a session in the pool', () => {
    setPaneId('pane-1');
    const matched = makeSession({
      id: 'sess-1',
      paneId: 'pane-1',
      status: 'running',
      toolCalls: [{ id: 'tc1', toolName: 'Edit', input: 'foo.ts', timestamp: 2000, status: 'pending' }],
    });
    const ambient = makeSession({
      id: 'ambient',
      paneId: 'pane-other',
      status: 'running',
      startedAt: 99_000,
    });
    const data = globeData([matched, ambient]);
    expect(data.state).toBe('running');
    expect(data.activeTool).toBe('Edit');
  });

  it('falls back to global primary when paneId is null (outside provider — test isolation)', () => {
    // paneId null = useWorkbenchTabsContextSafe returned null = outside provider.
    setPaneId(null);
    const session = makeSession({
      id: 'running-1',
      status: 'running',
      toolCalls: [{ id: 'tc1', toolName: 'Read', input: 'x', timestamp: 2000, status: 'pending' }],
    });
    const data = globeData([session]);
    // With null paneId, the global fallback fires — should show the session.
    expect(data.state).toBe('running');
  });
});
