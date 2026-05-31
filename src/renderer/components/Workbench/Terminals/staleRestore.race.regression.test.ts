/**
 * Regression test — stale-restore race on uncached project switch.
 *
 * Scenario: provider starts on project A (with persisted restore data), then
 * switches to project B which also has a saved slot in canonWorkbenchSessions.
 * During the transitional render where projectRoot first becomes B,
 * useWorkbenchRestore's internal state STILL holds A's data — the effect that
 * calls setRestoreState({ forProject: B }) hasn't committed yet.
 *
 * The fix adds a synchronous render-time guard in useWorkbenchRestore:
 *   if (restoreState.forProject !== projectRoot) return NOT_READY
 * This makes the hook report not-ready THIS render, preventing useTabRestoreInit
 * from applying A's collections to B.
 *
 * Uses the REAL useWorkbenchRestore (not mocked) to exercise the guard.
 * Controls timing via a deferred config.get promise so we can inspect the
 * transitional render before B's data resolves.
 *
 * Assertions:
 *   (a) After B's store data resolves, the provider's upper tabs match B's
 *       persisted collection — NOT project A's tabs.
 *   (b) A's CC sessionId is NOT resumed under B's cwd.
 *
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { useWorkbenchTabs } from './useWorkbenchTabs';
import { WorkbenchTabsProvider } from './WorkbenchTabsProvider';

// ── Module mocks ──────────────────────────────────────────────────────────────

// useWorkbenchRestore is NOT mocked here — we exercise the real hook.

vi.mock('./useWorkbenchSessionPersist', () => ({
  useWorkbenchSessionPersist: vi.fn(),
}));

vi.mock('../../../contexts/ProjectContext', () => ({
  useProject: () => ({ projectRoots: [], projectRoot: null, projectName: '', isLoaded: false }),
  useProjectOptional: () => null,
}));

// useConfig must return persistTerminalSessions:true so restore actually reads.
vi.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({
    config: { persistTerminalSessions: true },
    isLoading: false,
    error: null,
    set: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSlot(tabId: string, sessionId: string) {
  const tab = { id: tabId, label: 'claude', sessionId, kind: 'cc' as const, createdAt: 1_000_000 };
  const upper = { activeTabId: tabId, tabs: [tab] };
  const lower = { activeTabId: null, tabs: [] };
  return { upper, lower };
}

// ── electronAPI harness ───────────────────────────────────────────────────────

// Deferred promise controls: we resolve B's config.get AFTER the transitional
// render so we can observe whether the stale guard works.
let resolveBStore!: (v: unknown) => void;

function buildSessionsRecord(rootA: string, rootB: string) {
  return {
    [rootA]: makeSlot('tab-A', 'sess-A'),
    [rootB]: makeSlot('tab-B', 'sess-B'),
  };
}

function installElectronAPI(rootA: string, rootB: string): void {
  const sessionsRecord = buildSessionsRecord(rootA, rootB);
  let getBCallCount = 0;

  (window as unknown as { electronAPI: unknown }).electronAPI = {
    pty: {
      spawn: vi.fn().mockResolvedValue({ success: true, pid: 1 }),
      spawnClaude: vi.fn().mockResolvedValue({ success: true, pid: 2 }),
      kill: vi.fn().mockResolvedValue({ success: true }),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
    },
    hooks: { onAgentEvent: vi.fn(() => () => {}) },
    config: {
      // First call = project A's initial restore (resolves immediately).
      // Second call = project B's restore (deferred so we can observe the transition).
      get: vi.fn(() => {
        getBCallCount += 1;
        if (getBCallCount === 1) {
          return Promise.resolve(sessionsRecord);
        }
        // B's restore: deferred promise — resolved manually in the test.
        return new Promise<unknown>((resolve) => {
          resolveBStore = resolve;
        });
      }),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
  };
}

function ptySpawnClaude(): Mock {
  return window.electronAPI.pty.spawnClaude as unknown as Mock;
}

// ── Wrapper helpers ───────────────────────────────────────────────────────────

let wrapperRoot: string | null = null;

function makeWrapper(
  initial: string | null,
): (p: { children: React.ReactNode }) => React.ReactElement {
  wrapperRoot = initial;
  return function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return React.createElement(WorkbenchTabsProvider, { projectRoot: wrapperRoot }, children);
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resolveBStore = () => {};
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('stale-restore race — uncached project switch (real useWorkbenchRestore)', () => {
  it(
    'switching A→B applies B persisted tabs, not A tabs, and does not resume A session under B',
    async () => {
      const rootA = '/projects/alpha';
      const rootB = '/projects/beta';

      installElectronAPI(rootA, rootB);

      // Mount on project A — restore reads A's persisted slot immediately.
      const wrapper = makeWrapper(rootA);
      const { result, rerender } = renderHook(
        ({ root }: { root: string }) => useWorkbenchTabs('upper', root),
        { wrapper, initialProps: { root: rootA } },
      );

      // A's restored CC tab is applied.
      await waitFor(() => {
        expect(result.current.tabs.some((t) => t.id === 'tab-A')).toBe(true);
      });

      // Switch to project B. B's config.get is deferred — the transitional render
      // has useWorkbenchRestore still holding A's data (forProject: rootA).
      wrapperRoot = rootB;
      await act(async () => {
        rerender({ root: rootB });
      });

      // Transitional state: B's store read is pending. The forProject guard must
      // prevent A's tabs from being applied. The frame should show a fresh default
      // tab (not tab-A) while waiting for B's store resolve.
      // Allow one tick for the effect to queue the store read.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });

      // Now resolve B's store data.
      resolveBStore(buildSessionsRecord(rootA, rootB));

      // B's tabs must appear after the deferred resolve.
      await waitFor(() => {
        expect(result.current.tabs.some((t) => t.id === 'tab-B')).toBe(true);
      });

      // (a) B's tabs are present, A's are not.
      expect(result.current.tabs.some((t) => t.id === 'tab-A')).toBe(false);

      // (b) A's CC session must NOT have been resumed under B's cwd.
      const badResumes = ptySpawnClaude().mock.calls.filter(
        ([, opts]: [unknown, { resumeMode?: string; cwd?: string }]) =>
          opts?.resumeMode === 'sess-A' && opts?.cwd === rootB,
      );
      expect(badResumes).toHaveLength(0);
    },
  );
});
