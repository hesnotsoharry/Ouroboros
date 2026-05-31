/**
 * Unit tests for pure functions in useWorkbenchAgentData.ts.
 *
 * deriveWorkbenchAgentState — all six states including precedence edge cases.
 * selectPrimarySession — null on empty list; most-recent-activity wins; tie-breaking.
 *
 * These test the pure logic in isolation (no React, no context, no jsdom needed).
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession, PermissionEvent, ToolCallEvent } from '../AgentMonitor/types';
import {
  deriveActiveTool,
  deriveSessionStatus,
  deriveWorkbenchAgentState,
  selectPrimarySession,
} from './useWorkbenchAgentData';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTool(
  partial: Partial<ToolCallEvent> & Pick<ToolCallEvent, 'status' | 'toolName'>,
): ToolCallEvent {
  return {
    id: 'tc-1',
    toolName: partial.toolName,
    input: partial.input ?? 'arg',
    timestamp: partial.timestamp ?? 1000,
    status: partial.status,
    ...partial,
  };
}

function makeSession(partial: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 's-1',
    taskLabel: 'test',
    status: 'idle',
    startedAt: 1000,
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    ...partial,
  };
}

const requestPerm: PermissionEvent = { type: 'request', timestamp: 2000 };
const deniedPerm: PermissionEvent = { type: 'denied', timestamp: 2000 };

// ── deriveWorkbenchAgentState ─────────────────────────────────────────────────

describe('deriveWorkbenchAgentState', () => {
  it('returns fresh when session is null', () => {
    expect(deriveWorkbenchAgentState(null)).toBe('fresh');
  });

  it('returns fresh when status is idle', () => {
    expect(deriveWorkbenchAgentState(makeSession({ status: 'idle' }))).toBe('fresh');
  });

  it('returns errored when status is error', () => {
    expect(deriveWorkbenchAgentState(makeSession({ status: 'error' }))).toBe('errored');
  });

  it('returns done when status is complete', () => {
    expect(deriveWorkbenchAgentState(makeSession({ status: 'complete' }))).toBe('done');
  });

  it('returns running when status is running with a pending tool call', () => {
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Bash', status: 'pending' })],
    });
    expect(deriveWorkbenchAgentState(session)).toBe('running');
  });

  it('returns thinking when status is running with no pending tool call', () => {
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Read', status: 'success' })],
    });
    expect(deriveWorkbenchAgentState(session)).toBe('thinking');
  });

  it('returns thinking when status is running with no tool calls at all', () => {
    const session = makeSession({ status: 'running', toolCalls: [] });
    expect(deriveWorkbenchAgentState(session)).toBe('thinking');
  });

  it('returns awaiting when latest permissionEvent is a request (precedence over pending tool)', () => {
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Bash', status: 'pending' })],
      permissionEvents: [requestPerm],
    });
    expect(deriveWorkbenchAgentState(session)).toBe('awaiting');
  });

  it('does NOT return awaiting when latest permissionEvent is denied (not a pending request)', () => {
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Bash', status: 'pending' })],
      permissionEvents: [deniedPerm],
    });
    // latest event is denied → falls through to pending-tool check → running
    expect(deriveWorkbenchAgentState(session)).toBe('running');
  });
});

// ── selectPrimarySession ──────────────────────────────────────────────────────

describe('selectPrimarySession', () => {
  it('returns null for an empty list', () => {
    expect(selectPrimarySession([])).toBeNull();
  });

  it('returns the only session when the list has one entry', () => {
    const s = makeSession({ id: 'only', startedAt: 5000 });
    expect(selectPrimarySession([s])?.id).toBe('only');
  });

  it('selects the session with the highest tool-call timestamp', () => {
    const older = makeSession({
      id: 'older',
      startedAt: 1000,
      toolCalls: [makeTool({ toolName: 'Read', status: 'pending', timestamp: 1100 })],
    });
    const newer = makeSession({
      id: 'newer',
      startedAt: 1050,
      toolCalls: [makeTool({ toolName: 'Bash', status: 'pending', timestamp: 9999 })],
    });
    expect(selectPrimarySession([older, newer])?.id).toBe('newer');
  });

  it('selects the session with the highest completedAt when no tool calls', () => {
    const early = makeSession({ id: 'early', startedAt: 1000, completedAt: 2000, toolCalls: [] });
    const late = makeSession({ id: 'late', startedAt: 1000, completedAt: 5000, toolCalls: [] });
    expect(selectPrimarySession([early, late])?.id).toBe('late');
  });

  it('falls back to startedAt when no completedAt and no tool calls', () => {
    const first = makeSession({ id: 'first', startedAt: 100, toolCalls: [] });
    const second = makeSession({ id: 'second', startedAt: 500, toolCalls: [] });
    expect(selectPrimarySession([first, second])?.id).toBe('second');
  });

  it('running session beats a more-recently-finished one (two-tier preference, ADR D4)', () => {
    const finished = makeSession({
      id: 'finished',
      status: 'complete',
      startedAt: 2000,
      completedAt: 99_999,
      toolCalls: [],
    });
    const live = makeSession({
      id: 'live',
      status: 'running',
      startedAt: 1000,
      toolCalls: [makeTool({ toolName: 'Bash', status: 'pending', timestamp: 5000 })],
    });
    expect(selectPrimarySession([finished, live])?.id).toBe('live');
  });
});

// ── deriveSessionStatus ───────────────────────────────────────────────────────

describe('deriveSessionStatus', () => {
  it('returns live for a running session with no permission events', () => {
    const s = makeSession({ status: 'running', toolCalls: [] });
    expect(deriveSessionStatus(s)).toBe('live');
  });

  it('returns warn when the latest permissionEvent is a request', () => {
    const s = makeSession({
      status: 'running',
      toolCalls: [],
      permissionEvents: [requestPerm],
    });
    expect(deriveSessionStatus(s)).toBe('warn');
  });

  it('returns live when the latest permissionEvent is denied (not a pending request)', () => {
    const s = makeSession({
      status: 'running',
      toolCalls: [],
      permissionEvents: [deniedPerm],
    });
    expect(deriveSessionStatus(s)).toBe('live');
  });

  it('returns idle for an idle session regardless of permission events', () => {
    const s = makeSession({ status: 'idle', toolCalls: [], permissionEvents: [requestPerm] });
    expect(deriveSessionStatus(s)).toBe('idle');
  });
});

// ── idle-between-turns (session_stop boundary) ────────────────────────────────

describe('deriveWorkbenchAgentState — idle-between-turns (session_stop boundary)', () => {
  it('returns idle when lastTurnEndedAt is set on a running session (turn-end idle)', () => {
    // session_stop arrived after a tool completed; session is still running (alive)
    // but idle between turns. State must be 'idle' (session exists), not 'fresh' (no session).
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Bash', status: 'success' })],
      lastTurnEndedAt: 9000,
    });
    expect(deriveWorkbenchAgentState(session)).toBe('idle');
  });

  it('returns thinking (not fresh) when lastTurnEndedAt is absent and no pending tool', () => {
    // No session_stop yet — session is still actively thinking.
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Read', status: 'success' })],
    });
    expect(deriveWorkbenchAgentState(session)).toBe('thinking');
  });

  it('returns running when lastTurnEndedAt is absent and a pending tool exists', () => {
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Bash', status: 'pending' })],
    });
    expect(deriveWorkbenchAgentState(session)).toBe('running');
  });

  it('idle-between-turns takes precedence over awaiting-permission', () => {
    // If somehow both are set, turn-end wins (no shimmer/awaiting should show).
    const session = makeSession({
      status: 'running',
      toolCalls: [],
      permissionEvents: [requestPerm],
      lastTurnEndedAt: 9000,
    });
    expect(deriveWorkbenchAgentState(session)).toBe('idle');
  });
});

// ── deriveActiveTool ──────────────────────────────────────────────────────────

describe('deriveActiveTool — returns empty string when nothing is pending', () => {
  it('returns the pending tool name when a tool is in-flight', () => {
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Bash', status: 'pending' })],
    });
    expect(deriveActiveTool(session)).toBe('Bash');
  });

  it('returns empty string when the last tool completed (not pending) — no stale tool shown', () => {
    // This is the key regression: previously returned the last completed tool name.
    const session = makeSession({
      status: 'running',
      toolCalls: [makeTool({ toolName: 'Bash', status: 'success' })],
    });
    expect(deriveActiveTool(session)).toBe('');
  });

  it('returns empty string when there are no tool calls at all', () => {
    expect(deriveActiveTool(makeSession({ status: 'running' }))).toBe('');
  });

  it('returns empty string when session is null', () => {
    expect(deriveActiveTool(null)).toBe('');
  });

  it('returns the pending tool when mixed pending + completed tools exist', () => {
    const session = makeSession({
      status: 'running',
      toolCalls: [
        makeTool({ id: 'tc-1', toolName: 'Read', status: 'success', timestamp: 1000 }),
        makeTool({ id: 'tc-2', toolName: 'Edit', status: 'pending', timestamp: 2000 }),
      ],
    });
    expect(deriveActiveTool(session)).toBe('Edit');
  });
});
