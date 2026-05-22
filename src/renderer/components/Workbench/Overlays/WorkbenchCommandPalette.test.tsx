/**
 * @vitest-environment jsdom
 *
 * WorkbenchCommandPalette.test.tsx — Wave 7 Phase 2.
 *
 * Contracts tested:
 *   (a) Dispatching 'agent-ide:command-palette' opens the palette
 *       (CommandPalette sentinel receives isOpen=true).
 *   (b) The palette is NOT open before the event fires.
 *   (c) The sentinel's onClose callback closes the palette (isOpen=false).
 *   (d) Clicking the TitleBar Ctrl-K pill dispatches 'agent-ide:command-palette'.
 *   (e) Clicking the Ctrl-K pill opens the palette when rendered with the overlay.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sentinel mock for CommandPalette ─────────────────────────────────────────
// Mock the boundary dependency (the component the overlay renders), not the
// overlay itself. The sentinel exposes isOpen via data-testid so we can assert
// without knowing the palette's internal DOM structure.
vi.mock('../../CommandPalette/CommandPalette', () => ({
  CommandPalette: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
    commands: unknown[];
    recentIds: string[];
    onExecute: (cmd: unknown) => Promise<void>;
  }) =>
    isOpen
      ? React.createElement('div', {
          'data-testid': 'command-palette-sentinel',
          onClick: onClose,
        })
      : null,
}));

// ── Mock useCommandRegistry to avoid electron-log + window.electronAPI deps ──
vi.mock('../../CommandPalette/useCommandRegistry', () => ({
  useCommandRegistry: () => ({
    commands: [],
    recentIds: [],
    execute: vi.fn(),
    registerCommand: vi.fn(),
    unregisterCommand: vi.fn(),
  }),
}));

// ── Mocks required by TitleBar (AgentGlobe → useWorkbenchAgentData → AgentEventsContext)
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

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { TitleBar } from '../TitleBar/TitleBar';
import { WorkbenchCommandPalette } from './WorkbenchCommandPalette';

const mockedAgentCtx = vi.mocked(useAgentEventsContext);

beforeEach(() => {
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

// ── (a) + (b) Dispatching the event opens the palette ────────────────────────

describe('WorkbenchCommandPalette', () => {
  it('does not render the palette before the event fires', () => {
    render(<WorkbenchCommandPalette />);
    expect(screen.queryByTestId('command-palette-sentinel')).toBeNull();
  });

  it("renders the palette when 'agent-ide:command-palette' is dispatched", () => {
    render(<WorkbenchCommandPalette />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });

    expect(screen.getByTestId('command-palette-sentinel')).toBeDefined();
  });

  // ── (c) onClose closes the palette ─────────────────────────────────────────

  it('closes the palette when the sentinel calls onClose', () => {
    render(<WorkbenchCommandPalette />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });

    const sentinel = screen.getByTestId('command-palette-sentinel');
    act(() => {
      fireEvent.click(sentinel);
    });

    expect(screen.queryByTestId('command-palette-sentinel')).toBeNull();
  });

  it('can be re-opened after being closed', () => {
    render(<WorkbenchCommandPalette />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('command-palette-sentinel'));
    });
    expect(screen.queryByTestId('command-palette-sentinel')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });
    expect(screen.getByTestId('command-palette-sentinel')).toBeDefined();
  });
});

// ── (d) TitleBar Ctrl-K pill dispatches the event ────────────────────────────

describe('TitleBar Ctrl-K pill', () => {
  it("clicking the Ctrl-K pill dispatches 'agent-ide:command-palette'", () => {
    render(<TitleBar />);

    const dispatched: string[] = [];
    const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatched.push((event as CustomEvent).type);
      return true;
    });

    act(() => {
      fireEvent.click(screen.getByTitle('Command palette'));
    });

    expect(dispatched).toContain('agent-ide:command-palette');
    spy.mockRestore();
  });

  it('Ctrl-K pill has title attribute "Command palette"', () => {
    render(<TitleBar />);
    expect(screen.getByTitle('Command palette')).toBeDefined();
  });
});

// ── (e) TitleBar + WorkbenchCommandPalette integration ───────────────────────

describe('TitleBar + WorkbenchCommandPalette integration', () => {
  it('clicking the Ctrl-K pill opens the command palette', () => {
    render(
      <>
        <TitleBar />
        <WorkbenchCommandPalette />
      </>,
    );

    expect(screen.queryByTestId('command-palette-sentinel')).toBeNull();

    act(() => {
      fireEvent.click(screen.getByTitle('Command palette'));
    });

    expect(screen.getByTestId('command-palette-sentinel')).toBeDefined();
  });
});
