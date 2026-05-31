/**
 * WorkbenchTabsProvider — singleton tab state for both workbench frames.
 *
 * ONE context, ONE spawnedTabsRef — a given tab id is spawned at most once
 * globally regardless of how many consumers call the context hook.
 *
 * Rules-of-Hooks: per-frame state uses two explicit useFrameTabState calls
 * (one for 'upper', one for 'lower') — NOT a dynamic loop.
 *
 * Project-switch (freeze-fix): no key-based remount; projectRoot changes are
 * handled in-place. Collections for each visited project are cached in-memory
 * so switching back restores instantly without a persist-round-trip race.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { TabCollection, TabState } from '../../../types/electron';
import { useWorkbenchRestore } from './useWorkbenchRestore';
import { useWorkbenchSessionPersist } from './useWorkbenchSessionPersist';
import {
  applyAddTab,
  applyRenameTab,
  resolveCloseResult,
  spawnRestoredShellTabs,
  spawnTab,
  trySpawnFirstShellTab,
} from './WorkbenchTabsProvider.pure';

// ── Public types ──────────────────────────────────────────────────────────────

export interface UseWorkbenchTabsResult {
  tabs: TabState[];
  activeTabId: string | null;
  /** Ids of tabs whose PTY session has been started (by user or auto-spawn). */
  spawnedTabIds: ReadonlySet<string>;
  addTab(opts: { kind?: 'cc' | 'shell' }): string;
  closeTab(id: string): void;
  renameTab(id: string, label: string): void;
  setActiveTab(id: string): void;
  /**
   * Starts a cc PTY session for the given tab id.
   * No-op if the tab was already spawned. Does NOT auto-start shell tabs —
   * shell tabs are started at collection-init time (no token cost).
   */
  spawnCcTab(tabId: string): void;
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

// ── makeDefaultCollection ──────────────────────────────────────────────────────

function makeDefaultCollection(frame: 'upper' | 'lower'): TabCollection {
  const tab = buildNewTab(frame, defaultKind(frame));
  return { activeTabId: tab.id, tabs: [tab] };
}

// ── useTabActions ─────────────────────────────────────────────────────────────

interface TabActions {
  addTab(opts: { kind?: 'cc' | 'shell' }): string;
  closeTab(id: string): void;
  renameTab(id: string, label: string): void;
  setActiveTab(id: string): void;
  spawnCcTab(tabId: string): void;
}

interface TabActionsArgs {
  frame: 'upper' | 'lower';
  cwd: string | undefined;
  spawnedTabsRef: React.MutableRefObject<Set<string>>;
  setCollection: React.Dispatch<React.SetStateAction<TabCollection>>;
  markSpawned: (id: string) => void;
}

function useTabActions(args: TabActionsArgs): TabActions {
  const { frame, cwd, spawnedTabsRef, setCollection, markSpawned } = args;
  const addTab = useCallback(
    (opts: { kind?: 'cc' | 'shell' } = {}): string => {
      const kind = opts.kind ?? defaultKind(frame);
      const newTab = buildNewTab(frame, kind);
      spawnTab(newTab.id, kind, cwd);
      spawnedTabsRef.current.add(newTab.id);
      markSpawned(newTab.id);
      setCollection((prev) => applyAddTab(prev, newTab));
      return newTab.id;
    },
    // spawnedTabsRef is a stable ref — excluded from deps intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame, cwd, setCollection, markSpawned],
  );
  const closeTab = useCallback((id: string): void => {
    setCollection((prev) => resolveCloseResult(prev, id));
    void Promise.resolve().then(() => { void window.electronAPI?.pty?.kill(id); });
  }, [setCollection]);
  const renameTab = useCallback(
    (id: string, label: string): void => { setCollection((prev) => applyRenameTab(prev, id, label)); },
    [setCollection],
  );
  const setActiveTab = useCallback(
    (id: string): void => { setCollection((prev) => ({ ...prev, activeTabId: id })); },
    [setCollection],
  );
  const spawnCcTab = useCallback(
    (tabId: string): void => {
      if (spawnedTabsRef.current.has(tabId)) return;
      spawnedTabsRef.current.add(tabId);
      markSpawned(tabId);
      spawnTab(tabId, 'cc', cwd);
    },
    // spawnedTabsRef is a stable ref — excluded from deps intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cwd, markSpawned],
  );
  return { addTab, closeTab, renameTab, setActiveTab, spawnCcTab };
}

// ── Per-project collection cache type ─────────────────────────────────────────

interface FrameCollections {
  upper: TabCollection;
  lower: TabCollection;
}

// ── useTabRestoreInit ─────────────────────────────────────────────────────────

