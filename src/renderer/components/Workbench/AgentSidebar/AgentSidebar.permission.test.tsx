/**
 * @vitest-environment jsdom
 *
 * Wave 5 Phase 2 — AgentSidebar permission takeover render tests.
 *
 * Verifies:
 *   1. When a permission request is pending: AgentSidebar renders the
 *      permission-sidebar takeover instead of the now-block, and panels 2–5
 *      are wrapped at opacity 0.7 while the permission card stays at full
 *      opacity (not inside the dimmed wrapper).
 *   2. When no request is pending: now-block renders, permission-sidebar
 *      is absent, panels 2–5 wrapper is at opacity 1.
 *   3. Clicking permission-approve in the sidebar calls the context approve
 *      resolver exactly once.
 *   4. The sidebar variant renders the full-width-Approve layout (Approve
 *      button on its own row, above Always + Deny).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('../../../hooks/useClaudeCliSettings', () => ({
  useClaudeCliSettings: vi.fn(() => ({ enableTerminalDiffReview: false })),
}));

vi.mock('../../../contexts/ApprovalContext', () => ({
  useApprovalContext: vi.fn(),
}));

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { useApprovalContext } from '../../../contexts/ApprovalContext';
import type { AgentSession } from '../../AgentMonitor/types';
import { AgentSidebar } from './AgentSidebar';

const mockedAgentCtx = vi.mocked(useAgentEventsContext);
const mockedApprovalCtx = vi.mocked(useApprovalContext);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REQUEST = {
  requestId: 'req-p2',
  toolName: 'Bash',
  toolInput: { command: 'npm test' },
  sessionId: 'sess-p2',
  timestamp: Date.now() - 2_000,
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

function agentCtx() {
  return {
    agents: [] as AgentSession[],
    activeCount: 0,
    currentSessions: [],
    historicalSessions: [],
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  } as unknown as ReturnType<typeof useAgentEventsContext>;
}

function stubElectronApi(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    hooks: { onAgentEvent: vi.fn(() => () => {}), onToolCall: vi.fn(() => () => {}) },
    git: { diffReview: vi.fn().mockResolvedValue({ success: true, files: [] }) },
  };
}

beforeEach(() => {
  approve = vi.fn();
  reject = vi.fn();
  alwaysAllow = vi.fn();
  stubElectronApi();
  mockedAgentCtx.mockReturnValue(agentCtx());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

// ── Test: pending request — takeover + dim ─────────────────────────────────────

describe('AgentSidebar permission takeover — request pending', () => {
  beforeEach(() => {
    mockedApprovalCtx.mockReturnValue(approvalCtx([REQUEST]));
  });

  it('renders permission-sidebar and NOT now-block when a request is pending', () => {
    render(<AgentSidebar />);
    expect(screen.getByTestId('permission-sidebar')).toBeDefined();
    expect(screen.queryByTestId('now-block')).toBeNull();
  });

  it('dims the panels-2-5 wrapper to opacity 0.7 while a request is pending', () => {
    render(<AgentSidebar />);
    // The permission-sidebar is the NOW slot — NOT inside the dimmed wrapper.
    // The dimmed wrapper wraps panels 2–5 (ContextBlock, FilesTouched, LatestHunk,
    // HookTimeline). Find it by checking for the opacity style on the wrapper div
    // that is a sibling of the permission-sidebar root.
    const sidebar = screen.getByTestId('workbench-agentsidebar');
    const scrollContainer = sidebar.querySelector<HTMLElement>(
      '[style*="overflow-y: auto"], [style*="overflowY"]',
    );
    expect(scrollContainer).not.toBeNull();

    // The permission card is a direct child of the scroll container.
    const permCard = screen.getByTestId('permission-sidebar');
    expect(scrollContainer?.contains(permCard)).toBe(true);

    // The dim wrapper is the sibling div after the permission card.
    const dimWrapper = permCard.nextElementSibling as HTMLElement | null;
    expect(dimWrapper).not.toBeNull();
    expect(dimWrapper?.style.opacity).toBe('0.7');
  });

  it('permission card (NOW slot) is NOT inside the dimmed wrapper', () => {
    render(<AgentSidebar />);
    const permCard = screen.getByTestId('permission-sidebar');
    const dimWrapper = permCard.nextElementSibling as HTMLElement | null;
    // The permission card must not be a descendant of the dim wrapper.
    expect(dimWrapper?.contains(permCard)).toBe(false);
  });

  it('clicking permission-sidebar-approve calls approve(requestId) exactly once', () => {
    render(<AgentSidebar />);
    fireEvent.click(screen.getByTestId('permission-sidebar-approve'));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith('req-p2');
    expect(reject).not.toHaveBeenCalled();
  });

  it('sidebar variant: Approve button is in its own row above Always and Deny', () => {
    render(<AgentSidebar />);
    const approveBtn = screen.getByTestId('permission-sidebar-approve');
    const alwaysBtn = screen.getByTestId('permission-sidebar-always');
    const denyBtn = screen.getByTestId('permission-sidebar-deny');

    // Approve's parent should NOT be the same element as Always's parent
    // (Approve is on its own row; Always + Deny share a flex row beneath it).
    expect(approveBtn.parentElement).not.toBe(alwaysBtn.parentElement);
    // Always and Deny share the same row container.
    expect(alwaysBtn.parentElement).toBe(denyBtn.parentElement);
  });
});

// ── Test: no pending request — normal sidebar ──────────────────────────────────

describe('AgentSidebar permission takeover — no pending request', () => {
  beforeEach(() => {
    mockedApprovalCtx.mockReturnValue(approvalCtx([]));
  });

  it('renders now-block and does NOT render permission-sidebar', () => {
    render(<AgentSidebar />);
    expect(screen.getByTestId('now-block')).toBeDefined();
    expect(screen.queryByTestId('permission-sidebar')).toBeNull();
  });

  it('panels-2-5 wrapper has opacity 1 when no request is pending', () => {
    render(<AgentSidebar />);
    const nowBlock = screen.getByTestId('now-block');
    const dimWrapper = nowBlock.nextElementSibling as HTMLElement | null;
    expect(dimWrapper).not.toBeNull();
    // When not pending, opacity is 1 (either explicit or unset — not '0.7').
    expect(dimWrapper?.style.opacity).not.toBe('0.7');
  });
});
