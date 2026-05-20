/**
 * useAgentCompletionIndicators.ts
 *
 * Derives per-project and per-session completion indicators from the live
 * AgentSession store. Owns two independent timestamp watermarks so callers
 * can mark the project rail and per-terminal indicators independently.
 *
 * ADR decisions honored:
 *   1 — complete (green) / error (red); error outranks complete per project
 *   2 — timestamp watermarks: unseen iff completedAt > lastViewedAt
 *   4 — normalized cwd prefix match; longest-match wins; undefined cwd → no project
 *   5 — in-memory only (no persistence) — now two refs: lastProjectViewedAt +
 *       lastSessionViewedAt, stamped independently
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import type { AgentSession } from '../components/AgentMonitor/types';
import { useAgentEventsContext } from '../contexts/AgentEventsContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompletionStatus = 'complete' | 'error';
export type SessionStatus = CompletionStatus | 'running';

export interface AgentCompletionIndicators {
  /** Projects with at least one unseen completion (error outranks complete). */
  statusByProject: Record<string, CompletionStatus>;
  /**
   * Per agent-session status:
   *   'running'  — agent is currently running (for Live chip)
   *   'complete' | 'error' — unseen completion
   *   (absent when seen or idle)
   */
  statusByClaudeSessionId: Record<string, SessionStatus>;
  /** Mark the project-level indicator as viewed (does NOT clear per-terminal dots). */
  markProjectViewed: (projectPath: string) => void;
  /** Mark a single agent session as viewed (does NOT clear the project dot). */
  markSessionViewed: (sessionId: string) => void;
}

// ─── Pure path helpers ────────────────────────────────────────────────────────

/** Normalize a path: backslash → slash, strip trailing slash, lowercase. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
}

/**
 * Return the normalized project path that best matches the given normalized cwd,
 * or null if no project matches. "Best" = longest match (most specific project).
 */
export function matchProjectForCwd(
  normalizedCwd: string,
  normalizedProjects: string[],
): string | null {
  let best: string | null = null;
  for (const proj of normalizedProjects) {
    const fits = normalizedCwd === proj || normalizedCwd.startsWith(proj + '/');
    if (fits && (best === null || proj.length > best.length)) {
      best = proj;
    }
  }
  return best;
}

// ─── Project-level status reducer ────────────────────────────────────────────

/**
 * Fold a new session status into an existing project status.
 * Error outranks complete; anything beats nothing.
 */
function reduceProjectStatus(
  current: CompletionStatus | undefined,
  incoming: CompletionStatus,
): CompletionStatus {
  if (current === 'error') return 'error';
  if (incoming === 'error') return 'error';
  return 'complete';
}

// ─── Pure derivation (exported for unit tests) ────────────────────────────────

export interface DerivedStatus {
  statusByProject: Record<string, CompletionStatus>;
  statusByClaudeSessionId: Record<string, SessionStatus>;
}

/**
 * Contribute one finished agent to the session-level indicator map.
 * Mutates `out` in place; skips if the completion is already seen.
 */
function applySessionIndicator(
  agent: AgentSession,
  lastSessionViewedAt: Record<string, number>,
  out: Record<string, SessionStatus>,
): void {
  const { id, status, completedAt } = agent;
  if (status !== 'complete' && status !== 'error') return;
  const sessionSeen = (completedAt ?? 0) <= (lastSessionViewedAt[id] ?? 0);
  if (!sessionSeen) {
    out[id] = status;
  }
}

interface ProjectLookup {
  projects: string[];
  normalizedProjects: string[];
  lastProjectViewedAt: Record<string, number>;
  sessionProjectMap: Record<string, string>;
}

/**
 * Contribute one finished agent to the project-level indicator map.
 * Mutates `out` in place; skips if no project association exists or already seen.
 *
 * Project association is resolved in priority order:
 *   1. lookup.sessionProjectMap[agent.id] — set by the terminal→session→projectRoot join
 *      (reliable for terminal-launched sessions that never set agent.cwd)
 *   2. agent.cwd — fallback for sessions that do carry a working directory
 */
