/**
 * ptyKillHelpers.ts — Bulk PTY session kill helpers.
 *
 * Extracted from pty.ts (line-limit split). These are the only two functions
 * that kill multiple sessions at once; all single-session kill logic stays in
 * pty.ts alongside the sessions/sessionWindowMap maps.
 */

import { getConfigValue } from './config';
import { cleanupSession, sessions, sessionWindowMap } from './pty';
import { killAllViaPtyHost, killForWindowViaPtyHost } from './ptyHost/ptyHostProxy';

/** Feature flag — mirrors the one in pty.ts; kept local to avoid circular re-import. */
function ptyHostEnabled(): boolean {
  return getConfigValue('usePtyHost') === true;
}

export function killAllPtySessions(): void | Promise<void> {
  if (ptyHostEnabled()) return killAllViaPtyHost();
  for (const [id, session] of sessions) {
    try {
      session.process.kill();
    } catch {
      /* ignore */
    }
    cleanupSession(id);
  }
}

export function killPtySessionsForWindow(windowId: number): Promise<void> {
  if (ptyHostEnabled()) return killForWindowViaPtyHost(windowId);
  for (const [sessionId, ownerWindowId] of sessionWindowMap) {
    if (ownerWindowId !== windowId) continue;
    const session = sessions.get(sessionId);
    if (session) {
      try {
        session.process.kill();
      } catch {
        /* ignore */
      }
    }
    cleanupSession(sessionId);
  }
  return Promise.resolve();
}
