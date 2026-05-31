/**
 * Orchestrator-owned acceptance test — Wave 12 Phase 4 (TerminalShell rename wiring).
 *
 * Expresses the contract for inline tab rename (ADR D3: double-click → uncontrolled
 * input → Enter/blur commits, Esc reverts, empty input reverts):
 *
 *   1. Double-clicking a tab replaces its label span with an <input>.
 *      The input is discoverable via data-testid="terminal-tab-rename-input-{tabId}"
 *      OR by role="textbox" inside the tab.
 *   2. Typing in the input and pressing Enter calls renameTab(id, newLabel).
 *   3. Pressing Esc cancels — renameTab is NOT called; label text is restored.
 *   4. Blur (focus lost) commits — renameTab(id, newLabel) is called.
 *   5. Empty input on Enter reverts — renameTab NOT called.
 *   6. Whitespace-only input on Enter reverts — renameTab NOT called.
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md the Phase 4
 * implementer implements TerminalShell against THIS test and MAY NOT modify it.
 * The test is RED at Phase 4 dispatch; it goes green when the double-click →
 * input → commit/cancel flow lands.
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

const SINGLE_TAB = [
  { id: 't1', label: 'build', sessionId: 's1', kind: 'shell' as const, createdAt: 1 },
];

function installHook(): void {
  const value = {
    tabs: SINGLE_TAB,
    activeTabId: 't1',
    addTab: mockAddTab,
    closeTab: mockCloseTab,
    renameTab: mockRenameTab,
    setActiveTab: mockSetActiveTab,
  };
  // TerminalShell calls useWorkbenchTabsContext directly; useWorkbenchTabs kept for compat.
  mockedUseWorkbenchTabsContext.mockReturnValue(value);
  mockedUseWorkbenchTabs.mockReturnValue(value);
}

/** Double-clicks the tab label and returns the rename input that appears. */
function doubleClickTab(testId: string): HTMLInputElement {
  const tab = screen.getByTestId(testId);
  fireEvent.doubleClick(tab);
  // After double-click the input replaces (or augments) the label — find it.
  const input =
    screen.queryByTestId(`terminal-tab-rename-input-t1`) ??
    (screen.queryByRole('textbox') as HTMLInputElement | null);
  if (!input) {
    throw new Error(
      `Expected a rename input to appear after double-clicking tab ${testId}, but none was found. ` +
        `Either data-testid="terminal-tab-rename-input-t1" or role="textbox" must be present.`,
    );
  }
  return input as HTMLInputElement;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockAddTab.mockClear();
  mockCloseTab.mockClear();
  mockRenameTab.mockClear();
  mockSetActiveTab.mockClear();
  installHook();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Wave 12 Phase 4 — TerminalShell rename: Enter commits', () => {
  it('double-click reveals a rename input; Enter commits the new label via renameTab', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const input = doubleClickTab('terminal-tab-t1');

    fireEvent.change(input, { target: { value: 'test:watch' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockRenameTab).toHaveBeenCalledTimes(1);
    expect(mockRenameTab).toHaveBeenCalledWith('t1', 'test:watch');
  });

  it('renameTab receives the exact typed string (not the original label)', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const input = doubleClickTab('terminal-tab-t1');
    fireEvent.change(input, { target: { value: 'npm run build' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const [, committedLabel] = mockRenameTab.mock.calls[0] as [string, string];
    expect(committedLabel).toBe('npm run build');
  });
});

describe('Wave 12 Phase 4 — TerminalShell rename: Esc cancels', () => {
  it('pressing Esc does NOT call renameTab', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const input = doubleClickTab('terminal-tab-t1');
    fireEvent.change(input, { target: { value: 'discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(mockRenameTab).not.toHaveBeenCalled();
  });

  it("after Esc the original label 'build' is still visible (no permanent mutation)", () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const input = doubleClickTab('terminal-tab-t1');
    fireEvent.change(input, { target: { value: 'discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // The original label must be present again in the DOM.
    // The tab's textContent may include the label plus close-button icon text;
    // use screen.getAllByText loosely to check the text node exists.
    const tab = screen.getByTestId('terminal-tab-t1');
    expect(tab.textContent).toContain('build');
  });
});

describe('Wave 12 Phase 4 — TerminalShell rename: blur commits', () => {
  it('blurring the input commits renameTab with the typed value', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const input = doubleClickTab('terminal-tab-t1');
    fireEvent.change(input, { target: { value: 'test:watch' } });
    fireEvent.blur(input);

    expect(mockRenameTab).toHaveBeenCalledTimes(1);
    expect(mockRenameTab).toHaveBeenCalledWith('t1', 'test:watch');
  });
});

describe('Wave 12 Phase 4 — TerminalShell rename: empty / whitespace-only input reverts', () => {
  it('clearing the input and pressing Enter does NOT call renameTab', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const input = doubleClickTab('terminal-tab-t1');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockRenameTab).not.toHaveBeenCalled();
  });

  it('whitespace-only input on Enter does NOT call renameTab', () => {
    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-test-1" isActive />);

    const input = doubleClickTab('terminal-tab-t1');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockRenameTab).not.toHaveBeenCalled();
  });
});
