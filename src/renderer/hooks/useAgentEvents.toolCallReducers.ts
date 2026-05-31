import type { ToolCallEvent } from '../components/AgentMonitor/types';
import type { AgentState } from './useAgentEvents.helpers';
import {
  ensureSession,
  findToolCallIndex,
  resolveStaleToolCalls,
  trimToolCalls,
  updateSession,
} from './useAgentEvents.session-utils';

/** [trace:bind] Diagnostic: logs the resolved tool id + which reducer branch a TOOL_START takes.
 *  Disambiguates fallback-id collision ('collision-update') vs the isDuplicate guard
 *  ('duplicate-skip') vs a clean append. Remove when the trace commit is reverted (B5 cleanup). */
function traceToolAttach(
  session: { toolCalls: ToolCallEvent[] },
  action: { sessionId: string; toolCall: ToolCallEvent },
): void {
  const existingIndex = session.toolCalls.findIndex((tc) => tc.id === action.toolCall.id);
  const isDuplicate =
    existingIndex < 0 &&
    session.toolCalls.some(
      (tc) =>
        tc.toolName === action.toolCall.toolName &&
        tc.input === action.toolCall.input &&
        Math.abs(tc.timestamp - action.toolCall.timestamp) < 2000 &&
        tc.status === 'pending',
    );
  const branch = existingIndex >= 0 ? 'collision-update' : isDuplicate ? 'duplicate-skip' : 'append';
  // eslint-disable-next-line no-console
  console.warn('[trace:bind] toolAttach', {
    sessionId: action.sessionId,
    toolName: action.toolCall.toolName,
    toolCallId: action.toolCall.id,
    branch,
    countBefore: session.toolCalls.length,
  });
}

export function startToolCall(
  state: AgentState,
  action: Extract<{ type: 'TOOL_START'; sessionId: string; toolCall: ToolCallEvent }, { type: 'TOOL_START' }>,
): AgentState {
  const baseState = ensureSession(state, action.sessionId, action.toolCall.timestamp);
  return updateSession(baseState, action.sessionId, (session) => {
    traceToolAttach(session, action);
    const existingIndex = session.toolCalls.findIndex((tc) => tc.id === action.toolCall.id);
    if (existingIndex >= 0) {
      const existing = session.toolCalls[existingIndex];
      const toolCalls = session.toolCalls.map((tc, index) =>
        index === existingIndex
          ? {
              ...existing,
              toolName: action.toolCall.toolName,
              input: action.toolCall.input,
              timestamp: action.toolCall.timestamp,
            }
          : tc,
      );
      // New activity in a new turn — clear the idle boundary.
      return { ...session, toolCalls, lastTurnEndedAt: undefined };
    }
    const isDuplicate = session.toolCalls.some(
      (tc) =>
        tc.toolName === action.toolCall.toolName &&
        tc.input === action.toolCall.input &&
        Math.abs(tc.timestamp - action.toolCall.timestamp) < 2000 &&
        tc.status === 'pending',
    );
    if (isDuplicate) return session;
    return {
      ...session,
      // New activity in a new turn — clear the idle boundary.
      lastTurnEndedAt: undefined,
      toolCalls: trimToolCalls([
        ...resolveStaleToolCalls(session.toolCalls, action.toolCall.timestamp),
        action.toolCall,
      ]),
    };
  });
}

export function finishToolCall(
  state: AgentState,
  action: Extract<{ type: 'TOOL_END'; sessionId: string; toolCallId?: string; toolName?: string; duration: number; status: 'success' | 'error'; output?: string }, { type: 'TOOL_END' }>,
): AgentState {
  return updateSession(state, action.sessionId, (session) => {
    const targetIndex = findToolCallIndex(session.toolCalls, action.toolCallId, action.toolName);
    if (targetIndex < 0) return session;
    const toolCalls = session.toolCalls.map((tc, i) =>
      i === targetIndex
        ? { ...tc, duration: action.duration, status: action.status, output: action.output }
        : tc,
    );
    return { ...session, toolCalls };
  });
}
