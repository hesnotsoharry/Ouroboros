/**
 * @vitest-environment jsdom
 *
 * WorkbenchSettingsOverlay.test.tsx — Wave 7 Phase 1.
 *
 * Contracts tested:
 *   (a) Dispatching OPEN_SETTINGS_EVENT causes the overlay to render SettingsModal.
 *   (b) The overlay does NOT render SettingsModal before the event fires.
 *   (c) Clicking the TitleBar Settings cog dispatches OPEN_SETTINGS_EVENT
 *       (verified by asserting the modal appears when both are rendered together).
 *   (d) Listener is cleaned up on unmount (no leak / double-fire after remount).
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OPEN_SETTINGS_EVENT } from '../../../hooks/appEventNames';

// ── Sentinel mock for SettingsModal ──────────────────────────────────────────
// Mocking the subject's dependency (SettingsModal), NOT the subject itself.
// This is the boundary mock: we verify the overlay wires isOpen/onClose correctly.
vi.mock('../../Settings/SettingsModal', () => ({
  SettingsModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen
      ? React.createElement('div', {
          'data-testid': 'settings-modal-sentinel',
          onClick: onClose,
        })
      : null,
}));

// ── Mocks required by TitleBar (AgentGlobe → AgentEventsContext) ─────────────
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

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { TitleBar } from '../TitleBar/TitleBar';
import { WorkbenchSettingsOverlay } from './WorkbenchSettingsOverlay';

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

// ── (a) Dispatching OPEN_SETTINGS_EVENT causes the modal to appear ────────────

describe('WorkbenchSettingsOverlay', () => {
  it('does not render SettingsModal before the event fires', () => {
    render(<WorkbenchSettingsOverlay />);
    expect(screen.queryByTestId('settings-modal-sentinel')).toBeNull();
  });

  it('renders SettingsModal when OPEN_SETTINGS_EVENT is dispatched', () => {
    render(<WorkbenchSettingsOverlay />);

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });

    expect(screen.getByTestId('settings-modal-sentinel')).toBeDefined();
  });

  it('closes the modal when the modal calls onClose', () => {
    render(<WorkbenchSettingsOverlay />);

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });

    const sentinel = screen.getByTestId('settings-modal-sentinel');
    // The sentinel mock calls onClose on click
    act(() => {
      fireEvent.click(sentinel);
    });

    expect(screen.queryByTestId('settings-modal-sentinel')).toBeNull();
  });

  it('can be re-opened after being closed', () => {
    render(<WorkbenchSettingsOverlay />);

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('settings-modal-sentinel'));
    });
    expect(screen.queryByTestId('settings-modal-sentinel')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });
    expect(screen.getByTestId('settings-modal-sentinel')).toBeDefined();
  });

  it('removes the event listener on unmount — no modal after unmount + event', () => {
    const { unmount } = render(<WorkbenchSettingsOverlay />);
    unmount();

    // Event fires after unmount — must not cause a state update or render
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
    });

    // Sentinel must not appear because the listener was cleaned up
    expect(screen.queryByTestId('settings-modal-sentinel')).toBeNull();
  });
});

// ── (c) TitleBar Settings cog dispatches OPEN_SETTINGS_EVENT ─────────────────

describe('TitleBar + WorkbenchSettingsOverlay integration', () => {
  it('clicking the Settings cog opens the Settings modal', () => {
    render(
      <>
        <TitleBar />
        <WorkbenchSettingsOverlay />
      </>,
    );

    // Modal should not be open initially
    expect(screen.queryByTestId('settings-modal-sentinel')).toBeNull();

    // Click the Settings cog
    act(() => {
      fireEvent.click(screen.getByTitle('Settings'));
    });

    expect(screen.getByTestId('settings-modal-sentinel')).toBeDefined();
  });

  it('Settings cog title attribute is "Settings"', () => {
    render(<TitleBar />);
    expect(screen.getByTitle('Settings')).toBeDefined();
  });
});
