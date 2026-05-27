/**
 * @vitest-environment jsdom
 *
 * UnifiedRail.fileTreeReal.acceptance.test.tsx — Wave 14 Phase 5 ORCHESTRATOR-OWNED acceptance test.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FROZEN. Do NOT modify this file. Per orchestrator-owned acceptance test
 * discipline, the contract is fixed; the implementation bends to fit it.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * CONTRACT:
 *   When <UnifiedRail> is rendered with an active project, the expanded
 *   accordion body MUST render real file tree data (from WorkbenchFileTree)
 *   and MUST NOT render any MOCK_FILE_TREE filename strings.
 *
 * Anti-tautology:
 *   - Mock is at the IPC boundary (useWorkbenchFileTree) NOT on WorkbenchFileTree.
 *   - Asserts a specific known fixture filename ('real-fixture-file.ts').
 *   - Asserts specific MOCK_FILE_TREE names do NOT appear.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: '/projects/agent-ide',
    projectRoots: ['/projects/agent-ide'],
    projectName: 'agent-ide',
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
    config: { recentProjects: ['/projects/agent-ide'] },
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
    currentSessions: [],
    historicalSessions: [],
    clearCompleted: vi.fn(),
    dismiss: vi.fn(),
    updateNotes: vi.fn(),
    registerChatSession: vi.fn(),
  })),
}));

// Mock at the IPC boundary — useWorkbenchFileTree — not the component under test.
vi.mock('./useWorkbenchFileTree', () => ({
  useWorkbenchFileTree: () => ({
    nodes: [
      {
        key: '/projects/agent-ide/real-fixture-file.ts',
        type: 'file' as const,
        depth: 0,
        name: 'real-fixture-file.ts',
        path: '/projects/agent-ide/real-fixture-file.ts',
        open: false,
        badge: null,
      },
    ],
    isLoading: false,
    error: null,
    toggleDir: vi.fn(),
  }),
  compareEntries: (
    a: { type: string; name: string },
    b: { type: string; name: string },
  ): number => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  },
}));

// stub window.electronAPI so useWorkbenchProjects.fetchExistsMap doesn't throw
beforeEach(() => {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    files: {
      pathExists: vi.fn().mockResolvedValue(true),
    },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Import AFTER mocks
import { UnifiedRail } from './UnifiedRail';

// ── Test ─────────────────────────────────────────────────────────────────────

describe('UnifiedRail — file tree renders real data, not MOCK_FILE_TREE', () => {
  it('shows real fixture file name inside the unified rail when a project is active', async () => {
    render(<UnifiedRail />);

    const rail = screen.getByTestId('workbench-unifiedrail');

    // The active project accordion is expanded by default (expandedProjectId initialized
    // from activeProject?.id). WorkbenchFileTree should render the fixture node.
    await waitFor(() => {
      expect(rail.textContent).toContain('real-fixture-file.ts');
    });
  });

  it('does NOT show any MOCK_FILE_TREE filename inside the unified rail', async () => {
    render(<UnifiedRail />);

    const rail = screen.getByTestId('workbench-unifiedrail');

    await waitFor(() => {
      expect(rail.textContent).toContain('real-fixture-file.ts');
    });

    // MOCK_FILE_TREE entries from workbenchMockData.rails.ts — none must appear
    expect(rail.textContent).not.toContain('ChatOnlyShell.tsx');
    expect(rail.textContent).not.toContain('WorkbenchMenuBar.tsx');
    expect(rail.textContent).not.toContain('TerminalPane.tsx');
    expect(rail.textContent).not.toContain('CommandBlockOverlayBody.tsx');
    expect(rail.textContent).not.toContain('tokens.css');
    expect(rail.textContent).not.toContain('globals.css');
    expect(rail.textContent).not.toContain('package.json');
    expect(rail.textContent).not.toContain('CLAUDE.md');
  });
});
