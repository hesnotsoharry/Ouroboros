/**
 * ChatWorkbenchBody.rails — outer/inner rail composition for the chat workbench.
 *
 * Outer rail = projects (always). Inner sidebar shows chats / terminals / code
 * for the active project. Selecting a project sets `layout.activeProject`;
 * the inner Chats tab lists all chats whose workspaceRoot matches.
 */

import log from 'electron-log/renderer';
import React, { useCallback, useMemo } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useProjectTerminalsContext } from '../../../contexts/ProjectTerminalsContext';
import { OPEN_SETTINGS_EVENT } from '../../../hooks/appEventNames';
import { useConfig } from '../../../hooks/useConfig';
import type {
  AgentChatThreadRecord,
  ApprovalRequest,
  SessionRecord,
} from '../../../types/electron';
import { useAgentCompletionIndicatorsContext } from './AgentCompletionIndicatorsContext';
import type {
  CompareState,
  DockState,
  LayoutState,
  SessionsState,
  WorkbenchHandlers,
} from './ChatWorkbenchBody.model';
import { InnerSidebar } from './InnerSidebar';
import { InnerSidebarChats } from './InnerSidebarChats';
import { InnerSidebarCode } from './InnerSidebarCode';
import { InnerSidebarTerminals } from './InnerSidebarTerminals';
import { OuterProjectRail } from './OuterProjectRail';
import {
  buildTerminalClaudeIdMap,
  deriveAgentStatusBySessionRecordId,
} from './useWorkbenchAttention.agentSource';

// ── Project list helpers ───────────────────────────────────────────────────────

function useWorkbenchProjects(): string[] {
  const { projectRoots } = useProject();
  const { config } = useConfig();
  return useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const p of [...projectRoots, ...(config?.recentProjects ?? [])]) {
      if (p && !seen.has(p)) {
        seen.add(p);
        merged.push(p);
      }
    }
    return merged;
  }, [projectRoots, config?.recentProjects]);
}

// Wave 82 — clear stale activeProject if it isn't in the merged project list.
// Without this, layout.activeProject persists in localStorage even after a
// project is removed, leaving the inner rail showing a project that the outer
// rail no longer contains.
//
// `isReady` gates the validator until both async sources (ProjectContext's
// getProjectRoots and useConfig's config.getAll) have resolved. On cold boot
// the localStorage-restored activeProject would otherwise be wiped because
// `projects` is transiently `[]` while the IPC calls are in flight, leaving
// the rail entry but no inner state — the user then has to remove and re-add
// the project to recover.
function useActiveProjectValidator(
  layout: LayoutState,
  projects: string[],
  isReady: boolean,
): void {
  const activeProject = layout.activeProject;
  React.useEffect(() => {
    if (!isReady) return;
    if (!activeProject) return;
    if (projects.includes(activeProject)) return;
    log.warn('[rail] active project not in workbench list — clearing', {
      activeProject,
      projects,
      isReady,
    });
    layout.setActiveProject(null);
  }, [activeProject, projects, layout, isReady]);
}

// ── Rail handlers ──────────────────────────────────────────────────────────────

interface RailHandlers {
  handleSelectProject: (path: string) => void;
  handleAddProject: (path: string) => void;
  handleRemoveProject: (path: string) => void;
  handleOpenSettings: () => void;
  handleSelectTab: (tab: Parameters<LayoutState['setActiveInnerTab']>[1]) => void;
}

