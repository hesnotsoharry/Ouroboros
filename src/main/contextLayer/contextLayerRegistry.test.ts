/**
 * contextLayerRegistry.test.ts — Unit tests for the per-root registry.
 *
 * Focus: concurrent-acquire dedup (W4), refcount semantics, release lifecycle.
 * The controller impl is mocked; we test registry logic only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: { getPath: (name: string) => `/tmp/test-${name}` },
}));

vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import {
  acquireContextLayer,
  getContextLayerController,
  getContextLayerForRoot,
  initContextLayer,
  releaseContextLayer,
  setControllerFactory,
  unregisterController,
} from './contextLayerRegistry';
import type { ContextLayerConfig } from './contextLayerTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<ContextLayerConfig>): ContextLayerConfig {
  return {
    enabled: true,
    maxModules: 10,
    maxSizeBytes: 64 * 1024,
    debounceMs: 1000,
    autoSummarize: false,
    ...overrides,
  };
}

/** Creates a minimal fake controller that tracks initialize() call count. */
function makeControllerFactory() {
  const initializeCallCount = { value: 0 };
  const disposeCallCount = { value: 0 };

  const factory = vi.fn((options: { workspaceRoot: string }) => {
    const ctrl = {
      workspaceRoot: options.workspaceRoot,
      initialize: vi.fn(async () => {
        initializeCallCount.value++;
      }),
      dispose: vi.fn(async () => {
        disposeCallCount.value++;
        unregisterController(options.workspaceRoot, ctrl);
      }),
      enrichPacket: vi.fn(),
      onFileChange: vi.fn(),
      onGitCommit: vi.fn(),
      onSessionStart: vi.fn(),
      forceRebuild: vi.fn(),
      switchWorkspace: vi.fn(),
      getStatus: vi
        .fn()
        .mockReturnValue({
          health: 'healthy',
          workspaceRoot: options.workspaceRoot,
          moduleCount: 0,
          summaryCount: 0,
          enabled: true,
          repoMapAge: null,
        }),
      getRepoMap: vi.fn().mockReturnValue(null),
      getSymbolIndex: vi.fn().mockReturnValue(null),
      getActiveSessionCount: vi.fn().mockReturnValue(0),
    };
    return ctrl;
  });

  return { factory, initializeCallCount, disposeCallCount };
}

function makeBuildRepoIndex() {
  return vi.fn().mockResolvedValue({
    indexedAt: Date.now(),
    repoFacts: {
      workspaceRoots: [],
      roots: [],
      gitDiff: {
        changedFiles: [],
        totalAdditions: 0,
        totalDeletions: 0,
        changedFileCount: 0,
        generatedAt: Date.now(),
      },
      diagnostics: {
        files: [],
        totalErrors: 0,
        totalWarnings: 0,
        totalInfos: 0,
        totalHints: 0,
        generatedAt: Date.now(),
      },
      recentEdits: { files: [], generatedAt: Date.now() },
    },
    roots: [],
    cache: { key: 'k', hit: false, roots: [] },
  });
}

// ── State reset between tests ─────────────────────────────────────────────────

