/**
 * Orchestrator-owned acceptance test — Wave 3 Phase 1 (hook→presentation boundary).
 *
 * Expresses the workbench live-agent contract from the CONSUMER's perspective:
 * the Agent Globe reflects real agent-event state, derived from `AgentEventsContext`,
 * NOT the static `workbenchMockData` constants and NOT a hardcoded `state` prop.
 * The implementer builds `useWorkbenchAgentData` + the derived `WorkbenchAgentState`
 * machine and rewires `AgentGlobe` against THIS test and MAY NOT modify it
 * (per ~/.claude/rules/orchestrator-owned-acceptance-tests.md).
 *
 * Phase 1 contract (the headline live slice — TitleBar Agent Globe):
 *   The Globe exposes the derived presentation state on the `agent-globe` element via
 *   a `data-state` attribute taking one of the six canon states:
 *     fresh | thinking | running | awaiting | errored | done
 *   Derivation (from the PRIMARY session — see selection rule below):
 *     - no session selected ............................. → "fresh"
 *     - status 'idle' (registered, not started) ......... → "fresh"
 *     - status 'running' + latest permissionEvent 'request' (takes precedence) → "awaiting"
 *     - status 'running' + a pending toolCall ........... → "running"
 *     - status 'running' + no pending toolCall .......... → "thinking"
 *     - status 'complete' ............................... → "done"
 *     - status 'error' .................................. → "errored"
 *   Primary-session selection (ADR D4): the session with the greatest "last activity"
 *   timestamp = max(completedAt, last toolCall timestamp, startedAt) across all sessions;
 *   null when there are no sessions.
 *   When running, the Globe renders the PRIMARY session's live model + active tool name —
 *   the static mock model string ('claude-sonnet-4-6') and mock tool data must be gone.
 *
 * No @testing-library/jest-dom matchers are configured in this repo (vitest.setup.ts
 * sets up vitest-axe + matchMedia only), so assertions use plain DOM + vitest core.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentSession,
  AgentStatus,
  PermissionEvent,
  ToolCallEvent,
} from '../../AgentMonitor/types';

// Control the agent-events source. The real `useWorkbenchAgentData` (to be built) consumes
// this; mocking the SOURCE keeps the derivation + Globe render path REAL (the boundary under test).
vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { AgentGlobe } from './AgentGlobe';

const mockedCtx = vi.mocked(useAgentEventsContext);

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeToolCall(
  partial: Partial<ToolCallEvent> & Pick<ToolCallEvent, 'toolName'>,
): ToolCallEvent {
  return {
    id: `tc-${Math.random().toString(36).slice(2)}`,
    toolName: partial.toolName,
    input: partial.input ?? '',
    timestamp: partial.timestamp ?? 1000,
    status: partial.status ?? 'success',
    ...partial,
  };
}

function makeSession(partial: Partial<AgentSession> & { status: AgentStatus }): AgentSession {
  return {
    id: partial.id ?? `s-${Math.random().toString(36).slice(2)}`,
    taskLabel: partial.taskLabel ?? 'task',
    status: partial.status,
    startedAt: partial.startedAt ?? 1000,
    toolCalls: partial.toolCalls ?? [],
    inputTokens: partial.inputTokens ?? 0,
    outputTokens: partial.outputTokens ?? 0,
    ...partial,
  };
}

/** Build a faithful context value from a flat session list (mirrors useAgentEvents' partitions). */
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

function renderGlobeWith(sessions: AgentSession[]): HTMLElement {
  mockedCtx.mockReturnValue(ctxFor(sessions));
  render(<AgentGlobe />);
  return screen.getByTestId('agent-globe');
}

const requestPerm: PermissionEvent = { type: 'request', timestamp: 2000, toolName: 'Bash' };

beforeEach(() => {
  mockedCtx.mockReset();
});

afterEach(() => {
  cleanup();
});

// ── Contract ─────────────────────────────────────────────────────────────────

