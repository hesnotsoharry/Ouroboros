/**
 * @vitest-environment jsdom
 *
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 99 Phase 3.
 *
 * Expresses the consumer contract for the new AgentSession attention source
 * (ADR Decision 6): the workbench rail passes a precomputed
 * `agentStatusBySessionRecordId` (keyed by SessionRecord.id, already
 * unseen-filtered by useAgentCompletionIndicators) into useWorkbenchAttention,
 * and the attention layer maps it to the existing kinds — WITHOUT removing the
 * legacy chat-thread path.
 *
 * The implementer (Phase 3) implements against this file and MUST NOT modify it.
 * Mapping contract:
 *   agentStatus 'running'  -> kind 'live'             tone 'accent'
 *   agentStatus 'complete' -> kind 'completed-unseen' tone 'success'
 *   agentStatus 'error'    -> kind 'failed'           tone 'error'
 * Precedence: approval still outranks the agent path; the agent path outranks an
 * idle/empty chat thread; a session ABSENT from the map (seen or never-run) with
 * no thread is 'none' (clear-on-view is handled upstream by the Phase 1 hook
 * omitting seen sessions).
 *
 * The `as unknown as` cast lets this compile before the option exists on
 * UseWorkbenchAttentionOptions; once Phase 3 adds the field, the cast is
 * redundant but harmless. The hook reads the field off the runtime object.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
  AgentChatThreadRecord,
  ApprovalRequest,
  SessionRecord,
} from '../../../types/electron';
import { useWorkbenchAttention } from './useWorkbenchAttention';

type AgentRowStatus = 'running' | 'complete' | 'error';

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'sess-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-04-22T14:00:00.000Z',
    projectRoot: '/workspace/alpha',
    worktree: false,
    tags: [],
    activeTerminalIds: [],
    costRollup: { totalUsd: 0, inputTokens: 0, outputTokens: 0 },
    telemetry: { correlationIds: [], telemetrySessionId: 'sess-1' },
    ...overrides,
  };
}

function makeApproval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    requestId: 'approval-1',
    sessionId: 'sess-1',
    toolName: 'shell_command',
    toolInput: {},
    timestamp: 10,
    ...overrides,
  };
}

/** Build options carrying the (not-yet-typed) agent-source field. */
function withAgentStatus(
  sessions: SessionRecord[],
  agentStatusBySessionRecordId: Record<string, AgentRowStatus>,
  extra: Record<string, unknown> = {},
): Parameters<typeof useWorkbenchAttention>[0] {
  return {
    sessions,
    agentStatusBySessionRecordId,
    ...extra,
  } as unknown as Parameters<typeof useWorkbenchAttention>[0];
}

function renderAttention(opts: Parameters<typeof useWorkbenchAttention>[0]) {
  return renderHook(() => useWorkbenchAttention(opts)).result.current.sessionAttentionById;
}

describe('useWorkbenchAttention — AgentSession source (Wave 99 Phase 3 acceptance)', () => {
  it("maps agentStatus 'running' to the Live chip (revives Live for terminal sessions)", () => {
    const byId = renderAttention(withAgentStatus([makeSession()], { 'sess-1': 'running' }));
    expect(byId['sess-1']).toMatchObject({ kind: 'live', tone: 'accent' });
  });

  it("maps agentStatus 'complete' to completed-unseen with success tone", () => {
    const byId = renderAttention(withAgentStatus([makeSession()], { 'sess-1': 'complete' }));
    expect(byId['sess-1']).toMatchObject({
      kind: 'completed-unseen',
      tone: 'success',
      isSticky: true,
    });
  });

  it("maps agentStatus 'error' to failed with error tone", () => {
    const byId = renderAttention(withAgentStatus([makeSession()], { 'sess-1': 'error' }));
    expect(byId['sess-1']).toMatchObject({ kind: 'failed', tone: 'error' });
  });

  it('shows none for a session absent from the agent map and with no thread (clear-on-view upstream)', () => {
    const byId = renderAttention(
      withAgentStatus([makeSession({ id: 'sess-1' }), makeSession({ id: 'sess-2' })], {
        'sess-1': 'complete',
      }),
    );
    expect(byId['sess-2'].kind).toBe('none');
  });

  it('agent path outranks an idle/empty chat thread (no thread present)', () => {
    // No threads at all — the only signal is the agent status. Pre-Phase-3 this
    // returns 'none' (the dead chat-thread path), which is exactly the bug.
    const byId = renderAttention(withAgentStatus([makeSession()], { 'sess-1': 'complete' }));
    expect(byId['sess-1'].kind).not.toBe('none');
  });

  it('approval still outranks the agent path', () => {
    const byId = renderAttention(
      withAgentStatus(
        [makeSession()],
        { 'sess-1': 'running' },
        {
          approvalRequests: [makeApproval()] satisfies ApprovalRequest[],
        },
      ),
    );
    expect(byId['sess-1'].kind).toBe('approval');
  });

  it('does not regress the legacy chat-thread path when no agent status is supplied', () => {
    // Legacy callers pass threads only; behavior must be unchanged.
    const thread: AgentChatThreadRecord = {
      version: 1,
      id: 'thread-1',
      workspaceRoot: '/workspace/alpha',
      createdAt: 1,
      updatedAt: 10,
      title: 'Alpha',
      status: 'failed',
      messages: [],
      latestOrchestration: { sessionId: 'sess-1' },
    };
    const byId = renderHook(() =>
      useWorkbenchAttention({ sessions: [makeSession()], threads: [thread] }),
    ).result.current.sessionAttentionById;
    expect(byId['sess-1']).toMatchObject({ kind: 'failed', tone: 'error' });
  });
});
