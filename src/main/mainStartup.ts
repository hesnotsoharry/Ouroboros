/**
 * mainStartup.ts — Startup helpers extracted from main.ts to satisfy max-lines.
 * Contains crash logging, auto-updater wiring, web-contents security setup,
 * and synchronous bootstrap functions for V8 snapshot safety.
 *
 * Codebase graph initialization lives in mainStartupGraph.ts.
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

import { getCredential } from './auth/credentialStore';
import log from './logger';
import { broadcastToActiveWindows } from './mainStartupBroadcast';
import { setGithubTokenForPty } from './ptyEnv';
import { configureUpdaterChannel, getAutoUpdater, setUpdaterGitHubToken } from './updater';

export { broadcastToActiveWindows };
export {
  bootstrapApp,
  bootstrapCrashReporter,
} from './mainStartupHelpers';

// ---------------------------------------------------------------------------
// Crash logging
// ---------------------------------------------------------------------------

async function getCrashLogDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'crashes');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeCrashLog(source: string, details: string): Promise<void> {
  try {
    const dir = await getCrashLogDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `crash-${timestamp}.log`);
    const content = [
      `Source: ${source}`,
      `Timestamp: ${new Date().toISOString()}`,
      `App version: ${app.getVersion()}`,
      `Platform: ${process.platform} ${process.arch}`,
      '',
      details,
    ].join('\n');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.writeFile(file, content, 'utf-8');
    log.error(`Logged to ${file}`);
  } catch (err) {
    log.error('Failed to write crash log:', err);
  }
}

// ---------------------------------------------------------------------------
// Auto-updater
// ---------------------------------------------------------------------------

function registerAutoUpdaterEvents(): void {
  const updater = getAutoUpdater();
  if (!updater) return;
  updater.on('checking-for-update', () =>
    broadcastToActiveWindows('updater:event', { type: 'checking-for-update' }),
  );
  updater.on('update-available', (info: unknown) =>
    broadcastToActiveWindows('updater:event', { type: 'update-available', info }),
  );
  updater.on('update-not-available', (info: unknown) =>
    broadcastToActiveWindows('updater:event', { type: 'update-not-available', info }),
  );
  updater.on('download-progress', (progress: unknown) =>
    broadcastToActiveWindows('updater:event', { type: 'download-progress', progress }),
  );
  updater.on('update-downloaded', (info: unknown) =>
    broadcastToActiveWindows('updater:event', { type: 'update-downloaded', info }),
  );
  updater.on('error', (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    // Suppress 404 errors — just means no releases published yet
    if (msg.includes('404') || msg.includes('HttpError')) {
      log.info('Update check: no releases found (404)');
      return;
    }
    broadcastToActiveWindows('updater:event', { type: 'error', error: msg });
  });
}

function scheduleAutoUpdateCheck(): void {
  if (!app.isPackaged) return;
  const updater = getAutoUpdater();
  if (!updater) return;
  setTimeout(() => {
    updater.checkForUpdates().catch((err: Error) => {
      log.info('Auto-check failed:', err.message);
    });
  }, 5000);
}

async function seedUpdaterToken(): Promise<void> {
  try {
    const cred = await getCredential('github');
    if (cred?.type === 'oauth') setUpdaterGitHubToken(cred.accessToken);
  } catch {
    // Non-fatal — updater works without token for public repos
  }
}

export function configureAutoUpdater(): void {
  if (!getAutoUpdater()) return;
  configureUpdaterChannel();
  registerAutoUpdaterEvents();
  void seedUpdaterToken();
  scheduleAutoUpdateCheck();
}

// ---------------------------------------------------------------------------
// GitHub token seeding for PTY env
// ---------------------------------------------------------------------------

async function seedGithubTokenForPty(): Promise<void> {
  const cred = await getCredential('github');
  if (cred?.type === 'oauth') setGithubTokenForPty(cred.accessToken);
}

export async function seedGithubTokenWithRetry(maxAttempts = 3): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await seedGithubTokenForPty();
      return;
    } catch (err) {
      log.warn(`GitHub token seed attempt ${i + 1} failed:`, err);
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// ---------------------------------------------------------------------------
// Synchronous bootstrap — V8 snapshot safety
//
// These functions wrap the calls that must happen synchronously before
// app.whenReady() resolves, but were previously naked at module scope in
// main.ts. Extracting them here keeps main.ts under the 300-line ESLint
// limit and makes the snapshot-hostile boundary explicit.
// ---------------------------------------------------------------------------

export function bootstrapProcessHandlers(
  onWriteCrashLog: (source: string, details: string) => Promise<void>,
): void {
  process.on('uncaughtException', (err: Error) => {
    log.error('uncaughtException:', err);
    void onWriteCrashLog('main:uncaughtException', `${err.stack ?? err.message}`);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    log.error('unhandledRejection:', msg);
    void onWriteCrashLog('main:unhandledRejection', msg);
  });

  // Graceful shutdown on POSIX signals (Docker, systemd, etc.)
  process.on('SIGTERM', () => app.quit());
  process.on('SIGINT', () => app.quit());
}

export function ensureSingleInstance(): void {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    process.exit(0);
  }
}
