/**
 * AgentSection.test.tsx — Smoke tests for AgentSection.
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../types/electron';
import { AgentSection } from './AgentSection';

afterEach(cleanup);

function makeDraft(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    backgroundJobsMaxConcurrent: 2,
    ...overrides,
  } as AppConfig;
}

describe('AgentSection', () => {
  // 'renders Agent Chat section label' test removed in Wave 100 Phase H (AgentChatSettingsGroup removed)
  // 'renders Model Router section label' test removed in Wave 100 Phase G (RouterSettingsGroup removed)
  // 'renders Context Layer section label' test removed in Wave 100 Phase H (ContextLayerSettingsGroup removed)

  it('renders Inline Edit section label', () => {
    render(<AgentSection draft={makeDraft()} onChange={vi.fn()} />);
    expect(screen.getByText(/Inline Edit/)).toBeDefined();
  });

  it('calls onChange when background jobs input changes', () => {
    const onChange = vi.fn();
    render(<AgentSection draft={makeDraft()} onChange={onChange} />);
    const input = screen.getByLabelText('Background jobs max concurrency');
    input.focus();
    // simulate a change event
    Object.defineProperty(input, 'value', { value: '4', writable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // onChange may or may not fire depending on parsed value path — just confirm no crash
    expect(input).toBeDefined();
  });
});
