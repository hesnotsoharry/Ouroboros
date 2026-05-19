/**
 * codemodeStartup.ts — Wave 53l Phase A: user-level CodeMode lifecycle.
 *
 * Pre-Wave-53l, CodeMode was per-spawn: `acquireCodeModeForLaunch` enabled
 * it on every IDE-orchestrated chat spawn and `releaseCodeModeForLaunch`
 * disabled it on completion. External `claude` sessions never touched
 * CodeMode at all — they read `~/.claude.json mcpServers` and `.mcp.json`
 * directly, missing the multiplex.
 *
 * Wave 53l flips this: when `codemode.enabled: true`, the IDE enables
 * CodeMode ONCE at startup and leaves `__codemode_proxy` in
 * `~/.claude.json mcpServers` so EVERY Claude Code session — IDE-internal
 * AND external terminal — sees the proxy. The per-spawn acquire becomes
 * a no-op (it already returns `ownsLifecycle:false` when
 * `isCodeModeEnabled()`).
 *
 * Lifecycle:
 *   - IDE startup → `enableCodeModeUserLevel()` (after the codebase graph
 *     init, so config is fully loaded).
 *   - IDE shutdown → `disableCodeModeUserLevel()` restores user's
 *     `mcpServers` from the managed-backup file.
 *   - If the IDE crashes before disable, the next startup's
 *     `enableCodeMode` calls `maybeRestoreFromCrash` (Wave 53k Phase B″)
 *     which self-heals before re-enabling.
 *
 * Config:
 *   - `codemode.enabled` (bool) — single switch. true = take over user
 *     config; false = direct discovery.
 *   - `codemode.excludeFromMultiplex` (string[]) — names to skip
 *     (HTTP-only servers, problem servers, etc.).
 *
 * HTTP-only upstreams are filtered the same way as in Phase B‴'s
 * `claudeCodeMode.resolveProxiedServerNames`: `mcpClient` is stdio-only,
 * so URL-only entries can't be multiplexed and stay directly registered.
 *
 * NOTE (Wave 98 bypass): `runCodeModeStartupGate` replaces
 * `enableCodeModeUserLevel` in the main-process startup sequence.
 * CodeMode is currently bypassed on startup — the enable path never runs.
 * Users with a prior enable (codemode-managed.json on disk) have their
 * backed-up MCP servers restored on first run, then CodeMode is left off.
 * See Wave 99+ for re-enable wiring when the subsystem is stable.
 */

import fs from 'fs/promises';

import { getConfigValue } from '../config';
import log from '../logger';
import {
  disableCodeMode,
  enableCodeMode,
  getMcpServers,
  isCodeModeEnabled,
  maybeRestoreFromCrash,
  type McpServerConfig,
} from './codemodeManager';
import {
  deleteRestorationFile,
  PROXY_CONFIG_PATH,
  restorationFilePath,
} from './codemodeManagerFiles';

interface CodeModeConfig {
  enabled?: boolean;
  excludeFromMultiplex?: string[];
}

function readConfig(): CodeModeConfig {
  return (getConfigValue('codemode') as CodeModeConfig | undefined) ?? {};
}

function isStdioCapable(config: McpServerConfig): boolean {
  return typeof config.command === 'string' && config.command.length > 0;
}

// Wave 60 Phase E: removed dropStaleOuroboros / livePortOrNull / bridge-port
// extraction helpers. The pre-Wave-60 bridge baked a port into args that
// could go stale across IDE restarts; Wave 60's standalone is portless and
// stable across sessions, so the guard has nothing to defend against.

async function restorationFileExists(): Promise<boolean> {
  try {
    await fs.access(restorationFilePath());
    return true;
  } catch {
    return false;
  }
}

async function cleanupProxyConfig(): Promise<void> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- known module constant
    await fs.unlink(PROXY_CONFIG_PATH);
  } catch {
    /* non-fatal */
  }
}

/**
 * Wave 98 bypass: CodeMode is disabled on startup until the subsystem is
 * stable in packaged builds. If a prior enable left codemode-managed.json
 * on disk, this function restores the backed-up MCP servers to
 * ~/.claude.json (and project .mcp.json) so Claude Code CLI sees them
 * normally again. The enable path is never reached.
 *
 * Re-enable wiring: replace the call to `runCodeModeStartupGate` in
 * `main.ts` with `enableCodeModeUserLevel` and remove this function once
 * the codemode subsystem is ready for packaged-build use (Wave 99+).
 */
