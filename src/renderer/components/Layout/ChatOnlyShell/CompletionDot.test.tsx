/**
 * @vitest-environment jsdom
 *
 * CompletionDot.test.tsx — Wave 99 Phase 4
 *
 * Verifies:
 *  - 'complete' renders a green dot (bg-status-success) with correct data-testid
 *  - 'error' renders a red dot (bg-status-error) with correct data-testid
 *  - 'running' renders nothing
 *  - undefined renders nothing
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { CompletionDot } from './CompletionDot';

afterEach(cleanup);

describe('CompletionDot — renders correct token per status', () => {
  it("renders a green dot with data-testid 'terminal-completion-dot-complete' when status is 'complete'", () => {
    render(<CompletionDot status="complete" />);
    const dot = screen.getByTestId('terminal-completion-dot-complete');
    expect(dot).toBeTruthy();
    expect(dot.className).toContain('bg-status-success');
    expect(dot.className).not.toContain('bg-status-error');
  });

  it("renders a red dot with data-testid 'terminal-completion-dot-error' when status is 'error'", () => {
    render(<CompletionDot status="error" />);
    const dot = screen.getByTestId('terminal-completion-dot-error');
    expect(dot).toBeTruthy();
    expect(dot.className).toContain('bg-status-error');
    expect(dot.className).not.toContain('bg-status-success');
  });

  it("renders nothing when status is 'running'", () => {
    render(<CompletionDot status="running" />);
    expect(screen.queryByTestId('terminal-completion-dot-complete')).toBeNull();
    expect(screen.queryByTestId('terminal-completion-dot-error')).toBeNull();
  });

  it('renders nothing when status is undefined', () => {
    render(<CompletionDot status={undefined} />);
    expect(screen.queryByTestId('terminal-completion-dot-complete')).toBeNull();
    expect(screen.queryByTestId('terminal-completion-dot-error')).toBeNull();
  });
});
