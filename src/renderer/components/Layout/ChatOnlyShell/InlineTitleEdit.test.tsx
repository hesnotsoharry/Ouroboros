/**
 * @vitest-environment jsdom
 *
 * InlineTitleEdit.test.tsx — Wave 95 Phase A
 *
 * Smoke tests for the shared inline-edit input component.
 *
 * Acceptance criteria:
 *  1. Renders an input with the initial value, autofocused.
 *  2. Type new value + Enter → calls onCommit(newValue).
 *  3. Type new value + Escape → calls onCancel(), never onCommit.
 *  4. Type new value + blur → calls onCommit(newValue).
 *  5. Empty input + Enter → calls onCancel(), never onCommit.
 *  6. Unchanged input + Enter → calls onCancel(), never onCommit.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InlineTitleEdit } from './InlineTitleEdit';

afterEach(cleanup);

function renderEdit(
  initial: string,
  overrides?: Partial<React.ComponentProps<typeof InlineTitleEdit>>,
) {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(
    <InlineTitleEdit
      initial={initial}
      onCommit={onCommit}
      onCancel={onCancel}
      testId="test-inline-edit"
      {...overrides}
    />,
  );
  const input = screen.getByTestId('test-inline-edit') as HTMLInputElement;
  return { onCommit, onCancel, input };
}

describe('InlineTitleEdit — renders input with initial value and autofocus', () => {
  it('displays the initial value and is focused on mount', () => {
    const { input } = renderEdit('my-tab');
    expect(input.value).toBe('my-tab');
    expect(document.activeElement).toBe(input);
  });
});

describe('InlineTitleEdit — Enter commits a changed non-empty value', () => {
  it('calls onCommit(newValue) when Enter is pressed with a new trimmed non-empty value', () => {
    const { onCommit, onCancel, input } = renderEdit('original');
    fireEvent.change(input, { target: { value: 'new name' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('new name');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('InlineTitleEdit — Escape always cancels without committing', () => {
  it('calls onCancel() and never calls onCommit when Escape is pressed', () => {
    const { onCommit, onCancel, input } = renderEdit('original');
    fireEvent.change(input, { target: { value: 'new name' } });
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('InlineTitleEdit — blur commits a changed non-empty value', () => {
  it('calls onCommit(newValue) when the input loses focus with a new value', () => {
    const { onCommit, onCancel, input } = renderEdit('original');
    fireEvent.change(input, { target: { value: 'updated' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('updated');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('InlineTitleEdit — empty input falls through to cancel', () => {
  it('calls onCancel() and never onCommit when Enter is pressed with an empty value', () => {
    const { onCommit, onCancel, input } = renderEdit('original');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('InlineTitleEdit — unchanged input falls through to cancel', () => {
  it('calls onCancel() and never onCommit when Enter is pressed with the same value as initial', () => {
    const { onCommit, onCancel, input } = renderEdit('original');
    // Value unchanged — still 'original'
    expect(input.value).toBe('original');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
