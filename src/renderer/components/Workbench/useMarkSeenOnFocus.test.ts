/**
 * useMarkSeenOnFocus.test.ts — behavioral tests for the focus-based seen marking hook.
 *
 * Verifies that when the user has a session's terminal tab active, the session
 * is marked seen with the correct notification key.
 *
 * Mocks at module boundaries (useAgentEventsContextSafe + WorkbenchTabsProvider +
 * useProjectNotificationStore), NOT the subject under test.
 *
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentSession } from '../AgentMonitor/types';

vi.mock('../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('./Terminals/WorkbenchTabsProvider', () => ({
  useWorkbenchTabsContextSafe: vi.fn(),
}));

vi.mock('./useProjectNotificationStore', () => ({
  useProjectNotificationStore: vi.fn(),
  deriveCurrentNotificationKey: vi.fn((session: AgentSession) => {
    const pendingAsk = session.toolCalls.find(
      (tc) => tc.toolName === 'AskUserQuestion' && tc.status === 'pending',
    );
    if (pendingAsk) return `ask:${pendingAsk.id}`;
    if (session.lastTurnEndedAt !== undefined) return `turn-end:${session.lastTurnEndedAt}`;
    return null;
  }),
}));

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import { useWorkbenchTabsContextSafe } from './Terminals/WorkbenchTabsProvider';
import { useMarkSeenOnFocus } from './useMarkSeenOnFocus';
import { useProjectNotificationStore } from './useProjectNotificationStore';

const mockedEventsCtx = vi.mocked(useAgentEventsContext);
const mockedTabs = vi.mocked(useWorkbenchTabsContextSafe);
const mockedStore = vi.mocked(useProjectNotificationStore);

function makeSession(overrides: Partial<AgentSession> & { id: string }): AgentSession {
  return {
    taskLabel: 'task',
    status: 'running',
    startedAt: 1000,
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    ...overrides,
  } as AgentSession;
}

function makeTabsResult(activeTabId: string | null) {
  return {
    activeTabId,
    tabs: [],
    addTab: vi.fn(),
    closeTab: vi.fn(),
    renameTab: vi.fn(),
    setActiveTab: vi.fn(),
    spawnCcTab: vi.fn(),
    spawnedTabIds: new Set<string>(),
  };
}

describe('useMarkSeenOnFocus', () => {
  let markSeen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    markSeen = vi.fn();
    mockedStore.mockReturnValue({
      seenKeys: new Map(),
      markSeen,
    });
    // Default: no active tabs, no agents
    mockedTabs.mockReturnValue(null);
    mockedEventsCtx.mockReturnValue({
      agents: [],
      activeCount: 0,
      currentSessions: [],
      historicalSessions: [],
      clearCompleted: vi.fn(),
      dismiss: vi.fn(),
      updateNotes: vi.fn(),
      registerChatSession: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls markSeen with turn-end key when focused paneId matches a finished session', () => {
    const session = makeSession({ id: 's1', paneId: 'pane-upper-1', lastTurnEndedAt: 5000 });
    mockedEventsCtx.mockReturnValue({ agents: [session] } as ReturnType<typeof useAgentEventsContext>);
    mockedTabs.mockImplementation((frame) =>
      frame === 'upper' ? makeTabsResult('pane-upper-1') : makeTabsResult(null),
    );

    renderHook(() => useMarkSeenOnFocus());

    expect(markSeen).toHaveBeenCalledWith('s1', 'turn-end:5000');
  });

  it('calls markSeen with ask key when focused session has pending AskUserQuestion', () => {
    const session = makeSession({
      id: 's2',
      paneId: 'pane-lower-1',
      toolCalls: [
        { id: 'ask-abc', toolName: 'AskUserQuestion', status: 'pending', input: '?', timestamp: 1 },
      ],
    });
    mockedEventsCtx.mockReturnValue({ agents: [session] } as ReturnType<typeof useAgentEventsContext>);
    mockedTabs.mockImplementation((frame) =>
      frame === 'lower' ? makeTabsResult('pane-lower-1') : makeTabsResult(null),
    );

    renderHook(() => useMarkSeenOnFocus());

    expect(markSeen).toHaveBeenCalledWith('s2', 'ask:ask-abc');
  });

  it('does not call markSeen when session has no notification key (mid-turn working)', () => {
    const session = makeSession({ id: 's3', paneId: 'pane-upper-2' });
    mockedEventsCtx.mockReturnValue({ agents: [session] } as ReturnType<typeof useAgentEventsContext>);
    mockedTabs.mockImplementation((frame) =>
      frame === 'upper' ? makeTabsResult('pane-upper-2') : makeTabsResult(null),
    );

    renderHook(() => useMarkSeenOnFocus());

    expect(markSeen).not.toHaveBeenCalled();
  });

  it('does not call markSeen when no session matches the active pane id', () => {
    const session = makeSession({ id: 's4', paneId: 'other-pane', lastTurnEndedAt: 9000 });
    mockedEventsCtx.mockReturnValue({ agents: [session] } as ReturnType<typeof useAgentEventsContext>);
    mockedTabs.mockImplementation((frame) =>
      frame === 'upper' ? makeTabsResult('pane-upper-nomatch') : makeTabsResult(null),
    );

    renderHook(() => useMarkSeenOnFocus());

    expect(markSeen).not.toHaveBeenCalled();
  });

  it('does not call markSeen when no agents are available', () => {
    mockedEventsCtx.mockReturnValue({ agents: [] } as ReturnType<typeof useAgentEventsContext>);
    mockedTabs.mockReturnValue(null);

    renderHook(() => useMarkSeenOnFocus());

    expect(markSeen).not.toHaveBeenCalled();
  });
});