interface TabRestoreInitArgs {
  restoredCollection: TabCollection | undefined;
  isReady: boolean;
  spawnedTabsRef: React.MutableRefObject<Set<string>>;
  cwd: string | undefined;
  projectRoot: string | null;
  cachedCollection: TabCollection | undefined;
  collectionRef: React.MutableRefObject<TabCollection>;
  setCollection: React.Dispatch<React.SetStateAction<TabCollection>>;
}

/** Applies cold-start collection resolution for one frame (shell-only auto-spawn). */
function applyColdStartCollection(
  args: TabRestoreInitArgs,
  initializedForRef: React.MutableRefObject<string | null | undefined>,
): void {
  const { restoredCollection, isReady, spawnedTabsRef, cwd, projectRoot } = args;
  const { cachedCollection, collectionRef, setCollection } = args;
  if (!isReady || cwd === undefined) return;
  if (initializedForRef.current === projectRoot) return;
  initializedForRef.current = projectRoot;
  if (cachedCollection && cachedCollection.tabs.length > 0) { setCollection(cachedCollection); return; }
  if (restoredCollection && restoredCollection.tabs.length > 0) { setCollection(restoredCollection); return; }
  trySpawnFirstShellTab(collectionRef.current, spawnedTabsRef.current, cwd);
}

/** Manages initial collection state (shell auto-spawn; CC gated). */
function useTabRestoreInit(args: TabRestoreInitArgs): void {
  const { restoredCollection, isReady, spawnedTabsRef, cwd, projectRoot } = args;
  const { cachedCollection } = args;
  const initializedForRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    applyColdStartCollection(args, initializedForRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, cwd, projectRoot]);

  useEffect(() => {
    if (!isReady || !restoredCollection || restoredCollection.tabs.length === 0) return;
    if (cachedCollection && cachedCollection.tabs.length > 0) return;
    spawnRestoredShellTabs(restoredCollection, spawnedTabsRef.current, cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, projectRoot]);
}

// ── useProjectSwitch ──────────────────────────────────────────────────────────

interface ProjectSwitchArgs {
  projectRoot: string | null;
  getUpperColl: () => TabCollection;
  getLowerColl: () => TabCollection;
  cacheRef: React.MutableRefObject<Map<string, FrameCollections>>;
  spawnedTabsRef: React.MutableRefObject<Set<string>>;
  setUpperCollection: React.Dispatch<React.SetStateAction<TabCollection>>;
  setLowerCollection: React.Dispatch<React.SetStateAction<TabCollection>>;
}

/**
 * Detects projectRoot changes and saves the outgoing project's collections to
 * the in-memory cache. Resets collection state and spawnedTabsRef for the new
 * project so useTabRestoreInit can initialize it cleanly.
 */
function useProjectSwitch(args: ProjectSwitchArgs): void {
  const {
    projectRoot,
    getUpperColl,
    getLowerColl,
    cacheRef,
    spawnedTabsRef,
    setUpperCollection,
    setLowerCollection,
  } = args;

  const prevProjectRootRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const prev = prevProjectRootRef.current;
    if (prev === projectRoot) return;

    // Save outgoing project's collections (skip the undefined sentinel on first run).
    if (prev !== undefined && prev !== null) {
      cacheRef.current.set(prev, { upper: getUpperColl(), lower: getLowerColl() });
    }
    prevProjectRootRef.current = projectRoot;

    // On first mount (prev === undefined) useState already initialised the
    // collections via makeDefaultCollection — resetting again would create new
    // tab ids that don't match what useTabRestoreInit will read from collectionRef,
    // causing a blank terminal (the id-match invariant). Only reset when genuinely
    // switching away from a known project root.
    if (prev === undefined) return;

    // Reset spawned-tabs set so old ids don't block new project's spawns.
    spawnedTabsRef.current = new Set<string>();

    // Reset to fresh default placeholders while restore loads for new project.
    setUpperCollection(makeDefaultCollection('upper'));
    setLowerCollection(makeDefaultCollection('lower'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRoot]);
}

// ── useFrameTabState ──────────────────────────────────────────────────────────

interface FrameTabStateArgs {
  frame: 'upper' | 'lower';
  restoredCollection: TabCollection | undefined;
  isReady: boolean;
  spawnedTabsRef: React.MutableRefObject<Set<string>>;
  spawnedTabIdsState: ReadonlySet<string>;
  markSpawned: (id: string) => void;
  projectRoot: string | null;
  cachedCollection: TabCollection | undefined;
  collection: TabCollection;
  collectionRef: React.MutableRefObject<TabCollection>;
  setCollection: React.Dispatch<React.SetStateAction<TabCollection>>;
}

