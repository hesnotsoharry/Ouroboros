/**
 * Orchestrator-owned acceptance test — Wave 12 Phase 4 (TerminalShell addTab wiring).
 *
 * Expresses the contract for the "new tab" button in TerminalShell:
 *   1. Clicking the button in the upper frame (kind="cc") calls addTab({ kind: 'cc' }).
 *   2. Clicking the button in the lower frame (kind="shell") calls addTab({ kind: 'shell' }).
 *   3. The button is discoverable via data-testid="terminal-tabbar-new-{frame}",
 *      where frame is 'upper' for kind="cc" and 'lower' for kind="shell".
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 4
 * implementer implements TerminalShell against THIS test and MAY NOT modify it.
 * The test is RED at Phase 4 dispatch; it goes green only when TerminalShell
 * consumes useWorkbenchTabs and wires the new-tab button handler.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalShell } from './TerminalShell';

// ── Module mocks ──────────────────────────────────────────────────────────────

// useWorkbenchTabs — controlled per test via mockReturnValue in beforeEach.
const mockAddTab = vi.fn();
const mockCloseTab = vi.fn();
const mockRenameTab = vi.fn();
const mockSetActiveTab = vi.fn();

vi.mock('./useWorkbenchTabs', () => ({
  useWorkbenchTabs: vi.fn(),
}));

// TerminalInstance — xterm mounts crash jsdom; replace with a thin stub.
vi.mock('../../Terminal/TerminalInstance', () => ({
  TerminalInstance: ({ sessionId }: { sessionId: string }) => (
    <div data-testid={`terminal-instance-stub-${sessionId}`} />
  ),
}));

// ActiveWorkbenchFrame — TerminalShell calls setActiveFrame on mousedown.
vi.mock('../useActiveWorkbenchFrame', () => ({
  useActiveWorkbenchFrame: () => ({
    activeFrame: 'upper',
    setActiveFrame: vi.fn(),
  }),
}));

// ProjectContext — useWorkbenchTabs dependency via CenterPane; TerminalShell
// itself does not consume it directly, but keep it safe if the impl reaches for it.
vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/proj/test',
    projectRoots: ['/proj/test'],
    projectName: 'test',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => ({
    projectRoot: '/proj/test',
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { useWorkbenchTabs } from './useWorkbenchTabs';
const mockedUseWorkbenchTabs = vi.mocked(useWorkbenchTabs);

function makeMockHook(
  tabs: Array<{
    id: string;
    label: string;
    sessionId: string;
    kind: 'cc' | 'shell';
    createdAt: number;
  }>,
  activeTabId: string | null,
) {
  return {
    tabs,
    activeTabId,
    addTab: mockAddTab,
    closeTab: mockCloseTab,
    renameTab: mockRenameTab,
    setActiveTab: mockSetActiveTab,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockAddTab.mockClear();
  mockCloseTab.mockClear();
  mockRenameTab.mockClear();
  mockSetActiveTab.mockClear();

  // Default: single tab, upper frame.
  mockedUseWorkbenchTabs.mockReturnValue(
    makeMockHook([{ id: 't1', label: 'claude', sessionId: 's1', kind: 'cc', createdAt: 1 }], 't1'),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Wave 12 Phase 4 — TerminalShell addTab (upper frame, kind=cc)', () => {
  it('clicking the new-tab button calls addTab({ kind: "cc" }) for the upper frame', () => {
    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-test-1" isActive />);

    const btn = screen.getByTestId('terminal-tabbar-new-upper');
    fireEvent.click(btn);

    expect(mockAddTab).toHaveBeenCalledTimes(1);
    expect(mockAddTab).toHaveBeenCalledWith({ kind: 'cc' });
  });

  it('addTab is called exactly once per click — no double-fire', () => {
    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-test-1" isActive />);

    const btn = screen.getByTestId('terminal-tabbar-new-upper');
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(mockAddTab).toHaveBeenCalledTimes(2);
  });
});

describe('Wave 12 Phase 4 — TerminalShell addTab (lower frame, kind=shell)', () => {
  beforeEach(() => {
    mockedUseWorkbenchTabs.mockReturnValue(
      makeMockHook(
        [{ id: 's1', label: 'shell', sessionId: 'ws1', kind: 'shell', createdAt: 1 }],
        's1',
      ),
    );
  });

  it('clicking the new-tab button calls addTab({ kind: "shell" }) for the lower frame', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const btn = screen.getByTestId('terminal-tabbar-new-lower');
    fireEvent.click(btn);

    expect(mockAddTab).toHaveBeenCalledTimes(1);
    expect(mockAddTab).toHaveBeenCalledWith({ kind: 'shell' });
  });

  it('lower-frame new-tab button does NOT call addTab with kind=cc', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const btn = screen.getByTestId('terminal-tabbar-new-lower');
    fireEvent.click(btn);

    const call = mockAddTab.mock.calls[0][0] as { kind: string };
    expect(call.kind).toBe('shell');
    expect(call.kind).not.toBe('cc');
  });
});
