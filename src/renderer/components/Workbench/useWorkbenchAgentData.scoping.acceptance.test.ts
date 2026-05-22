/**
 * Orchestrator-owned acceptance test — Wave 8 Phase 1 (session-identity scoping boundary).
 *
 * Locks the SCOPING contract of `useWorkbenchAgentData(claudeSessionId?)`: the canon
 * sidebar must reflect ONLY the Claude session bound to the active workbench terminal in
 * the active project — not whichever session is most-recently-active machine-wide. This is
 * the conceptual-risk + boundary piece of Phase 1 (session-identity matching across two
 * independent ID sources). The implementer extends `useWorkbenchAgentData` against THIS
 * test and MAY NOT modify it (per ~/.claude/rules/orchestrator-owned-acceptance-tests.md).
 *
 * Phase 1 scoping contract:
 *   `useWorkbenchAgentData(claudeSessionId?: string | null)`:
 *
 *   BOUND path (id supplied) — explicit binding wins; project filter does NOT apply:
 *     - primary = agents.find((s) => s.id === claudeSessionId)
 *       → NOT selectPrimarySession; the most-recently-active OTHER session is ignored.
 *     - contextStats reflect THAT session (usedTokens = its input + output), even if a
 *       newer/zero-token session exists.
 *     - a bound id whose cwd does NOT match the active project root is STILL returned
 *       (explicit binding overrides the project-cwd fallback filter).
 *     - a bound id that matches no session → primary null → zeroed contextStats (graceful).
 *
 *   FALLBACK path (no id) — pre-binding behavior, additionally project-scoped:
 *     - selection pool is filtered to sessions whose cwd matches the active project root
 *       (read from ProjectContext via the NON-throwing `useProjectOptional` so the hook is
 *       safe to render outside a provider — fallback then applies no cwd filter).
 *     - a more-recently-active session in a DIFFERENT project is excluded; the primary
 *       (and thus the active rail row + contextStats) comes from the active-project session.
 *     - with no active project root available (provider absent → null), no cwd filter is
 *       applied — preserves the pre-Wave-8 fallback so existing tests that don't mock
 *       ProjectContext keep their behavior.
 *
 * The frozen Wave-3 sessions test (`…sessions.acceptance.test.ts`) still owns the
 * rail-mapping + non-scoped contextStats contract; this file is additive and owns scoping.
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

describe('Wave 8 Phase 1 — bound-id scoping (orchestrator-owned)', () => {
  it('binds to agents.find(id===X), not the most-recently-active session', () => {
    const data = dataFor(
      [
        makeSession({
          id: 'X',
          status: 'running',
          startedAt: 1000,
          cwd: ACTIVE_ROOT,
          inputTokens: 1000,
          outputTokens: 500,
        }),
        // Y is more recent — selectPrimarySession would pick it; binding must override.
        makeSession({
          id: 'Y',
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

  it('a bound id that matches no session → null primary → zeroed context stats', () => {
    const data = dataFor(
      [makeSession({ id: 'real', status: 'running', cwd: ACTIVE_ROOT, inputTokens: 42 })],
      'ghost',
    );
    expect(data.sessions.some((s) => s.active)).toBe(false);
    expect(data.contextStats.usedTokens).toBe(0);
  });
});

describe('Wave 8 Phase 1 — fallback project scoping (orchestrator-owned)', () => {
  it('with no id, excludes a more-recent session from a DIFFERENT project', () => {
    const data = dataFor([
      // Active-project session — older.
      makeSession({
        id: 'in-project',
        status: 'running',
        startedAt: 1000,
        cwd: ACTIVE_ROOT,
        inputTokens: 200,
        outputTokens: 100,
      }),
      // Other-project session — more recent; must NOT become primary.
      makeSession({
        id: 'cross-project',
        status: 'running',
        startedAt: 9000,
        cwd: OTHER_ROOT,
        inputTokens: 999,
        outputTokens: 999,
      }),
    ]);
    const active = data.sessions.filter((s) => s.active).map((s) => s.id);
    expect(active).toEqual(['in-project']);
    expect(data.contextStats.usedTokens).toBe(300); // in-project, not cross-project's 1998
  });

  it('with no active project root (provider absent), applies no cwd filter (pre-Wave-8 behavior)', () => {
    setActiveRoot(null);
    const data = dataFor([
      makeSession({
        id: 'older',
        status: 'running',
        startedAt: 1000,
        cwd: ACTIVE_ROOT,
        inputTokens: 10,
      }),
      // Most-recently-active wins when no project scoping is available.
      makeSession({
        id: 'newer',
        status: 'running',
        startedAt: 9000,
        cwd: OTHER_ROOT,
        inputTokens: 50,
        outputTokens: 7,
      }),
    ]);
    const active = data.sessions.filter((s) => s.active).map((s) => s.id);
    expect(active).toEqual(['newer']);
    expect(data.contextStats.usedTokens).toBe(57);
  });
});
