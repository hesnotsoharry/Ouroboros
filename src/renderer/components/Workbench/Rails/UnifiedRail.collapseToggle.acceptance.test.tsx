/**
 * @vitest-environment jsdom
 *
 * UnifiedRail.collapseToggle.acceptance.test.tsx — Wave 14 Phase 5 ORCHESTRATOR-OWNED acceptance test.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FROZEN. Do NOT modify this file. Per orchestrator-owned acceptance test
 * discipline, the contract is fixed; the implementation bends to fit it.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * CONTRACT:
 *   - With 2 projects (A active, B inactive), A's accordion body is visible by
 *     default; B's is collapsed.
 *   - Clicking B's AccordionHeader expands B's body.
 *   - Clicking B's AccordionHeader again collapses B's body.
 *   - Single-expanded semantics: expanding B also collapses A.
 *
 * Anti-tautology:
 *   - Mocks are at module boundaries (useWorkbenchProjects, useGitBranch, etc.).
 *   - Asserts specific project names in the DOM.
 *   - Covers both expand and collapse paths.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

// Two projects: A active, B inactive. Paths used as project IDs.
const PROJECT_A_PATH = '/projects/project-alpha';
const PROJECT_B_PATH = '/projects/project-bravo';

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectRoot: PROJECT_A_PATH,
    projectRoots: [PROJECT_A_PATH, PROJECT_B_PATH],
    projectName: 'project-alpha',
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
    config: {
      recentProjects: [PROJECT_A_PATH, PROJECT_B_PATH],
    },
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

// Stub WorkbenchFileTree so it renders a simple sentinel div without IPC calls.
vi.mock('./WorkbenchFileTree', () => ({
  WorkbenchFileTree: ({ rootPath }: { rootPath: string }) =>
    React.createElement('div', { 'data-testid': `file-tree-${rootPath.split('/').pop() ?? ''}` }),
}));

// stub pathExists so useWorkbenchProjects.fetchExistsMap doesn't throw
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find an AccordionHeader div by the project name text it contains.
 * AccordionHeader renders a <div onClick=...> containing the project.name span.
 * We use fireEvent.click on the span — React synthetic events bubble up to the
 * parent div's onClick handler.
 */
function clickAccordionHeader(projectName: string): void {
  const span = screen.getByText(projectName);
  fireEvent.click(span);
}

/**
 * Find the AccordionBody for a project by its file-tree stub testid.
 * Returns null if the body is not mounted (collapsed).
 */
function queryAccordionBody(projectPathSuffix: string): Element | null {
  return screen.queryByTestId(`file-tree-${projectPathSuffix}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UnifiedRail — accordion collapse toggle (single-expanded semantics)', () => {
  it('project A is expanded by default (active project), project B is collapsed', async () => {
    render(<UnifiedRail />);

    // Wait for both project names to appear (useWorkbenchProjects async pathExists)
    await waitFor(() => {
      expect(screen.queryByText('project-alpha')).not.toBeNull();
      expect(screen.queryByText('project-bravo')).not.toBeNull();
    });

    // A's file-tree body should be visible (expanded)
    expect(queryAccordionBody('project-alpha')).not.toBeNull();
    // B's file-tree body should be absent (collapsed)
    expect(queryAccordionBody('project-bravo')).toBeNull();
  });

  it('clicking project B header expands B and collapses A (single-expanded)', async () => {
    render(<UnifiedRail />);

    await waitFor(() => {
      expect(screen.queryByText('project-bravo')).not.toBeNull();
    });

    // Click project B's header
    clickAccordionHeader('project-bravo');

    // B is now expanded
    expect(queryAccordionBody('project-bravo')).not.toBeNull();
    // A is now collapsed (single-expanded)
    expect(queryAccordionBody('project-alpha')).toBeNull();
  });

  it('clicking project B header a second time collapses B', async () => {
    render(<UnifiedRail />);

    await waitFor(() => {
      expect(screen.queryByText('project-bravo')).not.toBeNull();
    });

    // First click: expand B
    clickAccordionHeader('project-bravo');
    expect(queryAccordionBody('project-bravo')).not.toBeNull();

    // Second click: collapse B
    clickAccordionHeader('project-bravo');
    expect(queryAccordionBody('project-bravo')).toBeNull();
  });
});
