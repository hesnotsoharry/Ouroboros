/**
 * mainStartupGraph.ts — Codebase graph initialization helpers extracted from
 * mainStartup.ts to satisfy the max-lines ESLint limit.
 *
 * Owns: GraphDatabase lifecycle, GC passes, initial-index triggering,
 * ensureIndexed callback factory, and the public initCodebaseGraph /
 * disposeCodebaseGraph entry points.
 */

import path from 'path';

import { initConflictMonitor } from './agentConflict/conflictMonitor';
import {
  acquireGraphController as acquireCompatController,
  initCompatRegistry,
} from './codebaseGraph/graphControllerCompatRegistry';
import { setGraphController, setSystem2Db } from './codebaseGraph/graphControllerSupport';
import type { GraphDatabase } from './codebaseGraph/graphDatabase';
import { pruneExpiredProjects, purgeSkippedNodes } from './codebaseGraph/graphGc';
import { getConfigValue } from './config';
import log from './logger';
import { broadcastToActiveWindows } from './mainStartupBroadcast';
import { triggerContextLayerRebuildAfterGraphReady } from './mainStartupContextLayerTrigger';

// ── Module-level state ────────────────────────────────────────────────────────

let sharedSystem2Db: GraphDatabase | null = null;
/** GC-pruned project names captured at startup. Post-startup acquires see []. */
let _startupGcPrunedNames: string[] = [];

// ── Types ─────────────────────────────────────────────────────────────────────

type IndexReason = 'first-launch' | 'hash-mismatch' | 'post-gc';

interface System2IndexProgressEvent {
  kind: 'start' | 'progress' | 'complete' | 'error';
  projectName: string;
  projectRoot?: string;
  reason?: IndexReason;
  phase?: string;
  filesProcessed?: number;
  filesTotal?: number;
  elapsedMs?: number;
  filesIndexed?: number;
  nodesCreated?: number;
  durationMs?: number;
  message?: string;
}

