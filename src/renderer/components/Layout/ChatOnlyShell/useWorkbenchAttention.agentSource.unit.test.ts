/**
 * @vitest-environment jsdom
 *
 * Unit tests for the cross-store join helper.
 * The join is the primary failure surface (Wave 99 honeycomb shape):
 * SessionRecord → terminal → AgentSession status.
 */

import { describe, expect, it } from 'vitest';

import type { SessionRecord } from '../../../types/electron';
import type { TerminalSession } from '../../Terminal/TerminalTabs';
import {
  buildTerminalClaudeIdMap,
  deriveAgentStatusBySessionRecordId,
} from './useWorkbenchAttention.agentSource';

function makeSession(id: string, activeTerminalIds: string[] = []): SessionRecord {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-01-01T00:00:00.000Z',
    projectRoot: '/workspace',
    worktree: false,
    tags: [],
    activeTerminalIds,
    costRollup: { totalUsd: 0, inputTokens: 0, outputTokens: 0 },
    telemetry: { correlationIds: [], telemetrySessionId: id },
  };
}

function makeTerminal(id: string, claudeSessionId?: string): TerminalSession {
  return { id, title: id, status: 'running', claudeSessionId };
}

describe('buildTerminalClaudeIdMap', () => {
  it('maps terminal id to claudeSessionId for terminals that have one', () => {
    const terminals = [
      makeTerminal('t-1', 'agent-1'),
      makeTerminal('t-2', 'agent-2'),
      makeTerminal('t-3'), // no claudeSessionId — excluded
    ];
    const map = buildTerminalClaudeIdMap(terminals);
    expect(map.get('t-1')).toBe('agent-1');
    expect(map.get('t-2')).toBe('agent-2');
    expect(map.has('t-3')).toBe(false);
  });

  it('returns empty map for empty terminal list', () => {
    expect(buildTerminalClaudeIdMap([]).size).toBe(0);
  });
});

describe('deriveAgentStatusBySessionRecordId', () => {
  it("maps a session with one bound terminal to that terminal's agent status", () => {
    const sessions = [makeSession('sess-1', ['t-1'])];
    const terminalMap = new Map([['t-1', 'agent-1']]);
    const statusMap = { 'agent-1': 'complete' as const };
    const result = deriveAgentStatusBySessionRecordId(sessions, terminalMap, statusMap);
    expect(result['sess-1']).toBe('complete');
  });

  it('maps running status correctly', () => {
    const sessions = [makeSession('sess-1', ['t-1'])];
    const terminalMap = new Map([['t-1', 'agent-1']]);
    const result = deriveAgentStatusBySessionRecordId(sessions, terminalMap, {
      'agent-1': 'running',
    });
    expect(result['sess-1']).toBe('running');
  });

  it('worst-status-wins: error outranks complete and running', () => {
    const sessions = [makeSession('sess-1', ['t-1', 't-2', 't-3'])];
    const terminalMap = new Map([
      ['t-1', 'agent-1'],
      ['t-2', 'agent-2'],
      ['t-3', 'agent-3'],
    ]);
    const result = deriveAgentStatusBySessionRecordId(sessions, terminalMap, {
      'agent-1': 'complete',
      'agent-2': 'error',
      'agent-3': 'running',
    });
    expect(result['sess-1']).toBe('error');
  });

  it('worst-status-wins: complete outranks running', () => {
    const sessions = [makeSession('sess-1', ['t-1', 't-2'])];
    const terminalMap = new Map([
      ['t-1', 'agent-1'],
      ['t-2', 'agent-2'],
    ]);
    const result = deriveAgentStatusBySessionRecordId(sessions, terminalMap, {
      'agent-1': 'running',
      'agent-2': 'complete',
    });
    expect(result['sess-1']).toBe('complete');
  });

  it('session with no bound terminals is absent from result', () => {
    const sessions = [makeSession('sess-1', ['t-1'])];
    const terminalMap = new Map<string, string>(); // t-1 has no claudeSessionId
    const result = deriveAgentStatusBySessionRecordId(sessions, terminalMap, {});
    expect(result['sess-1']).toBeUndefined();
  });

  it('session with terminals not in the status map is absent from result', () => {
    const sessions = [makeSession('sess-1', ['t-1'])];
    const terminalMap = new Map([['t-1', 'agent-1']]);
    // agent-1 is not in the status map (seen or idle)
    const result = deriveAgentStatusBySessionRecordId(sessions, terminalMap, {});
    expect(result['sess-1']).toBeUndefined();
  });

  it('handles multiple sessions independently', () => {
    const sessions = [
      makeSession('sess-1', ['t-1']),
      makeSession('sess-2', ['t-2']),
      makeSession('sess-3', []), // no terminals
    ];
    const terminalMap = new Map([
      ['t-1', 'agent-1'],
      ['t-2', 'agent-2'],
    ]);
    const result = deriveAgentStatusBySessionRecordId(sessions, terminalMap, {
      'agent-1': 'complete',
      'agent-2': 'error',
    });
    expect(result['sess-1']).toBe('complete');
    expect(result['sess-2']).toBe('error');
    expect(result['sess-3']).toBeUndefined();
  });
});
