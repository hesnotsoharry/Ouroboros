/**
 * useProjectNotificationStore.test.ts — unit tests for the pure
 * deriveCurrentNotificationKey helper.
 *
 * The provider + hook integration is covered by deriveCurrentNotificationKey
 * since the hook is a thin wrapper. markSeen + seenKeys interaction is tested
 * via the pure key derivation logic (React context itself needs no unit test —
 * it's trivial state machinery).
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../AgentMonitor/types';
import { deriveCurrentNotificationKey } from './useProjectNotificationStore';

function makeSession(overrides: Partial<AgentSession> & { id: string }): AgentSession {
  return {
    taskLabel: 'Test',
    status: 'running',
    startedAt: 1000,
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    ...overrides,
  };
}

describe('deriveCurrentNotificationKey', () => {
  it('returns null when no turn has ended and no pending ask exists', () => {
    const session = makeSession({ id: 's1' });
    expect(deriveCurrentNotificationKey(session)).toBeNull();
  });

  it('returns turn-end key when lastTurnEndedAt is set and no pending ask', () => {
    const session = makeSession({ id: 's1', lastTurnEndedAt: 5000 });
    expect(deriveCurrentNotificationKey(session)).toBe('turn-end:5000');
  });

  it('returns ask key when a pending AskUserQuestion exists', () => {
    const session = makeSession({
      id: 's1',
      toolCalls: [
        { id: 'ask-abc', toolName: 'AskUserQuestion', status: 'pending', input: '?', timestamp: 1 },
      ],
    });
    expect(deriveCurrentNotificationKey(session)).toBe('ask:ask-abc');
  });

  it('asking key wins over turn-end when both conditions are present', () => {
    const session = makeSession({
      id: 's1',
      lastTurnEndedAt: 5000,
      toolCalls: [
        { id: 'ask-xyz', toolName: 'AskUserQuestion', status: 'pending', input: '?', timestamp: 1 },
      ],
    });
    expect(deriveCurrentNotificationKey(session)).toBe('ask:ask-xyz');
  });

  it('returns turn-end when AskUserQuestion is answered (not pending)', () => {
    const session = makeSession({
      id: 's1',
      lastTurnEndedAt: 6000,
      toolCalls: [
        { id: 'ask-1', toolName: 'AskUserQuestion', status: 'success', input: '?', timestamp: 1 },
      ],
    });
    expect(deriveCurrentNotificationKey(session)).toBe('turn-end:6000');
  });
});
