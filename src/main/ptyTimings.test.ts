/**
 * ptyTimings.test.ts — Unit tests for PTY session timing helpers.
 *
 * Wave 101 Phase 4: outcomeObserver call removed from reportPtyExit (telemetry deleted).
 * Tests updated to reflect the no-op observer behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordPtyStart, reportPtyExit } from './ptyTimings';

beforeEach(() => {
  vi.useFakeTimers();
});

describe('recordPtyStart + reportPtyExit (Wave 101 Phase 4 — observer no-op)', () => {
  it('does not throw after a start + exit', () => {
    recordPtyStart('sess-1');
    expect(() => reportPtyExit('sess-1', '/workspace', 0)).not.toThrow();
  });

  it('does not throw for an exit with no recorded start', () => {
    expect(() => reportPtyExit('unknown-sess', '/tmp', 1)).not.toThrow();
  });

  it('cleans up start timestamp so the session map does not grow unboundedly', () => {
    // Verify idempotency: two exits for the same session do not throw
    recordPtyStart('sess-2');
    expect(() => reportPtyExit('sess-2', '/a', 0)).not.toThrow();
    expect(() => reportPtyExit('sess-2', '/a', 0)).not.toThrow();
  });
});
