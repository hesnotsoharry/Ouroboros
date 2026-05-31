/**
 * useAgentEvents.sessionUtils.stale.test.ts — tests for resolveStaleToolCalls,
 * specifically verifying that AskUserQuestion is exempt from auto-resolution.
 */

import { describe, expect, it } from 'vitest';

import type { ToolCallEvent } from '../components/AgentMonitor/types';
import { resolveStaleToolCalls } from './useAgentEvents.session-utils';

const STALE_MS = 120_001; // just over the 120s threshold

function makeToolCall(overrides: Partial<ToolCallEvent> & { id: string }): ToolCallEvent {
  return {
    toolName: 'Read',
    input: 'file.ts',
    timestamp: 0,
    status: 'pending',
    ...overrides,
  };
}

describe('resolveStaleToolCalls — AskUserQuestion exemption', () => {
  it('does NOT auto-resolve a pending AskUserQuestion past the threshold', () => {
    const tc = makeToolCall({ id: 'ask-1', toolName: 'AskUserQuestion', timestamp: 0 });
    const result = resolveStaleToolCalls([tc], STALE_MS);
    expect(result[0].status).toBe('pending');
  });

  it('auto-resolves other pending tool calls past the threshold', () => {
    const tc = makeToolCall({ id: 'read-1', toolName: 'Read', timestamp: 0 });
    const result = resolveStaleToolCalls([tc], STALE_MS);
    expect(result[0].status).toBe('success');
  });

  it('does not resolve tool calls that have not yet exceeded the threshold', () => {
    const tc = makeToolCall({ id: 'read-2', toolName: 'Read', timestamp: 0 });
    const result = resolveStaleToolCalls([tc], 1000); // well under threshold
    expect(result[0].status).toBe('pending');
  });

  it('returns the same array reference when nothing changed', () => {
    const tc = makeToolCall({ id: 'ask-2', toolName: 'AskUserQuestion', timestamp: 0 });
    const original = [tc];
    const result = resolveStaleToolCalls(original, STALE_MS);
    // AskUserQuestion is exempt → nothing changed → same reference returned
    expect(result).toBe(original);
  });

  it('returns a new array when non-ask tool calls are resolved', () => {
    const tc = makeToolCall({ id: 'bash-1', toolName: 'Bash', timestamp: 0 });
    const original = [tc];
    const result = resolveStaleToolCalls(original, STALE_MS);
    expect(result).not.toBe(original);
    expect(result[0].status).toBe('success');
  });

  it('handles mixed tool calls — only non-ask past threshold are resolved', () => {
    const ask = makeToolCall({ id: 'ask-3', toolName: 'AskUserQuestion', timestamp: 0 });
    const read = makeToolCall({ id: 'read-3', toolName: 'Read', timestamp: 0 });
    const result = resolveStaleToolCalls([ask, read], STALE_MS);
    expect(result[0].status).toBe('pending'); // AskUserQuestion untouched
    expect(result[1].status).toBe('success'); // Read resolved
  });
});
