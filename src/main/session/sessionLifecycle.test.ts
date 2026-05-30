/**
 * sessionLifecycle.test.ts — Unit tests for session lifecycle event emitters.
 *
 * Wave 101 Phase 4: telemetry store calls removed from sessionLifecycle.ts.
 * Functions are now no-ops; tests verify they do not throw.
 */

import { describe, expect, it } from 'vitest';

import { makeSession } from './session';
import { emitSessionActivated, emitSessionArchived, emitSessionCreated } from './sessionLifecycle';

describe('session lifecycle emitters (Wave 101 Phase 4 — no-op)', () => {
  it('emitSessionCreated does not throw', () => {
    const session = makeSession('/projects/foo');
    expect(() => emitSessionCreated(session)).not.toThrow();
  });

  it('emitSessionActivated does not throw', () => {
    const session = makeSession('/projects/foo');
    expect(() => emitSessionActivated(session)).not.toThrow();
  });

  it('emitSessionArchived does not throw', () => {
    const session = makeSession('/projects/foo');
    expect(() => emitSessionArchived(session)).not.toThrow();
  });
});
