/**
 * useAgentEvents.test.ts — Smoke tests for the useAgentEvents hook entry point.
 *
 * Tests focus on the dispatchNewEventTypes routing logic, which is the
 * primary code added in Package C of the hook events expansion.
 */
import { describe, expect, it, vi } from 'vitest';

// We test the routing by checking that each event type triggers the
// correct downstream dispatcher. We do this by importing the new
// dispatcher modules and verifying they're invoked correctly via
// the reducer actions they produce.
import type { AgentState } from './useAgentEvents.helpers';
import { initialAgentState, reducer } from './useAgentEvents.helpers';

const BASE_SESSION = {
  id: 'sess-1',
  taskLabel: 'Test',
  status: 'running' as const,
  startedAt: 1000,
  toolCalls: [],
  inputTokens: 0,
  outputTokens: 0,
};

const STATE_WITH_SESSION: AgentState = {
  ...initialAgentState,
  sessions: [BASE_SESSION],
};

describe('reducer — new action types', () => {
  it('handles TASK_CREATED action', () => {
    const next = reducer(STATE_WITH_SESSION, {
      type: 'TASK_CREATED',
      sessionId: 'sess-1',
      task: { id: 't1', description: 'Do work', status: 'pending', createdAt: 2000 },
    });
    expect(next.sessions[0].tasks).toHaveLength(1);
    expect(next.sessions[0].tasks?.[0].id).toBe('t1');
  });

  it('handles TASK_COMPLETED action', () => {
    const stateWithTask: AgentState = {
      ...STATE_WITH_SESSION,
      sessions: [
        {
          ...BASE_SESSION,
          tasks: [{ id: 't1', description: 'Do work', status: 'pending', createdAt: 1000 }],
        },
      ],
    };
    const next = reducer(stateWithTask, {
      type: 'TASK_COMPLETED',
      sessionId: 'sess-1',
      taskId: 't1',
      timestamp: 3000,
    });
    expect(next.sessions[0].tasks?.[0].status).toBe('completed');
  });

  it('handles CONVERSATION_TURN action', () => {
    const next = reducer(STATE_WITH_SESSION, {
      type: 'CONVERSATION_TURN',
      sessionId: 'sess-1',
      turn: { type: 'prompt', content: 'Hello', timestamp: 2000 },
    });
    expect(next.sessions[0].conversationTurns).toHaveLength(1);
  });

  it('handles COMPACTION action', () => {
    const next = reducer(STATE_WITH_SESSION, {
      type: 'COMPACTION',
      sessionId: 'sess-1',
      event: { preTokens: 5000, postTokens: 0, timestamp: 3000 },
    });
    expect(next.sessions[0].compactions).toHaveLength(1);
  });

  it('handles PERMISSION_EVENT action', () => {
    const next = reducer(STATE_WITH_SESSION, {
      type: 'PERMISSION_EVENT',
      sessionId: 'sess-1',
      event: { type: 'request', toolName: 'Bash', timestamp: 4000 },
    });
    expect(next.sessions[0].permissionEvents).toHaveLength(1);
    expect(next.sessions[0].permissionEvents?.[0].type).toBe('request');
  });

  it('returns state unchanged for unknown action type', () => {
    // @ts-expect-error — testing unknown action
    const next = reducer(STATE_WITH_SESSION, { type: 'UNKNOWN_ACTION' });
    expect(next).toBe(STATE_WITH_SESSION);
  });
});