// Wave 82.1 — clicking a "recent" project on the rail used to call
// `layout.setActiveProject` only, leaving the project absent from
// `projectRoots`. Per-window roots (used by `pathSecurity` in the main
// process) are sourced from `projectRoots`, so `files:readDir` returned
// `{success:false}` and the file tree silently rendered as empty. Promoting
// the path via `addProjectRoot` (idempotent) registers it with the sandbox
// before activation.
function useProjectSelection(
  layout: LayoutState,
  onSelected?: (path: string) => void,
): {
  handleSelectOrAdd: (path: string) => void;
  handleRemoveProject: (path: string) => void;
} {
  const { addProjectRoot, removeProjectRoot } = useProject();
  const { config, set: setConfig } = useConfig();
  const handleSelectOrAdd = useCallback(
    (path: string) => {
      addProjectRoot(path);
      layout.setActiveProject(path);
      onSelected?.(path);
    },
    [addProjectRoot, layout, onSelected],
  );
  const handleRemoveProject = useCallback(
    (path: string) => {
      removeProjectRoot(path);
      const recents = config?.recentProjects ?? [];
      if (recents.includes(path)) {
        void setConfig(
          'recentProjects',
          recents.filter((p) => p !== path),
        );
      }
      if (layout.activeProject === path) layout.setActiveProject(null);
    },
    [config?.recentProjects, layout, removeProjectRoot, setConfig],
  );
  return { handleSelectOrAdd, handleRemoveProject };
}

function useRailHandlers(
  layout: LayoutState,
  onProjectSelected?: (path: string) => void,
): RailHandlers {
  const activeProject = layout.activeProject;
  const { handleSelectOrAdd, handleRemoveProject } = useProjectSelection(layout, onProjectSelected);
  const handleOpenSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
  }, []);
  const handleSelectTab = useCallback(
    (tab: Parameters<LayoutState['setActiveInnerTab']>[1]) => {
      if (activeProject) layout.setActiveInnerTab(activeProject, tab);
    },
    [layout, activeProject],
  );
  return {
    handleSelectProject: handleSelectOrAdd,
    handleAddProject: handleSelectOrAdd,
    handleRemoveProject,
    handleOpenSettings,
    handleSelectTab,
  };
}

// ── Inner tab contents ─────────────────────────────────────────────────────────

interface InnerTabContentsArgs {
  activeProject: string | null;
  agentStatusBySessionRecordId: Record<string, 'running' | 'complete' | 'error'>;
  approvalRequests: ApprovalRequest[];
  dock: DockState;
  handlers: WorkbenchHandlers;
  sessionsState: SessionsState;
  threads: AgentChatThreadRecord[];
}

interface InnerTabContents {
  chats: React.ReactNode;
  terminals: React.ReactNode;
  code: React.ReactNode;
}

function buildInnerTabContents(args: InnerTabContentsArgs): InnerTabContents {
  const {
    activeProject,
    agentStatusBySessionRecordId,
    approvalRequests,
    dock,
    handlers,
    sessionsState,
    threads,
  } = args;
  const openDock = (): void => {
    dock.setVisible(true);
  };
  return {
    chats: (
      <InnerSidebarChats
        activeProjectRoot={activeProject}
        activeThreadId={null}
        agentStatusBySessionRecordId={agentStatusBySessionRecordId}
        approvalRequests={approvalRequests}
        onCreateChat={() => {
          void handlers.handleCreateSession(activeProject ?? undefined);
        }}
        onSelectRecentChat={handlers.handleSelectRecentChat}
        sessions={sessionsState.sessions}
        threads={threads}
      />
    ),
    terminals: <InnerSidebarTerminals onActivateInDock={openDock} />,
    code: <InnerSidebarCode activeProject={activeProject} />,
  };
}

// ── Rail surface view ──────────────────────────────────────────────────────────

interface RailSurfaceViewProps {
  activeProject: string | null;
  activeTab: ReturnType<LayoutState['getProjectState']>['activeInnerTab'];
  projects: string[];
  railHandlers: RailHandlers;
  statusByProject?: Record<string, 'complete' | 'error'>;
  tabContents: InnerTabContents;
  agentStatusBySessionRecordId: Record<string, 'running' | 'complete' | 'error'>;
}

function RailSurfaceView(props: RailSurfaceViewProps): React.ReactElement {
  return (
    <>
      <OuterProjectRail
        projects={props.projects}
        activeProject={props.activeProject}
        onSelectProject={props.railHandlers.handleSelectProject}
        onAddProject={props.railHandlers.handleAddProject}
        onRemoveProject={props.railHandlers.handleRemoveProject}
        onOpenSettings={props.railHandlers.handleOpenSettings}
        statusByProject={props.statusByProject}
      />
      <InnerSidebar
        activeProject={props.activeProject}
        activeTab={props.activeTab}
        onSelectTab={props.railHandlers.handleSelectTab}
        chatsContent={props.tabContents.chats}
        terminalsContent={props.tabContents.terminals}
        codeContent={props.tabContents.code}
      />
    </>
  );
}

