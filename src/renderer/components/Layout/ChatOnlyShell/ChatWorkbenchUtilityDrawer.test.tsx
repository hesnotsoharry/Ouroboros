/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatWorkbenchUtilityDrawer } from './ChatWorkbenchUtilityDrawer';

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

// useDiffReview is still consumed by WorkbenchTimelinePanel.
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
  currentSessions = [];
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

  it('switches between activity and monitor tabs', () => {
    const onSelectTab = vi.fn();
    const { rerender } = render(
      <ChatWorkbenchUtilityDrawer
        activeTab="activity"
        onSelectTab={onSelectTab}
        onClose={vi.fn()}
      />,
    );
    // With no sessions, timeline renders the empty state (no workbench-timeline-panel testid)
    expect(screen.getByText('No timeline entries yet.')).toBeTruthy();

    // approvals tab must not exist in the drawer anymore
    expect(screen.queryByTestId('chat-workbench-utility-tab-approvals')).toBeNull();
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
