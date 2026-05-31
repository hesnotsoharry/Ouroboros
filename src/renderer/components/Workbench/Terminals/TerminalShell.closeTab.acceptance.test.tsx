/**
 * Orchestrator-owned acceptance test — Wave 12 Phase 4 (TerminalShell closeTab wiring).
 *
 * Expresses the contract for the per-tab close button in TerminalShell:
 *   1. Each tab renders a close button discoverable via
 *      data-testid="terminal-tab-close-{tabId}".
 *   2. Clicking the close button on a non-active tab calls closeTab(tabId).
 *   3. Clicking the close button on the active tab calls closeTab(activeTabId).
 *   4. The downstream pty kill / active-tab fallback is the hook's
 *      responsibility (Phase 3 territory); TerminalShell just calls closeTab.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 4
 * implementer implements TerminalShell against THIS test and MAY NOT modify it.
 * The test is RED at Phase 4 dispatch; it goes green when the per-tab close
 * button is wired to closeTab.
 *
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalShell } from './TerminalShell';
import { useWorkbenchTabs } from './useWorkbenchTabs';
import { useWorkbenchTabsContext } from './WorkbenchTabsProvider';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAddTab = vi.fn();
const mockCloseTab = vi.fn();
const mockRenameTab = vi.fn();
const mockSetActiveTab = vi.fn();

vi.mock('./WorkbenchTabsProvider', () => ({
  useWorkbenchTabsContext: vi.fn(),
}));

vi.mock('./useWorkbenchTabs', () => ({
  useWorkbenchTabs: vi.fn(),
}));

vi.mock('../../Terminal/TerminalInstance', () => ({
  TerminalInstance: ({ sessionId }: { sessionId: string }) => (
    <div data-testid={`terminal-instance-stub-${sessionId}`} />
  ),
}));

vi.mock('../useActiveWorkbenchFrame', () => ({
  useActiveWorkbenchFrame: () => ({
    activeFrame: 'upper',
    setActiveFrame: vi.fn(),
  }),
}));

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
  useProjectOptional: () => ({ projectRoot: '/proj/test' }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockedUseWorkbenchTabsContext = vi.mocked(useWorkbenchTabsContext);
const mockedUseWorkbenchTabs = vi.mocked(useWorkbenchTabs);

const TWO_TABS = [
  { id: 't1', label: 'one', sessionId: 's1', kind: 'cc' as const, createdAt: 1 },
  { id: 't2', label: 'two', sessionId: 's2', kind: 'cc' as const, createdAt: 2 },
];

function installHook(tabs: typeof TWO_TABS, activeTabId: string | null): void {
  const value = {
    tabs,
    activeTabId,
    addTab: mockAddTab,
    closeTab: mockCloseTab,
    renameTab: mockRenameTab,
    setActiveTab: mockSetActiveTab,
  };
  // TerminalShell calls useWorkbenchTabsContext directly; useWorkbenchTabs kept for compat.
  mockedUseWorkbenchTabsContext.mockReturnValue(value);
  mockedUseWorkbenchTabs.mockReturnValue(value);
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockAddTab.mockClear();
  mockCloseTab.mockClear();
  mockRenameTab.mockClear();
  mockSetActiveTab.mockClear();
  installHook(TWO_TABS, 't1');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Wave 12 Phase 4 — TerminalShell closeTab wiring', () => {
  it("close button on a non-active tab calls closeTab with that tab's id", () => {
    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-test-1" isActive />);

    // t1 is active; t2 is not active — clicking t2's close button.
    const closeBtn = screen.getByTestId('terminal-tab-close-t2');
    fireEvent.click(closeBtn);

    expect(mockCloseTab).toHaveBeenCalledTimes(1);
    expect(mockCloseTab).toHaveBeenCalledWith('t2');
  });

  it("close button on the active tab calls closeTab with the active tab's id", () => {
    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-test-1" isActive />);

    // t1 is the active tab.
    const closeBtn = screen.getByTestId('terminal-tab-close-t1');
    fireEvent.click(closeBtn);

    expect(mockCloseTab).toHaveBeenCalledTimes(1);
    expect(mockCloseTab).toHaveBeenCalledWith('t1');
  });

  it('closeTab is called exactly once per click — no double-fire', () => {
    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-test-1" isActive />);

    const closeBtn = screen.getByTestId('terminal-tab-close-t2');
    fireEvent.click(closeBtn);

    expect(mockCloseTab).toHaveBeenCalledTimes(1);
  });

  it('close buttons exist for all rendered tabs (both tabs discoverable)', () => {
    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-test-1" isActive />);

    // Both tabs must expose their close button in the DOM —
    // visibility may be CSS-gated (hover) but the element must exist.
    expect(screen.getByTestId('terminal-tab-close-t1')).toBeDefined();
    expect(screen.getByTestId('terminal-tab-close-t2')).toBeDefined();
  });

  it('closeTab is NOT called when clicking the tab label (not the close button)', () => {
    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-test-1" isActive />);

    // Click the tab itself, not its close sub-element.
    const tab = screen.getByTestId('terminal-tab-t2');
    fireEvent.click(tab);

    expect(mockCloseTab).not.toHaveBeenCalled();
  });

  it('closing a tab in the lower frame also works (shell frame)', () => {
    const shellTabs = [
      { id: 's1', label: 'dev', sessionId: 'ws1', kind: 'shell' as const, createdAt: 1 },
      { id: 's2', label: 'test', sessionId: 'ws2', kind: 'shell' as const, createdAt: 2 },
    ];
    installHook(shellTabs, 's1');

    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const closeBtn = screen.getByTestId('terminal-tab-close-s2');
    fireEvent.click(closeBtn);

    expect(mockCloseTab).toHaveBeenCalledTimes(1);
    expect(mockCloseTab).toHaveBeenCalledWith('s2');
  });
});
