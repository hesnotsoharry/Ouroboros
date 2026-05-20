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
}

/**
 * Contribute one finished agent to the project-level indicator map.
 * Mutates `out` in place; skips if cwd is absent, no project matches, or already seen.
 */
function applyProjectIndicator(
  agent: AgentSession,
  lookup: ProjectLookup,
  lastProjectViewedAt: Record<string, number>,
  out: Record<string, CompletionStatus>,
): void {
  const { status, cwd, completedAt } = agent;
  if (!cwd || (status !== 'complete' && status !== 'error')) return;

  const normalizedCwd = normalizePath(cwd);
  const matchedProject = matchProjectForCwd(normalizedCwd, lookup.normalizedProjects);
  if (matchedProject === null) return;

  const projectSeen = (completedAt ?? 0) <= (lastProjectViewedAt[matchedProject] ?? 0);
  if (projectSeen) return;

  const originalProject = lookup.projects[lookup.normalizedProjects.indexOf(matchedProject)];
  out[originalProject] = reduceProjectStatus(out[originalProject], status);
}

/**
 * Pure derivation — no React, no side-effects.
 *
 * @param agents              Live agent sessions from the store.
 * @param projects            List of project root paths (un-normalized).
 * @param lastProjectViewedAt Watermark keyed by normalized project path; stamped by markProjectViewed.
 * @param lastSessionViewedAt Watermark keyed by sessionId; stamped by markSessionViewed.
 */
export function deriveCompletionStatus(
  agents: AgentSession[],
  projects: string[],
  lastProjectViewedAt: Record<string, number>,
  lastSessionViewedAt: Record<string, number>,
): DerivedStatus {
  const lookup: ProjectLookup = {
    projects,
    normalizedProjects: projects.map(normalizePath),
  };
  const statusByClaudeSessionId: Record<string, SessionStatus> = {};
  const statusByProject: Record<string, CompletionStatus> = {};

  for (const agent of agents) {
    const { id, status } = agent;

    if (status === 'running') {
      statusByClaudeSessionId[id] = 'running';
      continue;
    }

    if (status !== 'complete' && status !== 'error') continue;

    applySessionIndicator(agent, lastSessionViewedAt, statusByClaudeSessionId);
    applyProjectIndicator(agent, lookup, lastProjectViewedAt, statusByProject);
  }

  return { statusByProject, statusByClaudeSessionId };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentCompletionIndicators(projects: string[]): AgentCompletionIndicators {
  const { agents } = useAgentEventsContext();

  // Two independent watermark refs + a shared version counter for re-derive trigger
  const lastProjectViewedAtRef = useRef<Record<string, number>>({});
  const lastSessionViewedAtRef = useRef<Record<string, number>>({});
  const [viewedVersion, setViewedVersion] = useState(0);
  const bump = useCallback(() => setViewedVersion((v) => v + 1), []);

  const markSessionViewed = useCallback(
    (sessionId: string) => {
      lastSessionViewedAtRef.current[sessionId] = Date.now();
      bump();
    },
    [bump],
  );

  const markProjectViewed = useCallback(
    (projectPath: string) => {
      lastProjectViewedAtRef.current[normalizePath(projectPath)] = Date.now();
      bump();
    },
    [bump],
  );

  const derived = useMemo(
    () =>
      deriveCompletionStatus(
        agents,
        projects,
        lastProjectViewedAtRef.current,
        lastSessionViewedAtRef.current,
      ),
    // viewedVersion triggers re-derive after marks fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents, projects, viewedVersion],
  );

  return {
    statusByProject: derived.statusByProject,
    statusByClaudeSessionId: derived.statusByClaudeSessionId,
    markProjectViewed,
    markSessionViewed,
  };
}
