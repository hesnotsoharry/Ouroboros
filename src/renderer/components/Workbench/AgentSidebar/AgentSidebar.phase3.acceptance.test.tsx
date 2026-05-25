/**
 * @vitest-environment jsdom
 *
 * Wave 4 Phase 3 — ORCHESTRATOR-OWNED ACCEPTANCE TEST (boundary phase).
 *
 * Per ~/.claude/rules/orchestrator-owned-acceptance-tests.md: this file is
 * authored by the orchestrator BEFORE the Phase 3 implementer is dispatched.
 * The implementer implements against it and MAY NOT modify this file. It
 * expresses the diff-review boundary contract from the consumer's perspective:
 *
 *   synthetic `diff_review_ready` event
 *     → window.electronAPI.hooks.onAgentEvent callback (subscription)
 *     → window.electronAPI.git.diffReview(root, snapshotHash, filePaths) fetch
 *     → FileDiff[] → MockDiffHunk
 *     → LatestHunk renders the hunk lines
 *     → FilesTouched rows show +N/−N badges from the same FileDiff
 *
 * Plus the two graceful-degrade paths (Wave 4 ADR D5, Cole-locked):
 *   - flag off  (enableTerminalDiffReview === false) → no fetch, empty hunk, no badges
 *   - no snapshot (diffReview returns files: [])      → empty hunk, no badges, no crash
 *
 * Contract markers the implementer must honour:
 *   - LatestHunk renders <… data-testid="latest-hunk-empty"> when there is no
 *     live hunk (placeholder); it must NOT fall back to the static mock hunk.
 *   - When a live hunk exists, LatestHunk renders the parsed line text (sign
 *     stripped) and NOT the empty placeholder.
 *   - FilesTouched badge text is "+<adds>" / "−<dels>" (U+2212 minus, matching
 *     FilesTouched.tsx) and is absent when no diff is available for the row.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Context + settings mocks ──────────────────────────────────────────────────

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(),
}));

vi.mock('../../../hooks/useClaudeCliSettings', () => ({
  useClaudeCliSettings: vi.fn(),
}));

// Wave 13 Phase 2.6: AgentSidebar derives paneId from useWorkbenchTabs.
// Mock useWorkbenchTabs directly to return a stable tab whose id matches
// SESSION.paneId so hasActiveSession = true and PanelStack renders.
// vi.mock factories are hoisted — use a literal string here; PANE_ID below
// must match this literal exactly.
vi.mock('../Terminals/useWorkbenchRestore', () => ({
  useWorkbenchRestore: vi.fn().mockReturnValue({
    isReady: false,
    upperCollection: undefined,
    lowerCollection: undefined,
  }),
}));

vi.mock('../Terminals/useWorkbenchSessionPersist', () => ({
  useWorkbenchSessionPersist: vi.fn(),
}));

vi.mock('../Terminals/useWorkbenchTabs', () => ({
  useWorkbenchTabs: vi.fn().mockReturnValue({
    tabs: [
      {
        id: 'wb-upper-cc-phase3-fixture',
        label: 'claude',
        sessionId: 'wb-upper-cc-phase3-fixture',
        kind: 'cc',
        createdAt: 0,
      },
    ],
    activeTabId: 'wb-upper-cc-phase3-fixture',
    addTab: vi.fn(),
    closeTab: vi.fn(),
    renameTab: vi.fn(),
    setActiveTab: vi.fn(),
  }),
}));

// Must match the literal in the vi.mock factory above (factory is hoisted, no variable access).
const PANE_ID = 'wb-upper-cc-phase3-fixture';

import { useAgentEventsContext } from '../../../contexts/AgentEventsContext';
import { useClaudeCliSettings } from '../../../hooks/useClaudeCliSettings';
import type { AgentSession, ConversationTurn, ToolCallEvent } from '../../AgentMonitor/types';
import { AgentSidebar } from './AgentSidebar';

const mockedAgentCtx = vi.mocked(useAgentEventsContext);
const mockedCliSettings = vi.mocked(useClaudeCliSettings);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TOUCHED_PATH = 'src/foo.ts';

function tc(toolName: string, input: string, status: ToolCallEvent['status']): ToolCallEvent {
  return { id: `tc-${toolName}-${input}`, toolName, input, timestamp: 1000, status };
}

const SESSION: AgentSession = {
  id: 's1',
  paneId: PANE_ID, // Wave 13 Phase 2.5: must match active tab id for hasActiveSession = true
  taskLabel: 'live diff session',
  status: 'running',
  startedAt: Date.now() - 30_000,
  toolCalls: [tc('Edit', TOUCHED_PATH, 'success')],
  inputTokens: 100,
  outputTokens: 50,
  conversationTurns: [] as ConversationTurn[],
};

/**
 * Renderer-side FileDiff (what window.electronAPI.git.diffReview resolves with —
 * see electron-git.d.ts FileDiff/DiffHunk). lines[] are raw unified-diff strings
 * with the +/-/space prefix intact. adds=2, dels=1.
 */
const ADD_LINE_A = 'const y = 3;';
const ADD_LINE_B = 'const z = 4;';
const DEL_LINE = 'const y = 2;';
const CTX_LINE = 'const x = 1;';

