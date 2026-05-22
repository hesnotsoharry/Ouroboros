/**
 * @vitest-environment jsdom
 *
 * Workbench.responsive.acceptance.test.tsx — Wave 6 Phase 3 ORCHESTRATOR-OWNED acceptance test.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FROZEN. The Phase 3 implementer MUST NOT modify this file. Per
 * ~/.claude/rules/orchestrator-owned-acceptance-tests.md, the orchestrator owns
 * the boundary contract; the implementation bends to fit it. Implement
 * useWorkbenchBreakpoint + the conditional shell render until this passes.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * THE CONTRACT (canon §16, ADR D1/D3 — HUD dropped, so three tiers):
 *   width ≥ 1760            → FULL    : ProjectRail + InnerRail mount; no UnifiedRail;
 *                                       agent sidebar 348px; Latest Hunk full (not collapsed)
 *   1440 ≤ width < 1760     → COMPACT : ProjectRail + InnerRail mount; no UnifiedRail;
 *                                       agent sidebar 300px; Latest Hunk collapsed to a
 *                                       one-line indicator (data-testid="latest-hunk-collapsed")
 *   width < 1440            → UNIFIED : UnifiedRail mounts; ProjectRail + InnerRail do NOT;
 *                                       (covers canon's 1180–1439 Unified AND the <1180 clamp —
 *                                        no floating HUD this wave, D3)
 *
 * The two tier boundaries are 1760 and 1440. (1180 is NOT a boundary in our 3-tier
 * system — below 1440 is uniformly Unified once the HUD is dropped.)
 *
 * The setViewport() helper below evaluates BOTH `min-width` and `max-width` media
 * queries against a width, so the implementer may phrase the breakpoint hook's
 * matchMedia queries either way — the contract is the tier behavior, not the query string.
 *
 * jsdom has no layout engine: this asserts WHICH components mount + their declared
 * inline width, NOT visual fit. "Permission card un-clipped at 300px" and the live
 * drag-resize feel are smoke-gate concerns (/ui-smoke 6), not unit-testable here.
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock harness (mirrors Workbench.test.tsx) ────────────────────────────────
vi.mock('../Terminal/TerminalInstance', () => ({
  TerminalInstance: ({ sessionId }: { sessionId: string }) =>
    React.createElement('div', { 'data-testid': `terminal-instance-${sessionId}` }),
}));
vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/projects/agent-ide',
    projectRoots: ['/projects/agent-ide'],
    projectName: 'agent-ide',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
  }),
  useProjectOptional: () => null,
}));
vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { recentProjects: ['/projects/agent-ide', '/projects/pinpoint'] },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));
vi.mock('../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'feature/x' }),
}));
vi.mock('../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

import { useAgentEventsContext } from '../../contexts/AgentEventsContext';
import type { AgentSession } from '../AgentMonitor/types';
import { Workbench } from './Workbench';

const mockedAgentCtx = vi.mocked(useAgentEventsContext);

function agentCtx(sessions: AgentSession[]) {
  const isLive = (s: AgentSession) => s.status === 'running' || s.status === 'idle';
  return {
    agents: sessions,
    activeCount: sessions.filter((s) => s.status === 'running').length,
    currentSessions: sessions.filter(isLive),
    historicalSessions: sessions.filter((s) => s.status === 'complete' || s.status === 'error'),
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  } as unknown as ReturnType<typeof useAgentEventsContext>;
}

function stubPty(): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    ...(window as unknown as { electronAPI: Record<string, unknown> }).electronAPI,
    pty: {
      spawn: vi.fn().mockResolvedValue({ success: true }),
      kill: vi.fn().mockResolvedValue({ success: true }),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
      write: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

const realMatchMedia = window.matchMedia;

/** Install a matchMedia that evaluates min-width AND max-width queries against `width`. */
function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)/.exec(query);
    const min = /min-width:\s*(\d+)/.exec(query);
    let matches = false;
    if (max) matches = width <= Number(max[1]);
    if (min) matches = width >= Number(min[1]);
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  stubPty();
  mockedAgentCtx.mockReturnValue(agentCtx([]));
});

afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
});

describe('Wave 6 Phase 3 — responsive collapse contract (canon §16)', () => {
  it('FULL (≥1760): dual rails mount, no UnifiedRail, agent sidebar 348px, Latest Hunk not collapsed', () => {
    setViewport(1920);
    render(<Workbench />);

    expect(screen.getByTestId('workbench-projectrail')).toBeDefined();
    expect(screen.getByTestId('workbench-innerrail')).toBeDefined();
    expect(screen.queryByTestId('workbench-unifiedrail')).toBeNull();
    expect(screen.getByTestId('workbench-agentsidebar').style.width).toBe('348px');
    expect(screen.queryByTestId('latest-hunk-collapsed')).toBeNull();
  });

  it('COMPACT (1440–1759): dual rails mount, agent sidebar narrows to 300px, Latest Hunk collapses', () => {
    setViewport(1500);
    render(<Workbench />);

    expect(screen.getByTestId('workbench-projectrail')).toBeDefined();
    expect(screen.getByTestId('workbench-innerrail')).toBeDefined();
    expect(screen.queryByTestId('workbench-unifiedrail')).toBeNull();
    expect(screen.getByTestId('workbench-agentsidebar').style.width).toBe('300px');
    // The collapsed one-line indicator replaces the full/empty Latest Hunk panel.
    expect(screen.getByTestId('latest-hunk-collapsed')).toBeDefined();
    expect(screen.queryByTestId('latest-hunk')).toBeNull();
    expect(screen.queryByTestId('latest-hunk-empty')).toBeNull();
  });

  it('UNIFIED (1180–1439): UnifiedRail mounts, dual rails do NOT', () => {
    setViewport(1300);
    render(<Workbench />);

    expect(screen.getByTestId('workbench-unifiedrail')).toBeDefined();
    expect(screen.queryByTestId('workbench-projectrail')).toBeNull();
    expect(screen.queryByTestId('workbench-innerrail')).toBeNull();
  });

  it('CLAMP (<1180): still UNIFIED — no floating HUD this wave (D3)', () => {
    setViewport(900);
    render(<Workbench />);

    expect(screen.getByTestId('workbench-unifiedrail')).toBeDefined();
    expect(screen.queryByTestId('workbench-projectrail')).toBeNull();
  });

  it('mounted UnifiedRail shows live project/branch data, not MOCK_* placeholders', () => {
    setViewport(1300);
    render(<Workbench />);

    const unified = screen.getByTestId('workbench-unifiedrail');
    // The live branch comes from the mocked useGitBranch ('feature/x'); the canon
    // mockup's MOCK_BRANCH.name was 'main'. Seeing the live branch (and NOT a
    // hardcoded mock string) proves the rail was wired to live data when mounted.
    expect(unified.textContent).toContain('feature/x');
  });
});
