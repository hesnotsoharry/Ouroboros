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

  it('resolves the target session by paneId when paneId is provided and matches', () => {
    // sessionId is 'unknown' (as emitted by statusline when CLAUDE_SESSION_ID is absent)
    // paneId matches a real session — the update must land on that session
    const session = makeSession({ id: 'ses-real', paneId: 'pane-abc' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      paneId: 'pane-abc',
      contextUsedTokens: 55_000,
      contextMaxTokens: 200_000,
    });
    const updated = next.sessions.find((s) => s.id === 'ses-real');
    expect(updated?.contextUsedTokens).toBe(55_000);
    expect(updated?.contextMaxTokens).toBe(200_000);
  });

  it('falls back to sessionId when paneId is absent', () => {
    const session = makeSession({ id: 'ses-1', paneId: 'pane-xyz' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'ses-1',
      // no paneId — must route by sessionId
      contextUsedTokens: 70_000,
      contextMaxTokens: 200_000,
    });
    expect(next.sessions.find((s) => s.id === 'ses-1')?.contextUsedTokens).toBe(70_000);
  });

  it('no-ops when neither paneId nor sessionId matches any session', () => {
    const session = makeSession({ id: 'ses-1', paneId: 'pane-xyz' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      paneId: 'pane-nope',
      contextUsedTokens: 99_000,
      contextMaxTokens: 200_000,
    });
    // Neither paneId nor sessionId matched — session stays untouched
    expect(next.sessions[0].contextUsedTokens).toBeUndefined();
  });

  // ── cwd-based matching (statusline fix) ──────────────────────────────────────

  it('resolves the target session by cwd when paneId is absent', () => {
    // Statusline sends cwd=process.cwd() of the Claude subprocess, paneId=undefined.
    // The session was registered with a matching cwd.
    const session = makeSession({ id: 'ses-real', cwd: 'C:\\Web App\\AgentIDE' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      cwd: 'C:\\Web App\\AgentIDE',
      contextUsedTokens: 365_271,
      contextMaxTokens: 1_000_000,
    });
    const updated = next.sessions.find((s) => s.id === 'ses-real');
    expect(updated?.contextUsedTokens).toBe(365_271);
    expect(updated?.contextMaxTokens).toBe(1_000_000);
  });

  it('cwd matching is case-insensitive and normalizes backslashes to forward slashes', () => {
    const session = makeSession({ id: 'ses-1', cwd: 'C:/Web App/AgentIDE' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      cwd: 'C:\\Web App\\AgentIDE',
      contextUsedTokens: 100_000,
      contextMaxTokens: 200_000,
    });
    expect(next.sessions.find((s) => s.id === 'ses-1')?.contextUsedTokens).toBe(100_000);
  });

  it('cwd prefix match: statusline cwd is a subdirectory of the session cwd', () => {
    // Agent runs from project root; statusline cwd may be a subdir (e.g. after cd).
    const session = makeSession({ id: 'ses-1', cwd: 'C:/projects/foo' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      cwd: 'C:/projects/foo/src',
      contextUsedTokens: 50_000,
      contextMaxTokens: 200_000,
    });
    expect(next.sessions.find((s) => s.id === 'ses-1')?.contextUsedTokens).toBe(50_000);
  });

  it('cwd match prefers paneId when both are present', () => {
    // paneId matches ses-by-pane; cwd also matches ses-by-cwd.
    // paneId must win (higher priority).
    const byPane = makeSession({ id: 'ses-by-pane', paneId: 'pane-abc', cwd: 'C:/other' });
    const byCwd = makeSession({ id: 'ses-by-cwd', cwd: 'C:/projects/foo' });
    const state = makeState([byPane, byCwd]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      paneId: 'pane-abc',
      cwd: 'C:/projects/foo',
      contextUsedTokens: 77_000,
      contextMaxTokens: 200_000,
    });
    expect(next.sessions.find((s) => s.id === 'ses-by-pane')?.contextUsedTokens).toBe(77_000);
    expect(next.sessions.find((s) => s.id === 'ses-by-cwd')?.contextUsedTokens).toBeUndefined();
  });

  it('no-ops when cwd does not match any session', () => {
    const session = makeSession({ id: 'ses-1', cwd: 'C:/projects/foo' });
    const state = makeState([session]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      cwd: 'C:/projects/bar',
      contextUsedTokens: 99_000,
      contextMaxTokens: 200_000,
    });
    expect(next.sessions[0].contextUsedTokens).toBeUndefined();
  });

  // ── paneId-null guard (IDE-runs-in-itself regression) ────────────────────────

  it('paneId-null context_update does NOT overwrite a pane-bound session matched by cwd', () => {
    // Setup: a workbench pane session with paneId set, cwd = AgentIDE root, 88k tokens.
    // A terminal Claude session in the same cwd emits a context_update with no paneId.
    // The terminal's event must NOT pollute the pane session's gauge.
    const paneSession = makeSession({
      id: 'ses-pane',
      paneId: 'pane-1',
      cwd: 'C:/Web App/AgentIDE',
      contextUsedTokens: 88_000,
      contextMaxTokens: 200_000,
    });
    const state = makeState([paneSession]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'terminal-session-id',
      // paneId intentionally absent — this is a terminal/external Claude process
      cwd: 'C:/Web App/AgentIDE',
      contextUsedTokens: 126_000,
      contextMaxTokens: 200_000,
    });
    // Pane session must be unchanged — terminal update must not overwrite it
    const pane = next.sessions.find((s) => s.id === 'ses-pane');
    expect(pane?.contextUsedTokens).toBe(88_000);
  });

  it('paneId context_update WITH matching paneId DOES update the pane-bound session', () => {
    // Positive case: the same pane session receives an update that carries the correct paneId.
    const paneSession = makeSession({
      id: 'ses-pane',
      paneId: 'pane-1',
      cwd: 'C:/Web App/AgentIDE',
      contextUsedTokens: 88_000,
      contextMaxTokens: 200_000,
    });
    const state = makeState([paneSession]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'ses-pane',
      paneId: 'pane-1',
      cwd: 'C:/Web App/AgentIDE',
      contextUsedTokens: 95_000,
      contextMaxTokens: 200_000,
    });
    const pane = next.sessions.find((s) => s.id === 'ses-pane');
    expect(pane?.contextUsedTokens).toBe(95_000);
  });

  it('paneId-null context_update CAN still update a non-pane session by cwd', () => {
    // The guard only blocks pane-bound sessions. A terminal session in a folder with
    // no in-app pane active should still drive the gauge via cwd.
    const freeSession = makeSession({
      id: 'ses-free',
      // no paneId — this session has no workbench pane binding
      cwd: 'C:/projects/other',
      contextUsedTokens: 10_000,
      contextMaxTokens: 200_000,
    });
    const state = makeState([freeSession]);
    const next = updateContextWindow(state, {
      type: 'CONTEXT_UPDATE',
      sessionId: 'unknown',
      // no paneId in the action
      cwd: 'C:/projects/other',
      contextUsedTokens: 50_000,
      contextMaxTokens: 200_000,
    });
    const sess = next.sessions.find((s) => s.id === 'ses-free');
    expect(sess?.contextUsedTokens).toBe(50_000);
  });
});
