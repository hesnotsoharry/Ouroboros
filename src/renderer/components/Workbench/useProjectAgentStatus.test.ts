/**
 * useProjectAgentStatus.test.ts — Unit tests for the pure deriveProjectStatus
 * function and its helpers (isAsking, pendingAskId).
 *
 * These cover the PURE layer only (no React, no mocks).
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../AgentMonitor/types';
import { deriveProjectStatus, isAsking, pendingAskId } from './useProjectAgentStatus';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AgentSession> & { id: string }): AgentSession {
  return {
    taskLabel: 'Test session',
    status: 'running',
    startedAt: 1000,
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    ...overrides,
  };
}

function makePendingAsk(id = 'ask-1'): AgentSession['toolCalls'][0] {
  return { id, toolName: 'AskUserQuestion', status: 'pending', input: '?', timestamp: 1000 };
}

function makeSuccessAsk(id = 'ask-1'): AgentSession['toolCalls'][0] {
  return { id, toolName: 'AskUserQuestion', status: 'success', input: '?', timestamp: 1000 };
}

const EMPTY_SEEN = new Map<string, string>();
const PROJECT_PATH = '/home/user/MyProject';

// ── isAsking ──────────────────────────────────────────────────────────────────

describe('isAsking', () => {
  it('returns true when a pending AskUserQuestion tool call exists', () => {
    const session = makeSession({ id: 's1', toolCalls: [makePendingAsk()] });
    expect(isAsking(session)).toBe(true);
  });

  it('returns false when AskUserQuestion is answered (status success)', () => {
    const session = makeSession({ id: 's1', toolCalls: [makeSuccessAsk()] });
    expect(isAsking(session)).toBe(false);
  });

  it('returns false when no tool calls exist', () => {
    const session = makeSession({ id: 's1' });
    expect(isAsking(session)).toBe(false);
  });

  it('returns false when only non-ask tools are pending', () => {
    const session = makeSession({
      id: 's1',
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'file.ts', timestamp: 1 }],
    });
    expect(isAsking(session)).toBe(false);
  });
});

// ── pendingAskId ──────────────────────────────────────────────────────────────

describe('pendingAskId', () => {
  it('returns the id of the pending AskUserQuestion', () => {
    const session = makeSession({ id: 's1', toolCalls: [makePendingAsk('ask-xyz')] });
    expect(pendingAskId(session)).toBe('ask-xyz');
  });

  it('returns undefined when no pending ask exists', () => {
    const session = makeSession({ id: 's1', toolCalls: [makeSuccessAsk()] });
    expect(pendingAskId(session)).toBeUndefined();
  });
});

// ── deriveProjectStatus ───────────────────────────────────────────────────────

describe('deriveProjectStatus — working-only', () => {
  it("returns borderMode 'working' when a session is mid-turn with no ask", () => {
    // Session has a pending tool call — it IS actively working.
    const session = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
    expect(result.unseenFinished).toBe(0);
    expect(result.unseenAsking).toBe(0);
  });
});

describe('deriveProjectStatus — unseen finished', () => {
  it("returns borderMode 'ready-green' for an unseen finished session", () => {
    const session = makeSession({ id: 's1', cwd: PROJECT_PATH, lastTurnEndedAt: 5000 });
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('ready-green');
    expect(result.unseenFinished).toBe(1);
    expect(result.workingCount).toBe(0);
  });

  it("returns borderMode 'none' when finished session is already seen", () => {
    const session = makeSession({ id: 's1', cwd: PROJECT_PATH, lastTurnEndedAt: 5000 });
    const seen = new Map([['s1', 'turn-end:5000']]);
    const result = deriveProjectStatus([session], PROJECT_PATH, seen);
    expect(result.borderMode).toBe('none');
    expect(result.unseenFinished).toBe(0);
  });
});

describe('deriveProjectStatus — asking (AskUserQuestion)', () => {
  it("returns borderMode 'asking-yellow' for a pending AskUserQuestion", () => {
    const session = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      toolCalls: [makePendingAsk('ask-1')],
    });
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('asking-yellow');
    expect(result.unseenAsking).toBe(1);
    expect(result.workingCount).toBe(0);
  });

  it("returns 'none' when the asking session was already seen", () => {
    const session = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      toolCalls: [makePendingAsk('ask-1')],
    });
    const seen = new Map([['s1', 'ask:ask-1']]);
    const result = deriveProjectStatus([session], PROJECT_PATH, seen);
    expect(result.borderMode).toBe('none');
    expect(result.unseenAsking).toBe(0);
  });

  it('treats answered AskUserQuestion (status success) as not asking', () => {
    const session = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      toolCalls: [makeSuccessAsk('ask-1')],
      lastTurnEndedAt: 6000,
    });
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN);
    // Answered ask + finished turn = ready-green, NOT asking-yellow
    expect(result.borderMode).toBe('ready-green');
    expect(result.unseenAsking).toBe(0);
  });
});

describe('deriveProjectStatus — asking wins over finished (priority)', () => {
  it("asking-yellow wins over ready-green when both are present but no working", () => {
    const askSession = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      toolCalls: [makePendingAsk('ask-1')],
    });
    const finishedSession = makeSession({ id: 's2', cwd: PROJECT_PATH, lastTurnEndedAt: 7000 });
    const result = deriveProjectStatus([askSession, finishedSession], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('asking-yellow');
    expect(result.unseenAsking).toBe(1);
    expect(result.unseenFinished).toBe(1);
  });
});

describe('deriveProjectStatus — working + unseen finished (dots)', () => {
  it("working borderMode + dots when working session + unseen finished exist", () => {
    // Working session has a pending tool call (genuinely mid-turn).
    const workingSession = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      toolCalls: [{ id: 't1', toolName: 'Bash', status: 'pending', input: 'ls', timestamp: 1 }],
    });
    const finishedSession = makeSession({ id: 's2', cwd: PROJECT_PATH, lastTurnEndedAt: 8000 });
    const result = deriveProjectStatus([workingSession, finishedSession], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
    expect(result.unseenFinished).toBe(1);
  });
});

describe('deriveProjectStatus — multi-project isolation', () => {
  it('does not count sessions from another project', () => {
    const foreignSession = makeSession({ id: 's1', cwd: '/home/user/OtherProject' });
    const result = deriveProjectStatus([foreignSession], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('none');
    expect(result.workingCount).toBe(0);
  });

  it('matches by basename so paths with different separators resolve correctly', () => {
    const session = makeSession({
      id: 's1',
      cwd: 'C:\\Users\\user\\MyProject',
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    const result = deriveProjectStatus([session], 'C:/Users/user/MyProject', EMPTY_SEEN);
    expect(result.borderMode).toBe('working');
  });
});

describe('deriveProjectStatus — Windows-backslash cwd matching (regression: AGENT_START cwd forwarding)', () => {
  it('matches a session whose cwd uses Windows backslashes to a forward-slash project path', () => {
    // Regression: agent_start.mjs sends cwd via process.cwd() which on Windows
    // returns backslash-separated paths (e.g. 'C:\\Web App\\cryptobot').
    // The basename() helper normalises backslashes, so matching must still work.
    const session = makeSession({
      id: 's1',
      cwd: 'C:\\Web App\\cryptobot',
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    const result = deriveProjectStatus([session], 'C:\\Web App\\cryptobot', EMPTY_SEEN);
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
  });

  it('matches when projectPath uses forward slashes and cwd uses backslashes', () => {
    const session = makeSession({
      id: 's1',
      cwd: 'C:\\Web App\\AgentIDE',
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    const result = deriveProjectStatus([session], 'C:/Web App/AgentIDE', EMPTY_SEEN);
    expect(result.borderMode).toBe('working');
  });

  it('does not match when only the basename is different', () => {
    const session = makeSession({ id: 's1', cwd: 'C:\\Web App\\cryptobot' });
    const result = deriveProjectStatus([session], 'C:\\Web App\\gamify', EMPTY_SEEN);
    expect(result.borderMode).toBe('none');
    expect(result.workingCount).toBe(0);
  });
});

describe('deriveProjectStatus — non-running sessions produce no output', () => {
  it('ignores sessions with status !== running', () => {
    const completeSession = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      status: 'complete',
      lastTurnEndedAt: 9000,
    });
    const result = deriveProjectStatus([completeSession], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('none');
  });

  it('ignores internal sessions', () => {
    const internalSession = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      internal: true,
    });
    const result = deriveProjectStatus([internalSession], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('none');
  });
});

// ── Bug D fix: zero-turn session must NOT classify as working ─────────────────

describe('deriveProjectStatus — never-prompted (zero-turn) session is NOT working (Bug D fix)', () => {
  it("returns 'none' for a running session with zero conversationTurns and zero toolCalls", () => {
    // This is the state right after spawn + "Start Claude" click: status=running,
    // no turns, no tools, no lastTurnEndedAt. Must NOT show the working border.
    const session = makeSession({ id: 's1', cwd: PROJECT_PATH });
    // makeSession sets toolCalls: [] and no conversationTurns — exactly the
    // spawned-but-idle state.
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('none');
    expect(result.workingCount).toBe(0);
  });

  it("returns 'working' once at least one tool call has arrived (turn is in progress)", () => {
    const session = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'file.ts', timestamp: 1 }],
    });
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
  });

  it("returns 'working' once at least one conversationTurn has arrived", () => {
    const session = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      conversationTurns: [{ type: 'prompt', content: 'hello', timestamp: 2000 }],
    });
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN);
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
  });
});

// ── Bug E fix: closed-tab sessions are excluded from working count ─────────────

describe('deriveProjectStatus — closed-tab session excluded from working count (Bug E fix)', () => {
  it("does NOT count a session whose paneId is absent from openPaneIds", () => {
    const closedSession = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      paneId: 'pane-closed',
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    // openPaneIds contains a different pane — the closed one is absent.
    const openPaneIds = new Set(['pane-open-other']);
    const result = deriveProjectStatus([closedSession], PROJECT_PATH, EMPTY_SEEN, openPaneIds);
    expect(result.borderMode).toBe('none');
    expect(result.workingCount).toBe(0);
  });

  it("counts a session whose paneId IS in openPaneIds", () => {
    const openSession = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      paneId: 'pane-open',
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    const openPaneIds = new Set(['pane-open']);
    const result = deriveProjectStatus([openSession], PROJECT_PATH, EMPTY_SEEN, openPaneIds);
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
  });

  it("counts a session with no paneId even when openPaneIds is non-empty (external sessions)", () => {
    // External sessions (spawned outside the IDE) have no paneId — they should still
    // be counted (we can't tell which tab they belong to, so we don't filter them).
    const externalSession = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      // no paneId
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    const openPaneIds = new Set(['pane-open-other']);
    const result = deriveProjectStatus([externalSession], PROJECT_PATH, EMPTY_SEEN, openPaneIds);
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
  });

  it("counts all sessions when openPaneIds is empty (no tab context — fallback path)", () => {
    const session = makeSession({
      id: 's1',
      cwd: PROJECT_PATH,
      paneId: 'pane-x',
      toolCalls: [{ id: 't1', toolName: 'Read', status: 'pending', input: 'x', timestamp: 1 }],
    });
    // Empty set = provider absent = don't filter (backward-compat / test isolation).
    const result = deriveProjectStatus([session], PROJECT_PATH, EMPTY_SEEN, new Set());
    expect(result.borderMode).toBe('working');
    expect(result.workingCount).toBe(1);
  });
});
