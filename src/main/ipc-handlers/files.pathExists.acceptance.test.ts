/**
 * files.pathExists.acceptance.test.ts — Wave 12 Phase 1 boundary acceptance test.
 *
 * Orchestrator-owned, frozen. The Phase 1 implementer MAY NOT modify this file.
 * Source: roadmap/wave-12-terminal-and-project-crud-chrome/waveplan-12.md Phase 1.
 *
 * Tests the boundary contract for `window.electronAPI.files.pathExists(path)`:
 * given a filesystem path, returns boolean. NEVER throws.
 *
 * ADR D7 specifies a tight IPC surface — single function, no error envelope.
 * This deliberately deviates from the broader `{ success, error }` convention
 * documented in src/main/ipc-handlers/CLAUDE.md because pathExists is a pure
 * predicate with no error mode (fs.access errors → false, not throw). Keeping
 * the renderer-facing signature `Promise<boolean>` symmetric with the handler
 * return type avoids a needless unwrap layer in the preload bridge.
 *
 * Run with: npx vitest run src/main/ipc-handlers/files.pathExists.acceptance
 */

import path from 'node:path';

import type { IpcMainInvokeEvent } from 'electron';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// ── Electron stub ──────────────────────────────────────────────────────────────
// Capture the handler registered for 'files:pathExists' so the test can invoke
// it directly without going through the real IPC bridge.
const registeredHandlers = new Map<
  string,
  (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
>();

vi.mock('electron', () => ({
  app: { getPath: () => '/mock/userData', getAppPath: () => '/mock/app' },
  BrowserWindow: { getAllWindows: vi.fn(() => []), getFocusedWindow: vi.fn(() => null) },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: IpcMainInvokeEvent) => unknown) => {
      registeredHandlers.set(
        channel,
        handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
      );
    }),
  },
  dialog: { showOpenDialog: vi.fn() },
  shell: { trashItem: vi.fn() },
}));

// ── Logger stub ────────────────────────────────────────────────────────────────
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── windowManager stub ─────────────────────────────────────────────────────────
vi.mock('../windowManager', () => ({
  getWindowProjectRoots: vi.fn().mockReturnValue([]),
}));

// ── config stub ────────────────────────────────────────────────────────────────
vi.mock('../config', () => ({ getConfigValue: vi.fn() }));

// ── pathSecurity stub — allow everything for the boundary contract test ───────
// pathExists is a low-trust read-only existence probe; the renderer cannot use
// its result to read content. The acceptance test treats the security guard as
// out-of-scope and verifies only the existence-check contract itself.
vi.mock('./pathSecurity', () => ({
  assertPathAllowed: vi.fn().mockReturnValue(null),
  isTrustedConfigPath: vi.fn().mockReturnValue(false),
  isTrustedVsxExtensionPath: vi.fn().mockReturnValue(false),
}));

// ── @parcel/watcher stub via ../watchers ───────────────────────────────────────
// files.ts imports watchers indirectly; tests in this directory neutralize it.
vi.mock('../watchers', () => ({
  subscribe: vi.fn(),
}));

// ── Real filesHelpers ─────────────────────────────────────────────────────────
// We do NOT mock filesHelpers — pathExists must exercise real fs.access so the
// boundary contract is tested end-to-end. Other helpers from filesHelpers that
// files.ts depends on at module-init use no fs calls; if they later do, this
// mock surface widens.

describe('files:pathExists IPC handler — Wave 12 Phase 1 acceptance', () => {
  beforeAll(async () => {
    // Importing files.ts runs registerFileHandlers indirectly via its module
    // graph. We call it explicitly so the handler is registered into the
    // captured map before any test runs.
    const { registerFileHandlers } = await import('./files');
    registerFileHandlers({
      getSender: () => null,
    } as never);
  });

  // Build a minimal event object — real IPC layers also pass extra metadata
  // but our handler should only need `event` to be defined.
  const event = {} as IpcMainInvokeEvent;

  function getHandler() {
    const handler = registeredHandlers.get('files:pathExists');
    if (!handler) {
      throw new Error(
        'files:pathExists handler was not registered. Expected registerFileHandlers ' +
          "to include ['files:pathExists', <handler>] in its channel array.",
      );
    }
    return handler;
  }

  it('returns true for a path that exists on disk (this test file)', async () => {
    const handler = getHandler();
    // __filename always exists — this very test file. Stable across CI.
    const result = await handler(event, __filename);
    expect(result).toBe(true);
  });

  it('returns true for an existing directory (this test file directory)', async () => {
    const handler = getHandler();
    const result = await handler(event, __dirname);
    expect(result).toBe(true);
  });

  it('returns false for a definitely-missing path', async () => {
    const handler = getHandler();
    const missing = path.join(__dirname, '__wave12_never_exists__.tmp');
    const result = await handler(event, missing);
    expect(result).toBe(false);
  });

  it('returns false for an empty string (does NOT throw)', async () => {
    const handler = getHandler();
    const result = await handler(event, '');
    expect(result).toBe(false);
  });

  it('returns false for a malformed path containing NUL bytes (does NOT throw)', async () => {
    const handler = getHandler();
    // fs.access throws ERR_INVALID_ARG_VALUE on NUL-byte paths. The handler
    // must catch and return false per ADR D7 — never propagate.
    const malformed = path.join(__dirname, 'has\0nul.tmp');
    const result = await handler(event, malformed);
    expect(result).toBe(false);
  });

  it('handler returns a boolean primitive (not a wrapped envelope)', async () => {
    const handler = getHandler();
    const result = await handler(event, __filename);
    // ADR D7 specifies Promise<boolean>, not Promise<{success, exists}>.
    // The renderer-facing signature is `Promise<boolean>` — keep the handler
    // symmetric with that signature; do not wrap in {success: true, ...}.
    expect(typeof result).toBe('boolean');
  });
});