/**
 * Sets up the full tab state machine for one frame.
 * Called twice in the provider — once for 'upper', once for 'lower'.
 * Rules of Hooks: never call this inside a conditional or loop.
 */
function useFrameTabState(args: FrameTabStateArgs): UseWorkbenchTabsResult {
  const { frame, restoredCollection, isReady, spawnedTabsRef, spawnedTabIdsState } = args;
  const { markSpawned, projectRoot, cachedCollection, collection, collectionRef, setCollection } = args;
  const cwd = projectRoot ?? undefined;
  useTabRestoreInit({
    restoredCollection, isReady, spawnedTabsRef, cwd, projectRoot, cachedCollection,
    collectionRef, setCollection,
  });
  useWorkbenchSessionPersist({ frame, projectRoot, tabCollection: collection });
  const actions = useTabActions({ frame, cwd, spawnedTabsRef, setCollection, markSpawned });
  return {
    tabs: collection.tabs,
    activeTabId: collection.activeTabId,
    spawnedTabIds: spawnedTabIdsState,
    ...actions,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

interface WorkbenchTabsContextValue {
  upper: UseWorkbenchTabsResult;
  lower: UseWorkbenchTabsResult;
}

const WorkbenchTabsContext = createContext<WorkbenchTabsContextValue | null>(null);

// ── useProviderCollections ────────────────────────────────────────────────────

/** Owns per-frame collections, in-memory project cache, and spawned-tabs ref. */
function useProviderCollections(projectRoot: string | null) {
  const projectCacheRef = useRef<Map<string, FrameCollections>>(new Map());
  const cachedCollections = projectRoot ? projectCacheRef.current.get(projectRoot) : undefined;
  const [upperColl, setUpperColl] = useState<TabCollection>(() => makeDefaultCollection('upper'));
  const [lowerColl, setLowerColl] = useState<TabCollection>(() => makeDefaultCollection('lower'));
  const upperCollRef = useRef(upperColl);
  upperCollRef.current = upperColl;
  const lowerCollRef = useRef(lowerColl);
  lowerCollRef.current = lowerColl;
  const spawnedTabsRef = useRef<Set<string>>(new Set());
  // Reactive copy of spawnedTabsRef for UI detection (spawnedTabsRef itself is
  // a mutable ref — not reactive. spawnedTabIdsState triggers re-renders when
  // a cc tab is started by the user clicking "Start Claude".)
  const [spawnedTabIdsState, setSpawnedTabIdsState] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const markSpawned = useCallback((id: string): void => {
    setSpawnedTabIdsState((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useProjectSwitch({
    projectRoot,
    getUpperColl: () => upperCollRef.current,
    getLowerColl: () => lowerCollRef.current,
    cacheRef: projectCacheRef,
    spawnedTabsRef,
    setUpperCollection: setUpperColl,
    setLowerCollection: setLowerColl,
  });

  return {
    upperColl, setUpperColl, upperCollRef,
    lowerColl, setLowerColl, lowerCollRef,
    spawnedTabsRef, spawnedTabIdsState, markSpawned, cachedCollections,
  };
}

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
  const {
    upperColl, setUpperColl, upperCollRef,
    lowerColl, setLowerColl, lowerCollRef,
    spawnedTabsRef, spawnedTabIdsState, markSpawned, cachedCollections,
  } = useProviderCollections(projectRoot);

  const upper = useFrameTabState({
    frame: 'upper',
    restoredCollection: upperCollection,
    isReady,
    spawnedTabsRef,
    spawnedTabIdsState,
    markSpawned,
    projectRoot,
    cachedCollection: cachedCollections?.upper,
    collection: upperColl,
    collectionRef: upperCollRef,
    setCollection: setUpperColl,
  });

  const lower = useFrameTabState({
    frame: 'lower',
    restoredCollection: lowerCollection,
    isReady,
    spawnedTabsRef,
    spawnedTabIdsState,
    markSpawned,
    projectRoot,
    cachedCollection: cachedCollections?.lower,
    collection: lowerColl,
    collectionRef: lowerCollRef,
    setCollection: setLowerColl,
  });

  return (
    <WorkbenchTabsContext.Provider value={{ upper, lower }}>{children}</WorkbenchTabsContext.Provider>
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

/**
 * Safe variant of useWorkbenchTabsContext — returns null instead of throwing when
 * called outside a WorkbenchTabsProvider. Used by the AgentGlobe pane-id derivation
 * so the globe degrades gracefully in test isolation without a provider wrapper.
 */
export function useWorkbenchTabsContextSafe(
  frame: 'upper' | 'lower',
): UseWorkbenchTabsResult | null {
  const ctx = useContext(WorkbenchTabsContext);
  return ctx ? ctx[frame] : null;
}
