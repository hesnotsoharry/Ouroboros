// hello from wave-84 repro
import type Store from 'electron-store';

import { migrateChatPrimary, migrateChatSurface } from './configMigrations';
import { ensureStore, lazyStore } from './configStoreLazy';
import {
  clearPendingWrite,
  enqueueWrite,
  flushPendingWrites,
  peekPendingWrite,
  setWriteBufferStore,
} from './configWriteBuffer';

export type {
  AgentTemplate,
  AppConfig,
  AppEcosystemConfig,
  AppLayoutConfig,
  ClaudeCliSettings,
  ClaudeMdSettings,
  CodebaseGraphSettings,
  CodexCliSettings,
  ContextScoringSettings,
  InstalledVsxExtension,
  MobileAccessConfig,
  ModelProvider,
  ModelSlotAssignments,
  NotificationSettings,
  PageRankSeedWeights,
  PairedDeviceRecord,
  PanelSizes,
  PlatformConfig,
  ProviderModel,
  ResearchSettings,
  SessionDispatchConfig,
  TerminalSessionSnapshot,
  ThemingConfig,
  WindowBounds,
  WindowSession,
  WorkspaceLayout,
  WorkspaceSnapshot,
} from './configTypes';

import type { AppConfig } from './configTypes';

export { flushPendingWrites };
export const store: Store<AppConfig> = lazyStore;

// In-memory cache to avoid re-reading config.json from disk on every call.
// electron-store's underlying conf library reads the file on every .get().
// This cache is invalidated on every write via setConfigValue.
let configCache: AppConfig | null = null;
// Wave 43 Phase A — run migration exactly once per process lifetime.
let chatPrimaryMigrationDone = false;
// Wave 100 Phase I — run migration exactly once per process lifetime.
let chatSurfaceMigrationDone = false;
// Track whether the write buffer store has been wired.
let bufferStoreWired = false;

function wireBufferStore(): void {
  if (bufferStoreWired) return;
  setWriteBufferStore(ensureStore());
  bufferStoreWired = true;
}

export function getConfig(): AppConfig {
  if (!configCache) {
    if (!chatPrimaryMigrationDone) {
      chatPrimaryMigrationDone = true;
      migrateChatPrimary(); // sets configCache = null via store write if migration fires
    }
    if (!chatSurfaceMigrationDone) {
      chatSurfaceMigrationDone = true;
      migrateChatSurface(); // purge retired chat-surface keys
    }
    configCache = ensureStore().store;
  }
  return configCache;
}

export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  // Check pending-writes buffer first for read-your-writes consistency.
  const pending = peekPendingWrite(key);
  if (pending !== undefined) return pending;
  // eslint-disable-next-line security/detect-object-injection -- key is constrained to keyof AppConfig by TypeScript
  return getConfig()[key];
}

/**
 * Debounced write: updates in-memory state immediately (read-your-writes),
 * schedules a ~200ms flush to disk. Multiple calls within the window collapse
 * into one disk write. Safe for high-frequency callers (bounds, sessions, etc.).
 */
export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  wireBufferStore();
  // eslint-disable-next-line security/detect-object-injection -- key is keyof AppConfig
  if (configCache) configCache[key] = value;
  enqueueWrite(key, value);
}

/**
 * Immediate synchronous write, bypasses the debounce buffer. Use for
 * security/crash-sensitive keys where loss on an unexpected quit is
 * unacceptable.
 *
 * Keys that MUST use this path:
 *  - Migration marker (_secrets_migrated) and cleared plaintext secrets
 *    (modelProviders, webAccessToken, webAccessPassword) — secretMigration.ts
 *  - Workspace trust mutations (trustedWorkspaces) — workspaceTrust.ts
 *
 * When in doubt, use this path rather than risk a lost write.
 */
export function setConfigValueImmediate<K extends keyof AppConfig>(
  key: K,
  value: AppConfig[K],
): void {
  ensureStore().set(key, value);
  // eslint-disable-next-line security/detect-object-injection -- key is keyof AppConfig
  if (configCache) configCache[key] = value;
  // Drop any queued debounced write for this key — otherwise a stale pending
  // value could flush later and clobber the value we just wrote synchronously.
  clearPendingWrite(key);
}
