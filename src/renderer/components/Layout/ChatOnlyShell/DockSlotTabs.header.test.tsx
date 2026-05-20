/**
 * @vitest-environment jsdom
 *
 * DockSlotTabs.header.test.tsx — Wave 99 Phase 4
 *
 * Verifies that SlotTabsHeader:
 *  - renders a completion dot for a tab whose claudeSessionId has a status
 *  - calls markSessionViewed with the claudeSessionId when that tab is activated
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SlotHandle } from '../../../hooks/useProjectTerminals';
import type { TerminalSession } from '../../Terminal/TerminalTabs';

// ---------------------------------------------------------------------------
// Mock the context hook so SlotTabsHeader doesn't need the Provider
// ---------------------------------------------------------------------------

const mockMarkSessionViewed = vi.fn();
const mockStatusByClaudeSessionId: Record<string, 'complete' | 'error' | 'running'> = {};

vi.mock('./AgentCompletionIndicatorsContext', () => ({
  AgentCompletionIndicatorsProvider: ({ children }: { children: React.ReactNode }) => children,
  useAgentCompletionIndicatorsContext: () => ({
    statusByProject: {},
    statusByClaudeSessionId: mockStatusByClaudeSessionId,
    markProjectViewed: vi.fn(),
    markSessionViewed: mockMarkSessionViewed,
  }),
}));

import { SlotTabsHeader } from './DockSlotTabs.header';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Clear the shared status map between tests
  for (const key of Object.keys(mockStatusByClaudeSessionId)) {
    delete mockStatusByClaudeSessionId[key];
  }
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(id: string, claudeSessionId?: string): TerminalSession {
  return { id, title: `term-${id}`, status: 'running', claudeSessionId };
}

function makeSlotHandle(overrides: Partial<SlotHandle> = {}): SlotHandle {
  return {
    sessions: [],
    activeSessionId: null,
    setActiveSessionId: vi.fn(),
    recordingSessions: new Set(),
    spawnSession: vi.fn().mockResolvedValue(undefined),
    handleTerminalClose: vi.fn(),
    handleTerminalRestart: vi.fn().mockResolvedValue(undefined),
    handleTerminalTitleChange: vi.fn(),
    handleToggleRecording: vi.fn().mockResolvedValue(undefined),
    handleSplit: vi.fn().mockResolvedValue(undefined),
    handleCloseSplit: vi.fn(),
    handleTerminalReorder: vi.fn(),
    renameSession: vi.fn(),
    ...overrides,
  };
}

function renderHeader(terminal: SlotHandle) {
  render(
    <SlotTabsHeader
      slot="primary"
      terminal={terminal}
      collapsed={false}
      isRecording={false}
      onSpawn={vi.fn()}
      onToggleRecording={vi.fn()}
      onToggleCollapse={vi.fn()}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SlotTabsHeader — completion dot for tab with matching claudeSessionId', () => {
  it("renders a complete dot when the tab's claudeSessionId has status 'complete'", () => {
    const session = makeSession('t1', 'claude-abc');
    mockStatusByClaudeSessionId['claude-abc'] = 'complete';
    renderHeader(makeSlotHandle({ sessions: [session], activeSessionId: 't1' }));
    expect(screen.getByTestId('terminal-completion-dot-complete')).toBeTruthy();
  });

  it("renders an error dot when the tab's claudeSessionId has status 'error'", () => {
    const session = makeSession('t1', 'claude-abc');
    mockStatusByClaudeSessionId['claude-abc'] = 'error';
    renderHeader(makeSlotHandle({ sessions: [session], activeSessionId: 't1' }));
    expect(screen.getByTestId('terminal-completion-dot-error')).toBeTruthy();
  });

  it('renders no dot for a tab without claudeSessionId', () => {
    const session = makeSession('t1'); // no claudeSessionId
    mockStatusByClaudeSessionId['claude-abc'] = 'complete';
    renderHeader(makeSlotHandle({ sessions: [session], activeSessionId: 't1' }));
    expect(screen.queryByTestId('terminal-completion-dot-complete')).toBeNull();
  });
});

describe('SlotTabsHeader — activating a tab calls markSessionViewed with its claudeSessionId', () => {
  it('calls markSessionViewed(claudeSessionId) when a tab with a claudeSessionId is activated', () => {
    const session = makeSession('t1', 'claude-abc');
    mockStatusByClaudeSessionId['claude-abc'] = 'complete';
    const terminal = makeSlotHandle({ sessions: [session], activeSessionId: null });
    renderHeader(terminal);

    fireEvent.click(screen.getByTestId('dock-slot-tab-t1'));

    expect(mockMarkSessionViewed).toHaveBeenCalledWith('claude-abc');
    expect(mockMarkSessionViewed).toHaveBeenCalledTimes(1);
  });

  it('does NOT call markSessionViewed when the activated tab has no claudeSessionId', () => {
    const session = makeSession('t1'); // no claudeSessionId
    const terminal = makeSlotHandle({ sessions: [session], activeSessionId: null });
    renderHeader(terminal);

    fireEvent.click(screen.getByTestId('dock-slot-tab-t1'));

    expect(mockMarkSessionViewed).not.toHaveBeenCalled();
  });
});
