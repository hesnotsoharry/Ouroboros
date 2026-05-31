/**
 * WorkbenchTabsProvider — singleton tab state for both workbench frames.
 *
 * Extracts the per-frame tab state machine from useWorkbenchTabs into a single
 * React context so TerminalShell and AgentSidebar share ONE TabCollection per
 * frame, eliminating the dual-instance double-spawn + pane-id mismatch
 * introduced when the hook was called from two sites (Wave 13 / bug fix).
 *
 * ONE spawnedTabsRef is shared across both frames so a given tab id is spawned
 * at most once globally, regardless of how many consumers call the context hook.
 *
 * Rules-of-Hooks: per-frame state is initialised by two explicit calls to
 * useFrameTabState (one for 'upper', one for 'lower') — NOT a dynamic loop.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { TabCollection, TabState } from '../../../types/electron';
import { useWorkbenchRestore } from './useWorkbenchRestore';
import { useWorkbenchSessionPersist } from './useWorkbenchSessionPersist';

// ── Public types ──────────────────────────────────────────────────────────────

export interface UseWorkbenchTabsResult {
  tabs: TabState[];
  activeTabId: string | null;
  addTab(opts: { kind?: 'cc' | 'shell' }): string;
  closeTab(id: string): void;
  renameTab(id: string, label: string): void;
  setActiveTab(id: string): void;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function makeTabId(frame: 'upper' | 'lower', kind: 'cc' | 'shell'): string {
  return `wb-${frame}-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultKind(frame: 'upper' | 'lower'): 'cc' | 'shell' {
  return frame === 'upper' ? 'cc' : 'shell';
}

function defaultLabel(kind: 'cc' | 'shell'): string {
  return kind === 'cc' ? 'claude' : 'shell';
}

export function buildNewTab(frame: 'upper' | 'lower', kind: 'cc' | 'shell'): TabState {
  const id = makeTabId(frame, kind);
  return { id, label: defaultLabel(kind), sessionId: id, kind, createdAt: Date.now() };
}

export function spawnTab(id: string, kind: 'cc' | 'shell', cwd: string | undefined): void {
  if (kind === 'cc') {
    void window.electronAPI?.pty?.spawnClaude?.(id, {
      cwd,
      env: { OUROBOROS_PANE_ID: id },
    });
  } else {
    void window.electronAPI?.pty?.spawn?.(id, {
      cwd,
      env: { OUROBOROS_PANE_ID: id },
    });
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
      env: { OUROBOROS_PANE_ID: tab.id },
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

function applyAddTab(prev: TabCollection, newTab: TabState): TabCollection {
  return { activeTabId: newTab.id, tabs: [...prev.tabs, newTab] };
}

function applyRenameTab(prev: TabCollection, id: string, label: string): TabCollection {
  return { ...prev, tabs: prev.tabs.map((t) => (t.id === id ? { ...t, label } : t)) };
}

// ── useTabActions ─────────────────────────────────────────────────────────────

interface TabActions {
  addTab(opts: { kind?: 'cc' | 'shell' }): string;
  closeTab(id: string): void;
  renameTab(id: string, label: string): void;
  setActiveTab(id: string): void;
}

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

// ── useTabRestoreInit ─────────────────────────────────────────────────────────

interface TabRestoreInitArgs {
  frame: 'upper' | 'lower';
  restoredCollection: TabCollection | undefined;
  isReady: boolean;
  spawnedTabsRef: React.MutableRefObject<Set<string>>;
  cwd: string | undefined;
}

/**
 * Manages initial collection state from restore and CC auto-resume on mount.
 * Synchronously creates a default tab so AgentSidebar has a pane id immediately.
 */
function useTabRestoreInit(
  args: TabRestoreInitArgs,
): [TabCollection, React.Dispatch<React.SetStateAction<TabCollection>>] {
  const { frame, restoredCollection, isReady, spawnedTabsRef, cwd } = args;
  const defaultTab = useRef<TabState>(buildNewTab(frame, defaultKind(frame)));
  const defaultCollection: TabCollection = {
    activeTabId: defaultTab.current.id,
    tabs: [defaultTab.current],
  };
  const [collection, setCollection] = useState<TabCollection>(defaultCollection);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasInitializedRef.current || cwd === undefined) return;
    hasInitializedRef.current = true;
    if (restoredCollection && restoredCollection.tabs.length > 0) {
      setCollection(restoredCollection);
    } else {
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

// ── useFrameTabState ──────────────────────────────────────────────────────────

interface FrameTabStateArgs {
  frame: 'upper' | 'lower';
  restoredCollection: TabCollection | undefined;
  isReady: boolean;
  spawnedTabsRef: React.MutableRefObject<Set<string>>;
  projectRoot: string | null;
}

/**
 * Sets up the full tab state machine for one frame.
 * Called twice in the provider — once for 'upper', once for 'lower'.
 * Rules of Hooks: never call this inside a conditional or loop.
 */
function useFrameTabState(args: FrameTabStateArgs): UseWorkbenchTabsResult {
  const { frame, restoredCollection, isReady, spawnedTabsRef, projectRoot } = args;
  const cwd = projectRoot ?? undefined;
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

// ── Context ───────────────────────────────────────────────────────────────────

interface WorkbenchTabsContextValue {
  upper: UseWorkbenchTabsResult;
  lower: UseWorkbenchTabsResult;
}

const WorkbenchTabsContext = createContext<WorkbenchTabsContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface WorkbenchTabsProviderProps {
  projectRoot: string | null;
  children: React.ReactNode;
}

export function WorkbenchTabsProvider({
  projectRoot,
  children,
}: WorkbenchTabsProviderProps): React.ReactElement {
  const { isReady, upperCollection, lowerCollection } = useWorkbenchRestore(projectRoot);
  // ONE shared ref across both frames — a tab id is spawned at most once globally.
  const spawnedTabsRef = useRef<Set<string>>(new Set());

  const upper = useFrameTabState({
    frame: 'upper',
    restoredCollection: upperCollection,
    isReady,
    spawnedTabsRef,
    projectRoot,
  });

  const lower = useFrameTabState({
    frame: 'lower',
    restoredCollection: lowerCollection,
    isReady,
    spawnedTabsRef,
    projectRoot,
  });

  const value: WorkbenchTabsContextValue = { upper, lower };

  return (
    <WorkbenchTabsContext.Provider value={value}>{children}</WorkbenchTabsContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useWorkbenchTabsContext(frame: 'upper' | 'lower'): UseWorkbenchTabsResult {
  const ctx = useContext(WorkbenchTabsContext);
  if (!ctx) {
    throw new Error('useWorkbenchTabsContext must be used inside <WorkbenchTabsProvider>');
  }
  return ctx[frame];
}