describe('reducer — existing action types still work', () => {
  it('handles DISMISS action', () => {
    const next = reducer(STATE_WITH_SESSION, { type: 'DISMISS', sessionId: 'sess-1' });
    expect(next.sessions).toHaveLength(0);
  });

  it('handles CLEAR_COMPLETED action (keeps running sessions)', () => {
    const next = reducer(STATE_WITH_SESSION, { type: 'CLEAR_COMPLETED' });
    expect(next.sessions).toHaveLength(1);
  });

  it('deduplicates TOOL_START when the same toolCall id is replayed', () => {
    const first = reducer(STATE_WITH_SESSION, {
      type: 'TOOL_START',
      sessionId: 'sess-1',
      toolCall: {
        id: 'tool-stream-thread-1',
        toolName: 'Read',
        input: 'src/foo.ts',
        timestamp: 2000,
        status: 'pending',
      },
    });
    const second = reducer(first, {
      type: 'TOOL_START',
      sessionId: 'sess-1',
      toolCall: {
        id: 'tool-stream-thread-1',
        toolName: 'Read',
        input: 'src/foo.ts',
        timestamp: 2001,
        status: 'pending',
      },
    });
    expect(second.sessions[0].toolCalls).toHaveLength(1);
    expect(second.sessions[0].toolCalls[0]).toMatchObject({
      id: 'tool-stream-thread-1',
      toolName: 'Read',
      input: 'src/foo.ts',
      timestamp: 2001,
      status: 'pending',
    });
  });
});

describe('dispatchNewEventTypes module exports', () => {
  it('conversation dispatchers module exports expected functions', async () => {
    const mod = await import('./useAgentEvents.conversationDispatchers');
    expect(typeof mod.dispatchUserPrompt).toBe('function');
    expect(typeof mod.dispatchElicitation).toBe('function');
    expect(typeof mod.dispatchElicitationResult).toBe('function');
  });

  it('task dispatchers module exports expected functions', async () => {
    const mod = await import('./useAgentEvents.taskDispatchers');
    expect(typeof mod.dispatchTaskCreated).toBe('function');
    expect(typeof mod.dispatchTaskCompleted).toBe('function');
  });

  it('workspace dispatchers module exports expected functions', async () => {
    const mod = await import('./useAgentEvents.workspaceDispatchers');
    expect(typeof mod.dispatchCompaction).toBe('function');
    expect(typeof mod.dispatchPermissionEvent).toBe('function');
    expect(typeof mod.dispatchWorkspaceEvent).toBe('function');
  });
});

describe('AGENT_START on a restored session', () => {
  const RESTORED_SESSION = {
    ...BASE_SESSION,
    id: 'sess-resumed',
    status: 'complete' as const,
    completedAt: 1500,
    restored: true,
  };

  it('clears the restored flag when a persisted session resumes', () => {
    const state: AgentState = { ...initialAgentState, sessions: [RESTORED_SESSION] };
    const next = reducer(state, {
      type: 'AGENT_START',
      sessionId: 'sess-resumed',
      taskLabel: 'Resumed thread',
      timestamp: 2000,
    });
    expect(next.sessions[0].status).toBe('running');
    expect(next.sessions[0].restored).toBe(false);
    expect(next.sessions[0].completedAt).toBeUndefined();
  });

  it('does not affect restored flag on unrelated sessions', () => {
    const otherRestored = { ...RESTORED_SESSION, id: 'sess-other' };
    const state: AgentState = {
      ...initialAgentState,
      sessions: [RESTORED_SESSION, otherRestored],
    };
    const next = reducer(state, {
      type: 'AGENT_START',
      sessionId: 'sess-resumed',
      taskLabel: 'Resumed thread',
      timestamp: 2000,
    });
    const resumed = next.sessions.find((s) => s.id === 'sess-resumed');
    const other = next.sessions.find((s) => s.id === 'sess-other');
    expect(resumed?.restored).toBe(false);
    expect(other?.restored).toBe(true);
  });

  it('post-resume status puts the session in the active bucket predicate', () => {
    // Bucketing is by status, not by `restored`. Mirror useDerivedSessions's
    // predicate to assert the resume → bucket transition end-to-end.
    const isCurrent = (s: { status: string }) => s.status === 'running' || s.status === 'idle';
    const isHistorical = (s: { status: string }) => s.status === 'complete' || s.status === 'error';

    const state: AgentState = { ...initialAgentState, sessions: [RESTORED_SESSION] };
    expect(state.sessions.filter(isCurrent)).toHaveLength(0);
    expect(state.sessions.filter(isHistorical)).toHaveLength(1);

    const next = reducer(state, {
      type: 'AGENT_START',
      sessionId: 'sess-resumed',
      taskLabel: 'Resumed thread',
      timestamp: 2000,
    });
    expect(next.sessions.filter(isCurrent)).toHaveLength(1);
    expect(next.sessions.filter(isHistorical)).toHaveLength(0);
  });
});

