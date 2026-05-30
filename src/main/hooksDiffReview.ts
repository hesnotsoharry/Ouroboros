/**
 * hooksDiffReview.ts — Hook tap for the diff-review producer.
 *
 * Listens to pre_tool_use / post_tool_use events for write-class tools
 * (Write, Edit, MultiEdit), captures a git snapshot before the write,
 * then emits a synthetic `diff_review_ready` agent-event so the renderer
 * hook `useDiffReviewTrigger` can open the diff-review panel.
 *
 * Registered in hooksTapRunner.ts alongside the other taps.
 * Wave 94 Phase E.
 */

import { getConfigValue } from './config';
import type { HookPayload } from './hooks';
import { dispatchSyntheticHookEvent } from './hooks';
import { getCachedRepoStatus } from './ipc-handlers/gitRepoStatusCache';
import log from './logger';

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const STASH_TTL_MS = 60_000;
const STASH_MAX_ENTRIES = 100;

interface StashEntry {
  snapshotHash: string;
  projectRoot: string;
  timestamp: number;
}

// correlationKey → StashEntry. Keyed by `${sessionId}:${correlationId}`.
const preSnapshotStash = new Map<string, StashEntry>();

function correlationKey(sessionId: string, correlationId: string): string {
  return `${sessionId}:${correlationId}`;
}

function evictStaleEntries(): void {
  const cutoff = Date.now() - STASH_TTL_MS;
  for (const [key, entry] of preSnapshotStash) {
    if (entry.timestamp < cutoff) preSnapshotStash.delete(key);
  }
  // Size cap: evict oldest entries when stash exceeds STASH_MAX_ENTRIES.
  // Prevents unbounded growth when post-hooks are lost.
  if (preSnapshotStash.size > STASH_MAX_ENTRIES) {
    const overflow = preSnapshotStash.size - STASH_MAX_ENTRIES;
    let evicted = 0;
    for (const key of preSnapshotStash.keys()) {
      preSnapshotStash.delete(key);
      evicted += 1;
      if (evicted >= overflow) break;
    }
    log.warn('[diffReview] stash size cap reached — evicted oldest entries', { evicted });
  }
}

async function captureSnapshot(cwd: string): Promise<string | null> {
  // Defense-in-depth: skip the spawn when the cache already confirms this is
  // not a git repo (avoids "fatal: not a git repository" churn on non-repo cwds).
  // A cache miss (undefined) allows the spawn — the catch below handles the case
  // where the cwd is later confirmed non-repo.
  if (getCachedRepoStatus(cwd) === false) {
    return null;
  }
  const { gitTrimmed } = await import('./ipc-handlers/gitOperations');
  try {
    return await gitTrimmed(cwd, ['rev-parse', 'HEAD']);
  } catch (err) {
    log.warn('[diffReview] git snapshot failed:', err);
    return null;
  }
}

function getFilePathsFromPayload(payload: HookPayload): string[] {
  const data = payload.data as Record<string, unknown> | undefined;
  // post_tool_use path forwarded by post_tool_use.mjs
  if (typeof data?.filePath === 'string') return [data.filePath];
  if (Array.isArray(data?.filePaths))
    return (data.filePaths as unknown[]).filter((p): p is string => typeof p === 'string');
  // fallback: read from input (pre_tool_use shape)
  const input = payload.input as Record<string, unknown> | undefined;
  if (typeof input?.file_path === 'string') return [input.file_path];
  if (Array.isArray(input?.edits)) {
    return (input.edits as Array<Record<string, unknown>>)
      .map((e) => e.file_path)
      .filter((p): p is string => typeof p === 'string');
  }
  return [];
}

function resolvePreToolUseCwd(
  payload: HookPayload,
  sessionCwdMap: Map<string, string>,
): string | null {
  if (!payload.correlationId || !payload.sessionId) {
    return null;
  }
  const cwd = payload.cwd ?? sessionCwdMap.get(payload.sessionId);
  if (!cwd) {
    return null;
  }
  return cwd;
}

function handlePreToolUse(payload: HookPayload, sessionCwdMap: Map<string, string>): void {
  const cwd = resolvePreToolUseCwd(payload, sessionCwdMap);
  if (!cwd) return;
  evictStaleEntries();
  const key = correlationKey(payload.sessionId, payload.correlationId!);
  if (preSnapshotStash.has(key)) {
    return; // idempotent — already stashed
  }
  setImmediate(() => {
    void captureSnapshot(cwd).then((hash) => {
      if (!hash) {
        return;
      }
      preSnapshotStash.set(key, { snapshotHash: hash, projectRoot: cwd, timestamp: Date.now() });
    });
  });
}

function handlePostToolUse(payload: HookPayload): void {
  if (!payload.correlationId || !payload.sessionId) {
    return;
  }
  const key = correlationKey(payload.sessionId, payload.correlationId);
  const entry = preSnapshotStash.get(key);
  preSnapshotStash.delete(key); // always clean up
  if (!entry) {
    return;
  }

  const filePaths = getFilePathsFromPayload(payload);
  const event = {
    type: 'diff_review_ready' as const,
    sessionId: payload.sessionId,
    snapshotHash: entry.snapshotHash,
    projectRoot: entry.projectRoot,
    filePaths,
    timestamp: Date.now(),
  };
  dispatchSyntheticHookEvent(event as unknown as HookPayload);
}

/**
 * Ownership gate: only process diff-review work for IDE-spawned sessions.
 *
 * `paneId` is set by session_start.mjs / agent_start.mjs exclusively from
 * `process.env.OUROBOROS_PANE_ID`, which is injected only into PTY processes
 * the IDE spawns. External Claude sessions running elsewhere on the machine
 * will never have this env var, so their hook payloads arrive with no paneId.
 *
 * This is the primary ownership signal (preferred over an owned-session-ID set
 * because: (a) it requires no threading of state from hooks.ts, (b) it is
 * reliable at the payload level, and (c) the CLAUDE.md gotcha explicitly
 * documents it as the discriminator for IDE-owned sessions).
 *
 * Synthetic `diff_review_ready` payloads emitted by this module have
 * `ideSpawned: true` (set by dispatchSyntheticHookEvent) but no paneId — that
 * is correct: they skip this gate because their type is 'diff_review_ready',
 * not 'pre_tool_use' / 'post_tool_use', so the toolName check returns first.
 */
function isOwnedSession(payload: HookPayload): boolean {
  return Boolean(payload.paneId);
}

export function tapDiffReview(payload: HookPayload, sessionCwdMap: Map<string, string>): void {
  if (!payload.toolName || !WRITE_TOOLS.has(payload.toolName)) return;
  // Gate: skip diff-review for sessions the IDE did not spawn. External Claude
  // sessions on the same machine send hooks to this pipe too; processing their
  // write events causes git spawns against unknown cwds and saturates CPU/disk.
  if (!isOwnedSession(payload)) return;
  const enabled = getConfigValue('claudeCliSettings')?.enableTerminalDiffReview ?? true;
  if (!enabled) return;

  if (payload.type === 'pre_tool_use') {
    handlePreToolUse(payload, sessionCwdMap);
  } else if (payload.type === 'post_tool_use') {
    handlePostToolUse(payload);
  }
}
