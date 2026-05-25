/**
 * hooks.paneId.acceptance.test.ts — Wave 13 Phase 1 boundary acceptance test.
 *
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 13 Phase 1).
 * Phase implementer may not modify this file.
 * See ~/.claude/rules/orchestrator-owned-acceptance-tests.md.
 *
 * Acceptance contract: `OUROBOROS_PANE_ID` env injection at renderer spawn-tab
 * reaches `HookPayload.paneId` round-trip.
 *
 * The five test cases below express the full chain:
 *   1.1 buildSpawnEnv(tabId) → { OUROBOROS_PANE_ID: tabId }
 *   1.2 buildSpawnEnv('') → { OUROBOROS_PANE_ID: '' }  (empty-string edge)
 *   1.3 OS-level env inheritance: a child process spawned with OUROBOROS_PANE_ID
 *       in its env reads that value via process.env (proves the pty→claude→hook
 *       subprocess inheritance chain at the OS level)
 *   1.4 HookPayload interface includes paneId?: string (compile-time + runtime check)
 *   1.5 The hook payload-receive forwarding logic preserves paneId on the
 *       renderer-bound event (sendPayload / dispatchToRenderer seam)
 *
 * RED signal before Phase 1: "Cannot find module" on buildSpawnEnv import,
 * and assertion failures on HookPayload.paneId which does not yet exist.
 *
 * Run with: npx vitest run src/main/hooks.paneId.acceptance.test.ts
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Test 1.1 / 1.2 import — RED until Phase 1 ships buildSpawnEnv ─────────────
//
// buildSpawnEnv is the helper mandated by ADR D6. It lives in
// `src/renderer/components/Workbench/Terminals/useWorkbenchTabs.ts` per the wave
// plan. The Phase 1 implementer must also export it so it is testable here.
//
// NOTE: this import is from the RENDERER module because buildSpawnEnv is a
// renderer-side helper (it constructs the env object passed to window.electronAPI.pty
// spawn calls). A plain Node import works here because vitest transforms the module.
// If the implementer places buildSpawnEnv in a shared helper file instead, adjust
// the import path below accordingly — the contract (function name + return shape)
// does not change.
import { buildSpawnEnv } from '../renderer/components/Workbench/Terminals/useWorkbenchTabs';
// ── Test 1.4 / 1.5 imports — HookPayload interface + dispatch seam ───────────
import type { HookPayload } from './hooks';
// For Test 1.5: buildRendererPayload must be exported from hooksDispatchLogic
// by the Phase 1 implementer. RED until that export exists.
import { buildRendererPayload } from './hooksDispatchLogic';

// ── Stubs (keep these narrow — only what the imports require at module-init) ──

vi.mock('electron', () => ({
  app: { getPath: () => '/mock/userData', getAppPath: () => '/mock/app' },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { trashItem: vi.fn() },
}));

vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./windowManager', () => ({
  getAllActiveWindows: vi.fn(() => []),
  getWindowProjectRoots: vi.fn(() => []),
}));

vi.mock('./config', () => ({ getConfigValue: vi.fn() }));

vi.mock('./hooksNet', () => ({
  getHooksNetAddress: vi.fn(() => null),
  startHooksNetServer: vi.fn(),
  stopHooksNetServer: vi.fn(),
}));

vi.mock('./pipeAuth', () => ({
  getHooksToken: vi.fn(() => 'tok'),
  getTokenFilePath: vi.fn(() => null),
  getToolServerToken: vi.fn(() => 'toolTok'),
}));

vi.mock('./web/webServer', () => ({
  broadcastToWebClients: vi.fn(),
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe.skip('hooks.paneId pipeline (Wave 13 Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1.1 — buildSpawnEnv returns OUROBOROS_PANE_ID for a known tab id ──

  it('1.1 buildSpawnEnv("wb-upper-cc-1234-abc") returns { OUROBOROS_PANE_ID: "wb-upper-cc-1234-abc" }', () => {
    // Phase 1 implementer ships this function. If it doesn't exist yet this
    // line throws "buildSpawnEnv is not a function" — RED for the right reason.
    const env = buildSpawnEnv('wb-upper-cc-1234-abc');
    expect(env).toEqual({ OUROBOROS_PANE_ID: 'wb-upper-cc-1234-abc' });
  });

  // ── Test 1.2 — empty-string edge: still injected, downstream filter handles ─

  it('1.2 buildSpawnEnv("") returns { OUROBOROS_PANE_ID: "" } — empty string still injected', () => {
    const env = buildSpawnEnv('');
    expect(env).toEqual({ OUROBOROS_PANE_ID: '' });
  });

  // ── Test 1.3 — OS-level env inheritance via child_process.spawnSync ──────────
  //
  // Proves that the pty → claude → hook-subprocess inheritance chain works at the
  // OS level. If a process is spawned with OUROBOROS_PANE_ID in its env, its
  // child processes (hook scripts) inherit the value via process.env.
  //
  // This test does NOT mock — it runs a real child process. That is intentional:
  // the contract being tested is the OS-level env-var propagation chain, not any
  // in-process logic.

  it('1.3 child process spawned with OUROBOROS_PANE_ID inherits the value', () => {
    const paneId = 'pane-X-boundary-test';
    const result = spawnSync(
      process.execPath, // node.exe
      [
        '-e',
        // Inline script: print paneId as JSON to stdout
        `process.stdout.write(JSON.stringify({ paneId: process.env.OUROBOROS_PANE_ID }))`,
      ],
      {
        env: { ...process.env, OUROBOROS_PANE_ID: paneId },
        encoding: 'utf8',
        timeout: 5000,
      },
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { paneId: string };
    expect(parsed.paneId).toBe(paneId);
  });

  // ── Test 1.4 — HookPayload interface includes paneId?: string ─────────────────
  //
  // This is both a compile-time check (tsc --noEmit will catch it if the field is
  // absent from the interface) and a runtime assertion. The `_check` assignment
  // below will produce a TypeScript error at import time if paneId is not in the
  // interface — which is the correct RED signal for Phase 1 dispatch.

  it('1.4 HookPayload interface includes paneId?: string (compile-time + runtime)', () => {
    // TypeScript assignment — if HookPayload lacks paneId, tsc rejects this file.
    const _check: HookPayload = {
      type: 'agent_start',
      sessionId: 'x',
      timestamp: 0,
      cwd: '',
      paneId: 'wb-upper-cc-pane-1',
    };
    // Runtime: the value must be the string we set
    expect(_check.paneId).toBe('wb-upper-cc-pane-1');
    // Runtime: undefined paneId is also valid (field is optional)
    const _noPane: HookPayload = { type: 'agent_end', sessionId: 'y', timestamp: 1 };
    expect(_noPane.paneId).toBeUndefined();
  });

  // ── Test 1.5 — payload-receive logic preserves paneId on renderer-bound event ─
  //
  // Tests the named-pipe → renderer-event forwarding path. The implementer must
  // export a pure function (recommended name: `buildRendererPayload`) from
  // hooksDispatchLogic.ts that takes an inbound HookPayload (as received from the
  // named pipe) and returns the renderer-bound payload with paneId preserved.
  //
  // If hooks.ts / hooksDispatchLogic.ts cannot surface this seam without major
  // restructuring, an acceptable alternative is to export a thin wrapper that
  // accepts a raw payload object and returns the processed payload. The seam must
  // not call webContents.send — only the pure transform is tested here.
  //
  // RED reason when Phase 1 not yet shipped: "buildRendererPayload is not a
  // function" — correct contract failure, not a broken test.

  it('1.5 buildRendererPayload preserves paneId from inbound named-pipe payload to renderer event', () => {
    const inbound: HookPayload = {
      type: 'agent_start',
      sessionId: 'cs1',
      timestamp: Date.now(),
      paneId: 'wb-upper-cc-pane-A',
    };

    // buildRendererPayload must NOT call webContents.send — it is a pure transform.
    // The function may perform enrichment (e.g. truncate large fields) but must
    // preserve paneId unchanged.
    const outbound = buildRendererPayload(inbound);

    expect(outbound.paneId).toBe('wb-upper-cc-pane-A');
    // Sanity: other required fields are also preserved
    expect(outbound.sessionId).toBe('cs1');
    expect(outbound.type).toBe('agent_start');
  });
});
