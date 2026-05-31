/**
 * useProjectNotificationStore — per-session "seen" tracking for project-rail notifications.
 *
 * Workbench-local UI state: tracks which notification events each session has "seen"
 * (i.e. the user focused the session's tab). Resets on app restart — correct.
 *
 * NOT on AgentSession — the domain model has ~48 consumers + SQLite migrations
 * (ADR-D1, Wave 4). This is purely presentation state.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { AgentSession } from '../AgentMonitor/types';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Encodes WHICH event was seen so a NEW turn-end/question after viewing re-fires
 * as unseen. Format: 'turn-end:${lastTurnEndedAt}' | 'ask:${toolCallId}'.
 */
export type SeenKey = string;

interface ProjectNotificationStoreValue {
  seenKeys: ReadonlyMap<string, SeenKey>;
  markSeen: (sessionId: string, key: SeenKey) => void;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Derives the current notification key for a session.
 * Priority: asking > finished > null.
 * Exported for unit testing.
 */
export function deriveCurrentNotificationKey(session: AgentSession): SeenKey | null {
  const pendingAsk = session.toolCalls.find(
    (tc) => tc.toolName === 'AskUserQuestion' && tc.status === 'pending',
  );
  if (pendingAsk) return `ask:${pendingAsk.id}`;
  if (session.lastTurnEndedAt !== undefined) return `turn-end:${session.lastTurnEndedAt}`;
  return null;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ProjectNotificationStoreContext =
  createContext<ProjectNotificationStoreValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProjectNotificationStoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [seenKeys, setSeenKeys] = useState<Map<string, SeenKey>>(new Map());

  const markSeen = useCallback((sessionId: string, key: SeenKey): void => {
    setSeenKeys((prev) => {
      if (prev.get(sessionId) === key) return prev;
      const next = new Map(prev);
      next.set(sessionId, key);
      return next;
    });
  }, []);

  const value = useMemo<ProjectNotificationStoreValue>(
    () => ({ seenKeys, markSeen }),
    [seenKeys, markSeen],
  );

  return (
    <ProjectNotificationStoreContext.Provider value={value}>
      {children}
    </ProjectNotificationStoreContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

const NOOP_STORE: ProjectNotificationStoreValue = {
  seenKeys: new Map(),
  markSeen: () => undefined,
};

/**
 * Returns the notification store value, or a no-op stub when called outside a
 * ProjectNotificationStoreProvider. The no-op stub means "nothing is seen" and
 * "marking has no effect" — correct for any render that mounts without the provider
 * (e.g. isolated component tests). In production, the provider is always present
 * above ProjectRail and UnifiedRail.
 */
export function useProjectNotificationStore(): ProjectNotificationStoreValue {
  const ctx = useContext(ProjectNotificationStoreContext);
  return ctx ?? NOOP_STORE;
}