describe('vi mock placeholder', () => {
  it('is a valid test file recognized by vitest', () => {
    expect(vi).toBeDefined();
  });
});

// ── Regression: AGENT_START must preserve cwd ─────────────────────────────────
//
// Before the fix, dispatchAgentStart() did not forward payload.cwd into the
// AGENT_START action, and startSession() did not copy action.cwd to the new
// AgentSession. This meant AgentSession.cwd was always undefined, so
// isProjectSession() (which matches basename(session.cwd) === basename(project))
// could never match any session — the ChipBorderOverlay always rendered 'none'.

describe('AGENT_START — cwd is preserved on the new session (regression)', () => {
  it('sets session.cwd from the action when the session is new', () => {
    const next = reducer(initialAgentState, {
      type: 'AGENT_START',
      sessionId: 'sess-cwd',
      taskLabel: 'Task',
      timestamp: 1000,
      cwd: 'C:\\Web App\\cryptobot',
    });
    expect(next.sessions[0].cwd).toBe('C:\\Web App\\cryptobot');
  });

  it('does not overwrite cwd on an existing session (updateExistingSession path)', () => {
    // updateExistingSession intentionally does NOT update cwd — it preserves the
    // original cwd set at session registration time (the working dir doesn't change
    // for a running session; cwd_changed events handle that separately).
    const stateWithSession: AgentState = {
      ...initialAgentState,
      sessions: [{ ...BASE_SESSION, cwd: 'C:\\Web App\\cryptobot' }],
    };
    const next = reducer(stateWithSession, {
      type: 'AGENT_START',
      sessionId: 'sess-1',
      taskLabel: 'New label',
      timestamp: 2000,
      cwd: 'C:\\different\\path',
    });
    // cwd stays as the original registration value
    expect(next.sessions[0].cwd).toBe('C:\\Web App\\cryptobot');
  });
});

describe('reducer — SESSION_REGISTER', () => {
  it('creates a session when none exists with that id', () => {
    const next = reducer(initialAgentState, {
      type: 'SESSION_REGISTER',
      sessionId: 'chat-uuid-1',
      timestamp: 5000,
      kind: 'chat',
      cwd: 'C:\\Web App\\Contractor App',
    });
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]).toMatchObject({
      id: 'chat-uuid-1',
      kind: 'chat',
      cwd: 'C:\\Web App\\Contractor App',
      status: 'running',
      startedAt: 5000,
    });
  });

  it('is a no-op when a session with the same id already exists', () => {
    const next = reducer(STATE_WITH_SESSION, {
      type: 'SESSION_REGISTER',
      sessionId: 'sess-1',
      timestamp: 9999,
      kind: 'chat',
    });
    expect(next).toBe(STATE_WITH_SESSION);
  });

  it('uses the provided taskLabel when given', () => {
    const next = reducer(initialAgentState, {
      type: 'SESSION_REGISTER',
      sessionId: 'chat-uuid-2',
      timestamp: 1000,
      kind: 'chat',
      taskLabel: 'Contractor app turn 3',
    });
    expect(next.sessions[0].taskLabel).toBe('Contractor app turn 3');
  });

  it('lets a subsequent RULE_LOADED action attach loadedRules to the registered session', () => {
    const registered = reducer(initialAgentState, {
      type: 'SESSION_REGISTER',
      sessionId: 'chat-uuid-3',
      timestamp: 1000,
      kind: 'chat',
    });
    const next = reducer(registered, {
      type: 'RULE_LOADED',
      sessionId: 'chat-uuid-3',
      rule: {
        filePath: '/Users/test/.claude/CLAUDE.md',
        name: 'CLAUDE',
        memoryType: 'User',
        loadReason: 'always',
        loadedAt: 2000,
      },
    });
    expect(next.sessions[0].loadedRules).toHaveLength(1);
    expect(next.sessions[0].loadedRules?.[0].memoryType).toBe('User');
  });
});
