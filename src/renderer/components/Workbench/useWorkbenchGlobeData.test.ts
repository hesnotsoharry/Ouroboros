/**
 * useWorkbenchGlobeData.test.ts — unit tests for selectPrimarySession.
 *
 * selectPrimarySession is a pure helper (all inputs explicit, no side effects),
 * so it's tested directly without rendering the hook.
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../AgentMonitor/types';
import { selectPrimarySession } from './useWorkbenchGlobeData';

// selectPrimarySession is a pure helper exported from the module — tested directly
// (no React context needed; importing the module doesn't invoke the hook).

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AgentSession> & { id: string }): AgentSession {
  return {
    id: overrides.id,
    taskLabel: 'task',
    status: overrides.status ?? 'idle',
    startedAt: overrides.startedAt ?? 1000,
    toolCalls: overrides.toolCalls ?? [],
    inputTokens: 0,
    outputTokens: 0,
    internal: overrides.internal,
    ...overrides,
  } as AgentSession;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('selectPrimarySession — internal filter', () => {
  it('returns null when only internal sessions exist', () => {
    const sessions = [makeSession({ id: 'i1', status: 'running', internal: true, startedAt: 9000 })];
    expect(selectPrimarySession(sessions)).toBeNull();
  });

  it('returns the normal session when an internal running session coexists', () => {
    const sessions = [
      makeSession({ id: 'internal', status: 'running', internal: true, startedAt: 9000 }),
      makeSession({ id: 'normal', status: 'idle', internal: undefined, startedAt: 1000 }),
    ];
    const primary = selectPrimarySession(sessions);
    expect(primary?.id).toBe('normal');
  });

  it('prefers a non-internal running session over a non-internal idle session', () => {
    const sessions = [
      makeSession({ id: 'internal-running', status: 'running', internal: true, startedAt: 9000 }),
      makeSession({ id: 'normal-running', status: 'running', internal: false, startedAt: 5000 }),
      makeSession({ id: 'normal-idle', status: 'idle', internal: false, startedAt: 8000 }),
    ];
    const primary = selectPrimarySession(sessions);
    expect(primary?.id).toBe('normal-running');
  });

  it('returns null when the sessions array is empty', () => {
    expect(selectPrimarySession([])).toBeNull();
  });

  it('returns the most-recently-active session when multiple non-internal sessions are idle', () => {
    const sessions = [
      makeSession({ id: 'older', status: 'idle', startedAt: 1000 }),
      makeSession({ id: 'newer', status: 'idle', startedAt: 5000 }),
    ];
    expect(selectPrimarySession(sessions)?.id).toBe('newer');
  });

  it('picks by most-recent toolCall timestamp when startedAt is equal', () => {
    const sessions = [
      makeSession({
        id: 'no-tools',
        status: 'running',
        startedAt: 1000,
        toolCalls: [],
      }),
      makeSession({
        id: 'with-tools',
        status: 'running',
        startedAt: 1000,
        toolCalls: [
          {
            id: 'tc1',
            toolName: 'Read',
            input: 'foo',
            timestamp: 9000,
            status: 'success',
          },
        ],
      }),
    ];
    expect(selectPrimarySession(sessions)?.id).toBe('with-tools');
  });
});
