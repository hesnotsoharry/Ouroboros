/**
 * @vitest-environment jsdom
 *
 * WorkbenchRightPane — Wave 95 Phase H continuation.
 * Artifact pane removed; component now renders utility drawer only.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ChatWorkbenchUtilityDrawer', () => ({
  ChatWorkbenchUtilityDrawer: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="utility-drawer-mock">utility:{activeTab}</div>
  ),
}));

import { WorkbenchRightPane } from './WorkbenchRightPane';

afterEach(cleanup);

function makeProps(overrides: Partial<React.ComponentProps<typeof WorkbenchRightPane>> = {}) {
  return {
    view: 'utility' as const,
    activeUtilityTab: 'activity' as const,
    onSelectUtilityTab: vi.fn(),
    onSelectView: vi.fn(),
    onClose: vi.fn(),
    activeProject: null,
    ...overrides,
  };
}

describe('WorkbenchRightPane', () => {
  it('always renders the utility drawer regardless of view prop', () => {
    render(<WorkbenchRightPane {...makeProps({ view: 'utility' })} />);
    expect(screen.getByTestId('utility-drawer-mock')).toBeDefined();
  });

  it('renders the utility drawer even when view is artifact (artifact pane removed)', () => {
    // Wave 95 Phase H continuation: artifact pane removed. view='artifact' still
    // renders utility drawer (the only remaining pane).
    render(<WorkbenchRightPane {...makeProps({ view: 'artifact' })} />);
    expect(screen.getByTestId('utility-drawer-mock')).toBeDefined();
  });

  it('passes activeTab to the utility drawer', () => {
    render(<WorkbenchRightPane {...makeProps({ activeUtilityTab: 'approvals' })} />);
    expect(screen.getByTestId('utility-drawer-mock').textContent).toContain('approvals');
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<WorkbenchRightPane {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('workbench-right-pane-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
