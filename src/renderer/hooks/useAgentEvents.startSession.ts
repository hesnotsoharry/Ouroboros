/**
 * useAgentEvents.startSession.ts — Session-start reducer logic extracted from
 * useAgentEvents.helpers.ts to satisfy the 300-line ESLint limit.
 *
 * Contains: startSession, updateExistingSession, resolveParentAndTimestamps,
 * AgentStartAction type alias.
 */

import type { AgentSession } from '../components/AgentMonitor/types';
import type { AgentAction, AgentState, PendingSubagentStamp } from './useAgentEvents.helpers';
import {
  hasSession,
  omitPendingLink,
  updateSession,
} from './useAgentEvents.session-utils';
import { findTemporalParent } from './useAgentEvents.subagentReducers';

export type AgentStartAction = Extract<AgentAction, { type: 'AGENT_START' }>;

function resolveParentAndTimestamps(
  state: AgentState,
  action: AgentStartAction,
): { resolvedParent: string | undefined; updatedTimestamps: PendingSubagentStamp[] } {
  let resolvedParent = action.parentSessionId ?? state.pendingSubagentLinks[action.sessionId];
  let updatedTimestamps = state.pendingSubagentTimestamps;
  if (!resolvedParent) {
    const temporalMatch = findTemporalParent(state.pendingSubagentTimestamps, action.timestamp);
    if (temporalMatch) {
      resolvedParent = temporalMatch.parentSessionId;
      updatedTimestamps = state.pendingSubagentTimestamps.filter(
        (stamp) => stamp !== temporalMatch,
      );
    }
  }
  return { resolvedParent, updatedTimestamps };
}

function updateExistingSession(state: AgentState, action: AgentStartAction): AgentState {
  return updateSession(state, action.sessionId, (session) => ({
    ...session,
    taskLabel:
      action.taskLabel !== `Session ${action.sessionId.slice(0, 8)}`
        ? action.taskLabel
        : session.taskLabel,
    status: 'running',
    startedAt: action.timestamp,
    completedAt: undefined,
    error: undefined,
    model: action.model ?? session.model,
    parentSessionId: action.parentSessionId ?? session.parentSessionId,
    external: action.external ?? session.external,
    paneId: action.paneId ?? session.paneId,
    restored: false,
  }));
}

export function startSession(state: AgentState, action: AgentStartAction): AgentState {
  if (hasSession(state.sessions, action.sessionId)) return updateExistingSession(state, action);
  const { resolvedParent, updatedTimestamps } = resolveParentAndTimestamps(state, action);
  const newSession: AgentSession = {
    id: action.sessionId,
    taskLabel: action.taskLabel,
    status: 'running',
    startedAt: action.timestamp,
    toolCalls: [],
    parentSessionId: resolvedParent,
    inputTokens: 0,
    outputTokens: 0,
    model: action.model,
    internal: action.internal,
    external: action.external,
    paneId: action.paneId,
  };
  return {
    sessions: [newSession, ...state.sessions],
    pendingSubagentLinks: omitPendingLink(state.pendingSubagentLinks, action.sessionId),
    pendingSubagentTimestamps: updatedTimestamps,
  };
}
