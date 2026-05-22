/**
 * WorkbenchBell.test.tsx — Wave 7 Phase 3 behavioral tests.
 *
 * @vitest-environment jsdom
 *
 * Contracts:
 *   (a) Badge dot is ABSENT when unreadCount is 0.
 *   (b) Badge dot is PRESENT when useToastContext returns unreadCount > 0.
 *   (c) Clicking the bell opens NotificationCenter (sentinel asserts it renders).
 *   (d) onClose callback from NotificationCenter hides the panel.
 *   (e) markAllRead is called when the panel opens with unread items.
 *
 * Mock boundary: useToastContext (the context the bell reads) and
 * NotificationCenter (the panel it renders). We do NOT mock WorkbenchBell itself.
 *
 * Mocks required by the TitleBar host (AgentGlobe → AgentEventsContext,
 * ProjectContext, useConfig, useGitBranch) are included for tests that render
 * <TitleBar /> to verify integration. WorkbenchBell-only tests avoid that overhead.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock boundaries ──────────────────────────────────────────────────────────

// Mock useToastContext — the data source WorkbenchBell reads.
vi.mock('../../../contexts/ToastContext', () => ({
  useToastContext: vi.fn(),
}));

// Mock NotificationCenter — the panel WorkbenchBell conditionally renders.
// Sentinel renders when open; calls onClose on click (mimics dismiss).
vi.mock('../../shared/NotificationCenter', () => ({
  NotificationCenter: ({
    onClose,
  }: {
    notifications: unknown[];
    onRemove: (id: string) => void;
    onClearAll: () => void;
    onClose: () => void;
    anchorRect: DOMRect | null;
  }) =>
    React.createElement('div', {
      'data-testid': 'notification-center-sentinel',
      onClick: onClose,
    }),
}));

// ── Mocks required when rendering TitleBar (for integration test) ────────────

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/projects/test',
    projectRoots: ['/projects/test'],
    projectName: 'test',
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
    config: { recentProjects: ['/projects/test'] },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'main' }),
}));

// ── Imports (after vi.mock calls) ────────────────────────────────────────────

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { useToastContext } from '../../../contexts/ToastContext';
import type { UseToastReturn } from '../../../hooks/useToast';
import { TitleBar } from './TitleBar';
import { WorkbenchBell } from './WorkbenchBell';

const mockedToast = vi.mocked(useToastContext);
const mockedAgentCtx = vi.mocked(useAgentEventsContext);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToastCtx(overrides: Partial<UseToastReturn> = {}): UseToastReturn {
  return {
    toasts: [],
    toast: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
    startProgress: vi.fn(),
    updateProgress: vi.fn(),
    completeProgress: vi.fn(),
    ...overrides,
  } as UseToastReturn;
}

beforeEach(() => {
  mockedToast.mockReturnValue(makeToastCtx());
  mockedAgentCtx.mockReturnValue({
    agents: [],
    activeCount: 0,
    currentSessions: [],
    historicalSessions: [],
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  } as unknown as ReturnType<typeof useAgentEventsContext>);
});

afterEach(() => {
  cleanup();
});

// ── (a)/(b) Badge presence ───────────────────────────────────────────────────

describe('WorkbenchBell — badge dot', () => {
  it('badge dot is absent when unreadCount is 0', () => {
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 0 }));
    render(<WorkbenchBell />);
    // The button's aria-label when no unread items
    const button = screen.getByRole('button', { name: 'Notifications' });
    expect(button).toBeDefined();
    // Badge dot carries data-testid="workbench-bell-dot"; absent when unread is 0.
    expect(screen.queryByTestId('workbench-bell-dot')).toBeNull();
  });

  it('badge dot is present when unreadCount is 1', () => {
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 1 }));
    render(<WorkbenchBell />);
    const button = screen.getByRole('button', { name: '1 unread notification' });
    expect(button).toBeDefined();
    expect(screen.getByTestId('workbench-bell-dot')).toBeDefined();
  });

  it('badge dot is present when unreadCount is 5', () => {
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 5 }));
    render(<WorkbenchBell />);
    const button = screen.getByRole('button', { name: '5 unread notifications' });
    expect(button).toBeDefined();
    expect(screen.getByTestId('workbench-bell-dot')).toBeDefined();
  });
});

// ── (c) Clicking the bell opens NotificationCenter ────────────────────────────

describe('WorkbenchBell — panel open / close', () => {
  it('NotificationCenter is NOT rendered before the bell is clicked', () => {
    render(<WorkbenchBell />);
    expect(screen.queryByTestId('notification-center-sentinel')).toBeNull();
  });

  it('clicking the bell opens NotificationCenter', () => {
    render(<WorkbenchBell />);
    const button = screen.getByRole('button', { name: 'Notifications' });
    act(() => {
      fireEvent.mouseDown(button);
    });
    expect(screen.getByTestId('notification-center-sentinel')).toBeDefined();
  });

  it('onClose from NotificationCenter hides the panel', () => {
    render(<WorkbenchBell />);
    const button = screen.getByRole('button', { name: 'Notifications' });
    act(() => {
      fireEvent.mouseDown(button);
    });
    const sentinel = screen.getByTestId('notification-center-sentinel');
    // Sentinel calls onClose on click
    act(() => {
      fireEvent.click(sentinel);
    });
    expect(screen.queryByTestId('notification-center-sentinel')).toBeNull();
  });

  it('clicking the bell a second time toggles the panel closed', () => {
    render(<WorkbenchBell />);
    const button = screen.getByRole('button', { name: 'Notifications' });
    act(() => {
      fireEvent.mouseDown(button);
    });
    expect(screen.getByTestId('notification-center-sentinel')).toBeDefined();
    act(() => {
      fireEvent.mouseDown(button);
    });
    expect(screen.queryByTestId('notification-center-sentinel')).toBeNull();
  });
});

// ── (e) markAllRead is called when panel opens with unread items ──────────────

describe('WorkbenchBell — markAllRead side-effect', () => {
  it('markAllRead is called when panel opens and unreadCount > 0', () => {
    const markAllRead = vi.fn();
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 3, markAllRead }));
    render(<WorkbenchBell />);
    const button = screen.getByRole('button', { name: '3 unread notifications' });
    act(() => {
      fireEvent.mouseDown(button);
    });
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('markAllRead is NOT called when panel opens with 0 unread items', () => {
    const markAllRead = vi.fn();
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 0, markAllRead }));
    render(<WorkbenchBell />);
    const button = screen.getByRole('button', { name: 'Notifications' });
    act(() => {
      fireEvent.mouseDown(button);
    });
    expect(markAllRead).not.toHaveBeenCalled();
  });
});

// ── Integration: TitleBar contains a live bell (no MOCK_PENDING_COUNT) ────────

describe('TitleBar + WorkbenchBell integration', () => {
  it('TitleBar renders a bell button with title "Notifications" when unread is 0', () => {
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 0 }));
    render(<TitleBar />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeDefined();
  });

  it('TitleBar renders a bell button with unread title when there are unread items', () => {
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 2 }));
    render(<TitleBar />);
    expect(screen.getByRole('button', { name: '2 unread notifications' })).toBeDefined();
  });

  it('clicking the bell in TitleBar opens the notification panel', () => {
    mockedToast.mockReturnValue(makeToastCtx({ unreadCount: 0 }));
    render(<TitleBar />);
    const button = screen.getByRole('button', { name: 'Notifications' });
    act(() => {
      fireEvent.mouseDown(button);
    });
    expect(screen.getByTestId('notification-center-sentinel')).toBeDefined();
  });
});