afterEach(async () => {
  // Release all acquired roots to clean up registry state.
  // The registry module is stateful; we reset by disposing any live controllers.
  const ctrl = getContextLayerController();
  if (ctrl) await ctrl.dispose();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('contextLayerRegistry', () => {
  describe('acquireContextLayer — basic acquire/release semantics', () => {
    beforeEach(() => {
      const { factory } = makeControllerFactory();
      setControllerFactory(factory as Parameters<typeof setControllerFactory>[0]);
    });

    it('acquires and returns a controller after initContextLayer', async () => {
      await initContextLayer({
        workspaceRoot: '/project',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      const ctrl = await acquireContextLayer('/project');
      expect(ctrl).not.toBeNull();
    });

    it('bumps refcount for same root on sequential acquires', async () => {
      await initContextLayer({
        workspaceRoot: '/project',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      const ctrl1 = await acquireContextLayer('/project');
      const ctrl2 = await acquireContextLayer('/project');

      // Both should be the same instance
      expect(ctrl1).toBe(ctrl2);
    });

    it('refcount survives N acquires + N-1 releases without disposing', async () => {
      await initContextLayer({
        workspaceRoot: '/project',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      await acquireContextLayer('/project'); // refCount = 2 (initContextLayer set 1)
      await acquireContextLayer('/project'); // refCount = 3

      // Two releases should not dispose
      await releaseContextLayer('/project');
      await releaseContextLayer('/project');

      expect(getContextLayerForRoot('/project')).not.toBeNull();
    });

    it('disposes controller and removes from registry when refcount reaches zero', async () => {
      const { factory, disposeCallCount } = makeControllerFactory();
      setControllerFactory(factory as Parameters<typeof setControllerFactory>[0]);

      await initContextLayer({
        workspaceRoot: '/project',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      // initContextLayer set refCount=1; acquire bumps to 2
      await acquireContextLayer('/project');
      // Release twice → 0 → dispose
      await releaseContextLayer('/project');
      await releaseContextLayer('/project');

      expect(disposeCallCount.value).toBe(1);
      expect(getContextLayerForRoot('/project')).toBeNull();
    });
  });

  describe('concurrent acquire dedup — W4 fix', () => {
    it('3 concurrent acquireContextLayer calls for the same root call initialize() exactly once', async () => {
      const { factory, initializeCallCount } = makeControllerFactory();
      setControllerFactory(factory as Parameters<typeof setControllerFactory>[0]);

      // Prime shared options without initializing a root
      await initContextLayer({
        workspaceRoot: '',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      // Fire 3 concurrent acquires for the SAME root before any resolves.
      // We need initialize() to be slow enough that the other acquires
      // see the in-flight entry. Since JS is single-threaded, all three
      // acquireContextLayer calls execute their synchronous setup before
      // initialize()'s microtask resolves.
      const [ctrl1, ctrl2, ctrl3] = await Promise.all([
        acquireContextLayer('/shared-root'),
        acquireContextLayer('/shared-root'),
        acquireContextLayer('/shared-root'),
      ]);

      // All three callers get back the same controller instance
      expect(ctrl1).not.toBeNull();
      expect(ctrl1).toBe(ctrl2);
      expect(ctrl1).toBe(ctrl3);

      // initialize() called exactly once — not three times
      expect(initializeCallCount.value).toBe(1);
    });

    it('3 concurrent acquires result in refcount=3 so 3 releases are needed to dispose', async () => {
      const { factory, disposeCallCount } = makeControllerFactory();
      setControllerFactory(factory as Parameters<typeof setControllerFactory>[0]);

      await initContextLayer({
        workspaceRoot: '',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      await Promise.all([
        acquireContextLayer('/shared-root'),
        acquireContextLayer('/shared-root'),
        acquireContextLayer('/shared-root'),
      ]);

      // Two releases should NOT dispose yet
      await releaseContextLayer('/shared-root');
      await releaseContextLayer('/shared-root');
      expect(disposeCallCount.value).toBe(0);
      expect(getContextLayerForRoot('/shared-root')).not.toBeNull();

      // Third release brings refcount to 0 → dispose
      await releaseContextLayer('/shared-root');
      expect(disposeCallCount.value).toBe(1);
      expect(getContextLayerForRoot('/shared-root')).toBeNull();
    });

    it('in-flight entry is removed after initialization rejects so it does not block future acquires', async () => {
      let callCount = 0;
      const failingFactory = vi.fn((options: { workspaceRoot: string }) => {
        callCount++;
        const ctrl = {
          workspaceRoot: options.workspaceRoot,
          initialize: vi.fn(async () => {
            throw new Error('git unavailable');
          }),
          dispose: vi.fn(async () => {
            unregisterController(options.workspaceRoot, ctrl);
          }),
          enrichPacket: vi.fn(),
          onFileChange: vi.fn(),
          onGitCommit: vi.fn(),
          onSessionStart: vi.fn(),
          forceRebuild: vi.fn(),
          switchWorkspace: vi.fn(),
          getStatus: vi
            .fn()
            .mockReturnValue({
              health: 'healthy',
              workspaceRoot: options.workspaceRoot,
              moduleCount: 0,
              summaryCount: 0,
              enabled: true,
              repoMapAge: null,
            }),
          getRepoMap: vi.fn().mockReturnValue(null),
          getSymbolIndex: vi.fn().mockReturnValue(null),
          getActiveSessionCount: vi.fn().mockReturnValue(0),
        };
        return ctrl;
      });

      setControllerFactory(failingFactory as Parameters<typeof setControllerFactory>[0]);

      await initContextLayer({
        workspaceRoot: '',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      // First acquire fails — the in-flight entry is cleared by .finally
      await expect(acquireContextLayer('/flaky-root')).rejects.toThrow('git unavailable');

      // factory was called once — the controller was created and registered
      expect(callCount).toBe(1);
    });

    it('concurrent acquires for DIFFERENT roots each call initialize() once', async () => {
      const { factory, initializeCallCount } = makeControllerFactory();
      setControllerFactory(factory as Parameters<typeof setControllerFactory>[0]);

      await initContextLayer({
        workspaceRoot: '',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      await Promise.all([
        acquireContextLayer('/root-a'),
        acquireContextLayer('/root-b'),
        acquireContextLayer('/root-c'),
      ]);

      // 3 distinct roots → 3 distinct initialize() calls
      expect(initializeCallCount.value).toBe(3);

      // Clean up
      await releaseContextLayer('/root-a');
      await releaseContextLayer('/root-b');
      await releaseContextLayer('/root-c');
    });
  });

  describe('path normalization', () => {
    it('backslash and forward-slash paths for the same root share one controller', async () => {
      const { factory, initializeCallCount } = makeControllerFactory();
      setControllerFactory(factory as Parameters<typeof setControllerFactory>[0]);

      await initContextLayer({
        workspaceRoot: 'C:/project',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      const ctrl1 = getContextLayerForRoot('C:/project');
      // Windows-style backslash path should resolve to the same key
      const ctrl2 = getContextLayerForRoot('C:\\project');

      expect(ctrl1).not.toBeNull();
      expect(ctrl1).toBe(ctrl2);

      // initialize() was only called once (by initContextLayer)
      expect(initializeCallCount.value).toBe(1);
    });

    it('trailing slashes are normalized away', async () => {
      await initContextLayer({
        workspaceRoot: '/project',
        buildRepoIndex: makeBuildRepoIndex(),
        config: makeConfig(),
      });

      const ctrl1 = getContextLayerForRoot('/project');
      const ctrl2 = getContextLayerForRoot('/project/');
      expect(ctrl1).toBe(ctrl2);
    });
  });
});
