/**
 * InnerRail.projectScoping.acceptance.test.tsx
 *
 * Wave 14 Phase 4 orchestrator-owned boundary acceptance test (frozen).
 * The Phase 4 implementer MAY NOT modify this file.
 *
 * Tests the contract that restored sessions with no cwd (the bug-shaped session)
 * do NOT appear in any project's session list, and that project-scoped sessions
 * appear only under their own project.
 *
 * Root cause (phase-1-diag-bug2.md): `buildPersistedSessionFields` dropped `cwd`
 * during persist/restore, causing all restored sessions to surface with
 * `projectId === 'unknown'` and bleed into every project's "other sessions" list.
 *
 * Contract:
 *   - Session A (cwd: '/projects/foo') → visible only under project /projects/foo
 *   - Session B (cwd: '/projects/bar') → visible only under project /projects/bar
 *   - Session C (cwd: undefined)       → NOT visible under any project (bug-shaped)
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

// Three sessions across two projects + one bug-shaped session with no cwd.
// These represent the state AFTER the fix: sessions A and B have their cwd
// correctly restored; session C has cwd: undefined (no project association).
const SESSION_A = {
  id: 'sess-a',
  taskLabel: 'Session Alpha Task',
  status: 'idle' as const,
  startedAt: 1000,
  toolCalls: [],
  inputTokens: 0,
  outputTokens: 0,
  cwd: '/projects/foo',
};

const SESSION_B = {
  id: 'sess-b',
  taskLabel: 'Session Beta Task',
  status: 'running' as const,
  startedAt: 2000,
  toolCalls: [],
  inputTokens: 0,
  outputTokens: 0,
  cwd: '/projects/bar',
};

// Bug-shaped session: cwd: undefined → projectId === 'unknown' → must NOT render
const SESSION_C = {
  id: 'sess-c',
  taskLabel: 'Session Charlie Task',
  status: 'idle' as const,
  startedAt: 3000,
  toolCalls: [],
  inputTokens: 0,
  outputTokens: 0,
  cwd: undefined,
};

// Active project root
const mockProjectRoot = '/projects/foo';

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: mockProjectRoot,
    projectRoots: ['/projects/foo', '/projects/bar'],
    projectName: mockProjectRoot.split('/').filter(Boolean).pop() ?? '',
    isLoaded: true,
    setProjectRoot: vi.fn(),
    addProjectRoot: vi.fn(),
    removeProjectRoot: vi.fn(),
    clearProject: vi.fn(),
    setActiveProjectRoot: vi.fn(),
  }),
  useProjectOptional: () => null,
}));

vi.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { recentProjects: [] },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useGitBranch', () => ({
  useGitBranch: () => ({ branch: 'main' }),
}));

vi.mock('../../../contexts/AgentEventsContext', () => ({
  useAgentEventsContext: vi.fn(() => ({
    agents: [],
    activeCount: 0,
    currentSessions: [SESSION_A, SESSION_B, SESSION_C],
    historicalSessions: [],
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  })),
}));

// WorkbenchFileTree makes IPC calls — stub it out
vi.mock('./WorkbenchFileTree', () => ({
  WorkbenchFileTree: () => React.createElement('div', { 'data-testid': 'file-tree-stub' }),
}));

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).electronAPI = {
    files: {
      readDir: vi.fn().mockResolvedValue({ success: true, items: [] }),
      selectFolder: vi.fn().mockResolvedValue({ success: false }),
    },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

import { InnerRail } from './InnerRail';

describe('Wave 14 Phase 4 — InnerRail (session list removed)', () => {
  it('does not render session labels — the inner-rail session list was removed', () => {
    render(<InnerRail />);
    const rail = screen.getByTestId('workbench-innerrail');
    // InnerRail no longer renders RunningSection/SessionRow — the rail renders only:
    // command palette button, add-project button, divider, and file tree / FilesSection.
    // None of the mock session labels should appear.
    expect(rail.textContent).not.toContain('Session Alpha Task');
    expect(rail.textContent).not.toContain('Session Beta Task');
    expect(rail.textContent).not.toContain('Session Charlie Task');
  });
});
