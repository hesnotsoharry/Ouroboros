/**
 * Orchestrator-owned acceptance test — Wave 3 Phase 3 (session-mapping boundary).
 *
 * Locks the AgentSession[] → workbench rail-session shape mapping, which is the
 * conceptual-risk piece of Phase 3: the status-DOT derivation (`live|warn|idle`)
 * is NOT a field rename — `warn` is derived from a pending permission request, not
 * from `AgentStatus`. The implementer extends `useWorkbenchAgentData` against THIS
 * test and MAY NOT modify it (per ~/.claude/rules/orchestrator-owned-acceptance-tests.md).
 *
 * Phase 3 adapter-extension contract:
 *   `useWorkbenchAgentData()` additionally returns:
 *     sessions: Array<{ id; projectId; kind: 'claude'|'shell'; label; sub;
 *                       status: 'live'|'warn'|'idle'; active: boolean }>
 *     contextStats: { usedTokens; maxTokens; costUsd; model }
 *
 *   sessions mapping (from the LIVE list — running + idle only; complete/error excluded):
 *     - status 'running' + latest permissionEvent 'request' → 'warn'
 *     - status 'running' (otherwise) ......................... → 'live'
 *     - status 'idle' ....................................... → 'idle'
 *     - the primary session (ADR D4 selection) is the only one with active === true
 *
 *   contextStats (from the PRIMARY session):
 *     - usedTokens = inputTokens + outputTokens
 *     - costUsd    = primary.costUsd ?? 0
 *     - model      = primary.model ?? <fallback>
 *     - maxTokens  = a positive number (model context window; no live source — constant ok)
 *
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentSession,
  AgentStatus,
  PermissionEvent,
  ToolCallEvent,
} from '../AgentMonitor/types';

vi.mock('../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import { useWorkbenchAgentData } from './useWorkbenchAgentData';

const mockedCtx = vi.mocked(useAgentEventsContext);

function makeToolCall(p: Partial<ToolCallEvent> & Pick<ToolCallEvent, 'toolName'>): ToolCallEvent {
  return {
    id: `tc-${Math.random().toString(36).slice(2)}`,
    toolName: p.toolName,
    input: p.input ?? '',
    timestamp: p.timestamp ?? 1000,
    status: p.status ?? 'success',
    ...p,
  };
}

function makeSession(p: Partial<AgentSession> & { status: AgentStatus; id: string }): AgentSession {
  return {
    taskLabel: p.taskLabel ?? 'task',
    startedAt: p.startedAt ?? 1000,
    toolCalls: p.toolCalls ?? [],
    inputTokens: p.inputTokens ?? 0,
    outputTokens: p.outputTokens ?? 0,
    ...p,
  };
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

function dataFor(sessions: AgentSession[]) {
  mockedCtx.mockReturnValue(ctxFor(sessions));
  return renderHook(() => useWorkbenchAgentData()).result.current;
}

const requestPerm: PermissionEvent = { type: 'request', timestamp: 2000 };

beforeEach(() => {
  mockedCtx.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Wave 3 Phase 3 — session mapping + context stats (orchestrator-owned)', () => {
  it('maps running/awaiting/idle to live/warn/idle status dots', () => {
    const data = dataFor([
      makeSession({ id: 'r1', status: 'running', startedAt: 1000 }),
      makeSession({
        id: 'r2',
        status: 'running',
        startedAt: 1100,
        permissionEvents: [requestPerm],
      }),
      makeSession({ id: 'i1', status: 'idle', startedAt: 900 }),
    ]);
    const byId = Object.fromEntries(data.sessions.map((s) => [s.id, s]));
    expect(byId.r1.status).toBe('live');
    expect(byId.r2.status).toBe('warn'); // pending permission request
    expect(byId.i1.status).toBe('idle');
  });

  it('excludes complete/error sessions from the rail list (live + idle only)', () => {
    const data = dataFor([
      makeSession({ id: 'r1', status: 'running', startedAt: 1000 }),
      makeSession({ id: 'c1', status: 'complete', startedAt: 900, completedAt: 1200 }),
      makeSession({ id: 'e1', status: 'error', startedAt: 800, completedAt: 1100 }),
    ]);
    const ids = data.sessions.map((s) => s.id).sort();
    expect(ids).toEqual(['r1']);
  });

  it('marks exactly the primary session active (most-recently-active running)', () => {
    const data = dataFor([
      makeSession({
        id: 'older',
        status: 'running',
        startedAt: 1000,
        toolCalls: [makeToolCall({ toolName: 'Read', timestamp: 1100 })],
      }),
      makeSession({
        id: 'newer',
        status: 'running',
        startedAt: 1050,
        toolCalls: [makeToolCall({ toolName: 'Bash', timestamp: 9999 })],
      }),
    ]);
    const active = data.sessions.filter((s) => s.active).map((s) => s.id);
    expect(active).toEqual(['newer']);
  });

  it('derives contextStats from the primary session', () => {
    const data = dataFor([
      makeSession({
        id: 'p1',
        status: 'running',
        model: 'claude-opus-4-7',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.05,
      }),
    ]);
    expect(data.contextStats.usedTokens).toBe(1500);
    expect(data.contextStats.model).toBe('claude-opus-4-7');
    expect(data.contextStats.costUsd).toBeCloseTo(0.05);
    expect(data.contextStats.maxTokens).toBeGreaterThan(0);
  });

  it('no sessions → empty sessions list + zeroed context stats', () => {
    const data = dataFor([]);
    expect(data.sessions).toEqual([]);
    expect(data.contextStats.usedTokens).toBe(0);
  });
});
