/**
 * useWorkbenchTabs — per-project terminal tab state machine (Wave 12 Phase 3).
 *
 * Manages the tab collection for one frame (upper or lower) of the workbench
 * terminal pane. State is initialized from `useWorkbenchRestore` and persisted
 * via `useWorkbenchSessionPersist`.
 *
 * StrictMode-safe: per-tab spawn guard (`spawnedTabsRef`) prevents double-spawn
 * on the mount → cleanup → mount cycle.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useWorkbenchRestore } from './useWorkbenchRestore';
import { useWorkbenchSessionPersist } from './useWorkbenchSessionPersist';

export interface TabState {
  id: string;
  label: string;
  sessionId: string;
  kind: 'cc' | 'shell';
  createdAt: number;
}

export interface TabCollection {
  activeTabId: string | null;
  tabs: TabState[];
}

export interface UseWorkbenchTabsResult {
  tabs: TabState[];
  activeTabId: string | null;
  addTab(opts: { kind?: 'cc' | 'shell' }): string;
  closeTab(id: string): void;
  renameTab(id: string, label: string): void;
  setActiveTab(id: string): void;
}

function makeTabId(frame: 'upper' | 'lower', kind: 'cc' | 'shell'): string {
  return `wb-${frame}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultKind(frame: 'upper' | 'lower'): 'cc' | 'shell' {
  return frame === 'upper' ? 'cc' : 'shell';
}

function defaultLabel(kind: 'cc' | 'shell'): string {
  return kind === 'cc' ? 'claude' : 'shell';
}

/**
 * buildSpawnEnv — constructs the env object injected into every pty spawn for
 * OUROBOROS_PANE_ID round-trip binding (Wave 13 D6).
 *
 * Both spawnTab AND autoResumeCcTab MUST call this helper. Any future spawn
 * site added to this file must also use buildSpawnEnv — it is the single
 * injection point for pane-id env propagation.
 */
export const buildSpawnEnv = (tabId: string): { OUROBOROS_PANE_ID: string } => ({
  OUROBOROS_PANE_ID: tabId,
});

function spawnTab(id: string, kind: 'cc' | 'shell', cwd: string | undefined): void {
  if (kind === 'cc') {
    void window.electronAPI?.pty?.spawnClaude?.(id, { cwd, env: buildSpawnEnv(id) });
  } else {
    void window.electronAPI?.pty?.spawn?.(id, { cwd, env: buildSpawnEnv(id) });
  }
}

function autoResumeCcTab(
  collection: TabCollection,
  spawned: Set<string>,
  cwd: string | undefined,
): void {
  const { tabs, activeTabId } = collection;
  for (const tab of tabs) {
    if (tab.kind !== 'cc') continue;
    if (tab.id !== activeTabId && activeTabId !== null) continue;
    if (spawned.has(tab.id)) break;
    spawned.add(tab.id);
    void window.electronAPI?.pty?.spawnClaude?.(tab.id, {
      cwd,
      resumeMode: tab.sessionId,
      env: buildSpawnEnv(tab.id),
    });
    break;
  }
}

function resolveCloseResult(prev: TabCollection, id: string): TabCollection {
  const remaining = prev.tabs.filter((t) => t.id !== id);
  if (prev.activeTabId !== id) return { activeTabId: prev.activeTabId, tabs: remaining };
  const closedIdx = prev.tabs.findIndex((t) => t.id === id);
  const nextTab = remaining[closedIdx] ?? remaining[closedIdx - 1] ?? null;
  return { activeTabId: nextTab?.id ?? null, tabs: remaining };
}

function buildNewTab(frame: 'upper' | 'lower', kind: 'cc' | 'shell'): TabState {
  const id = makeTabId(frame, kind);
  return { id, label: defaultLabel(kind), sessionId: id, kind, createdAt: Date.now() };
}

function applyAddTab(prev: TabCollection, newTab: TabState): TabCollection {
  return { activeTabId: newTab.id, tabs: [...prev.tabs, newTab] };
}

function applyRenameTab(prev: TabCollection, id: string, label: string): TabCollection {
  return { ...prev, tabs: prev.tabs.map((t) => (t.id === id ? { ...t, label } : t)) };
}

interface TabActions {
  addTab(opts: { kind?: 'cc' | 'shell' }): string;
  closeTab(id: string): void;
  renameTab(id: string, label: string): void;
  setActiveTab(id: string): void;
}