export async function runCodeModeStartupGate(): Promise<void> {
  const hasRestorationFile = await restorationFileExists();
  if (!hasRestorationFile) {
    log.info('[codemode-startup] disabled — no prior state to restore, skipping');
    return;
  }
  log.info(
    '[codemode-startup] disabled — restoring MCP servers to ~/.claude.json from prior enable',
  );
  try {
    await maybeRestoreFromCrash();
  } catch (err) {
    log.warn('[codemode-startup] restoration threw — state may be partial:', err);
  }
  // maybeRestoreFromCrash deletes the restoration file when it parses
  // successfully. If the file was malformed (version mismatch, bad JSON),
  // it returns early without deleting. Delete unconditionally here so a
  // corrupt managed file doesn't re-trigger this branch on every startup.
  await deleteRestorationFile();
  await cleanupProxyConfig();
  log.info('[codemode-startup] MCP server restoration complete');
}

interface StartupOptions {
  /**
   * Default project root, used to multiplex any project-scope ouroboros
   * entry in `<root>/.mcp.json`. Optional — without it, only user-scope
   * `~/.claude.json mcpServers` entries are multiplexed.
   */
  projectRoot?: string;
}

interface EligibilityResult {
  serverNames: string[];
  skippedHttp: string[];
}

async function resolveEligibleServers(
  cfg: CodeModeConfig,
  projectRoot: string | undefined,
): Promise<EligibilityResult> {
  const excludes = new Set(cfg.excludeFromMultiplex ?? []);
  const allServers = await getMcpServers(projectRoot);
  const eligible = allServers
    .filter((e) => e.enabled)
    .filter((e) => !excludes.has(e.name))
    .filter((e) => isStdioCapable(e.config));
  const skippedHttp = allServers
    .filter((e) => e.enabled && !isStdioCapable(e.config))
    .map((e) => e.name);
  return { serverNames: eligible.map((e) => e.name), skippedHttp };
}

/**
 * Enable CodeMode at user level. Idempotent — returns success:true if
 * already enabled. Honors `codemode.enabled` (gate) and
 * `codemode.excludeFromMultiplex` (per-server skip list).
 */
export async function enableCodeModeUserLevel(
  opts: StartupOptions = {},
): Promise<{ success: boolean; error?: string }> {
  const cfg = readConfig();
  if (cfg.enabled !== true) {
    log.info('[codemode-startup] codemode.enabled is false — skipping user-level enable');
    return { success: false, error: 'codemode.enabled is false' };
  }
  if (isCodeModeEnabled()) {
    log.info('[codemode-startup] already enabled in this process — skipping');
    return { success: true };
  }
  // Bug fix (Wave 98): restore any backed-up servers to ~/.claude.json BEFORE
  // resolving eligible servers. Without this, the server list read here would
  // be empty (servers were removed during the prior enable and stashed in the
  // restoration file), causing enableCodeModeUserLevel to bail out before
  // calling enableCodeMode — which meant maybeRestoreFromCrash never ran and
  // the stale proxy config (potentially written by a dev-mode session with a
  // source-tree context7Proxy.js path) was never overwritten.
  await maybeRestoreFromCrash();
  const { serverNames, skippedHttp } = await resolveEligibleServers(cfg, opts.projectRoot);
  if (skippedHttp.length > 0) {
    log.info(`[codemode-startup] skipping HTTP-only upstreams: ${skippedHttp.join(',')}`);
  }
  if (serverNames.length === 0) {
    log.info('[codemode-startup] no eligible servers to multiplex — skipping enable');
    return { success: false, error: 'no eligible servers' };
  }
  log.info(`[codemode-startup] enabling user-level CodeMode for: ${serverNames.join(',')}`);
  const result = await enableCodeMode(serverNames, 'global', opts.projectRoot);
  if (result.success) log.info(`[codemode-startup] enabled — proxied: ${serverNames.join(',')}`);
  else log.warn(`[codemode-startup] enable failed: ${result.error}`);
  return result;
}

/**
 * Disable user-level CodeMode. Called on IDE shutdown. Best-effort:
 * errors are logged, never thrown — `before-quit` is time-sensitive and
 * we'd rather force-restore on next startup via `maybeRestoreFromCrash`
 * than block app quit.
 */
export async function disableCodeModeUserLevel(): Promise<void> {
  if (!isCodeModeEnabled()) {
    return;
  }
  log.info('[codemode-startup] disabling user-level CodeMode (IDE shutting down)');
  try {
    const result = await disableCodeMode();
    if (!result.success) {
      log.warn(`[codemode-startup] disable returned error: ${result.error}`);
    }
  } catch (err) {
    log.warn('[codemode-startup] disable threw (ignored):', err);
  }
}
