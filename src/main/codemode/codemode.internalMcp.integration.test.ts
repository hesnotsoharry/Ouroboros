/**
 * codemode.internalMcp.integration.test.ts — Wave 51 Phase E
 *
 * Integration coverage for the CodeMode ↔ internalMcp routing path that
 * shipped in Phases B–D. Pure-policy combinatorics live in
 * `internalMcpRoutingPolicy.test.ts`; this suite focuses on the
 * integration shape — namely, the settings-write produced by
 * `buildScopedMcpConfig` and the telemetry record emitted by
 * `mcpSpawnCostTelemetry` for each routing outcome.
 *
 * Mocking notes (Phase D's pollution lesson):
 *   - `fs/promises` is selectively mocked so `readFile` of the user's
 *     `.claude/settings.json` returns the test fixture, while the temp
 *     config write goes to the real tmpdir (we read it back to assert).
 *   - `fs` is fully mocked so `mcpSpawnCostTelemetry` cannot reach the
 *     real `~/.ouroboros/telemetry/mcp-spawn-cost.jsonl`. This mirrors
 *     `mcpSpawnCostTelemetry.test.ts`.
 *   - `electron` is stubbed to keep the `internalMcp` import chain
 *     resolvable under vitest's node environment.
 *
 * What is intentionally OUT of scope here:
 *   - The full routing-decision matrix (covered by the pure tests).
 *   - End-to-end CodeMode subprocess lifecycle (no real proxy spawn).
 *   - Type generation (`typeGenerator.ts`) — Phase C left it untouched.
 */

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockGetConfigValue, mockGetInternalMcpUrl, mockReadFile } =
  vi.hoisted(() => ({
    mockGetConfigValue: vi.fn(),
    mockGetInternalMcpUrl: vi.fn(),
    mockReadFile: vi.fn(),
  }));

vi.mock('../config', () => ({ getConfigValue: mockGetConfigValue }));
vi.mock('../internalMcp/internalMcpPortRegistry', () => ({
  getInternalMcpUrl: mockGetInternalMcpUrl,
}));
vi.mock('../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Selective fs/promises mock — settings.json reads return our fixture; all
// other reads/writes (including the temp config the production code writes
// and we read back) hit real disk.
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  const wrappedReadFile = (
    p: Parameters<typeof actual.readFile>[0],
    o?: Parameters<typeof actual.readFile>[1],
  ) => {
    if (typeof p === 'string' && p.endsWith('.claude.json')) {
      return mockReadFile(p, o);
    }
    return actual.readFile(p, o);
  };
  return { ...actual, readFile: wrappedReadFile };
});

// Wave 101 Phase 4: fs mock for mcpSpawnCostTelemetry removed (telemetry pipeline deleted)

// internalMcp barrel pulls Electron `app` transitively through the graph
// controller. We only need the type symbol from internalMcpTypes, so this
// stub is sufficient for the import chain to resolve.
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));

import { buildScopedMcpConfig } from '../orchestration/providers/scopedMcpConfig';

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_ID = 'integration-test-session';
const OUROBOROS_PORT = '54321';
const OUROBOROS_URL = `http://127.0.0.1:${OUROBOROS_PORT}/sse`;
const FAKE_MAIN_OUT = '/fake/main/out';

// ─── Test helpers ────────────────────────────────────────────────────────────

interface ConfigShape {
  internalMcpUseStrictConfig?: boolean;
  internalMcpScope?: 'always' | 'task-gated' | 'never';
  codemode?: { enabled?: boolean; excludeFromMultiplex?: string[] };
}

function applyConfig(shape: ConfigShape): void {
  mockGetConfigValue.mockImplementation((key: string) => {
    if (key === 'internalMcpUseStrictConfig') return shape.internalMcpUseStrictConfig !== false;
    if (key === 'internalMcpScope') return shape.internalMcpScope ?? 'task-gated';
    if (key === 'codemode') return shape.codemode;
    if (key === 'internalMcpEnabled') return true;
    return undefined;
  });
}

function applyUserServers(servers: Record<string, unknown> = {}): void {
  mockReadFile.mockResolvedValue(JSON.stringify({ mcpServers: servers }));
}

function readWrittenConfig(configPath: string): {
  mcpServers: Record<string, { url?: string; command?: string; args?: string[]; env?: Record<string, string> }>;
} {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path produced by builder
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as ReturnType<typeof readWrittenConfig>;
}