/** Stable tab-mutation callbacks — memoised via useCallback. */
function useTabActions(
  frame: 'upper' | 'lower',
  cwd: string | undefined,
  spawnedTabsRef: React.MutableRefObject<Set<string>>,
  setCollection: React.Dispatch<React.SetStateAction<TabCollection>>,
): TabActions {
  const addTab = useCallback(
    (opts: { kind?: 'cc' | 'shell' } = {}): string => {
      const kind = opts.kind ?? defaultKind(frame);
      const newTab = buildNewTab(frame, kind);
      spawnTab(newTab.id, kind, cwd);
      spawnedTabsRef.current.add(newTab.id);
      setCollection((prev) => applyAddTab(prev, newTab));
      return newTab.id;
    },
    // spawnedTabsRef is a stable ref — intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame, cwd, setCollection],
  );
  const closeTab = useCallback(
    (id: string): void => {
      setCollection((prev) => resolveCloseResult(prev, id));
      void Promise.resolve().then(() => {
        void window.electronAPI?.pty?.kill(id);
      });
    },
    [setCollection],
  );
  const renameTab = useCallback(
    (id: string, label: string): void => {
      setCollection((prev) => applyRenameTab(prev, id, label));
    },
    [setCollection],
  );
  const setActiveTab = useCallback(
    (id: string): void => {
      setCollection((prev) => ({ ...prev, activeTabId: id }));
    },
    [setCollection],
  );
  return { addTab, closeTab, renameTab, setActiveTab };
}

interface TabRestoreInitArgs {
  frame: 'upper' | 'lower';
  restoredCollection: TabCollection | undefined;
  isReady: boolean;
  spawnedTabsRef: React.MutableRefObject<Set<string>>;
  cwd: string | undefined;
}

/**
 * Manages initial collection state from restore and CC auto-resume on mount.
 *
 * Wave 13 Phase 2: creates a default tab synchronously on first render (when no
 * restored collection exists). This gives useActivePaneId() a stable pane id from
 * the very first render so the AgentSidebar can bind deterministically. The default
 * tab is spawned once isReady fires. When a restored collection IS available,
 * the isReady effect overwrites the default tab as before.
 */
function useTabRestoreInit(
  args: TabRestoreInitArgs,
): [TabCollection, React.Dispatch<React.SetStateAction<TabCollection>>] {
  const { frame, restoredCollection, isReady, spawnedTabsRef, cwd } = args;
  // Default tab created synchronously — gives AgentSidebar a pane id on first render.
  const defaultTab = useRef<TabState>(buildNewTab(frame, defaultKind(frame)));
  const defaultCollection: TabCollection = {
    activeTabId: defaultTab.current.id,
    tabs: [defaultTab.current],
  };
  const [collection, setCollection] = useState<TabCollection>(defaultCollection);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Defer spawn until both isReady AND a valid project cwd are available.
    // cwd is undefined when projectRoot is null (no project loaded yet) —
    // setting hasInitializedRef too early would prevent re-entry once the
    // correct root arrives, causing the CC terminal to launch in the wrong dir.
    if (!isReady || hasInitializedRef.current || cwd === undefined) return;
    hasInitializedRef.current = true;
    if (restoredCollection && restoredCollection.tabs.length > 0) {
      // Restored session — overwrite the default tab with the persisted collection.
      setCollection(restoredCollection);
    } else {
      // No restore data — spawn the default tab now that the pty layer is ready.
      const tab = defaultTab.current;
      if (!spawnedTabsRef.current.has(tab.id)) {
        spawnedTabsRef.current.add(tab.id);
        spawnTab(tab.id, tab.kind, cwd);
      }
    }
  }, [isReady, restoredCollection, cwd, spawnedTabsRef]);

  useEffect(() => {
    if (!isReady || !restoredCollection || restoredCollection.tabs.length === 0) return;
    autoResumeCcTab(restoredCollection, spawnedTabsRef.current, cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return [collection, setCollection];
}

export function useWorkbenchTabs(
  frame: 'upper' | 'lower',
  projectRoot: string | null,
): UseWorkbenchTabsResult {
  const { isReady, upperCollection, lowerCollection } = useWorkbenchRestore(projectRoot);
  const restoredCollection = frame === 'upper' ? upperCollection : lowerCollection;
  const cwd = projectRoot ?? undefined;
  const spawnedTabsRef = useRef<Set<string>>(new Set());
  const [collection, setCollection] = useTabRestoreInit({
    frame,
    restoredCollection,
    isReady,
    spawnedTabsRef,
    cwd,
  });
  useWorkbenchSessionPersist({ frame, projectRoot, tabCollection: collection });
  const actions = useTabActions(frame, cwd, spawnedTabsRef, setCollection);
  return { tabs: collection.tabs, activeTabId: collection.activeTabId, ...actions };
}