interface InitialIndexArgs {
  workerClient: import('./codebaseGraph/indexingWorkerClient').IndexingWorkerClient;
  db: GraphDatabase;
  projectRoot: string;
  projectName: string;
  reason: IndexReason;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendIndexProgress(event: System2IndexProgressEvent): void {
  broadcastToActiveWindows('system2:indexProgress', event);
}

function buildProgressHandler(projectName: string) {
  return (p: { phase: string; filesProcessed: number; filesTotal: number; elapsedMs: number }) => {
    sendIndexProgress({
      kind: 'progress',
      projectName,
      phase: p.phase,
      filesProcessed: p.filesProcessed,
      filesTotal: p.filesTotal,
      elapsedMs: p.elapsedMs,
    });
  };
}

async function runInitialIndex(args: InitialIndexArgs): Promise<void> {
  const { workerClient, db, projectRoot, projectName, reason } = args;
  sendIndexProgress({ kind: 'start', projectName, projectRoot, reason });
  const result = await workerClient.runIndex({
    projectRoot,
    projectName,
    incremental: false,
    onProgress: buildProgressHandler(projectName),
  });
  if (result.success) {
    // Fix C: if any core pass threw (partial index), invalidate the catalog hash so the
    // next startup triggers a clean full rebuild rather than accepting a partial index.
    if ((result.passErrors ?? 0) > 0) {
      db.invalidateCatalogHash(projectName);
      log.warn('[system2] partial index detected (%d pass errors); catalog hash invalidated for next rebuild', result.passErrors);
    } else {
      db.writeCatalogHash(projectName);
    }
    sendIndexProgress({
      kind: 'complete',
      projectName,
      filesIndexed: result.filesIndexed,
      nodesCreated: result.nodesCreated,
      durationMs: result.durationMs,
    });
    log.info(
      `[system2] initial index complete: ${result.filesIndexed} files, ${result.nodesCreated} nodes`,
    );
    // Wave 69 follow-up: trigger contextLayer rebuild now that graph is populated
    // so the repo map picks up signatures, hotspot scores, and graph-derived deps.
    void triggerContextLayerRebuildAfterGraphReady();
  } else {
    const message = result.errors.join('; ');
    sendIndexProgress({ kind: 'error', projectName, message });
    log.warn('[system2] initial index failed:', message);
  }
}

function resolveIndexReason(
  db: GraphDatabase,
  projectName: string,
  gcPrunedNames: string[],
): IndexReason | null {
  if (gcPrunedNames.includes(projectName)) return 'post-gc';
  const hashOk = db.verifyCatalogHash(projectName);
  if (!hashOk) {
    log.info('[system2] catalog hash mismatch, triggering full rebuild', { projectName });
    return 'hash-mismatch';
  }
  if (db.getNodeCount(projectName) === 0) return 'first-launch';
  return null;
}

function runGraphGcPasses(db: GraphDatabase): string[] {
  const gcConfig = getConfigValue('codebaseGraph');
  let prunedNames: string[] = [];
  if (gcConfig?.gcEnabled) {
    const report = pruneExpiredProjects(db, gcConfig.gcDaysThreshold);
    if (report.prunedCount > 0) {
      log.info(
        `[system2] GC pruned ${report.prunedCount} stale project(s): ${report.prunedProjects.join(', ')}`,
      );
      prunedNames = report.prunedProjects;
    }
  }
  purgeSkippedNodes(db); // one-time migration: evict .claude/worktrees nodes
  return prunedNames;
}

function makeEnsureIndexedCallback(
  db: GraphDatabase,
  workerClient: import('./codebaseGraph/indexingWorkerClient').IndexingWorkerClient,
): (projectName: string, projectRoot: string) => void {
  return (projectName, projectRoot) => {
    const reason = resolveIndexReason(db, projectName, _startupGcPrunedNames);
    if (reason === null) return;
    runInitialIndex({ workerClient, db, projectRoot, projectName, reason }).catch((err: Error) => {
      log.error('[system2] initial index failed:', err);
    });
  };
}

async function initCodebaseGraphImpl(projectRoot: string): Promise<void> {
  const { GraphDatabase } = await import('./codebaseGraph/graphDatabase');
  const { IndexingPipeline } = await import('./codebaseGraph/indexingPipeline');
  const { TreeSitterParser } = await import('./codebaseGraph/treeSitterParser');
  const { QueryEngine } = await import('./codebaseGraph/queryEngine');
  const { CypherEngine } = await import('./codebaseGraph/cypherEngine');
  const { getIndexingWorkerClient } = await import('./codebaseGraph/indexingWorkerClient');

  const db = new GraphDatabase();
  sharedSystem2Db = db;
  setSystem2Db(db);

  const workerClient = getIndexingWorkerClient();
  _startupGcPrunedNames = runGraphGcPasses(db);

  initCompatRegistry({
    db,
    buildQueryEngine: (name, root) => new QueryEngine(db, name, root),
    buildCypherEngine: (name) => new CypherEngine(db, name),
    workerClient,
    ensureIndexed: makeEnsureIndexedCallback(db, workerClient),
  });

  const parser = new TreeSitterParser();
  await parser.init();
  const pipeline = new IndexingPipeline(db, parser);
  const compat = await acquireCompatController(projectRoot, pipeline);
  setGraphController(compat);
  const projectName = path.basename(projectRoot);
  db.touchProjectOpened(projectName);
  log.info(`[system2] controller initialized for ${projectName}`);
}

// ── Public exports ────────────────────────────────────────────────────────────

/** Dispose all graph controllers on app shutdown. */
export async function disposeCodebaseGraph(): Promise<void> {
  const { disposeAllCompat } = await import('./codebaseGraph/graphControllerCompatRegistry');
  const { disposeAll } = await import('./codebaseGraph/systemTwoRegistry');
  const { disposeIndexingWorkerClient } = await import('./codebaseGraph/indexingWorkerClient');

  await disposeAllCompat();
  await disposeAll();
  await disposeIndexingWorkerClient();

  try {
    sharedSystem2Db?.close();
  } finally {
    sharedSystem2Db = null;
    setSystem2Db(null);
  }
}

export async function initCodebaseGraph(): Promise<void> {
  const defaultRoot = getConfigValue('defaultProjectRoot') as string | undefined;
  if (!defaultRoot) {
    log.info('No default project root configured, skipping graph init');
    return;
  }

  try {
    await initCodebaseGraphImpl(defaultRoot);
  } catch (err) {
    log.warn('Failed to start graph:', err);
  }

  // Initialize conflict monitor after graph (operates in file-only mode if graph is cold)
  initConflictMonitor();
  log.info('[conflictMonitor] initialized after codebase graph');
}
