/**
 * hookInstallerSettings.ts — Registers telemetry hook commands into
 * ~/.claude/settings.json on IDE boot.
 *
 * The live telemetry hook manifest (TELEMETRY_HOOKS) is currently empty after
 * Wave 101 removed all telemetry-persistence hooks:
 *   - session_start_spawn_cost.mjs removed in Wave 101 Phase 6b (spawn-cost/trace deleted)
 *   - user_prompt_submit_router_shadow.mjs removed in Wave 101 Phase 6 (router-shadow deleted)
 *
 * Also performs one-time pruning passes (Wave 101) to remove stale entries from
 * existing installs of both removed scripts from ~/.claude/settings.json.
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

/**
 * Live telemetry hooks — currently empty after Wave 101 Phase 6/6b removed all
 * telemetry-persistence hooks. Kept as a typed manifest so the merge logic
 * and tests remain wired for future hook additions.
 */
const TELEMETRY_HOOKS: TelemetryHookSpec[] = [];

/**
 * Scripts removed in Wave 101, keyed by their event-type registration, that
 * must be pruned from existing ~/.claude/settings.json installs.
 * pruneRouterShadowFromSettings() iterates this list and removes all of them.
 */
interface RemovedHookSpec {
  eventType: string;
  scriptName: string;
}

const REMOVED_HOOKS: RemovedHookSpec[] = [
  // Phase 6: router-shadow deleted (UserPromptSubmit)
  { eventType: 'UserPromptSubmit', scriptName: 'user_prompt_submit_router_shadow.mjs' },
  // Phase 6b: spawn-cost/trace deleted (SessionStart)
  { eventType: 'SessionStart', scriptName: 'session_start_spawn_cost.mjs' },
];

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

// ─── Removed-hook prune (Wave 101 one-time uninstall) ────────────────────────

/** Returns matchers with any hooks referencing scriptName removed (empty matchers dropped). */
function filterScriptFromMatchers(
  matchers: HookMatcher[],
  scriptName: string,
): { filtered: HookMatcher[]; count: number } {
  let count = 0;
  const filtered = matchers
    .map((m) => {
      const kept = (m.hooks ?? []).filter((h) => !h.command.includes(scriptName));
      count += (m.hooks ?? []).length - kept.length;
      return { ...m, hooks: kept };
    })
    .filter((m) => m.hooks.length > 0);
  return { filtered, count };
}

/**
 * Applies the REMOVED_HOOKS list to hooksMap in-place.
 * Returns the total count of pruned hook entries across all specs.
 */
function pruneSpecsFromHooksMap(hooksMap: Record<string, HookMatcher[]>): number {
  let total = 0;
  for (const spec of REMOVED_HOOKS) {
    const matchers = hooksMap[spec.eventType];
    if (!Array.isArray(matchers)) continue;
    const { filtered, count } = filterScriptFromMatchers(matchers, spec.scriptName);
    if (count === 0) continue;
    total += count;
    if (filtered.length > 0) {
      hooksMap[spec.eventType] = filtered;
    } else {
      delete (hooksMap as Record<string, unknown>)[spec.eventType];
    }
  }
  return total;
}

/**
 * Removes all hook entries listed in REMOVED_HOOKS from ~/.claude/settings.json.
 *
 * Covers Wave 101 Phase 6 (router-shadow, UserPromptSubmit) and Phase 6b
 * (session_start_spawn_cost, SessionStart). Iterates REMOVED_HOOKS so future
 * removals only need a new entry there, not a new prune function.
 *
 * Safety: matches only on the specific script filenames; all other hooks and
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

  const totalPruned = pruneSpecsFromHooksMap(hooksMap);

  if (totalPruned === 0) return;

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from ~/.claude/settings.json
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    atomicWriteSettings(settingsPath, settings);
    log.info(`[hookInstallerSettings] pruned ${totalPruned} removed hook entries from settings.json`);
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
