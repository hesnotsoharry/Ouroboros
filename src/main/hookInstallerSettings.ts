/**
 * hookInstallerSettings.ts — Registers telemetry hook commands into
 * ~/.claude/settings.json on IDE boot.
 *
 * Handles one telemetry hook entry:
 *   1. SessionStart → session_start_spawn_cost.mjs  (spawn-cost + spawn-trace)
 *
 * Also performs a one-time pruning pass (Wave 101) to remove the stale
 * user_prompt_submit_router_shadow.mjs entry from existing installs.
 *
 * Properties:
 *   - Idempotent: running N times is identical to running once.
 *   - Append-only for live hooks: user entries are never deleted or reordered.
 *   - Atomic write: settings.json is never half-written (tmp + rename).
 *   - First-install backup: original settings.json backed up ONCE.
 *   - Failure-tolerant: logs warn and returns, never throws.
 *
 * Split from hookInstaller.ts to stay under the 300-line ESLint limit.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { readClaudeSettings } from './hookInstaller';
import log from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HookEntry {
  type: 'command';
  command: string;
}

interface HookMatcher {
  hooks: HookEntry[];
  matcher?: string;
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

/** The live telemetry hook entries to maintain in ~/.claude/settings.json. */
interface TelemetryHookSpec {
  eventType: string;
  scriptName: string;
}

const TELEMETRY_HOOKS: TelemetryHookSpec[] = [
  { eventType: 'SessionStart', scriptName: 'session_start_spawn_cost.mjs' },
  // user_prompt_submit_router_shadow.mjs removed in Wave 101 (router-shadow deleted)
];

/**
 * Script filename of the removed router-shadow hook.
 * Used by pruneRouterShadowFromSettings to remove stale entries from existing installs.
 */
const ROUTER_SHADOW_SCRIPT = 'user_prompt_submit_router_shadow.mjs';

// ─── Command builders ─────────────────────────────────────────────────────────

export function buildTelemetryHookCommand(hooksDir: string, scriptName: string): string {
  return `node "${path.join(hooksDir, scriptName)}"`;
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

function isCommandAlreadyPresent(
  matchers: HookMatcher[],
  command: string,
): boolean {
  return matchers.some((m) => m.hooks?.some((h) => h.command === command));
}

function getOrCreateEventMatchers(
  hooks: Record<string, HookMatcher[]>,
  eventType: string,
): HookMatcher[] {
  // eslint-disable-next-line security/detect-object-injection -- eventType from fixed manifest constant
  if (Array.isArray(hooks[eventType])) {
    // eslint-disable-next-line security/detect-object-injection -- same as above
    return hooks[eventType];
  }
  // eslint-disable-next-line security/detect-object-injection -- same as above
  hooks[eventType] = [];
  // eslint-disable-next-line security/detect-object-injection -- same as above
  return hooks[eventType];
}

function getOrCreateHooksMap(settings: Record<string, unknown>): Record<string, HookMatcher[]> {
  if (typeof settings['hooks'] === 'object' && settings['hooks'] !== null) {
    return settings['hooks'] as Record<string, HookMatcher[]>;
  }
  settings['hooks'] = {};
  return settings['hooks'] as Record<string, HookMatcher[]>;
}

// ─── Backup ───────────────────────────────────────────────────────────────────

/** Returns true if any backup file already exists for this settings path. */
function backupExists(settingsPath: string): boolean {
  const dir = path.dirname(settingsPath);
  const base = path.basename(settingsPath);
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir derived from ~/.claude/settings.json path
    const entries = fs.readdirSync(dir);
    return entries.some((e) => e.startsWith(`${base}.`) && e.endsWith('.bak'));
  } catch {
    return false;
  }
}

function writeFirstInstallBackup(settingsPath: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
  if (!fs.existsSync(settingsPath)) return;
  if (backupExists(settingsPath)) return;

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakPath = `${settingsPath}.${ts}.bak`;
  try {
    fs.copyFileSync(settingsPath, bakPath);
    log.info(`[hookInstallerSettings] backup written to ${bakPath}`);
  } catch (err) {
    log.warn('[hookInstallerSettings] could not write backup:', err);
  }
}

// ─── Atomic write ─────────────────────────────────────────────────────────────

