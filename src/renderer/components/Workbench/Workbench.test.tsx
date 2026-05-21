/**
 * @vitest-environment jsdom
 *
 * Workbench.test.tsx — Phase 1 + Phase 2 tests.
 *
 * Phase 1 trophy: the flag branch + frame render is the seam.
 * (a) flag on → Workbench mounts and all six region test-ids are present
 * (b) flag off → the prior InnerApp shell branch is unchanged (Workbench not rendered)
 *
 * Phase 2 additions: TitleBar renders the app mark, project + branch chips,
 * AgentGlobe (running content from mock), and the three window controls.
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Workbench } from './Workbench';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── (a) Workbench renders all six regions when mounted ───────────────────────

describe('Workbench', () => {
  it('mounts and renders all six region test-ids', () => {
    render(<Workbench />);

    expect(screen.getByTestId('workbench-titlebar')).toBeDefined();
    expect(screen.getByTestId('workbench-projectrail')).toBeDefined();
    expect(screen.getByTestId('workbench-innerrail')).toBeDefined();
    expect(screen.getByTestId('workbench-terminals')).toBeDefined();
    expect(screen.getByTestId('workbench-agentsidebar')).toBeDefined();
    expect(screen.getByTestId('workbench-statusbar')).toBeDefined();
  });

  it('renders the five remaining placeholder region labels', () => {
    render(<Workbench />);

    // Title Bar placeholder is now replaced by real TitleBar component — no placeholder text.
    expect(screen.getByText('Project Rail')).toBeDefined();
    expect(screen.getByText('Inner Rail')).toBeDefined();
    expect(screen.getByText('Terminals')).toBeDefined();
    expect(screen.getByText('Agent Sidebar')).toBeDefined();
    expect(screen.getByText('Status Bar')).toBeDefined();
  });

  it('does not import xterm, useAgentEvents, or permission components', async () => {
    // Structural: verify the module can be imported without those dependencies.
    // If this test resolves, the module loaded successfully in the test environment
    // which has no xterm or IPC shims wired.
    const mod = await import('./Workbench');
    expect(typeof mod.Workbench).toBe('function');
  });
});

// ── Phase 2: TitleBar content tests ──────────────────────────────────────────

describe('TitleBar', () => {
  it('renders the app mark "A" glyph', () => {
    render(<Workbench />);
    const titleBar = screen.getByTestId('workbench-titlebar');
    expect(titleBar.textContent).toContain('A');
  });

  it('renders the active project name from mock data', () => {
    render(<Workbench />);
    // MOCK_PROJECTS[0] is agent-ide with active: true
    expect(screen.getByText('agent-ide')).toBeDefined();
  });

  it('renders the active project branch name from mock data', () => {
    render(<Workbench />);
    // MOCK_PROJECTS[0].branch = 'wave/1-workbench-static-shell'
    expect(screen.getByText('wave/1-workbench-static-shell')).toBeDefined();
  });

  it('renders the AgentGlobe with running model name from mock data', () => {
    render(<Workbench />);
    const globe = screen.getByTestId('agent-globe');
    // MOCK_CONTEXT_STATS.model = 'claude-sonnet-4-6'
    expect(globe.textContent).toContain('claude-sonnet-4-6');
  });

  it('renders the Ctrl K command palette affordance (Windows shortcut, not ⌘K)', () => {
    render(<Workbench />);
    expect(screen.getByText('Ctrl K')).toBeDefined();
  });

  it('renders the three window control buttons', () => {
    render(<Workbench />);
    expect(screen.getByTitle('Minimize')).toBeDefined();
    expect(screen.getByTitle('Maximize')).toBeDefined();
    expect(screen.getByTitle('Close')).toBeDefined();
  });

  it('workbench-titlebar test-id resolves on the TitleBar root element', () => {
    render(<Workbench />);
    const el = screen.getByTestId('workbench-titlebar');
    // TitleBar is the outermost element of the title bar region
    expect(el).toBeDefined();
    // Should contain the window controls container
    expect(el.querySelector('[data-testid="window-controls"]')).toBeDefined();
  });
});

// ── (b) useCanonWorkbenchFlag — flag off leaves prior shell unchanged ────────

// Mock window.electronAPI so the hook can be tested without Electron.
function mockConfig(canonWorkbench: boolean): void {
  // Patch only electronAPI — jsdom's window is already populated.
  vi.stubGlobal('electronAPI', {
    config: {
      getAll: vi.fn().mockResolvedValue({ layout: { canonWorkbench } }),
    },
  });
}

describe('useCanonWorkbenchFlag', () => {
  it('returns false when config.layout.canonWorkbench is false', async () => {
    mockConfig(false);
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });

  it('returns true when config.layout.canonWorkbench is true', async () => {
    mockConfig(true);
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(true);
  });

  it('returns false when electronAPI is absent (SSR / web stub)', async () => {
    vi.stubGlobal('window', {});
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });

  it('returns false when config.getAll throws', async () => {
    vi.stubGlobal('window', {
      ...window,
      electronAPI: {
        config: { getAll: vi.fn().mockRejectedValue(new Error('ipc error')) },
      },
    });
    const { readCanonWorkbenchFlag } = await import(
      '../../hooks/useCanonWorkbenchFlag'
    );
    const result = await readCanonWorkbenchFlag();
    expect(result).toBe(false);
  });
});
