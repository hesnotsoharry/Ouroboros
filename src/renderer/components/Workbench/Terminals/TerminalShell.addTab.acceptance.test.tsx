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
import { useWorkbenchTabs } from './useWorkbenchTabs';
import { useWorkbenchTabsContext } from './WorkbenchTabsProvider';

// ── Module mocks ──────────────────────────────────────────────────────────────

// useWorkbenchTabsContext — TerminalShell calls this directly.
// useWorkbenchTabs — thin wrapper; still mocked for any indirect callers.
const mockAddTab = vi.fn();
const mockCloseTab = vi.fn();
const mockRenameTab = vi.fn();
const mockSetActiveTab = vi.fn();
const mockSpawnCcTab = vi.fn();

vi.mock('./WorkbenchTabsProvider', () => ({
  useWorkbenchTabsContext: vi.fn(),
}));

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

const mockedUseWorkbenchTabsContext = vi.mocked(useWorkbenchTabsContext);
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
  spawnedTabIds: ReadonlySet<string> = new Set(tabs.map((t) => t.id)),
) {
  return {
    tabs,
    activeTabId,
    addTab: mockAddTab,
    closeTab: mockCloseTab,
    renameTab: mockRenameTab,
    setActiveTab: mockSetActiveTab,
    spawnedTabIds,
    spawnCcTab: mockSpawnCcTab,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockAddTab.mockClear();
  mockCloseTab.mockClear();
  mockRenameTab.mockClear();
  mockSetActiveTab.mockClear();
  mockSpawnCcTab.mockClear();

  // Default: single tab, upper frame.
  const defaultHook = makeMockHook(
    [{ id: 't1', label: 'claude', sessionId: 's1', kind: 'cc', createdAt: 1 }],
    't1',
  );
  // TerminalShell calls useWorkbenchTabsContext directly; useWorkbenchTabs kept for compat.
  mockedUseWorkbenchTabsContext.mockReturnValue(defaultHook);
  mockedUseWorkbenchTabs.mockReturnValue(defaultHook);
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
    const lowerHook = makeMockHook(
      [{ id: 's1', label: 'shell', sessionId: 'ws1', kind: 'shell', createdAt: 1 }],
      's1',
    );
    mockedUseWorkbenchTabsContext.mockReturnValue(lowerHook);
    mockedUseWorkbenchTabs.mockReturnValue(lowerHook);
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

describe('Wave 101 — Start Claude gate (TerminalShell cc pane)', () => {
  it('renders "Start Claude" button when cc pane has an unspawned active tab', () => {
    // spawnedTabIds does NOT include 't1' → button shown.
    const hookVal = makeMockHook(
      [{ id: 't1', label: 'claude', sessionId: 's1', kind: 'cc', createdAt: 1 }],
      't1',
      new Set<string>(), // empty — tab not yet spawned
    );
    mockedUseWorkbenchTabsContext.mockReturnValue(hookVal);

    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-1" isActive />);

    expect(screen.getByTestId('start-claude-button')).toBeDefined();
    expect(screen.queryByTestId('terminal-instance-stub-s1')).toBeNull();
  });

  it('does NOT render "Start Claude" button when cc pane has a spawned active tab', () => {
    // spawnedTabIds includes 't1' → terminal shown.
    const hookVal = makeMockHook(
      [{ id: 't1', label: 'claude', sessionId: 's1', kind: 'cc', createdAt: 1 }],
      't1',
      new Set(['t1']), // already spawned
    );
    mockedUseWorkbenchTabsContext.mockReturnValue(hookVal);

    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-1" isActive />);

    expect(screen.queryByTestId('start-claude-button')).toBeNull();
    expect(screen.getByTestId('terminal-instance-stub-s1')).toBeDefined();
  });

  it('does NOT render "Start Claude" button for a shell pane (no gate for shell)', () => {
    const hookVal = makeMockHook(
      [{ id: 's1', label: 'shell', sessionId: 'ws1', kind: 'shell', createdAt: 1 }],
      's1',
      new Set<string>(), // empty — but shell ignores this
    );
    mockedUseWorkbenchTabsContext.mockReturnValue(hookVal);

    render(<TerminalShell kind="shell" flex={0.38} sessionId="wb-shell-1" isActive />);

    expect(screen.queryByTestId('start-claude-button')).toBeNull();
  });

  it('clicking "Start Claude" calls spawnCcTab with the active tab id', () => {
    const hookVal = makeMockHook(
      [{ id: 't1', label: 'claude', sessionId: 's1', kind: 'cc', createdAt: 1 }],
      't1',
      new Set<string>(),
    );
    mockedUseWorkbenchTabsContext.mockReturnValue(hookVal);

    render(<TerminalShell kind="cc" flex={0.62} sessionId="wb-cc-1" isActive />);

    const btn = screen.getByTestId('start-claude-button');
    fireEvent.click(btn);

    expect(mockSpawnCcTab).toHaveBeenCalledTimes(1);
    expect(mockSpawnCcTab).toHaveBeenCalledWith('t1');
  });
});
