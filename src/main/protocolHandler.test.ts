/**
 * protocolHandler.test.ts
 *
 * Phase A (Wave 100): thread:// deep-link handling removed (Decision 9).
 * extractPermalinkFromArgv now unconditionally returns null.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { on: vi.fn(), setAsDefaultProtocolClient: vi.fn() },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
}));

vi.mock('./logger', () => ({ default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { extractPermalinkFromArgv } from './protocolHandler';

describe('extractPermalinkFromArgv', () => {
  it('always returns null after thread:// deep-link removal', () => {
    expect(extractPermalinkFromArgv(['node', 'main.js', '--flag'])).toBeNull();
    expect(extractPermalinkFromArgv(['electron', 'thread://abc#msg=m1'])).toBeNull();
    expect(extractPermalinkFromArgv([])).toBeNull();
  });
});
