/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatWorkbenchUtilityDrawer } from './ChatWorkbenchUtilityDrawer';

let approvalRequests = [] as Array<{
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}>;
let currentSessions = [] as Array<{
  id: string;
  taskLabel: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  startedAt: number;
  completedAt?: number;
  error?: string;
  toolCalls: Array<{
    id: string;
    toolName: string;
    input: string;
    timestamp: number;
    status: 'pending' | 'success' | 'error';
    output?: string;
  }>;
  parentSessionId?: string;
  inputTokens: number;
  outputTokens: number;
}>;

vi.mock('../../../contexts/ApprovalContext', () => ({
  useApprovalContext: () => ({
    pendingCount: approvalRequests.length,
    requests: approvalRequests,
  }),
}));

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: () => ({
    currentSessions,
    historicalSessions: [],
    agents: currentSessions,
    activeCount: currentSessions.filter((session) => session.status === 'running').length,
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
  }),
}));

// useDiffReview is still consumed by WorkbenchApprovalPanel / WorkbenchTimelinePanel
// even though the review tab itself is removed from this drawer.
vi.mock('../../DiffReview/DiffReviewManager', () => ({
  useDiffReview: () => ({
    state: null,
    canRollback: false,
    acceptHunk: vi.fn(),
    rejectHunk: vi.fn(),
    acceptAllFile: vi.fn(),
    rejectAllFile: vi.fn(),
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    rollback: vi.fn(),
    closeReview: vi.fn(),
    confirmStaleOp: vi.fn(),
    dismissStaleOp: vi.fn(),
  }),
}));

vi.mock('../../AgentMonitor', () => ({
  AgentMonitorManager: () => <div data-testid="agent-monitor-manager" />,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  approvalRequests = [];
  currentSessions = [];
  window.electronAPI = {
    approval: {
      respond: vi.fn().mockResolvedValue({ success: true }),
      remember: vi.fn().mockResolvedValue({ success: true }),
    },
  } as typeof window.electronAPI;
});

describe('ChatWorkbenchUtilityDrawer', () => {
  it('renders timeline activity on the activity tab', () => {
    currentSessions = [
      {
        id: 'session-1',
        taskLabel: 'Primary',
        status: 'running',
        startedAt: 1_000,
        toolCalls: [
          {
            id: 'tool-1',
            toolName: 'Read',
            input: 'src/main.ts',
            timestamp: 2_000,
            status: 'success',
          },
        ],
        inputTokens: 0,
        outputTokens: 0,
      },
    ];

    render(
      <ChatWorkbenchUtilityDrawer activeTab="activity" onSelectTab={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByTestId('workbench-timeline-panel')).toBeTruthy();
    // Wave 82 — entries are nested in collapsed session groups; expand to reveal.
    const group = screen.getByTestId('timeline-session-group');
    fireEvent.click(group.querySelector('button')!);
    expect(screen.getByText('Read')).toBeTruthy();
  });

  it('switches across approvals and monitor tabs (Wave 95 — review tab removed)', () => {
    approvalRequests = [
      {
        requestId: 'req-1',
        toolName: 'Bash',
        toolInput: { command: 'npm test' },
        sessionId: 'session-1',
        timestamp: 3_000,
      },
    ];

    const onSelectTab = vi.fn();
    const { rerender } = render(
      <ChatWorkbenchUtilityDrawer
        activeTab="approvals"
        onSelectTab={onSelectTab}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('workbench-approval-panel')).toBeTruthy();

    // review tab must not exist in the drawer anymore
    expect(screen.queryByTestId('chat-workbench-utility-tab-review')).toBeNull();

    fireEvent.click(screen.getByTestId('chat-workbench-utility-tab-monitor'));
    expect(onSelectTab).toHaveBeenCalledWith('monitor');

    rerender(
      <ChatWorkbenchUtilityDrawer
        activeTab="monitor"
        onSelectTab={onSelectTab}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('agent-monitor-manager')).toBeTruthy();
  });

  it('renders AgentMonitorManager on the monitor tab', () => {
    render(
      <ChatWorkbenchUtilityDrawer activeTab="monitor" onSelectTab={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId('agent-monitor-manager')).toBeTruthy();
  });
});
