/**
 * WorkbenchTabsProvider.pure.test.ts — Unit tests for pure helpers.
 *
 * Covers collectOpenPaneIds (the open-pane union used by the rail/globe working
 * indicator) and the collection-mutation helpers.
 */

import { describe, expect, it } from 'vitest';

import type { TabCollection } from '../../../../types/electron';
import {
  applyAddTab,
  applyRenameTab,
  collectOpenPaneIds,
  resolveCloseResult,
} from './WorkbenchTabsProvider.pure';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCollection(ids: string[]): TabCollection {
  return {
    activeTabId: ids[0] ?? null,
    tabs: ids.map((id) => ({ id, label: id, sessionId: id, kind: 'cc' as const, createdAt: 0 })),
  };
}

// ── collectOpenPaneIds ────────────────────────────────────────────────────────

describe('collectOpenPaneIds', () => {
  it('returns an empty Set for an empty iterable', () => {
    const result = collectOpenPaneIds([]);
    expect(result.size).toBe(0);
  });

  it('returns ids from a single collection', () => {
    const coll = makeCollection(['a', 'b', 'c']);
    const result = collectOpenPaneIds([coll]);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns the union of ids across multiple collections (active + cached simulation)', () => {
    // Simulates the cross-project navigation fix: active project has panes [a, b],
    // cached (parked) project has panes [c, d] — the union must include all four.
    const activeColl = makeCollection(['a', 'b']);
    const cachedColl = makeCollection(['c', 'd']);
    const result = collectOpenPaneIds([activeColl, cachedColl]);
    expect(result).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('deduplicates ids that appear in multiple collections', () => {
    const coll1 = makeCollection(['a', 'b']);
    const coll2 = makeCollection(['b', 'c']);
    const result = collectOpenPaneIds([coll1, coll2]);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
    expect(result.size).toBe(3);
  });

  it('returns an empty Set for collections that each have no tabs', () => {
    const empty1 = makeCollection([]);
    const empty2 = makeCollection([]);
    const result = collectOpenPaneIds([empty1, empty2]);
    expect(result.size).toBe(0);
  });

  it('includes ids from a mix of non-empty and empty collections', () => {
    const nonempty = makeCollection(['x', 'y']);
    const empty = makeCollection([]);
    const result = collectOpenPaneIds([nonempty, empty]);
    expect(result).toEqual(new Set(['x', 'y']));
  });

  it('accepts a generator (Iterable, not just Array)', () => {
    function* gen(): Generator<TabCollection> {
      yield makeCollection(['g1']);
      yield makeCollection(['g2']);
    }
    const result = collectOpenPaneIds(gen());
    expect(result).toEqual(new Set(['g1', 'g2']));
  });
});

// ── resolveCloseResult ────────────────────────────────────────────────────────

describe('resolveCloseResult', () => {
  it('removes the tab and keeps activeTabId when a non-active tab is closed', () => {
    const coll = makeCollection(['a', 'b', 'c']);
    const result = resolveCloseResult({ ...coll, activeTabId: 'a' }, 'b');
    expect(result.tabs.map((t) => t.id)).toEqual(['a', 'c']);
    expect(result.activeTabId).toBe('a');
  });

  it('advances activeTabId to the next tab when the active tab is closed', () => {
    const coll = makeCollection(['a', 'b', 'c']);
    const result = resolveCloseResult({ ...coll, activeTabId: 'a' }, 'a');
    expect(result.tabs.map((t) => t.id)).toEqual(['b', 'c']);
    expect(result.activeTabId).toBe('b');
  });

  it('falls back to the previous tab when the last tab is closed', () => {
    const coll = makeCollection(['a', 'b', 'c']);
    const result = resolveCloseResult({ ...coll, activeTabId: 'c' }, 'c');
    expect(result.tabs.map((t) => t.id)).toEqual(['a', 'b']);
    expect(result.activeTabId).toBe('b');
  });

  it('sets activeTabId to null when the only tab is closed', () => {
    const coll = makeCollection(['solo']);
    const result = resolveCloseResult({ ...coll, activeTabId: 'solo' }, 'solo');
    expect(result.tabs).toEqual([]);
    expect(result.activeTabId).toBeNull();
  });
});

// ── applyRenameTab ────────────────────────────────────────────────────────────

describe('applyRenameTab', () => {
  it('updates the label of the matching tab and leaves others unchanged', () => {
    const coll = makeCollection(['a', 'b']);
    const result = applyRenameTab(coll, 'a', 'renamed');
    const labels = result.tabs.map((t) => ({ id: t.id, label: t.label }));
    expect(labels).toEqual([
      { id: 'a', label: 'renamed' },
      { id: 'b', label: 'b' },
    ]);
  });

  it('returns a collection with the same activeTabId', () => {
    const coll = { ...makeCollection(['a']), activeTabId: 'a' };
    const result = applyRenameTab(coll, 'a', 'new-label');
    expect(result.activeTabId).toBe('a');
  });
});

// ── applyAddTab ───────────────────────────────────────────────────────────────

describe('applyAddTab', () => {
  it('appends the new tab and sets it as active', () => {
    const coll = makeCollection(['a']);
    const newTab = { id: 'new', label: 'new', sessionId: 'new', kind: 'shell' as const, createdAt: 1 };
    const result = applyAddTab(coll, newTab);
    expect(result.tabs.map((t) => t.id)).toEqual(['a', 'new']);
    expect(result.activeTabId).toBe('new');
  });
});
