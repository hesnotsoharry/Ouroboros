/**
 * Orchestrator-owned acceptance test — Wave 8 Phase 1 (session-identity scoping boundary).
 *
 * Locks the SCOPING contract of `useWorkbenchAgentData(paneId?)`: the canon
 * sidebar must reflect ONLY the Claude session bound to the active workbench terminal in
 * the active project — not whichever session is most-recently-active machine-wide. This is
 * the conceptual-risk + boundary piece of Phase 1 (session-identity matching across two
 * independent ID sources). The implementer extends `useWorkbenchAgentData` against THIS
 * test and MAY NOT modify it (per ~/.claude/rules/orchestrator-owned-acceptance-tests.md).
 *
 * Phase 1 scoping contract (updated Wave 13 Phase 2.5 — matches by session.paneId,
 * stamped from AGENT_START hook payload's OUROBOROS_PANE_ID):
 *   `useWorkbenchAgentData(paneId?: string | null)`:
 *
 *   BOUND path (paneId supplied) — explicit binding wins; project filter does NOT apply:
 *     - primary = agents.find((s) => s.paneId === paneId)
 *       → NOT selectPrimarySession; the most-recently-active OTHER session is ignored.
 *     - contextStats reflect THAT session (usedTokens = its input + output), even if a
 *       newer/zero-token session exists.
 *     - a bound paneId whose session cwd does NOT match the active project root is STILL
 *       returned (explicit binding overrides the project-cwd fallback filter).
 *     - a bound paneId that matches no session → primary null → zeroed contextStats (graceful).
 *
 *   FALLBACK path (no paneId, D4 Option A) — no fallback, always empty:
 *     - When no paneId is supplied, returns empty data shape regardless of session pool.
 *     - The heuristic project-cwd fallback path (Wave 8) is removed — it was the source
 *       of the hijack bug closed in Wave 13 (ADR D4, D5).
 *
 * The frozen Wave-3 sessions test (`…sessions.acceptance.test.ts`) still owns the
 * rail-mapping + non-scoped contextStats contract; this file is additive and owns scoping.
 *
 * Wave 13 Phase 2.5 update (orchestrator-sanctioned): bound-path describe block mock
 * sessions now include `paneId: 'X'` to align with the resolvePrimary filter change
 * (was session.id === paneId; now session.paneId === paneId). Assertions unchanged.
 *
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectContextValue } from '../../contexts/ProjectContext';
import type { AgentSession, AgentStatus } from '../AgentMonitor/types';

vi.mock('../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('../../contexts/ProjectContext', () => ({
  useProjectOptional: vi.fn(),
}));

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import { useProjectOptional } from '../../contexts/ProjectContext';
import { useWorkbenchAgentData } from './useWorkbenchAgentData';

const mockedCtx = vi.mocked(useAgentEventsContext);
const mockedProject = vi.mocked(useProjectOptional);

const ACTIVE_ROOT = '/projects/alpha';
const OTHER_ROOT = '/projects/beta';

function makeSession(p: Partial<AgentSession> & { status: AgentStatus; id: string }): AgentSession {
  return {
    taskLabel: p.taskLabel ?? 'task',
    startedAt: p.startedAt ?? 1000,
    toolCalls: p.toolCalls ?? [],
    inputTokens: p.inputTokens ?? 0,
    outputTokens: p.outputTokens ?? 0,
    ...p,
  };
}

function ctxFor(sessions: AgentSession[]) {
  const isLive = (s: AgentSession) => s.status === 'running' || s.status === 'idle';
  return {
    agents: sessions,
    activeCount: sessions.filter((s) => s.status === 'running').length,
    currentSessions: sessions.filter(isLive),
    historicalSessions: sessions.filter((s) => s.status === 'complete' || s.status === 'error'),
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  } as unknown as ReturnType<typeof useAgentEventsContext>;
}

/** Sets the active project root the fallback path scopes to (null → no provider). */
function setActiveRoot(root: string | null): void {
  mockedProject.mockReturnValue(
    root === null
      ? null
      : ({ projectRoot: root, projectRoots: [root] } as unknown as ProjectContextValue),
  );
}

function dataFor(sessions: AgentSession[], claudeSessionId?: string | null) {
  mockedCtx.mockReturnValue(ctxFor(sessions));
  return renderHook(() => useWorkbenchAgentData(claudeSessionId)).result.current;
}

