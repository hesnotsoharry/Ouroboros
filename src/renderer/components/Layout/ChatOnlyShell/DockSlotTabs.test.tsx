/**
 * @vitest-environment jsdom
 *
 * DockSlotTabs.test.tsx — Wave 94 Phase C
 *
 * Verifies per-slot tab strip contract:
 *  - renders one tab per session
 *  - active tab is visually distinguished (aria-selected)
 *  - clicking a tab calls onActivate with correct id
 *  - clicking × calls onClose with correct id
 *  - clicking + New calls onSpawn
 *  - empty session list still renders + New button
 *  - rightControls slot renders supplied nodes
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TerminalSession } from '../../Terminal/TerminalTabs';
import { DockSlotTabs } from './DockSlotTabs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(id: string, title: string): TerminalSession {
  return { id, title, status: 'running' };
}

const SESSION_A = makeSession('a1', 'bash');
const SESSION_B = makeSession('b2', 'node');

function renderTabs(
  sessions: TerminalSession[],
  activeSessionId: string | null,
  overrides?: Partial<React.ComponentProps<typeof DockSlotTabs>>,
) {
  const onActivate = vi.fn();
  const onClose = vi.fn();
  const onSpawn = vi.fn();
  render(
    <DockSlotTabs
      slot="primary"
      sessions={sessions}
      activeSessionId={activeSessionId}
      onActivate={onActivate}
      onClose={onClose}
      onSpawn={onSpawn}
      {...overrides}
    />,
  );
  return { onActivate, onClose, onSpawn };
}

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tab rendering
// ---------------------------------------------------------------------------

describe('DockSlotTabs — renders one tab per session', () => {
  it('renders a tab button for each session', () => {
    renderTabs([SESSION_A, SESSION_B], null);
    expect(screen.getByTestId('dock-slot-tab-a1')).toBeTruthy();
    expect(screen.getByTestId('dock-slot-tab-b2')).toBeTruthy();
  });

  it('renders zero tabs when session list is empty', () => {
    renderTabs([], null);
    expect(screen.queryByRole('button', { name: /Tab:/ })).toBeNull();
  });

  it('renders session title text inside the tab', () => {
    renderTabs([SESSION_A], null);
    expect(screen.getByText('bash')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Active tab distinction
// ---------------------------------------------------------------------------

describe('DockSlotTabs — active tab is distinguished', () => {
  it('sets aria-selected=true on the active tab', () => {
    renderTabs([SESSION_A, SESSION_B], 'a1');
    const activeTab = screen.getByTestId('dock-slot-tab-a1');
    expect(activeTab.getAttribute('aria-selected')).toBe('true');
  });

  it('sets aria-selected=false on inactive tabs', () => {
    renderTabs([SESSION_A, SESSION_B], 'a1');
    const inactiveTab = screen.getByTestId('dock-slot-tab-b2');
    expect(inactiveTab.getAttribute('aria-selected')).toBe('false');
  });

  it('no tab is active when activeSessionId is null', () => {
    renderTabs([SESSION_A, SESSION_B], null);
    expect(screen.getByTestId('dock-slot-tab-a1').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByTestId('dock-slot-tab-b2').getAttribute('aria-selected')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// Tab interaction
// ---------------------------------------------------------------------------

describe('DockSlotTabs — clicking a tab calls onActivate with its id', () => {
  it('calls onActivate(id) when tab is clicked', () => {
    const { onActivate } = renderTabs([SESSION_A, SESSION_B], null);
    fireEvent.click(screen.getByTestId('dock-slot-tab-b2'));
    expect(onActivate).toHaveBeenCalledWith('b2');
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});

describe('DockSlotTabs — clicking × calls onClose with its id', () => {
  it('calls onClose(id) when the close button is clicked', () => {
    const { onClose, onActivate } = renderTabs([SESSION_A, SESSION_B], null);
    fireEvent.click(screen.getByTestId('dock-slot-tab-close-a1'));
    expect(onClose).toHaveBeenCalledWith('a1');
    expect(onClose).toHaveBeenCalledTimes(1);
    // Should not also trigger activate
    expect(onActivate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// + New button
// ---------------------------------------------------------------------------

describe('DockSlotTabs — + New button', () => {
  it('renders + New button when sessions exist', () => {
    renderTabs([SESSION_A], 'a1');
    expect(screen.getByTestId('dock-slot-primary-spawn')).toBeTruthy();
  });

  it('renders + New button when session list is empty', () => {
    renderTabs([], null);
    expect(screen.getByTestId('dock-slot-primary-spawn')).toBeTruthy();
  });

  it('calls onSpawn when + New is clicked', () => {
    const { onSpawn } = renderTabs([SESSION_A], null);
    fireEvent.click(screen.getByTestId('dock-slot-primary-spawn'));
    expect(onSpawn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// rightControls slot
// ---------------------------------------------------------------------------

describe('DockSlotTabs — rightControls renders supplied nodes', () => {
  it('renders rightControls content when provided', () => {
    renderTabs([SESSION_A], null, {
      rightControls: <button data-testid="custom-ctrl">▾</button>,
    });
    expect(screen.getByTestId('custom-ctrl')).toBeTruthy();
  });

  it('renders nothing for rightControls when omitted', () => {
    renderTabs([SESSION_A], null);
    expect(screen.queryByTestId('custom-ctrl')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Wave 95 Phase A — double-click rename
// ---------------------------------------------------------------------------

describe('DockSlotTabs — double-click rename (Wave 95)', () => {
  it('double-click tab title → input autofocus → Enter commits rename', () => {
    const onRename = vi.fn();

    render(
      <DockSlotTabs
        slot="primary"
        sessions={[SESSION_A]}
        activeSessionId="a1"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
        onRename={onRename}
      />,
    );

    // Find the tab title element (not in edit mode)
    const tabTitle = screen.getByTestId('dock-slot-tab-title-a1');
    expect(tabTitle.tagName).toBe('SPAN'); // Initially a span, not an input

    // Double-click to enter edit mode
    fireEvent.doubleClick(tabTitle);

    // Now the element should be an input
    const input = screen.getByTestId('dock-slot-tab-title-a1') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(document.activeElement).toBe(input);

    // Simulate typing new title
    fireEvent.change(input, { target: { value: 'My Terminal' } });

    // Simulate Enter key press
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Verify onRename was called with the new title
    expect(onRename).toHaveBeenCalledWith('a1', 'My Terminal');
  });

  it('double-click tab title → input autofocus → Escape cancels rename', () => {
    const onRename = vi.fn();

    render(
      <DockSlotTabs
        slot="primary"
        sessions={[SESSION_A]}
        activeSessionId="a1"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
        onRename={onRename}
      />,
    );

    // Find and double-click the tab title
    const tabTitle = screen.getByTestId('dock-slot-tab-title-a1');
    fireEvent.doubleClick(tabTitle);

    // Get the input and simulate typing a new title
    const input = screen.getByTestId('dock-slot-tab-title-a1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Title' } });

    // Simulate Escape key press
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    // Verify onRename was NOT called
    expect(onRename).not.toHaveBeenCalled();
  });

  it('double-click → type and blur commits the new title', () => {
    const onRename = vi.fn();

    render(
      <DockSlotTabs
        slot="primary"
        sessions={[SESSION_A]}
        activeSessionId="a1"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
        onRename={onRename}
      />,
    );

    // Double-click to edit
    const tabTitle = screen.getByTestId('dock-slot-tab-title-a1');
    fireEvent.doubleClick(tabTitle);

    // Simulate typing new title
    const input = screen.getByTestId('dock-slot-tab-title-a1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated' } });

    // Simulate blur (click outside)
    fireEvent.blur(input);

    // onRename should be called with the new title
    expect(onRename).toHaveBeenCalledWith('a1', 'Updated');
  });

  it('empty input after trim reverts to original title (no rename call)', () => {
    const onRename = vi.fn();

    render(
      <DockSlotTabs
        slot="primary"
        sessions={[SESSION_A]}
        activeSessionId="a1"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
        onRename={onRename}
      />,
    );

    // Double-click to edit
    const tabTitle = screen.getByTestId('dock-slot-tab-title-a1');
    fireEvent.doubleClick(tabTitle);

    // Clear the input completely (empty string)
    const input = screen.getByTestId('dock-slot-tab-title-a1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    // Simulate Enter key press
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // onRename should NOT be called because the trimmed input is empty
    expect(onRename).not.toHaveBeenCalled();
  });

  it('multiple tabs: double-click one tab does not affect others', () => {
    const onRename = vi.fn();

    render(
      <DockSlotTabs
        slot="primary"
        sessions={[SESSION_A, SESSION_B]}
        activeSessionId="a1"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onSpawn={vi.fn()}
        onRename={onRename}
      />,
    );

    // Double-click the first tab's title
    const tabTitle1 = screen.getByTestId('dock-slot-tab-title-a1');
    fireEvent.doubleClick(tabTitle1);

    // Verify second tab is still a span (not in edit mode)
    const tabTitle2 = screen.getByTestId('dock-slot-tab-title-b2');
    expect(tabTitle2.tagName).toBe('SPAN');

    // Complete the first tab's edit
    const input = screen.getByTestId('dock-slot-tab-title-a1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'First Tab' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Only the first tab should have triggered onRename
    expect(onRename).toHaveBeenCalledOnce();
    expect(onRename).toHaveBeenCalledWith('a1', 'First Tab');
  });
});

// ---------------------------------------------------------------------------
// Wave 99 Phase 4 — completion dot via statusByClaudeSessionId
// ---------------------------------------------------------------------------

function makeSessionWithClaude(
  id: string,
  title: string,
  claudeSessionId: string,
): TerminalSession {
  return { id, title, status: 'running', claudeSessionId };
}

describe('DockSlotTabs — completion dot renders for tab whose claudeSessionId has a status', () => {
  it("renders a complete dot when the tab's claudeSessionId maps to 'complete'", () => {
    const session = makeSessionWithClaude('t1', 'bash', 'claude-abc');
    renderTabs([session], 't1', {
      statusByClaudeSessionId: { 'claude-abc': 'complete' },
    });
    expect(screen.getByTestId('terminal-completion-dot-complete')).toBeTruthy();
  });

  it("renders an error dot when the tab's claudeSessionId maps to 'error'", () => {
    const session = makeSessionWithClaude('t1', 'bash', 'claude-abc');
    renderTabs([session], 't1', {
      statusByClaudeSessionId: { 'claude-abc': 'error' },
    });
    expect(screen.getByTestId('terminal-completion-dot-error')).toBeTruthy();
  });

  it('renders no dot when the tab has no claudeSessionId', () => {
    renderTabs([SESSION_A], 'a1', {
      statusByClaudeSessionId: { 'claude-abc': 'complete' },
    });
    expect(screen.queryByTestId('terminal-completion-dot-complete')).toBeNull();
    expect(screen.queryByTestId('terminal-completion-dot-error')).toBeNull();
  });

  it("renders no dot when the tab's claudeSessionId has no entry in statusByClaudeSessionId", () => {
    const session = makeSessionWithClaude('t1', 'bash', 'claude-xyz');
    renderTabs([session], 't1', {
      statusByClaudeSessionId: { 'claude-abc': 'complete' },
    });
    expect(screen.queryByTestId('terminal-completion-dot-complete')).toBeNull();
  });

  it("renders no dot when statusByClaudeSessionId maps the session to 'running'", () => {
    const session = makeSessionWithClaude('t1', 'bash', 'claude-abc');
    renderTabs([session], 't1', {
      statusByClaudeSessionId: { 'claude-abc': 'running' },
    });
    expect(screen.queryByTestId('terminal-completion-dot-complete')).toBeNull();
    expect(screen.queryByTestId('terminal-completion-dot-error')).toBeNull();
  });
});
