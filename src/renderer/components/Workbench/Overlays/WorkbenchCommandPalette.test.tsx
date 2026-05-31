/**
 * @vitest-environment jsdom
 *
 * WorkbenchCommandPalette.test.tsx — Wave 7 Phase 2.
 *
 * Contracts tested:
 *   (a) Dispatching 'agent-ide:command-palette' opens the palette
 *       (CommandPalette sentinel receives isOpen=true).
 *   (b) The palette is NOT open before the event fires.
 *   (c) The sentinel's onClose callback closes the palette (isOpen=false).
 *
 * NOTE: The Ctrl-K button was in TitleBar (Wave 7). It was moved to InnerRail
 * (command-palette button at top of rail) in a later cleanup wave. Tests for the
 * button → event dispatch contract live in InnerRail.wave10.test.tsx.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Sentinel mock for CommandPalette ─────────────────────────────────────────
// Mock the boundary dependency (the component the overlay renders), not the
// overlay itself. The sentinel exposes isOpen via data-testid so we can assert
// without knowing the palette's internal DOM structure.
vi.mock('../../CommandPalette/CommandPalette', () => ({
  CommandPalette: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
    commands: unknown[];
    recentIds: string[];
    onExecute: (cmd: unknown) => Promise<void>;
  }) =>
    isOpen
      ? React.createElement('div', {
          'data-testid': 'command-palette-sentinel',
          onClick: onClose,
        })
      : null,
}));

// ── Mock useCommandRegistry to avoid electron-log + window.electronAPI deps ──
vi.mock('../../CommandPalette/useCommandRegistry', () => ({
  useCommandRegistry: () => ({
    commands: [],
    recentIds: [],
    execute: vi.fn(),
    registerCommand: vi.fn(),
    unregisterCommand: vi.fn(),
  }),
}));

import { WorkbenchCommandPalette } from './WorkbenchCommandPalette';

afterEach(() => {
  cleanup();
});

// ── (a) + (b) Dispatching the event opens the palette ────────────────────────

describe('WorkbenchCommandPalette', () => {
  it('does not render the palette before the event fires', () => {
    render(<WorkbenchCommandPalette />);
    expect(screen.queryByTestId('command-palette-sentinel')).toBeNull();
  });

  it("renders the palette when 'agent-ide:command-palette' is dispatched", () => {
    render(<WorkbenchCommandPalette />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });

    expect(screen.getByTestId('command-palette-sentinel')).toBeDefined();
  });

  // ── (c) onClose closes the palette ─────────────────────────────────────────

  it('closes the palette when the sentinel calls onClose', () => {
    render(<WorkbenchCommandPalette />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });

    const sentinel = screen.getByTestId('command-palette-sentinel');
    act(() => {
      fireEvent.click(sentinel);
    });

    expect(screen.queryByTestId('command-palette-sentinel')).toBeNull();
  });

  it('can be re-opened after being closed', () => {
    render(<WorkbenchCommandPalette />);

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('command-palette-sentinel'));
    });
    expect(screen.queryByTestId('command-palette-sentinel')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('agent-ide:command-palette'));
    });
    expect(screen.getByTestId('command-palette-sentinel')).toBeDefined();
  });
});