// ── Public entry ───────────────────────────────────────────────────────────────

export interface TwoTierRailSurfaceProps {
  layout: LayoutState;
  sessionsState: SessionsState;
  threads: AgentChatThreadRecord[];
  approvalRequests: ApprovalRequest[];
  compare: CompareState;
  handlers: WorkbenchHandlers;
  dock: DockState;
}

function useAgentIndicators(sessions: SessionRecord[]) {
  const { primary, secondary } = useProjectTerminalsContext();
  const { statusByProject, statusByClaudeSessionId, markProjectViewed, markSessionViewed } =
    useAgentCompletionIndicatorsContext();
  const terminalClaudeIds = React.useMemo(
    () => buildTerminalClaudeIdMap([...primary.sessions, ...secondary.sessions]),
    [primary.sessions, secondary.sessions],
  );
  const agentStatusBySessionRecordId = React.useMemo(
    () => deriveAgentStatusBySessionRecordId(sessions, terminalClaudeIds, statusByClaudeSessionId),
    [sessions, terminalClaudeIds, statusByClaudeSessionId],
  );
  return {
    agentStatusBySessionRecordId,
    terminalClaudeIds,
    statusByProject,
    markProjectViewed,
    markSessionViewed,
  };
}

function useSelectSessionWithMark(
  handlers: WorkbenchHandlers,
  sessions: SessionRecord[],
  terminalClaudeIds: Map<string, string>,
  markSessionViewed: (id: string) => void,
): (sessionId: string) => void {
  return React.useCallback(
    (sessionId: string) => {
      handlers.handleSelectSession(sessionId);
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      for (const terminalId of session.activeTerminalIds) {
        const claudeId = terminalClaudeIds.get(terminalId);
        if (claudeId) markSessionViewed(claudeId);
      }
    },
    [handlers, sessions, terminalClaudeIds, markSessionViewed],
  );
}

function useHandlersWithMark(
  handlers: WorkbenchHandlers,
  sessions: SessionRecord[],
  terminalClaudeIds: Map<string, string>,
  markSessionViewed: (id: string) => void,
): WorkbenchHandlers {
  const sel = useSelectSessionWithMark(handlers, sessions, terminalClaudeIds, markSessionViewed);
  return React.useMemo(() => ({ ...handlers, handleSelectSession: sel }), [handlers, sel]);
}

export function TwoTierRailSurface(props: TwoTierRailSurfaceProps): React.ReactElement {
  const { layout, sessionsState, threads, approvalRequests, dock, handlers } = props;
  const { isLoaded: projectsReady } = useProject();
  const { isLoading: configLoading } = useConfig();
  const isReady = projectsReady && !configLoading;
  const activeProject = layout.activeProject;
  const projectState = layout.getProjectState(activeProject ?? '');
  const projects = useWorkbenchProjects();
  useActiveProjectValidator(layout, projects, isReady);
  const indicators = useAgentIndicators(sessionsState.sessions);
  const handlersWithMark = useHandlersWithMark(
    handlers,
    sessionsState.sessions,
    indicators.terminalClaudeIds,
    indicators.markSessionViewed,
  );
  const railHandlers = useRailHandlers(layout, indicators.markProjectViewed);
  return (
    <RailSurfaceView
      activeProject={activeProject}
      activeTab={projectState.activeInnerTab}
      agentStatusBySessionRecordId={indicators.agentStatusBySessionRecordId}
      projects={projects}
      railHandlers={railHandlers}
      statusByProject={indicators.statusByProject}
      tabContents={buildInnerTabContents({
        activeProject,
        agentStatusBySessionRecordId: indicators.agentStatusBySessionRecordId,
        approvalRequests,
        dock,
        handlers: handlersWithMark,
        sessionsState,
        threads,
      })}
    />
  );
}