const FILE_DIFF = {
  filePath: '/repo/src/foo.ts',
  relativePath: TOUCHED_PATH,
  status: 'modified' as const,
  oldPath: undefined,
  hunks: [
    {
      header: '@@ -10,3 +10,4 @@',
      oldStart: 10,
      oldCount: 3,
      newStart: 10,
      newCount: 4,
      lines: [` ${CTX_LINE}`, `-${DEL_LINE}`, `+${ADD_LINE_A}`, `+${ADD_LINE_B}`, ` return x;`],
      rawPatch: '@@ -10,3 +10,4 @@\n',
    },
  ],
};

const READY_EVENT = {
  type: 'diff_review_ready' as const,
  sessionId: 's1',
  snapshotHash: 'abc123',
  projectRoot: '/repo',
  filePaths: [TOUCHED_PATH],
};

// ── electronAPI test double ─────────────────────────────────────────────────────

let capturedCallback: ((raw: unknown) => void) | undefined;
let diffReviewMock: ReturnType<typeof vi.fn>;
let onAgentEventMock: ReturnType<typeof vi.fn>;

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

function installElectronApi(): void {
  capturedCallback = undefined;
  diffReviewMock = vi.fn().mockResolvedValue({ success: true, files: [FILE_DIFF] });
  onAgentEventMock = vi.fn((cb: (raw: unknown) => void) => {
    capturedCallback = cb;
    return () => {
      capturedCallback = undefined;
    };
  });
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    hooks: { onAgentEvent: onAgentEventMock, onToolCall: vi.fn(() => () => {}) },
    git: { diffReview: diffReviewMock },
  };
}

/** Fire a synthetic event through the captured subscription callback. */
async function fireReady(event: unknown): Promise<void> {
  expect(capturedCallback, 'adapter must subscribe via electronAPI.hooks.onAgentEvent').toBeTypeOf(
    'function',
  );
  await act(async () => {
    capturedCallback?.(event);
    // allow the diffReview promise + state update to flush
    await Promise.resolve();
  });
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  installElectronApi();
  mockedAgentCtx.mockReturnValue(agentCtx([SESSION]));
  mockedCliSettings.mockReturnValue({ enableTerminalDiffReview: true } as unknown as ReturnType<
    typeof useClaudeCliSettings
  >);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

// ── Acceptance: happy path (flag on) ────────────────────────────────────────────

describe('Wave 4 Phase 3 — diff-review boundary (flag on)', () => {
  it('renders the latest hunk lines after a diff_review_ready event', async () => {
    render(<AgentSidebar />);
    await fireReady(READY_EVENT);

    // Adapter fetched the parsed diff via the existing IPC wrapper.
    expect(diffReviewMock).toHaveBeenCalledWith('/repo', 'abc123', [TOUCHED_PATH]);

    // LatestHunk shows the parsed added-line text (sign stripped by the parser).
    const hunk = await screen.findByTestId('latest-hunk');
    expect(hunk.textContent).toContain(ADD_LINE_A);
    expect(hunk.textContent).toContain(ADD_LINE_B);

    // ...and is no longer the empty placeholder.
    expect(screen.queryByTestId('latest-hunk-empty')).toBeNull();
  });

  it('enriches the FilesTouched row with +N/−N badges from the same FileDiff', async () => {
    render(<AgentSidebar />);
    await fireReady(READY_EVENT);

    await screen.findByTestId('latest-hunk');
    const filesTouched = screen.getByTestId('files-touched');
    // adds=2, dels=1 derived from the hunk's +/- line counts.
    expect(filesTouched.textContent).toContain('+2');
    expect(filesTouched.textContent).toContain('−1'); // "−1" (U+2212)
  });
});

// ── Acceptance: graceful degrade — flag off ─────────────────────────────────────

describe('Wave 4 Phase 3 — graceful degrade (enableTerminalDiffReview off)', () => {
  beforeEach(() => {
    mockedCliSettings.mockReturnValue({ enableTerminalDiffReview: false } as unknown as ReturnType<
      typeof useClaudeCliSettings
    >);
  });

  it('does not fetch and renders an empty placeholder hunk', async () => {
    render(<AgentSidebar />);
    await fireReady(READY_EVENT);

    expect(diffReviewMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('latest-hunk-empty')).toBeDefined();
    expect(screen.queryByText(ADD_LINE_A)).toBeNull();
  });

  it('leaves the FilesTouched list intact but badge-free', async () => {
    render(<AgentSidebar />);
    await fireReady(READY_EVENT);

    // The row still renders from toolCalls (Phase 2)…
    expect(screen.getAllByTestId('files-touched-row')).toHaveLength(1);
    // …but carries no diff badges.
    const filesTouched = screen.getByTestId('files-touched');
    expect(filesTouched.textContent).not.toContain('+2');
    expect(filesTouched.textContent).not.toContain('−1');
  });
});

// ── Acceptance: graceful degrade — no snapshot (TTL evicted / empty diff) ────────

describe('Wave 4 Phase 3 — graceful degrade (no snapshot / empty diff)', () => {
  beforeEach(() => {
    diffReviewMock.mockResolvedValue({ success: true, files: [] });
  });

  it('renders an empty placeholder hunk and badge-free list, no crash', async () => {
    render(<AgentSidebar />);
    await fireReady(READY_EVENT);

    expect(diffReviewMock).toHaveBeenCalledWith('/repo', 'abc123', [TOUCHED_PATH]);
    expect(screen.getByTestId('latest-hunk-empty')).toBeDefined();
    expect(screen.queryByText(ADD_LINE_A)).toBeNull();

    const filesTouched = screen.getByTestId('files-touched');
    expect(filesTouched.textContent).not.toContain('+2');
  });
});
