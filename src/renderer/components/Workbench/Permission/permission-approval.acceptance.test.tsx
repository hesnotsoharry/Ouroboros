/**
 * @vitest-environment jsdom
 *
 * Wave 5 Phase 1 — ORCHESTRATOR-OWNED ACCEPTANCE TEST.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md: this file is
 * authored by the orchestrator BEFORE the Phase 1 implementer is dispatched.
 * The implementer implements against it and MAY NOT modify this file. It
 * expresses the permission-card → approval-context contract from the
 * consumer's perspective:
 *
 *   a pending ApprovalRequest in useApprovalContext()
 *     → useWorkbenchApproval selects requests[0]
 *     → the canon §13 terminal overlay renders over the workbench
 *        showing the tool name + a concise command preview
 *     → Approve  → approve(requestId)                              (exactly once)
 *     → Always   → alwaysAllow(requestId, sessionId, toolName)     (exactly once)
 *     → Deny (N) → reject(requestId, …)                            (exactly once)
 *
 * Plus the two invariants the dual-presentation design must hold (ADR D2/D3):
 *   - single keyboard owner: a single 'y' keypress resolves EXACTLY ONCE even
 *     though (from Phase 2 on) both the terminal overlay AND the sidebar
 *     NOW-takeover are mounted. This test renders the full <Workbench/>, so it
 *     keeps biting in Phase 2 — a double-bound handler fires twice and fails.
 *   - no surface when idle: with no pending request, no overlay mounts.
 *
 * Contract markers the implementer MUST honour (testids + a window-level key map):
 *   - data-testid="permission-overlay"  — the terminal-overlay card root.
 *   - data-testid="permission-approve" / "permission-deny" / "permission-always"
 *     — the three action controls.
 *   - the overlay's text content includes the request's toolName AND the salient
 *     command/input it is asking to run (the user must see what they approve).
 *   - the Y / A / N / Esc shortcuts are a SINGLE window-bubbling keydown handler
 *     owned by the hook (D3) — NOT one per presentation.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Workbench sub-region mocks (mirrors Workbench.test.tsx — keeps the render
//    light: no xterm, no real IPC, no ProjectContext provider tree) ────────────

vi.mock('../../Terminal/TerminalInstance', () => ({
  TerminalInstance: ({ sessionId }: { sessionId: string }) =>
    React.createElement('div', { 'data-testid': `terminal-instance-${sessionId}` }),
}));

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/projects/agent-ide',
    projectRoots: ['/projects/agent-ide'],
    projectName: 'agent-ide',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => null,
}));

vi.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { recentProjects: ['/projects/agent-ide'] },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'feature/x' }),
}));

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToastContext: () => ({
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
  }),
}));

// Keep the Wave-4 diff subscription quiet so this test stays focused on approval.
vi.mock('../../../hooks/useClaudeCliSettings', () => ({
  useClaudeCliSettings: vi.fn(() => ({ enableTerminalDiffReview: false })),
}));

// The boundary this wave consumes. The implementer's useWorkbenchApproval calls
// useApprovalContext(); we stub the context value here.
vi.mock('../../../contexts/ApprovalContext', () => ({
  useApprovalContext: vi.fn(),
  ApprovalProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { useApprovalContext } from '../../../contexts/ApprovalContext';
import type { AgentSession } from '../../AgentMonitor/types';
import { Workbench } from '../Workbench';

const mockedAgentCtx = vi.mocked(useAgentEventsContext);
const mockedApprovalCtx = vi.mocked(useApprovalContext);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REQUEST = {
  requestId: 'req-1',
  toolName: 'Bash',
  toolInput: { command: 'rm -rf /tmp/scratch' },
  sessionId: 'sess-1',
  timestamp: Date.now() - 4_000,
} as const;

let approve: ReturnType<typeof vi.fn>;
let reject: ReturnType<typeof vi.fn>;
let alwaysAllow: ReturnType<typeof vi.fn>;

function approvalCtx(requests: Array<typeof REQUEST>) {
  return {
    pendingCount: requests.length,
    requests,
    approve,
    reject,
    alwaysAllow,
  } as unknown as ReturnType<typeof useApprovalContext>;
}

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

function stubPty(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    pty: {
      spawn: vi.fn().mockResolvedValue({ success: true }),
      kill: vi.fn().mockResolvedValue({ success: true }),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
      write: vi.fn().mockResolvedValue({ success: true }),
    },
    hooks: { onAgentEvent: vi.fn(() => () => {}), onToolCall: vi.fn(() => () => {}) },
    git: { diffReview: vi.fn().mockResolvedValue({ success: true, files: [] }) },
  };
}

beforeEach(() => {
  approve = vi.fn();
  reject = vi.fn();
  alwaysAllow = vi.fn();
  stubPty();
  mockedAgentCtx.mockReturnValue(agentCtx([]));
  mockedApprovalCtx.mockReturnValue(approvalCtx([REQUEST]));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

// ── Acceptance: the overlay surfaces the request ────────────────────────────────

describe('Wave 5 Phase 1 — permission terminal overlay (request pending)', () => {
  it('renders the overlay naming the tool and the command it wants to run', () => {
    render(<Workbench />);
    const overlay = screen.getByTestId('permission-overlay');
    expect(overlay.textContent).toContain('Bash');
    expect(overlay.textContent).toContain('rm -rf /tmp/scratch');
  });

  it('Approve resolves through approve(requestId) exactly once', () => {
    render(<Workbench />);
    fireEvent.click(screen.getByTestId('permission-approve'));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith('req-1');
    expect(reject).not.toHaveBeenCalled();
    expect(alwaysAllow).not.toHaveBeenCalled();
  });

  it('Always resolves through alwaysAllow(requestId, sessionId, toolName) exactly once', () => {
    render(<Workbench />);
    fireEvent.click(screen.getByTestId('permission-always'));
    expect(alwaysAllow).toHaveBeenCalledTimes(1);
    expect(alwaysAllow).toHaveBeenCalledWith('req-1', 'sess-1', 'Bash');
  });

  it('Deny click-path resolves through reject(requestId) exactly once (two-stage reason flow)', () => {
    render(<Workbench />);
    const deny = screen.getByTestId('permission-deny');
    // First click reveals the optional reason input (ADR D7); does NOT reject yet.
    fireEvent.click(deny);
    expect(reject).not.toHaveBeenCalled();
    // Second click (now "Confirm deny") commits the rejection.
    fireEvent.click(screen.getByTestId('permission-deny'));
    expect(reject).toHaveBeenCalledTimes(1);
    expect(reject.mock.calls[0][0]).toBe('req-1');
    expect(approve).not.toHaveBeenCalled();
  });
});

// ── Acceptance: single keyboard owner (D3) — guards Phase 1 AND Phase 2 ──────────

describe('Wave 5 — single keyboard owner (no double-fire)', () => {
  it("a single 'y' keypress approves exactly once even with both surfaces mounted", () => {
    render(<Workbench />);
    fireEvent.keyDown(document.body, { key: 'y' });
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith('req-1');
  });

  it("a single 'n' keypress rejects exactly once", () => {
    render(<Workbench />);
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(reject).toHaveBeenCalledTimes(1);
    expect(reject.mock.calls[0][0]).toBe('req-1');
  });

  it("a single 'a' keypress always-allows exactly once", () => {
    render(<Workbench />);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(alwaysAllow).toHaveBeenCalledTimes(1);
    expect(alwaysAllow).toHaveBeenCalledWith('req-1', 'sess-1', 'Bash');
  });
});

// ── Acceptance: no surface when idle ────────────────────────────────────────────

describe('Wave 5 — no pending request', () => {
  beforeEach(() => {
    mockedApprovalCtx.mockReturnValue(approvalCtx([]));
  });

  it('mounts no overlay and binds no resolver when the queue is empty', () => {
    render(<Workbench />);
    expect(screen.queryByTestId('permission-overlay')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'y' });
    expect(approve).not.toHaveBeenCalled();
  });
});
