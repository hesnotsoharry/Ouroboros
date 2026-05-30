/**
 * sessionLifecycle.ts — Session lifecycle event emission hooks.
 *
 * Wave 101 Phase 4: telemetry store calls removed (telemetry pipeline deleted).
 * Functions are retained as no-ops so callers compile without changes.
 */

import type { Session } from './session';

// ─── Public API ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function emitSessionCreated(_session: Session): void {
  // Wave 101 Phase 4: telemetry store.record removed
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function emitSessionActivated(_session: Session): void {
  // Wave 101 Phase 4: telemetry store.record removed
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function emitSessionArchived(_session: Session): void {
  // Wave 101 Phase 4: telemetry store.record removed
}
