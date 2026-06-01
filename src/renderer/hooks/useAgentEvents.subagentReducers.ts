/**
 * useAgentEvents.subagentReducers.ts — Reducer functions for token usage,
 * subtool updates, and subagent linking logic.
 *
 * Extracted from useAgentEvents.helpers.ts to stay within the 300-line
 * ESLint limit. Uses local action type shapes to avoid circular imports
 * with useAgentEvents.helpers.ts.
 */

import type { SubToolCallEvent } from '../components/AgentMonitor/types';
import type { RawApiTokenUsage as TokenUsage } from '../types/electron';
import type { AgentState, PendingSubagentStamp } from './useAgentEvents.helpers';
import {
  getUsageDeltas,
  hasSession,
  mergeOptionalTokenCount,
  updateSession,
} from './useAgentEvents.session-utils';

/** Window (ms) for temporal linking — 30s accounts for model loading overhead. */
const TEMPORAL_LINK_WINDOW_MS = 30_000;

interface TokenUpdateAction {
  type: 'TOKEN_UPDATE';
  sessionId: string;
  usage: TokenUsage;
  model?: string;
}

interface SubToolUpdateAction {
  type: 'SUBTOOL_UPDATE';
  sessionId: string;
  parentToolCallId: string;
  subTool: SubToolCallEvent;
}

interface LinkSubagentAction {
  type: 'LINK_SUBAGENT';
  parentSessionId: string;
  childSessionId: string;
}

interface RecordSubagentToolAction {
  type: 'RECORD_SUBAGENT_TOOL';
  parentSessionId: string;
  timestamp: number;
}

interface ContextUpdateAction {
  type: 'CONTEXT_UPDATE';
  sessionId: string;
  /** OUROBOROS_PANE_ID forwarded from the statusline hook. Used when present. */
  paneId?: string;
  /**
   * Working directory of the Claude session — process.cwd() in the statusline subprocess.
   * Primary session-matching key: paneId → cwd (basename) → sessionId fallback.
   */
  cwd?: string;
  contextUsedTokens: number;
  contextMaxTokens: number;
}

export function updateTokenUsage(state: AgentState, action: TokenUpdateAction): AgentState {
  const usageDeltas = getUsageDeltas(action.usage);
  return updateSession(state, action.sessionId, (session) => ({
    ...session,
    inputTokens: session.inputTokens + usageDeltas.input,
    outputTokens: session.outputTokens + usageDeltas.output,
    cacheReadTokens: mergeOptionalTokenCount(session.cacheReadTokens, usageDeltas.cacheRead),
    cacheWriteTokens: mergeOptionalTokenCount(session.cacheWriteTokens, usageDeltas.cacheWrite),
    model: action.model ?? session.model,
  }));
}

/** Normalize a path to forward slashes, lowercase, no trailing slash. */
function normalizeCwd(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
}

/** Resolve a session by paneId. Returns undefined when paneId is absent or unmatched. */
function findSessionByPaneId(
  state: AgentState,
  paneId: string | undefined,
): string | undefined {
  if (!paneId) return undefined;
  return state.sessions.find((s) => s.paneId === paneId)?.id;
}

/**
 * Returns true when a session is eligible as a cwd-match candidate.
 * A pane-bound session (paneId set) is ineligible when the incoming update
 * carries no paneId — prevents a terminal Claude process sharing the same cwd
 * from overwriting a workbench pane session's context gauge.
 */
function isCwdCandidate(
  sessionPaneId: string | undefined,
  incomingPaneId: string | undefined,
): boolean {
  return !(!incomingPaneId && sessionPaneId);
}

/**
 * Resolve a session by cwd — the statusline subprocess's process.cwd() matches the
 * Claude session's working directory. Finds running/idle sessions whose cwd matches
 * (exact or as a parent prefix) the given cwd. When multiple sessions match, prefer
 * the one whose cwd is longest (most specific). Falls back to the first match.
 *
 * @param incomingPaneId - The paneId carried by the incoming action. When absent,
 *   pane-bound sessions are skipped: a terminal session (no paneId) sharing the same
 *   cwd must not overwrite a workbench pane session (paneId set) via cwd-matching.
 */
function findSessionByCwd(
  state: AgentState,
  cwd: string | undefined,
  incomingPaneId: string | undefined,
): string | undefined {
  if (!cwd) return undefined;
  const normalized = normalizeCwd(cwd);
  let best: { id: string; cwdLen: number } | undefined;
  for (const s of state.sessions) {
    if (!s.cwd) continue;
    if (!isCwdCandidate(s.paneId, incomingPaneId)) continue;
    const sCwd = normalizeCwd(s.cwd);
    const matches = normalized === sCwd || normalized.startsWith(sCwd + '/');
    if (matches && (!best || sCwd.length > best.cwdLen)) {
      best = { id: s.id, cwdLen: sCwd.length };
    }
  }
  return best?.id;
}

export function updateContextWindow(
  state: AgentState,
  action: ContextUpdateAction,
): AgentState {
  // Resolution priority: paneId → cwd → sessionId fallback.
  const targetId =
    findSessionByPaneId(state, action.paneId) ??
    findSessionByCwd(state, action.cwd, action.paneId) ??
    action.sessionId;
  return updateSession(state, targetId, (session) => ({
    ...session,
    contextUsedTokens: action.contextUsedTokens,
    contextMaxTokens: action.contextMaxTokens,
  }));
}

export function updateSubTool(state: AgentState, action: SubToolUpdateAction): AgentState {
  return updateSession(state, action.sessionId, (session) => {
    const toolCalls = session.toolCalls.map((tc) => {
      if (tc.id !== action.parentToolCallId) return tc;
      const existing = tc.subTools ?? [];
      const idx = existing.findIndex((s) => s.id === action.subTool.id);
      const subTools =
        idx >= 0
          ? existing.map((s, i) => (i === idx ? { ...s, ...action.subTool } : s))
          : [...existing, action.subTool];
      return { ...tc, subTools };
    });
    return { ...session, toolCalls };
  });
}

export function linkSubagent(state: AgentState, action: LinkSubagentAction): AgentState {
  if (hasSession(state.sessions, action.childSessionId)) {
    return updateSession(state, action.childSessionId, (session) => ({
      ...session,
      parentSessionId: action.parentSessionId,
    }));
  }
  return {
    ...state,
    pendingSubagentLinks: {
      ...state.pendingSubagentLinks,
      [action.childSessionId]: action.parentSessionId,
    },
  };
}

export function recordSubagentTool(
  state: AgentState,
  action: RecordSubagentToolAction,
): AgentState {
  return {
    ...state,
    pendingSubagentTimestamps: [
      ...state.pendingSubagentTimestamps,
      { parentSessionId: action.parentSessionId, timestamp: action.timestamp },
    ],
  };
}

export function findTemporalParent(
  stamps: PendingSubagentStamp[],
  childTimestamp: number,
): PendingSubagentStamp | undefined {
  let best: PendingSubagentStamp | undefined;
  for (const stamp of stamps) {
    const delta = childTimestamp - stamp.timestamp;
    if (delta >= 0 && delta <= TEMPORAL_LINK_WINDOW_MS) {
      if (!best || stamp.timestamp > best.timestamp) best = stamp;
    }
  }
  return best;
}
