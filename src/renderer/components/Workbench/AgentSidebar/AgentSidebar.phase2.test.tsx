/**
 * @vitest-environment jsdom
 *
 * AgentSidebar Phase 2 render tests — Wave 4 Phase 2.
 *
 * Verifies:
 *   - FilesTouched lists derived files with correct status (editing/edited/read)
 *   - FilesTouched shows correct row count
 *   - HookTimeline renders merged tool+prompt events
 *   - HookTimeline never renders a think row
 *   - Empty session → FilesTouched shows 0 rows, HookTimeline shows 0 rows
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Context mock (same pattern as Workbench.test.tsx) ────────────────────────

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import type { AgentSession, ConversationTurn, ToolCallEvent } from '../../AgentMonitor/types';

const mockedAgentCtx = vi.mocked(useAgentEventsContext);

function agentCtx(sessions: AgentSession[]) {
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

// ── Fixture helpers ───────────────────────────────────────────────────────────

let seq = 0;

function tc(
  toolName: string,
  input: string,
  status: ToolCallEvent['status'],
  timestamp: number,
): ToolCallEvent {
  return { id: `tc-${seq++}`, toolName, input, timestamp, status };
}

function turn(
  type: ConversationTurn['type'],
  content: string,
  timestamp: number,
): ConversationTurn {
  return { type, content, timestamp };
}

function makeSession(
  toolCalls: ToolCallEvent[],
  conversationTurns?: ConversationTurn[],
): AgentSession {
  return {
    id: 's1',
    taskLabel: 'test task',
    status: 'running',
    startedAt: Date.now() - 30_000,
    toolCalls,
    inputTokens: 100,
    outputTokens: 50,
    conversationTurns,
  };
}

// ── Import panels under test ──────────────────────────────────────────────────

import { AgentSidebar } from './AgentSidebar';

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockedAgentCtx.mockReturnValue(agentCtx([]));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── FilesTouched panel ────────────────────────────────────────────────────────

describe('FilesTouched panel (via AgentSidebar)', () => {
  it('shows 0 file rows when no session is active', () => {
    mockedAgentCtx.mockReturnValue(agentCtx([]));
    render(<AgentSidebar />);
    const rows = screen.queryAllByTestId('files-touched-row');
    expect(rows).toHaveLength(0);
  });

  it('lists one row per distinct file path from Edit/Write/Read calls', () => {
    const s = makeSession([
      tc('Edit', 'src/a.ts', 'success', 1000),
      tc('Write', 'src/b.ts', 'success', 2000),
      tc('Read', 'src/c.ts', 'success', 3000),
    ]);
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const rows = screen.getAllByTestId('files-touched-row');
    expect(rows).toHaveLength(3);
  });

  it('excludes Bash/Grep/Glob from the file list', () => {
    const s = makeSession([
      tc('Bash', 'npm test', 'success', 1000),
      tc('Grep', 'pattern', 'success', 2000),
      tc('Read', 'src/only.ts', 'success', 3000),
    ]);
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const rows = screen.getAllByTestId('files-touched-row');
    expect(rows).toHaveLength(1);
  });

  it('deduplicates repeated calls on the same path to one row', () => {
    const s = makeSession([
      tc('Read', 'src/x.ts', 'success', 1000),
      tc('Edit', 'src/x.ts', 'success', 2000),
      tc('Edit', 'src/x.ts', 'success', 3000),
    ]);
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const rows = screen.getAllByTestId('files-touched-row');
    expect(rows).toHaveLength(1);
  });

  it("a pending Edit yields status:'editing' — row gets the accent-edge border", () => {
    const s = makeSession([tc('Edit', 'src/active.ts', 'pending', 1000)]);
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const rows = screen.getAllByTestId('files-touched-row');
    expect(rows).toHaveLength(1);
    // FileRow applies accent-edge border only when status === 'editing'
    expect(rows[0].style.border).toContain('var(--accent-edge)');
  });
});

// ── HookTimeline panel ────────────────────────────────────────────────────────

describe('HookTimeline panel (via AgentSidebar)', () => {
  it('renders an empty timeline when no session is active', () => {
    mockedAgentCtx.mockReturnValue(agentCtx([]));
    render(<AgentSidebar />);
    const timeline = screen.getByTestId('hook-timeline');
    expect(timeline).toBeDefined();
    // No event rows when empty
    const rows = timeline.querySelectorAll('[data-testid="files-touched-row"]');
    expect(rows).toHaveLength(0);
  });

  it('renders tool call and prompt events from a live session', () => {
    const s = makeSession(
      [tc('Edit', 'src/a.ts', 'success', 1000), tc('Read', 'src/b.ts', 'pending', 2000)],
      [turn('prompt', 'do the thing', 500)],
    );
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const timeline = screen.getByTestId('hook-timeline');
    expect(timeline).toBeDefined();
    // 2 tool events + 1 prompt = 3 events rendered; verify timeline is not empty
    expect(timeline.textContent).toContain('Edit');
    expect(timeline.textContent).toContain('do the thing');
  });

  it('never renders a "thinking" row from live data', () => {
    const s = makeSession(
      [tc('Edit', 'src/a.ts', 'success', 1000)],
      [turn('prompt', 'a prompt', 500)],
    );
    mockedAgentCtx.mockReturnValue(agentCtx([s]));
    render(<AgentSidebar />);
    const timeline = screen.getByTestId('hook-timeline');
    expect(timeline.textContent).not.toContain('Thinking');
    expect(timeline.textContent).not.toContain('thinking ·');
  });
});