function atomicWriteSettings(settingsPath: string, settings: Record<string, unknown>): void {
  const tmpPath = `${settingsPath}.tmp`;
  const json = JSON.stringify(settings, null, 2);

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
    fs.writeFileSync(tmpPath, json, 'utf8');
    // Best-effort fsync via fd — available on Node 16+
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
      const fd = fs.openSync(tmpPath, 'r+');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      // fsync is best-effort; continue to rename
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
    fs.renameSync(tmpPath, settingsPath);
  } catch (err) {
    // Clean up tmp on write failure
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

// ─── Router-shadow prune (Wave 101 one-time uninstall) ───────────────────────

/** Returns true if a hook command references the router-shadow script. */
function isRouterShadowCommand(h: HookEntry): boolean {
  return h.command.includes(ROUTER_SHADOW_SCRIPT);
}

/** Returns matchers with the router-shadow hook entries removed (empty matchers dropped). */
function filterRouterShadow(matchers: HookMatcher[]): { filtered: HookMatcher[]; count: number } {
  let count = 0;
  const filtered = matchers
    .map((m) => {
      const kept = (m.hooks ?? []).filter((h) => !isRouterShadowCommand(h));
      count += (m.hooks ?? []).length - kept.length;
      return { ...m, hooks: kept };
    })
    .filter((m) => m.hooks.length > 0);
  return { filtered, count };
}

/**
 * Removes any UserPromptSubmit hook entry whose command references
 * user_prompt_submit_router_shadow.mjs from ~/.claude/settings.json.
 *
 * Safety: matches only on the specific script filename; all other hooks and
 * settings are preserved verbatim; writes atomically; never throws.
 */
export function pruneRouterShadowFromSettings(): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

  let settings: Record<string, unknown>;
  try {
    settings = readClaudeSettings(settingsPath);
    if (Object.keys(settings).length === 0) return;
  } catch (err) {
    log.warn('[hookInstallerSettings] pruneRouterShadow: could not read settings.json:', err);
    return;
  }

  const hooks = settings['hooks'];
  if (typeof hooks !== 'object' || hooks === null) return;
  const hooksMap = hooks as Record<string, HookMatcher[]>;
  const userPromptMatchers = hooksMap['UserPromptSubmit'];
  if (!Array.isArray(userPromptMatchers)) return;

  const { filtered, count } = filterRouterShadow(userPromptMatchers);
  if (count === 0) return;

  if (filtered.length > 0) {
    hooksMap['UserPromptSubmit'] = filtered;
  } else {
    delete (hooksMap as Record<string, unknown>)['UserPromptSubmit'];
  }

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    atomicWriteSettings(settingsPath, settings);
    log.info(`[hookInstallerSettings] pruned ${count} router-shadow hook entries from settings.json`);
  } catch (err) {
    log.warn('[hookInstallerSettings] pruneRouterShadow: could not write settings.json:', err);
  }
}

// ─── Merge logic ──────────────────────────────────────────────────────────────

function mergeManifestIntoSettings(
  settings: Record<string, unknown>,
  hooksDir: string,
): { added: number; alreadyPresent: number } {
  const hooks = getOrCreateHooksMap(settings);
  let added = 0;
  let alreadyPresent = 0;

  for (const spec of TELEMETRY_HOOKS) {
    const command = buildTelemetryHookCommand(hooksDir, spec.scriptName);
    const matchers = getOrCreateEventMatchers(hooks, spec.eventType);

    if (isCommandAlreadyPresent(matchers, command)) {
      alreadyPresent++;
      continue;
    }

    matchers.push({ hooks: [{ type: 'command', command }] });
    added++;
  }

  return { added, alreadyPresent };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Idempotently merges telemetry hook entries into ~/.claude/settings.json.
 *
 * Call after registerStatusLineInSettings() in syncHooksIntoSettings().
 * Never throws — logs warn on any fs error.
 */
export function registerTelemetryHooksInSettings(hooksDir: string): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

  let settings: Record<string, unknown>;
  let isMalformed = false;

  try {
    settings = readClaudeSettings(settingsPath);
    // readClaudeSettings returns {} for malformed JSON; detect by re-reading
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
    if (fs.existsSync(settingsPath)) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
        JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch {
        isMalformed = true;
      }
    }
  } catch (err) {
    log.warn('[hookInstallerSettings] could not read settings.json:', err);
    return;
  }

  // Backup on first install OR when the file is malformed (preserve corrupted original)
  const needsBackup = isMalformed || !backupExists(settingsPath);
  if (needsBackup) {
    writeFirstInstallBackup(settingsPath);
  }

  const { added, alreadyPresent } = mergeManifestIntoSettings(settings, hooksDir);

  if (added === 0) {
    log.info(
      `[hookInstallerSettings] telemetry hooks already registered (${alreadyPresent} present)`,
    );
    return;
  }

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    atomicWriteSettings(settingsPath, settings);
    log.info(
      `[hookInstallerSettings] registered telemetry hooks: ${added} added, ${alreadyPresent} already present`,
    );
  } catch (err) {
    log.warn('[hookInstallerSettings] could not write settings.json:', err);
  }
}