describe('Wave 3 Phase 1 — Agent Globe live state (orchestrator-owned)', () => {
  it('no sessions → fresh', () => {
    const globe = renderGlobeWith([]);
    expect(globe.getAttribute('data-state')).toBe('fresh');
  });

  it('idle session (registered, not started) → fresh', () => {
    const globe = renderGlobeWith([makeSession({ status: 'idle' })]);
    expect(globe.getAttribute('data-state')).toBe('fresh');
  });

  it('running + pending tool call → running, showing the LIVE model + tool (not mock)', () => {
    const globe = renderGlobeWith([
      makeSession({
        status: 'running',
        model: 'claude-opus-4-7',
        toolCalls: [
          makeToolCall({ toolName: 'Bash', input: 'npm test', status: 'pending', timestamp: 1500 }),
        ],
      }),
    ]);
    expect(globe.getAttribute('data-state')).toBe('running');
    // Live values present, static mock values gone:
    expect(globe.textContent).toContain('claude-opus-4-7');
    expect(globe.textContent).toContain('Bash');
    expect(globe.textContent).not.toContain('claude-sonnet-4-6'); // MOCK_CONTEXT_STATS.model
  });

  it('running + no pending tool call → thinking (no turn-end signal, session still active)', () => {
    // A running session with no PENDING tool and no lastTurnEndedAt reads as 'thinking'.
    // 'ready' is reserved for the confirmed turn-end path (lastTurnEndedAt set).
    const globe = renderGlobeWith([
      makeSession({
        status: 'running',
        model: 'claude-opus-4-7',
        toolCalls: [makeToolCall({ toolName: 'Read', status: 'success', timestamp: 1200 })],
      }),
    ]);
    expect(globe.getAttribute('data-state')).toBe('thinking');
  });

  it('running + latest permission request → awaiting (precedence over a pending tool)', () => {
    const globe = renderGlobeWith([
      makeSession({
        status: 'running',
        model: 'claude-opus-4-7',
        toolCalls: [makeToolCall({ toolName: 'Bash', status: 'pending', timestamp: 1500 })],
        permissionEvents: [requestPerm],
      }),
    ]);
    expect(globe.getAttribute('data-state')).toBe('awaiting');
  });

  it('error session → errored', () => {
    const globe = renderGlobeWith([
      makeSession({ status: 'error', error: 'boom', completedAt: 3000, model: 'claude-opus-4-7' }),
    ]);
    expect(globe.getAttribute('data-state')).toBe('errored');
  });

  it('complete session → done', () => {
    const globe = renderGlobeWith([
      makeSession({ status: 'complete', completedAt: 3000, model: 'claude-opus-4-7' }),
    ]);
    expect(globe.getAttribute('data-state')).toBe('done');
  });

  it('two running sessions → primary is the most-recently-active one', () => {
    const older = makeSession({
      id: 'older',
      status: 'running',
      model: 'claude-haiku-4-5',
      startedAt: 1000,
      toolCalls: [makeToolCall({ toolName: 'Read', status: 'pending', timestamp: 1100 })],
    });
    const newer = makeSession({
      id: 'newer',
      status: 'running',
      model: 'claude-opus-4-7',
      startedAt: 1050,
      toolCalls: [makeToolCall({ toolName: 'Bash', status: 'pending', timestamp: 9999 })],
    });
    const globe = renderGlobeWith([older, newer]);
    expect(globe.getAttribute('data-state')).toBe('running');
    expect(globe.textContent).toContain('claude-opus-4-7'); // newer wins
    expect(globe.textContent).toContain('Bash');
    expect(globe.textContent).not.toContain('claude-haiku-4-5');
  });

  it('a running session outranks a more-recently-FINISHED one (D4 prefers live)', () => {
    // A completed session that finished "just now" must NOT win over a live running
    // session — the Globe should read 'running', not 'done'. Locks the two-tier rule.
    const finished = makeSession({
      id: 'finished',
      status: 'complete',
      model: 'claude-haiku-4-5',
      startedAt: 2000,
      completedAt: 99_999, // finished very recently — would win a naive max-activity sort
    });
    const live = makeSession({
      id: 'live',
      status: 'running',
      model: 'claude-opus-4-7',
      startedAt: 1000,
      toolCalls: [makeToolCall({ toolName: 'Bash', status: 'pending', timestamp: 5000 })],
    });
    const globe = renderGlobeWith([finished, live]);
    expect(globe.getAttribute('data-state')).toBe('running');
    expect(globe.textContent).toContain('claude-opus-4-7');
    expect(globe.textContent).not.toContain('claude-haiku-4-5');
  });
});
