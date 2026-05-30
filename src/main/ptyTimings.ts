/**
 * ptyTimings.ts — Session start-time tracking for PTY exit duration measurement.
 *
 * Extracted from pty.ts to keep that file under the 300-line ESLint limit.
 * Records session spawn timestamps.
 * Wave 101 Phase 4: outcomeObserver calls removed (telemetry pipeline deleted).
 */

const sessionStartTs = new Map<string, number>();

export function recordPtyStart(sessionId: string): void {
  sessionStartTs.set(sessionId, Date.now());
}

export function reportPtyExit(
  sessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for callers
  _cwd: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for callers
  _exitCode: number,
): void {
  // Wave 101 Phase 4: getOutcomeObserver()?.onPtyExit() removed — observer store deleted.
  sessionStartTs.delete(sessionId);
}
