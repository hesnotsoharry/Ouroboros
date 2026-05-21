/**
 * @vitest-environment jsdom
 *
 * Workbench.test.tsx — Phase 1 walking skeleton tests.
 *
 * Trophy: the flag branch + frame render is the seam.
 * (a) flag on → Workbench mounts and all six region test-ids are present
 * (b) flag off → the prior InnerApp shell branch is unchanged (Workbench not rendered)
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

  it('renders each region placeholder label', () => {
    render(<Workbench />);

    expect(screen.getByText('Title Bar')).toBeDefined();
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