function applyProjectIndicator(
  agent: AgentSession,
  lookup: ProjectLookup,
  out: Record<string, CompletionStatus>,
): void {
  const { id, status, cwd, completedAt } = agent;
  if (status !== 'complete' && status !== 'error') return;

  const rawPath = lookup.sessionProjectMap[id] ?? cwd;
  if (!rawPath) return;

  const normalizedPath = normalizePath(rawPath);
  const matchedProject = matchProjectForCwd(normalizedPath, lookup.normalizedProjects);
  if (matchedProject === null) return;

  const projectSeen = (completedAt ?? 0) <= (lookup.lastProjectViewedAt[matchedProject] ?? 0);
  if (projectSeen) return;

  const originalProject = lookup.projects[lookup.normalizedProjects.indexOf(matchedProject)];
  out[originalProject] = reduceProjectStatus(out[originalProject], status);
}

// ─── Args object for deriveCompletionStatus ───────────────────────────────────

export interface DeriveCompletionStatusArgs {
  /** Live agent sessions from the store. */
  agents: AgentSession[];
  /** List of project root paths (un-normalized). */
  projects: string[];
  /** Watermark keyed by normalized project path; stamped by markProjectViewed. */
  lastProjectViewedAt: Record<string, number>;
  /** Watermark keyed by sessionId; stamped by markSessionViewed. */
  lastSessionViewedAt: Record<string, number>;
  /**
   * Optional map of AgentSession.id → projectRoot, built from the
   * terminal→SessionRecord→projectRoot join. Takes priority over agent.cwd
   * when present, enabling the outer project dot to light for terminal-launched
   * sessions (which never set agent.cwd).
   */
  sessionProjectMap?: Record<string, string>;
}

/**
 * Pure derivation — no React, no side-effects.
 */
export function deriveCompletionStatus({
  agents,
  projects,
  lastProjectViewedAt,
  lastSessionViewedAt,
  sessionProjectMap = {},
}: DeriveCompletionStatusArgs): DerivedStatus {
  const lookup: ProjectLookup = {
    projects,
    normalizedProjects: projects.map(normalizePath),
    lastProjectViewedAt,
    sessionProjectMap,
  };
  const statusByClaudeSessionId: Record<string, SessionStatus> = {};
  const statusByProject: Record<string, CompletionStatus> = {};

  for (const agent of agents) {
    const { id, status } = agent;

    // Subagents (Task-tool child sessions) never represent "the agent finished":
    // the parent keeps working after a subagent's SubagentStop fires. A child's
    // completion must not light any indicator. Exclude all sessions with a parent.
    if (agent.parentSessionId) continue;

    if (status === 'running') {
      statusByClaudeSessionId[id] = 'running';
      continue;
    }

    if (status !== 'complete' && status !== 'error') continue;

    applySessionIndicator(agent, lastSessionViewedAt, statusByClaudeSessionId);
    applyProjectIndicator(agent, lookup, statusByProject);
  }

  return { statusByProject, statusByClaudeSessionId };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Mark callbacks — stamp a watermark ref and bump the version counter. */
function makeMarkCallback(
  ref: React.MutableRefObject<Record<string, number>>,
  key: string,
  bump: () => void,
): void {
  ref.current[key] = Date.now();
  bump();
}

export function useAgentCompletionIndicators(
  projects: string[],
  sessionProjectMap?: Record<string, string>,
): AgentCompletionIndicators {
  const { agents } = useAgentEventsContext();
  const lastProjectViewedAtRef = useRef<Record<string, number>>({});
  const lastSessionViewedAtRef = useRef<Record<string, number>>({});
  const [viewedVersion, setViewedVersion] = useState(0);
  const bump = useCallback(() => setViewedVersion((v) => v + 1), []);

  const markSessionViewed = useCallback(
    (sessionId: string) => makeMarkCallback(lastSessionViewedAtRef, sessionId, bump),
    [bump],
  );

  const markProjectViewed = useCallback(
    (projectPath: string) =>
      makeMarkCallback(lastProjectViewedAtRef, normalizePath(projectPath), bump),
    [bump],
  );

  const derived = useMemo(
    () =>
      deriveCompletionStatus({
        agents,
        projects,
        lastProjectViewedAt: lastProjectViewedAtRef.current,
        lastSessionViewedAt: lastSessionViewedAtRef.current,
        sessionProjectMap,
      }),
    // viewedVersion triggers re-derive after marks fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents, projects, sessionProjectMap, viewedVersion],
  );

  return {
    statusByProject: derived.statusByProject,
    statusByClaudeSessionId: derived.statusByClaudeSessionId,
    markProjectViewed,
    markSessionViewed,
  };
}
