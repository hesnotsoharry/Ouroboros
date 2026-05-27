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
import { OPEN_SETTINGS_EVENT } from '../../../hooks/appEventNames';
import { useConfig } from '../../../hooks/useConfig';
import { useAgentCompletionIndicatorsContext } from './AgentCompletionIndicatorsContext';
import type { DockState, LayoutState } from './ChatWorkbenchBody.model';
import { InnerSidebar } from './InnerSidebar';
import { InnerSidebarCode } from './InnerSidebarCode';
import { InnerSidebarTerminals } from './InnerSidebarTerminals';
import { OuterProjectRail } from './OuterProjectRail';

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
  dock: DockState;
}

interface InnerTabContents {
  terminals: React.ReactNode;
  code: React.ReactNode;
}

function buildInnerTabContents(args: InnerTabContentsArgs): InnerTabContents {
  const { activeProject, dock } = args;
  const openDock = (): void => {
    dock.setVisible(true);
  };
  return {
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
        terminalsContent={props.tabContents.terminals}
        codeContent={props.tabContents.code}
      />
    </>
  );
}

// ── Public entry ───────────────────────────────────────────────────────────────

export interface TwoTierRailSurfaceProps {
  layout: LayoutState;
  dock: DockState;
}

function useAgentIndicators() {
  const { statusByProject, markProjectViewed } = useAgentCompletionIndicatorsContext();
  return {
    statusByProject,
    markProjectViewed,
  };
}

export function TwoTierRailSurface(props: TwoTierRailSurfaceProps): React.ReactElement {
  const { layout, dock } = props;
  const { isLoaded: projectsReady } = useProject();
  const { isLoading: configLoading } = useConfig();
  const isReady = projectsReady && !configLoading;
  const activeProject = layout.activeProject;
  const projectState = layout.getProjectState(activeProject ?? '');
  const projects = useWorkbenchProjects();
  useActiveProjectValidator(layout, projects, isReady);
  const indicators = useAgentIndicators();
  const railHandlers = useRailHandlers(layout, indicators.markProjectViewed);
  return (
    <RailSurfaceView
      activeProject={activeProject}
      activeTab={projectState.activeInnerTab}
      projects={projects}
      railHandlers={railHandlers}
      statusByProject={indicators.statusByProject}
      tabContents={buildInnerTabContents({
        activeProject,
        dock,
      })}
    />
  );
}
