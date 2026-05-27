import React from 'react';

import { useApprovalContext } from '../../../contexts/ApprovalContext';
import { OPEN_MULTI_SESSION_EVENT } from '../../../hooks/appEventNames';
import type { AgentChatThreadRecord } from '@shared/types/agentChat';
import type { ApprovalRequest } from '../../../types/electron';
import {
  createStoredSessionFromPicker,
  createStoredSessionInProject,
} from '../../SessionSidebar/NewSessionButton';
import { useSessions } from '../../SessionSidebar/useSessions';
import type { ChatWorkbenchLayoutApi } from './useChatWorkbenchLayout';
import type { TerminalDockApi } from './useTerminalDockState';
import { useWorkbenchCompare } from './useWorkbenchCompare';
import { useWorkbenchSessionActivation } from './useWorkbenchSessionActivation';
import { useWorkbenchSessions } from './useWorkbenchSessions';
import { useWorkbenchSurfacePolicy } from './useWorkbenchSurfacePolicy';

export type LayoutState = ChatWorkbenchLayoutApi;
export type DockState = TerminalDockApi;
export type SessionsState = ReturnType<typeof useSessions>;
export type CompareState = ReturnType<typeof useWorkbenchCompare>;
export type ActivationState = ReturnType<typeof useWorkbenchSessionActivation>;
export type SurfacePolicyState = ReturnType<typeof useWorkbenchSurfacePolicy>;

export interface WorkbenchContextState {
  activation: ActivationState;
  approvalRequests: ApprovalRequest[];
  compare: CompareState;
  dock: DockState;
  layout: LayoutState;
  sessionsState: SessionsState;
  surfacePolicy: SurfacePolicyState;
  threads: AgentChatThreadRecord[];
}

export interface WorkbenchHandlers {
  handleCreateSession: (projectRoot?: string) => Promise<void>;
  handleLaunchAgent: () => void;
  handleSelectRecentChat: (threadId: string) => void;
  handleSelectSession: (sessionId: string) => void;
}

function useWorkbenchListState(
  sessionsState: SessionsState,
  threads: AgentChatThreadRecord[],
): ReturnType<typeof useWorkbenchSessions> {
  return useWorkbenchSessions({
    sessions: sessionsState.sessions,
    activeSessionId: sessionsState.activeSessionId,
    threads,
  });
}

function useWorkbenchSurfaceState(layout: LayoutState, approvalCount: number): SurfacePolicyState {
  return useWorkbenchSurfacePolicy({
    approvalCount,
    setUtilityOpen: layout.setUtilityOpen,
    setActiveUtilityTab: layout.setActiveUtilityTab,
  });
}

const EMPTY_THREADS: AgentChatThreadRecord[] = [];

export function useWorkbenchContextState(
  layout: LayoutState,
  dock: DockState,
): WorkbenchContextState {
  const { requests: approvalRequests } = useApprovalContext();
  const threads = EMPTY_THREADS;
  const sessionsState = useSessions();
  const workbenchSessions = useWorkbenchListState(sessionsState, threads);
  const compare = useWorkbenchCompare({ items: workbenchSessions.items });
  const activation = useWorkbenchSessionActivation({
    sessions: sessionsState.sessions,
    threads,
    refreshSessions: sessionsState.refresh,
    actions: { selectThread: () => undefined },
  });
  const surfacePolicy = useWorkbenchSurfaceState(layout, approvalRequests.length);

  return {
    activation,
    approvalRequests,
    compare,
    dock,
    layout,
    sessionsState,
    surfacePolicy,
    threads,
  };
}

export function useWorkbenchHandlers(
  activation: ActivationState,
): WorkbenchHandlers {
  const handleCreateSession = React.useCallback(
    async (projectRoot?: string): Promise<void> => {
      const session = projectRoot
        ? await createStoredSessionInProject(projectRoot)
        : await createStoredSessionFromPicker();
      if (!session) return;
      await activation.activateSession(session.id);
    },
    [activation],
  );
  const handleLaunchAgent = React.useCallback((): void => {
    window.dispatchEvent(new CustomEvent(OPEN_MULTI_SESSION_EVENT));
  }, []);
  const handleSelectSession = React.useCallback(
    (sessionId: string) => {
      void activation.activateSession(sessionId);
    },
    [activation],
  );
  const handleSelectRecentChat = React.useCallback(
    (_threadId: string) => {
      // chat threads removed in Wave 100
    },
    [],
  );

  return { handleCreateSession, handleLaunchAgent, handleSelectRecentChat, handleSelectSession };
}

export function useActiveApprovalSessionIds(
  activeSessionId: string | null,
): Array<string | null | undefined> {
  return [activeSessionId];
}
