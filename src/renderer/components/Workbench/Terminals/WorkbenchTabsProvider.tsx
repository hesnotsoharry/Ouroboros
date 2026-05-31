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

function spawnRestoredCcTabs(
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
    // Cold-start: always spawn FRESH — never resume a stale session.
    // Tab structure (label, id) is preserved; the CC session itself starts new.
    spawnTab(tab.id, 'cc', cwd);
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

/**
 * Manages initial collection state from restore and CC fresh-spawn.
 * Keyed by projectRoot — re-initializes when projectRoot changes (in-place
 * project switching without provider remount).
 *
 * ID-match invariant: the tab id passed to spawnTab/spawnClaude on cold start
 * MUST equal the tab id already held in `collection.activeTabId` (the id that
 * useWorkbenchTabsContext exposes and TerminalShell displays). We use
 * `collection.tabs[0]` — the tab that makeDefaultCollection put into useState —
 * instead of building a fresh tab here (which would produce a DIFFERENT id and
 * cause a blank terminal).
 */
function useTabRestoreInit(args: TabRestoreInitArgs): void {
  const { restoredCollection, isReady, spawnedTabsRef, cwd, projectRoot } = args;
  const { cachedCollection, collectionRef, setCollection } = args;
  const initializedForRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isReady || cwd === undefined) return;
    if (initializedForRef.current === projectRoot) return;
    initializedForRef.current = projectRoot;
    if (cachedCollection && cachedCollection.tabs.length > 0) {
      // [trace:bind] restoreInit:cached — switching back to a previously-visited
      // project. The in-memory cache has its collection; NO new spawn happens here.
      // eslint-disable-next-line no-console
      console.warn('[trace:bind] restoreInit:cached', {
        projectRoot,
        cachedTabId: cachedCollection.tabs[0]?.id ?? null,
      });
      setCollection(cachedCollection);
      return;
    }
    if (restoredCollection && restoredCollection.tabs.length > 0) {
      setCollection(restoredCollection);
    } else {
      // Cold-start: spawn the tab already in collection state (read via ref so
      // we always get the latest value, even if useProjectSwitch reset it).
      // collectionRef.current.tabs[0] is the tab that makeDefaultCollection put
      // into useState — its id is what useWorkbenchTabsContext exposes as activeTabId.
      // Using collectionRef (not a closure-captured snapshot) guarantees
      // spawned-id === displayed activeTabId (the blank-screen invariant).
      const tab = collectionRef.current.tabs[0];
      // [trace:bind] restoreInit:coldStart — no cache and no persisted restore;
      // spawning a fresh Claude for this pane.
      // tab.id = the OUROBOROS_PANE_ID that will be injected into the new process env.
      // alreadySpawned = true means the duplicate guard fires and spawnTab is skipped.
      // eslint-disable-next-line no-console
      console.warn('[trace:bind] restoreInit:coldStart', {
        projectRoot,
        tabId: tab?.id ?? null,
        alreadySpawned: tab ? spawnedTabsRef.current.has(tab.id) : null,
      });
      if (tab && !spawnedTabsRef.current.has(tab.id)) {
        spawnedTabsRef.current.add(tab.id);
        spawnTab(tab.id, tab.kind, cwd);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, cwd, projectRoot]);

  useEffect(() => {
    if (!isReady || !restoredCollection || restoredCollection.tabs.length === 0) return;
    if (cachedCollection && cachedCollection.tabs.length > 0) return;
    // [trace:bind] restoreInit:restoredSpawn — persisted session found and cache is
    // absent; spawning from the restored collection. paneId = tab.id (the tab id
    // that spawnRestoredCcTabs will pass as OUROBOROS_PANE_ID).
    // eslint-disable-next-line no-console
    console.warn('[trace:bind] restoreInit:restoredSpawn', {
      projectRoot,
      restoredActiveTabId: restoredCollection.activeTabId,
    });
    spawnRestoredCcTabs(restoredCollection, spawnedTabsRef.current, cwd);
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

    // [trace:bind] projectSwitch — fires when the active project changes.
    // savedUpperTabId = the outgoing project's upper tab that was just cached.
    // spawnedBeforeClear = the set of pane ids that were in spawnedTabsRef before reset.
    // After this effect: spawnedTabsRef is empty and collection state is reset to fresh
    // defaults. useTabRestoreInit will fire next (same batch) for the new projectRoot.
    // eslint-disable-next-line no-console
    console.warn('[trace:bind] projectSwitch', {
      from: prev,
      to: projectRoot,
      savedUpperTabId: getUpperColl().tabs[0]?.id ?? null,
      spawnedBeforeClear: Array.from(spawnedTabsRef.current),
    });

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
  const { frame, restoredCollection, isReady, spawnedTabsRef } = args;
  const { projectRoot, cachedCollection, collection, collectionRef, setCollection } = args;
  const cwd = projectRoot ?? undefined;
  useTabRestoreInit({
    restoredCollection, isReady, spawnedTabsRef, cwd, projectRoot, cachedCollection,
    collectionRef, setCollection,
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
    spawnedTabsRef, cachedCollections,
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
    spawnedTabsRef, cachedCollections,
  } = useProviderCollections(projectRoot);

  const upper = useFrameTabState({
    frame: 'upper',
    restoredCollection: upperCollection,
    isReady,
    spawnedTabsRef,
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
