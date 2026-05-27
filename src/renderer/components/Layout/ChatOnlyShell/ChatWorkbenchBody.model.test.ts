/**
 * @vitest-environment jsdom
 *
 * Tests for ChatWorkbenchBody.model — useWorkbenchHandlers and
 * useActiveApprovalSessionIds. useWorkbenchContextState composes too many
 * external providers to test in isolation here; it is covered by the
 * ChatWorkbenchFollowThrough integration test.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useActiveApprovalSessionIds, useWorkbenchHandlers } from './ChatWorkbenchBody.model';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../SessionSidebar/NewSessionButton', () => ({
  createStoredSessionFromPicker: vi.fn(),
  createStoredSessionInProject: vi.fn(),
}));

import { createStoredSessionFromPicker } from '../../SessionSidebar/NewSessionButton';

const mockCreateStoredSessionFromPicker = vi.mocked(createStoredSessionFromPicker);

// ── useWorkbenchHandlers ──────────────────────────────────────────────────────

describe('useWorkbenchHandlers', () => {
  const mockActivation = {
    activateSession: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActivation.activateSession.mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = undefined;
  });

  it('handleLaunchAgent dispatches OPEN_MULTI_SESSION_EVENT on window', () => {
    const { result } = renderHook(() =>
      useWorkbenchHandlers(mockActivation as never),
    );
    const spy = vi.spyOn(window, 'dispatchEvent');
    act(() => {
      result.current.handleLaunchAgent();
    });
    expect(spy).toHaveBeenCalledOnce();
    const event = spy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('agent-ide:open-multi-session');
    spy.mockRestore();
  });

  it('handleSelectSession calls activation.activateSession with the given sessionId', () => {
    const { result } = renderHook(() =>
      useWorkbenchHandlers(mockActivation as never),
    );
    act(() => {
      result.current.handleSelectSession('ses-123');
    });
    expect(mockActivation.activateSession).toHaveBeenCalledWith('ses-123');
  });

  it('handleSelectRecentChat is a no-op after Wave 100 chat surface removal', () => {
    const { result } = renderHook(() =>
      useWorkbenchHandlers(mockActivation as never),
    );
    // Should not throw; does nothing
    act(() => {
      result.current.handleSelectRecentChat('thread-abc');
    });
    expect(mockActivation.activateSession).not.toHaveBeenCalled();
  });

  it('handleCreateSession aborts when createStoredSessionFromPicker returns null', async () => {
    mockCreateStoredSessionFromPicker.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useWorkbenchHandlers(mockActivation as never),
    );
    await act(async () => {
      await result.current.handleCreateSession();
    });
    expect(mockActivation.activateSession).not.toHaveBeenCalled();
  });

  it('handleCreateSession activates session when picker returns a session', async () => {
    const fakeSession = { id: 'ses-new', projectRoot: '/projects/new' };
    mockCreateStoredSessionFromPicker.mockResolvedValue(fakeSession as never);

    const { result } = renderHook(() =>
      useWorkbenchHandlers(mockActivation as never),
    );

    await act(async () => {
      await result.current.handleCreateSession();
    });

    expect(mockActivation.activateSession).toHaveBeenCalledWith('ses-new');
  });
});

// ── useActiveApprovalSessionIds ───────────────────────────────────────────────

describe('useActiveApprovalSessionIds', () => {
  it('returns array with just activeSessionId after Wave 100 chat surface removal', () => {
    const { result } = renderHook(() => useActiveApprovalSessionIds('ses-1'));
    expect(result.current[0]).toBe('ses-1');
    expect(result.current).toHaveLength(1);
  });

  it('returns array with null when activeSessionId is null', () => {
    const { result } = renderHook(() => useActiveApprovalSessionIds(null));
    expect(result.current[0]).toBeNull();
    expect(result.current).toHaveLength(1);
  });
});
