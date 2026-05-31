/**
 * useAgentEvents.subagentReducers.test.ts
 *
 * Unit tests for updateContextWindow reducer.
 *
 * Contract:
 *   - Sets contextUsedTokens + contextMaxTokens on the matching session.
 *   - No-ops (returns state unchanged) when sessionId doesn't match any session.
 *   - Does not touch inputTokens/outputTokens (separate delta accumulator path).
 */
import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../components/AgentMonitor/types';
import type { AgentState } from './useAgentEvents.helpers';
import { updateContextWindow } from './useAgentEvents.subagentReducers';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSession(partial: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'ses-1',
    taskLabel: 'test',
    status: 'running',
    startedAt: 1000,
    toolCalls: [],
    inputTokens: 10,
    outputTokens: 5,
    ...partial,
  };
}

function makeState(sessions: AgentSession[] = []): AgentState {
  return { sessions, pendingSubagentLinks: {}, pendingSubagentTimestamps: [] };
}

// ── updateContextWindow ───────────────────────────────────────────────────────

describe('updateContextWindow', () => {
  it('sets contextUsedTokens and contextMaxTokens on the matching session', () => {
    const session = makeSession({ id: 'ses-1' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'ses-1',
      contextUsedTokens: 42_000,
      contextMaxTokens: 200_000,
    });
    const updated = next.sessions.find((s) => s.id === 'ses-1');
    expect(updated?.contextUsedTokens).toBe(42_000);
    expect(updated?.contextMaxTokens).toBe(200_000);
  });

  it('does not modify inputTokens or outputTokens (separate delta path)', () => {
    const session = makeSession({ id: 'ses-1', inputTokens: 10, outputTokens: 5 });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'ses-1',
      contextUsedTokens: 99_000,
      contextMaxTokens: 1_000_000,
    });
    const updated = next.sessions.find((s) => s.id === 'ses-1');
    expect(updated?.inputTokens).toBe(10);
    expect(updated?.outputTokens).toBe(5);
  });

  it('overwrites a prior contextUsedTokens snapshot with the latest absolute value', () => {
    const session = makeSession({ id: 'ses-1', contextUsedTokens: 50_000, contextMaxTokens: 200_000 });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'ses-1',
      contextUsedTokens: 80_000,
      contextMaxTokens: 200_000,
    });
    const updated = next.sessions.find((s) => s.id === 'ses-1');
    expect(updated?.contextUsedTokens).toBe(80_000);
  });

  it('no-ops (returns same sessions array) when sessionId does not match', () => {
    const session = makeSession({ id: 'ses-1' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'ses-unknown',
      contextUsedTokens: 42_000,
      contextMaxTokens: 200_000,
    });
    // Session unchanged — contextUsedTokens stays absent
    expect(next.sessions[0].contextUsedTokens).toBeUndefined();
  });

  it('updates only the matching session when multiple sessions are present', () => {
    const s1 = makeSession({ id: 'ses-1' });
    const s2 = makeSession({ id: 'ses-2' });
    const state = makeState([s1, s2]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'ses-1',
      contextUsedTokens: 30_000,
      contextMaxTokens: 200_000,
    });
    expect(next.sessions.find((s) => s.id === 'ses-1')?.contextUsedTokens).toBe(30_000);
    expect(next.sessions.find((s) => s.id === 'ses-2')?.contextUsedTokens).toBeUndefined();
  });
});
