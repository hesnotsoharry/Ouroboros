/**
 * useWorkbenchAttention.agentSource.ts
 *
 * Pure helper for the cross-store join:
 *   SessionRecord.activeTerminalIds → TerminalSession.claudeSessionId
 *   → statusByClaudeSessionId → per-row agent status
 *
 * Exported for unit testing (no React, no side-effects).
 */

import type { SessionRecord } from '../../../types/electron';
import type { TerminalSession } from '../../Terminal/TerminalTabs';

export type AgentRowStatus = 'running' | 'complete' | 'error';

/** Worst-status-wins rank: error > complete > running */
function worstStatus(a: AgentRowStatus | undefined, b: AgentRowStatus): AgentRowStatus {
  if (a === 'error' || b === 'error') return 'error';
  if (a === 'complete' || b === 'complete') return 'complete';
  return 'running';
}

/**
 * Build a map from SessionRecord.id → worst AgentRowStatus for that row.
 *
 * Join path:
 *   SessionRecord.activeTerminalIds
 *     → terminalClaudeIdByTerminalId (TerminalSession.id → claudeSessionId)
 *     → statusByClaudeSessionId (from useAgentCompletionIndicators)
 *
 * A session absent from the status map (seen or never-run) is omitted from
 * the result — callers treat absence as 'none'.
 */
export function deriveAgentStatusBySessionRecordId(
  sessions: SessionRecord[],
  terminalClaudeIdByTerminalId: Map<string, string>,
  statusByClaudeSessionId: Record<string, AgentRowStatus>,
): Record<string, AgentRowStatus> {
  const result: Record<string, AgentRowStatus> = {};

  for (const session of sessions) {
    for (const terminalId of session.activeTerminalIds ?? []) {
      const claudeSessionId = terminalClaudeIdByTerminalId.get(terminalId);
      if (!claudeSessionId) continue;
      const status = statusByClaudeSessionId[claudeSessionId];
      if (!status) continue;
      result[session.id] = worstStatus(result[session.id], status);
    }
  }

  return result;
}

/**
 * Build the terminal→claudeSessionId lookup from a flat list of TerminalSessions.
 * Terminals without a claudeSessionId are excluded.
 */
export function buildTerminalClaudeIdMap(terminalSessions: TerminalSession[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of terminalSessions) {
    if (t.claudeSessionId) map.set(t.id, t.claudeSessionId);
  }
  return map;
}
