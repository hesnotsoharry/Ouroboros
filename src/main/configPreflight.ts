import fs from 'fs';
import path from 'path';

/**
 * Sanitize the persisted config.json before electron-store reads it.
 *
 * electron-store throws synchronously at construction if the persisted JSON
 * fails JSON-Schema validation. That blocks app startup with no recovery path.
 * This preflight reshapes known-bad fields into schema-valid defaults.
 *
 * Currently handles:
 * - `profiles` written as a non-array (observed: object keyed by OS username
 *   containing a stale config snapshot from a buggy code path). Reset to [].
 * - Deprecated keys removed by upstream waves whose schemas use
 *   `additionalProperties: false` (an upgraded user's stored config still has
 *   them, so electron-store rejects the file). Each strip is idempotent.
 */
export function runConfigPreflight(): void {
  try {
    const userDataDir = resolveUserDataDir();
    if (!userDataDir) return;
    // Path is derived from Electron's userData dir, not user input.
    const file = path.join(userDataDir, 'config.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(file)) return;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const raw = fs.readFileSync(file, 'utf8');
    const data = parseJsonSafe(raw);
    if (!data || typeof data !== 'object') return;
    if (sanitize(data)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(file, JSON.stringify(data, null, '\t'), 'utf8');
    }
  } catch {
    // Never block startup on the preflight. If sanitization fails, electron-store
    // will surface its own validation error, which is the existing behavior.
  }
}

function parseJsonSafe(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitize(data: Record<string, unknown>): boolean {
  let dirty = false;
  if ('profiles' in data && !Array.isArray(data.profiles)) {
    data.profiles = [];
    dirty = true;
  }
  if (stripDeprecatedKeys(data)) {
    dirty = true;
  }
  return dirty;
}

/**
 * Remove keys that were dropped from the schema in prior waves but may still
 * exist in upgraded users' stored configs. Schemas use
 * `additionalProperties: false`, so a stale key blocks startup.
 */
function stripDeprecatedKeys(data: Record<string, unknown>): boolean {
  let dirty = false;
  // Wave 79 — top-level windowSessions removed (migration to sessionsData expired).
  if ('windowSessions' in data) {
    delete data.windowSessions;
    dirty = true;
  }
  // Wave 79 — codemode.routeInternalMcp removed.
  if (deleteNestedKey(data, 'codemode', 'routeInternalMcp')) dirty = true;
  // Wave 79 — internalMcp.transport removed.
  if (deleteNestedKey(data, 'internalMcp', 'transport')) dirty = true;
  // Wave 86 — agentChatSettings.chatOrchestration.useNewStateMachine flag removed (feature promoted to default).
  if (deleteNestedKey(data, 'agentChatSettings', 'chatOrchestration')) dirty = true;
  // Wave 10 — canonWorkbenchSessions reshape from flat { upper, lower } to
  // Record<projectRoot, { upper, lower } | null>. Wave 9 data on disk fails the
  // new schema (the new shape's additionalProperties: false on the inner per-slot
  // object rejects the legacy { cwd, claudeSessionId } values appearing under
  // top-level "upper"/"lower" keys). ADR D1 said cold-start; this is where the
  // cold-start actually has to happen (Conf throws on validate before any read-
  // time hook guard runs). Reset to {} if the legacy shape is detected.
  if (resetLegacyCanonWorkbenchSessions(data)) dirty = true;
  return dirty;
}

/**
 * Wave 9 wrote canonWorkbenchSessions as `{ upper: {...} | null, lower: {...} | null }`
 * — the keys "upper" and "lower" appearing at the top level signal the legacy
 * flat shape. Wave 10 reshaped to `Record<projectRoot, ...>` where keys are
 * absolute paths (e.g. `C:\Users\Cole\dev\foo`). A valid Wave 10 record would
 * never have bare "upper"/"lower" string keys (project roots are absolute paths).
 *
 * Wave 12 additionally detects the Wave 10 per-project slot shape where each
 * value is `{ upper: { cwd, ... } | null, lower: { cwd } | null }` (i.e. the
 * slot has a `cwd` property rather than the Wave-12 `tabs` array). Those entries
 * are incompatible with the Wave-12 TabCollection schema and must be cleared.
 */
function resetLegacyCanonWorkbenchSessions(data: Record<string, unknown>): boolean {
  const value = Reflect.get(data, 'canonWorkbenchSessions');
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  // Wave 9 flat shape: top-level keys "upper" or "lower" (not absolute paths).
  if ('upper' in record || 'lower' in record) {
    data.canonWorkbenchSessions = {};
    return true;
  }

  // Wave 12 valid shape: check if ANY entry has the TabCollection shape.
  // If ALL non-null entries already have TabCollection shape → no migration needed.
  // If ANY entry has the Wave-10 single-slot shape (cwd-bearing upper/lower) → clear all.
  if (hasAnyWave10SlotEntry(record)) {
    data.canonWorkbenchSessions = {};
    return true;
  }

  return false;
}

/**
 * Returns true if any entry in the record looks like a Wave-10 single-slot value:
 * `{ upper: { cwd: string, ... } | null, lower: { cwd: string } | null }`.
 * The distinguishing mark is the presence of a `cwd` string property on `upper`
 * or `lower` (Wave-12 TabCollection has `activeTabId` + `tabs`, never `cwd`).
 */
function hasAnyWave10SlotEntry(record: Record<string, unknown>): boolean {
  for (const entry of Object.values(record)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const slot = entry as Record<string, unknown>;
    if (isWave10SlotShape(slot)) return true;
  }
  return false;
}

function hasCwdProperty(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'cwd' in (value as Record<string, unknown>)
  );
}

function isWave10SlotShape(slot: Record<string, unknown>): boolean {
  if (!('upper' in slot) && !('lower' in slot)) return false;
  return hasCwdProperty(slot.upper) || hasCwdProperty(slot.lower);
}

function deleteNestedKey(data: Record<string, unknown>, parent: string, child: string): boolean {
  const value = Reflect.get(data, parent);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!Reflect.has(value, child)) return false;
  return Reflect.deleteProperty(value, child);
}

/**
 * Resolve electron-store's userData dir. In the main process, prefer
 * `app.getPath('userData')`. In worker_threads / utility processes the
 * `electron` import is empty, so derive the path the same way Electron does
 * from platform conventions + the package "name" field.
 */
export function resolveUserDataDir(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron');
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch {
    // worker_threads context — electron module unavailable in packaged builds.
    // Fall through to platform-convention path derivation below.
  }
  const appName = 'ouroboros';
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, appName);
  }
  if (process.platform === 'darwin' && process.env.HOME) {
    return path.join(process.env.HOME, 'Library', 'Application Support', appName);
  }
  if (process.env.HOME) {
    return path.join(process.env.HOME, '.config', appName);
  }
  return null;
}
