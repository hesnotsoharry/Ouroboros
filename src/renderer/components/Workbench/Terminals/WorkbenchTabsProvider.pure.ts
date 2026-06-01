/**
 * WorkbenchTabsProvider.pure — side-effect-free collection helpers and spawn utilities.
 * Extracted from WorkbenchTabsProvider.tsx to keep it under the 300-line lint limit.
 */

import type { TabCollection, TabState } from '../../../types/electron';

// ── Open-pane union helper ────────────────────────────────────────────────────

/**
 * Collects all tab ids from an iterable of TabCollections into a single Set.
 * Used to build the union of active + cached project pane ids so the rail/globe
 * "working" indicator is not dropped when the user navigates to a different project
 * (the parked project's panes must remain in the open set).
 */
export function collectOpenPaneIds(collections: Iterable<TabCollection>): Set<string> {
  const ids = new Set<string>();
  for (const c of collections) for (const t of c.tabs) ids.add(t.id);
  return ids;
}

// ── Collection mutation helpers ────────────────────────────────────────────────

export function resolveCloseResult(prev: TabCollection, id: string): TabCollection {
  const remaining = prev.tabs.filter((t) => t.id !== id);
  if (prev.activeTabId !== id) return { activeTabId: prev.activeTabId, tabs: remaining };
  const closedIdx = prev.tabs.findIndex((t) => t.id === id);
  const nextTab = remaining[closedIdx] ?? remaining[closedIdx - 1] ?? null;
  return { activeTabId: nextTab?.id ?? null, tabs: remaining };
}

export function applyAddTab(prev: TabCollection, newTab: TabState): TabCollection {
  return { activeTabId: newTab.id, tabs: [...prev.tabs, newTab] };
}

export function applyRenameTab(prev: TabCollection, id: string, label: string): TabCollection {
  return { ...prev, tabs: prev.tabs.map((t) => (t.id === id ? { ...t, label } : t)) };
}

// ── Spawn utilities ───────────────────────────────────────────────────────────

export function spawnTab(id: string, kind: 'cc' | 'shell', cwd: string | undefined): void {
  if (kind === 'cc') {
    void window.electronAPI?.pty?.spawnClaude?.(id, { cwd, env: { OUROBOROS_PANE_ID: id } });
  } else {
    void window.electronAPI?.pty?.spawn?.(id, { cwd, env: { OUROBOROS_PANE_ID: id } });
  }
}

/** Auto-spawns shell tabs from a restored collection. CC tabs are excluded. */
export function spawnRestoredShellTabs(
  collection: TabCollection,
  spawned: Set<string>,
  cwd: string | undefined,
): void {
  for (const tab of collection.tabs) {
    if (tab.kind !== 'shell' || spawned.has(tab.id)) continue;
    spawned.add(tab.id);
    spawnTab(tab.id, 'shell', cwd);
  }
}

export function trySpawnFirstShellTab(
  coll: TabCollection,
  spawned: Set<string>,
  cwd: string,
): void {
  const tab = coll.tabs[0];
  if (!tab || tab.kind !== 'shell' || spawned.has(tab.id)) return;
  spawned.add(tab.id);
  spawnTab(tab.id, 'shell', cwd);
}