beforeEach(() => {
  mockedCtx.mockReset();
  mockedProject.mockReset();
  setActiveRoot(ACTIVE_ROOT);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Wave 8 Phase 1 — bound-paneId scoping (orchestrator-owned)', () => {
  // Wave 13 Phase 2.5 update: resolvePrimary now matches by session.paneId === paneId
  // (stamped from AGENT_START hook payload's OUROBOROS_PANE_ID). Mock sessions include
  // paneId: 'X' to satisfy the new contract. Assertions are unchanged.

  it('binds to agents.find(paneId===X), not the most-recently-active session', () => {
    const data = dataFor(
      [
        makeSession({
          id: 'X',
          paneId: 'X',
          status: 'running',
          startedAt: 1000,
          cwd: ACTIVE_ROOT,
          inputTokens: 1000,
          outputTokens: 500,
        }),
        // Y is more recent — selectPrimarySession would pick it; binding must override.
        makeSession({
          id: 'Y',
          paneId: 'Y',
          status: 'running',
          startedAt: 9000,
          cwd: ACTIVE_ROOT,
          inputTokens: 0,
          outputTokens: 0,
        }),
      ],
      'X',
    );
    const active = data.sessions.filter((s) => s.active).map((s) => s.id);
    expect(active).toEqual(['X']);
    expect(data.contextStats.usedTokens).toBe(1500); // X's tokens, not Y's 0
  });

  it('returns the bound session even when its cwd does NOT match the active project root', () => {
    // Explicit binding overrides the project-cwd fallback filter.
    const data = dataFor(
      [
        makeSession({
          id: 'X',
          paneId: 'X',
          status: 'running',
          startedAt: 1000,
          cwd: OTHER_ROOT, // different project than ACTIVE_ROOT
          inputTokens: 700,
          outputTokens: 300,
        }),
      ],
      'X',
    );
    const active = data.sessions.filter((s) => s.active).map((s) => s.id);
    expect(active).toEqual(['X']);
    expect(data.contextStats.usedTokens).toBe(1000);
  });

  it('a bound paneId that matches no session → null primary → zeroed context stats', () => {
    // 'ghost' paneId matches nothing — 'real' session has paneId: 'real', not 'ghost'.
    const data = dataFor(
      [makeSession({ id: 'real', paneId: 'real', status: 'running', cwd: ACTIVE_ROOT, inputTokens: 42 })],
      'ghost',
    );
    expect(data.sessions.some((s) => s.active)).toBe(false);
    expect(data.contextStats.usedTokens).toBe(0);
  });
});

/**
 * Wave 13 Phase 2 — D4 Option A: no-paneId → D4 empty state (orchestrator-owned update).
 *
 * The fallback project-cwd filter (Wave 8 Phase 1) is removed by D4 Option A + D5.
 * When no paneId is supplied, useWorkbenchAgentData returns the empty data shape
 * regardless of what sessions exist in the pool. This eliminates the heuristic that
 * allowed external/IDE-in-itself sessions to hijack the sidebar via project-cwd matching.
 *
 * The old Wave 8 fallback-path tests are superseded by these D4 empty-state tests.
 */
describe('Wave 13 Phase 2 — D4 empty state when no paneId supplied (orchestrator-owned)', () => {
  it('with no paneId, returns empty state even when sessions exist for the active project', () => {
    // D4 Option A: no fallback — external sessions cannot hijack the sidebar.
    const data = dataFor([
      makeSession({
        id: 'in-project',
        status: 'running',
        startedAt: 1000,
        cwd: ACTIVE_ROOT,
        inputTokens: 200,
        outputTokens: 100,
      }),
    ]);
    // No session is active — primary is null → empty state.
    expect(data.sessions.some((s) => s.active)).toBe(false);
    expect(data.contextStats.usedTokens).toBe(0);
    expect(data.state).toBe('fresh');
  });

  it('with no paneId and no project root, returns empty state (no unfiltered fallback)', () => {
    setActiveRoot(null);
    const data = dataFor([
      makeSession({ id: 'any', status: 'running', startedAt: 9000, cwd: OTHER_ROOT }),
    ]);
    // D4 Option A: empty state regardless of available sessions.
    expect(data.sessions.some((s) => s.active)).toBe(false);
    expect(data.contextStats.usedTokens).toBe(0);
    expect(data.state).toBe('fresh');
  });
});
