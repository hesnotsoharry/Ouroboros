/**
 * mainShutdown.ts — Shutdown orchestration for the Electron main process.
 *
 * Extracted from main.ts so that `will-quit` cleanup can properly await
 * async resources (notably the codebase-graph indexing worker and SQLite
 * handles) without racing Node's environment teardown. See the graceful
 * dispose protocol in `codebaseGraph/indexingWorker.ts` for context.
 */

import { stopClaudeUsagePoller } from './claudeUsagePoller';
import { disableCodeModeUserLevel } from './codemode/codemodeStartup';
import { flushPendingWritesSync } from './configWriteBuffer';
import { closeCostHistoryDb } from './costHistory';
import { shutdownExtensionHost } from './extensionHost/extensionHostProxy';
import { cleanupIpcHandlers } from './ipc';
import log from './logger';
// disposeCodebaseGraph removed in Wave 22 (codebaseGraph deleted)
// closeDecisionWriter/closeOutcomeWriter/stopContextRetrainTrigger removed in Wave 100 Phase F (context-intelligence cut)
// closeEditProvenance/closeOutcomeObserver/closeTelemetryStore removed in Wave 101 Phase 4 (telemetry pipeline removed)
import { deleteTokenFile } from './pipeAuth';
// research writer imports removed in Wave 101 Phase 5 (research subsystem deleted)
import { closeSessionServices } from './session/sessionStartup';

async function tryShutdown(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    log.warn(`${label} shutdown error:`, err);
  }
}

// closeWriters removed in Wave 101 Phase 5 (research writers deleted)
// closeSyncStores removed in Wave 101 Phase 4 (telemetry pipeline + editProvenance removed)

async function disposeSubsystems(): Promise<void> {
  // codebase-graph shutdown removed in Wave 22 (codebaseGraph deleted)
  // codex-app-server shutdown removed in Wave 100 Phase E (chat adapters deleted)
  await tryShutdown('extension-host', shutdownExtensionHost);
  // Wave 60 Phase E: no legacy MCP host cleanup remains here. The
  // standalone server is spawned and owned by Claude Code, not the IDE.
}

export async function performWillQuitShutdown(): Promise<void> {
  // Flush any buffered config writes FIRST — before any subsystem shuts down
  // and before we delete the token file. This is the data-safety crux: if the
  // debounce timer hasn't fired yet, pending writes would otherwise be lost.
  flushPendingWritesSync();
  await tryShutdown('codemode-user-level', disableCodeModeUserLevel);
  closeSessionServices();
  // closeWriters removed in Wave 101 Phase 5 (research writers deleted)
  await stopClaudeUsagePoller();
  await cleanupIpcHandlers();
  closeCostHistoryDb();
  deleteTokenFile();
  await disposeSubsystems();
}
