/**
 * @vitest-environment jsdom
 *
 * ChatWorkbenchOverlays — Wave 89 Phase 3 integration tests (artifact overlay
 * removed in Wave 95 Phase H continuation).
 *
 * Contract verified:
 * - Utility drawer OverlayDrawer is translate-x-full (hidden) when closed.
 * - Utility drawer OverlayDrawer is translate-x-0 (visible) when open.
 * - Utility close callback fires when utility's internal close button clicked.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatWorkbenchOverlays } from './ChatWorkbenchOverlays';
import type { UseOverlayDrawerWidthsReturn } from './useOverlayDrawerWidths';

afterEach(cleanup);

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./ChatWorkbenchUtilityDrawer', () => ({
  ChatWorkbenchUtilityDrawer: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mock-utility-drawer">
      <button onClick={onClose} data-testid="utility-close-btn">
        Close Utility
      </button>
    </div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWidths(
  overrides: Partial<UseOverlayDrawerWidthsReturn> = {},
): UseOverlayDrawerWidthsReturn {
  return {
    overlayDrawerWidth: 380,
    artifactOverlayWidth: 480,
    setOverlayDrawerWidth: vi.fn(),
    setArtifactOverlayWidth: vi.fn(),
    ...overrides,
  };
}

interface RenderProps {
  utilityOpen?: boolean;
  overlayWidths?: UseOverlayDrawerWidthsReturn;
}

function renderOverlays({ utilityOpen = false, overlayWidths = makeWidths() }: RenderProps = {}) {
  const onCloseUtility = vi.fn();

  const utils = render(
    <div style={{ position: 'relative', width: 800, height: 600 }}>
      <ChatWorkbenchOverlays
        utilityOpen={utilityOpen}
        activeUtilityTab="activity"
        onSelectUtilityTab={vi.fn()}
        onCloseUtility={onCloseUtility}
        activeProject={null}
        overlayWidths={overlayWidths}
      />
    </div>,
  );

  return { ...utils, onCloseUtility };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChatWorkbenchOverlays — utility overlay', () => {
  it('hides the utility drawer (translate-x-full) when utilityOpen is false', () => {
    renderOverlays({ utilityOpen: false });
    const drawer = screen.getByTestId('utility-overlay-drawer');
    expect(drawer.className).toContain('translate-x-full');
  });

  it('shows the utility drawer (translate-x-0) when utilityOpen is true', () => {
    renderOverlays({ utilityOpen: true });
    const drawer = screen.getByTestId('utility-overlay-drawer');
    expect(drawer.className).toContain('translate-x-0');
    expect(drawer.className).not.toContain('translate-x-full');
  });

  it('renders backdrop only when utility is open', () => {
    renderOverlays({ utilityOpen: true });
    expect(screen.queryByTestId('overlay-drawer-backdrop')).toBeTruthy();
  });

  it('calls onCloseUtility when utility close button is clicked', () => {
    const { onCloseUtility } = renderOverlays({ utilityOpen: true });
    fireEvent.click(screen.getByTestId('utility-close-btn'));
    expect(onCloseUtility).toHaveBeenCalledOnce();
  });
});