beforeEach(() => {
  mockGetConfigValue.mockReset();
  mockGetInternalMcpUrl.mockReset();
  mockReadFile.mockReset();
  mockGetInternalMcpUrl.mockReturnValue(OUROBOROS_URL);
  applyUserServers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Settings-write shape per decision ───────────────────────────────────────

describe('settings-write shape', () => {
  it('direct-inject: writes {ouroboros: {command, args, env}} (standalone shape)', async () => {
    // Wave 60 Phase E: SSE transport is deprecated — the entry is always
    // the standalone shape regardless of `internalMcp.transport`.
    applyConfig({
      internalMcpScope: 'task-gated',
      codemode: { enabled: false },
    });
    const result = await buildScopedMcpConfig({
      goalShape: 'code',
      sessionId: SESSION_ID,
      mainOutDir: FAKE_MAIN_OUT,
    });
    expect(result).not.toBeNull();
    const data = readWrittenConfig(result!.configPath);
    const entry = data.mcpServers['ouroboros'];
    expect(entry).toBeDefined();
    expect(entry.url).toBeUndefined();
    expect(entry.command).toBe('node');
    expect(entry.env).toBeUndefined();
    expect(entry.args![0]).toMatch(/packages[/\\]codebase-graph-mcp[/\\]dist[/\\]index\.js$/);
    expect(entry.args![1]).toBe('--root');
    expect(entry.args![2]).toBeDefined();
    expect(result!.routingDecision).toBe('direct-inject');
    await result!.cleanup();
  });


  it('route-through-codemode: ouroboros omitted from mcpServers (proxy surfaces it)', async () => {
    applyConfig({
      internalMcpScope: 'task-gated',
      codemode: { enabled: true },
    });
    const result = await buildScopedMcpConfig({
      goalShape: 'code',
      sessionId: SESSION_ID,
      mainOutDir: FAKE_MAIN_OUT,
    });
    expect(result).not.toBeNull();
    const data = readWrittenConfig(result!.configPath);
    expect(data.mcpServers).not.toHaveProperty('ouroboros');
    expect(result!.routingDecision).toBe('route-through-codemode');
    await result!.cleanup();
  });

  it('omit (scope=never): ouroboros absent regardless of other flags', async () => {
    applyConfig({
      internalMcpScope: 'never',
      codemode: { enabled: true },
    });
    const result = await buildScopedMcpConfig({
      goalShape: 'code',
      sessionId: SESSION_ID,
      mainOutDir: FAKE_MAIN_OUT,
    });
    expect(result).not.toBeNull();
    const data = readWrittenConfig(result!.configPath);
    expect(data.mcpServers).not.toHaveProperty('ouroboros');
    expect(result!.routingDecision).toBe('omit');
    await result!.cleanup();
  });

  it('passes through unrelated user servers in every routing path', async () => {
    applyUserServers({
      github: { command: 'npx', args: ['github-mcp'] },
      sentry: { url: 'http://localhost:9000/sse' },
    });
    applyConfig({
      internalMcpScope: 'task-gated',
      codemode: { enabled: true },
    });
    const result = await buildScopedMcpConfig({
      goalShape: 'code',
      sessionId: SESSION_ID,
      mainOutDir: FAKE_MAIN_OUT,
    });
    expect(result).not.toBeNull();
    const data = readWrittenConfig(result!.configPath);
    expect(data.mcpServers).toHaveProperty('github');
    expect(data.mcpServers).toHaveProperty('sentry');
    expect(data.mcpServers).not.toHaveProperty('ouroboros');
    await result!.cleanup();
  });

  // Wave 53k follow-up: when CodeMode is enabled, codemodeManager has placed
  // `__codemode_proxy` into ~/.claude.json mcpServers. The temp config must
  // pass it through so that --strict-mcp-config + the temp config gives the
  // agent a visible proxy. This is the regression test for the smoke-failure
  // where the temp config was empty (servers: []) and the agent saw nothing
  // through the proxy.
  it('passes through __codemode_proxy from ~/.claude.json under route-through-codemode', async () => {
    applyUserServers({
      __codemode_proxy: {
        command: 'node',
        args: ['/fake/proxyServer.js', '/fake/proxy-config.json'],
      },
    });
    applyConfig({
      internalMcpScope: 'task-gated',
      codemode: { enabled: true },
    });
    const result = await buildScopedMcpConfig({
      goalShape: 'code',
      sessionId: SESSION_ID,
      mainOutDir: FAKE_MAIN_OUT,
    });
    expect(result).not.toBeNull();
    const data = readWrittenConfig(result!.configPath);
    expect(data.mcpServers).toHaveProperty('__codemode_proxy');
    expect(data.mcpServers.__codemode_proxy.command).toBe('node');
    expect(data.mcpServers).not.toHaveProperty('ouroboros');
    expect(result!.routingDecision).toBe('route-through-codemode');
    await result!.cleanup();
  });
});


// Wave 101 Phase 4: telemetry emission describe block removed (mcpSpawnCostTelemetry deleted)

// ─── Cleanup ─────────────────────────────────────────────────────────────────

describe('cleanup', () => {
  it('removes the temp config file once cleanup() resolves', async () => {
    applyConfig({
      internalMcpScope: 'always',
    });
    const result = await buildScopedMcpConfig({
      goalShape: 'code',
      sessionId: SESSION_ID,
      mainOutDir: FAKE_MAIN_OUT,
    });
    expect(result).not.toBeNull();
    const path = result!.configPath;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only existence check
    expect(existsSync(path)).toBe(true);
    await result!.cleanup();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only existence check
    expect(existsSync(path)).toBe(false);
    // Defensive: if cleanup ever regressed, make sure the leak is visible.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only existence check
    if (existsSync(path)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- best-effort cleanup
      unlinkSync(path);
    }
  });
});
