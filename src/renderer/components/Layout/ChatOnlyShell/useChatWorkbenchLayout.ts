import { useCallback, useEffect, useState } from 'react';

import type { InnerSidebarTab } from './InnerSidebar';

const STORAGE_KEY = 'agent-ide:chat-workbench-layout';

export type ChatWorkbenchUtilityTab = 'activity' | 'approvals' | 'monitor';

// ── Per-project state ─────────────────────────────────────────────────────────

export interface ProjectRailState {
  activeInnerTab: InnerSidebarTab;
}

const DEFAULT_PROJECT_STATE: ProjectRailState = { activeInnerTab: 'chats' };

function isInnerTab(v: unknown): v is InnerSidebarTab {
  return v === 'chats' || v === 'terminals' || v === 'code';
}

function parseProjectStates(raw: unknown): Record<string, ProjectRailState> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, ProjectRailState> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      result[key] = { activeInnerTab: isInnerTab(v.activeInnerTab) ? v.activeInnerTab : 'chats' };
    }
  }
  return result;
}

// ── Top-level layout state ─────────────────────────────────────────────────────

// Wave 95 Phase H continuation: artifact pane removed. RightPaneView only has
// 'utility' now, but kept as a union for localStorage backward-compat reads.
export type RightPaneView = 'utility' | 'artifact';

export interface ChatWorkbenchLayoutState {
  railOpen: boolean;
  utilityOpen: boolean;
  activeUtilityTab: ChatWorkbenchUtilityTab;
  activeProject: string | null;
  projectStates: Record<string, ProjectRailState>;
}

export interface ChatWorkbenchLayoutApi extends ChatWorkbenchLayoutState {
  toggleRail: () => void;
  setRailOpen: (open: boolean) => void;
  toggleUtility: () => void;
  setUtilityOpen: (open: boolean) => void;
  setActiveUtilityTab: (tab: ChatWorkbenchUtilityTab) => void;
  setActiveProject: (projectPath: string | null) => void;
  setActiveInnerTab: (projectPath: string, tab: InnerSidebarTab) => void;
  getProjectState: (projectPath: string) => ProjectRailState;
  // Named alias for direct button binding
  isUtilityOpen: boolean;
  // Right pane (utility only — artifact pane removed in Wave 95 Phase H)
  rightPaneOpen: boolean;
  rightPaneView: RightPaneView | null;
  toggleRightPane: () => void;
  setRightPaneView: () => void;
}

const DEFAULT_STATE: ChatWorkbenchLayoutState = {
  railOpen: true,
  utilityOpen: false,
  activeUtilityTab: 'activity',
  activeProject: null,
  projectStates: {},
};

// ── Persistence ────────────────────────────────────────────────────────────────

function isUtilityTab(value: unknown): value is ChatWorkbenchUtilityTab {
  return value === 'activity' || value === 'approvals' || value === 'monitor';
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

function readPersisted(): ChatWorkbenchLayoutState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Cold boot on mobile — start with rail closed so chat fills the screen.
      return isMobileViewport() ? { ...DEFAULT_STATE, railOpen: false } : DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      railOpen: Boolean(parsed.railOpen),
      utilityOpen: Boolean(parsed.utilityOpen),
      activeUtilityTab: isUtilityTab(parsed.activeUtilityTab)
        ? parsed.activeUtilityTab
        : DEFAULT_STATE.activeUtilityTab,
      activeProject: typeof parsed.activeProject === 'string' ? parsed.activeProject : null,
      projectStates: parseProjectStates(parsed.projectStates),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function persist(state: ChatWorkbenchLayoutState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors for non-critical UI state.
  }
}

// ── Callback builders ─────────────────────────────────────────────────────────

type Setter = React.Dispatch<React.SetStateAction<ChatWorkbenchLayoutState>>;

function applyUtilityOpen(p: ChatWorkbenchLayoutState, open: boolean): ChatWorkbenchLayoutState {
  return { ...p, utilityOpen: open };
}

function buildCallbacks(setState: Setter) {
  return {
    toggleRail: () => setState((p) => ({ ...p, railOpen: !p.railOpen })),
    setRailOpen: (open: boolean) => setState((p) => ({ ...p, railOpen: open })),
    toggleUtility: () => setState((p) => applyUtilityOpen(p, !p.utilityOpen)),
    setUtilityOpen: (open: boolean) => setState((p) => applyUtilityOpen(p, open)),
    setActiveUtilityTab: (tab: ChatWorkbenchUtilityTab) =>
      setState((p) => ({ ...p, activeUtilityTab: tab })),
    setActiveProject: (projectPath: string | null) => {
      setState((p) => ({ ...p, activeProject: projectPath }));
    },
    setActiveInnerTab: (projectPath: string, tab: InnerSidebarTab) =>
      setState((p) => ({
        ...p,
        projectStates: {
          ...p.projectStates,
          [projectPath]: {
            ...DEFAULT_PROJECT_STATE,
            ...p.projectStates[projectPath],
            activeInnerTab: tab,
          },
        },
      })),
    // toggleRightPane / setRightPaneView kept for mobile path — only utility exists now.
    toggleRightPane: () => setState((p) => applyUtilityOpen(p, !p.utilityOpen)),
    setRightPaneView: () => setState((p) => applyUtilityOpen(p, true)),
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

function useStableCallbacks(setState: Setter): ReturnType<typeof buildCallbacks> {
  const cbs = buildCallbacks(setState);
  /* eslint-disable react-hooks/exhaustive-deps */
  return {
    toggleRail: useCallback(cbs.toggleRail, [setState]),
    setRailOpen: useCallback(cbs.setRailOpen, [setState]),
    toggleUtility: useCallback(cbs.toggleUtility, [setState]),
    setUtilityOpen: useCallback(cbs.setUtilityOpen, [setState]),
    setActiveUtilityTab: useCallback(cbs.setActiveUtilityTab, [setState]),
    setActiveProject: useCallback(cbs.setActiveProject, [setState]),
    setActiveInnerTab: useCallback(cbs.setActiveInnerTab, [setState]),
    toggleRightPane: useCallback(cbs.toggleRightPane, [setState]),
    setRightPaneView: useCallback(cbs.setRightPaneView, [setState]),
  };
  /* eslint-enable react-hooks/exhaustive-deps */
}

function deriveRightPane(state: ChatWorkbenchLayoutState): {
  isUtilityOpen: boolean;
  rightPaneOpen: boolean;
  rightPaneView: RightPaneView | null;
} {
  return {
    isUtilityOpen: state.utilityOpen,
    rightPaneOpen: state.utilityOpen,
    rightPaneView: state.utilityOpen ? 'utility' : null,
  };
}

export function useChatWorkbenchLayout(): ChatWorkbenchLayoutApi {
  const [state, setState] = useState<ChatWorkbenchLayoutState>(() => readPersisted());
  useEffect(() => {
    persist(state);
  }, [state]);
  const callbacks = useStableCallbacks(setState);
  const getProjectState = useCallback(
    (projectPath: string): ProjectRailState =>
      state.projectStates[projectPath] ?? DEFAULT_PROJECT_STATE,
    [state.projectStates],
  );
  return { ...state, ...callbacks, ...deriveRightPane(state), getProjectState };
}
