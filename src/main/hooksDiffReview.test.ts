/**
 * hooksDiffReview.test.ts — unit tests for the diff-review tap.
 *
 * Verifies the tap's gate logic and correlation-stash mechanics without
 * hitting the real git or IPC layers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const getConfigValueMock = vi.fn();
vi.mock('./config', () => ({
  getConfigValue: (...args: unknown[]) => getConfigValueMock(...args),
}));

const dispatchSyntheticMock = vi.fn();
vi.mock('./hooks', () => ({
  dispatchSyntheticHookEvent: (...args: unknown[]) => dispatchSyntheticMock(...args),
}));

const gitTrimmedMock = vi.fn();
vi.mock('./ipc-handlers/gitOperations', () => ({
  gitTrimmed: (...args: unknown[]) => gitTrimmedMock(...args),
}));

const getCachedRepoStatusMock = vi.fn<() => boolean | undefined>().mockReturnValue(undefined);
vi.mock('./ipc-handlers/gitRepoStatusCache', () => ({
  getCachedRepoStatus: (...args: unknown[]) => getCachedRepoStatusMock(...args),
}));

import log from './logger';
vi.mock('./logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import type { HookPayload } from './hooks';
import { tapDiffReview } from './hooksDiffReview';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePrePayload(overrides: Partial<HookPayload> = {}): HookPayload {
  return {
    type: 'pre_tool_use',
    sessionId: 'sess-1',
    toolName: 'Write',
    correlationId: 'corr-1',
    // paneId marks this as an IDE-owned session (set from OUROBOROS_PANE_ID in PTY env).
    // External sessions omit this field — tests that need to simulate external
    // sessions should pass paneId: undefined explicitly.
    paneId: 'wb-upper-cc',
    timestamp: Date.now(),
    input: { file_path: 'src/foo.ts' },
    ...overrides,
  } as HookPayload;
}

function makePostPayload(overrides: Partial<HookPayload> = {}): HookPayload {
  return {
    type: 'post_tool_use',
    sessionId: 'sess-1',
    toolName: 'Write',
    correlationId: 'corr-1',
    paneId: 'wb-upper-cc',
    timestamp: Date.now(),
    data: { filePath: 'src/foo.ts' },
    ...overrides,
  } as HookPayload;
}

function enabledSettings() {
  getConfigValueMock.mockReturnValue({ enableTerminalDiffReview: true });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('tapDiffReview', () => {
  const cwdMap = new Map<string, string>([['sess-1', '/proj']]);

  beforeEach(() => {
    vi.useFakeTimers();
    enabledSettings();
    gitTrimmedMock.mockResolvedValue('abc123');
    dispatchSyntheticMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('skips non-write-class tools', () => {
    tapDiffReview({ ...makePrePayload(), toolName: 'Read' } as HookPayload, cwdMap);
    vi.runAllTimers();
    expect(gitTrimmedMock).not.toHaveBeenCalled();
  });

  it('skips when enableTerminalDiffReview is false', () => {
    getConfigValueMock.mockReturnValue({ enableTerminalDiffReview: false });
    tapDiffReview(makePrePayload(), cwdMap);
    vi.runAllTimers();
    expect(gitTrimmedMock).not.toHaveBeenCalled();
  });

  it('captures snapshot on pre_tool_use for Write', async () => {
    tapDiffReview(makePrePayload(), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();
    expect(gitTrimmedMock).toHaveBeenCalledWith('/proj', ['rev-parse', 'HEAD']);
  });

  it('emits diff_review_ready on post_tool_use after snapshot captured', async () => {
    tapDiffReview(makePrePayload(), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(makePostPayload(), cwdMap);

    expect(dispatchSyntheticMock).toHaveBeenCalledTimes(1);
    const emitted = dispatchSyntheticMock.mock.calls[0][0];
    expect(emitted.type).toBe('diff_review_ready');
    expect(emitted.sessionId).toBe('sess-1');
    expect(emitted.snapshotHash).toBe('abc123');
    expect(emitted.projectRoot).toBe('/proj');
  });

  it('does NOT emit when post arrives with no matching pre (no stash)', () => {
    tapDiffReview(makePostPayload(), cwdMap);
    expect(dispatchSyntheticMock).not.toHaveBeenCalled();
  });

  it('is idempotent — second pre with same correlationId does not double-stash', async () => {
    tapDiffReview(makePrePayload(), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(makePrePayload(), cwdMap); // duplicate
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(makePostPayload(), cwdMap);
    expect(dispatchSyntheticMock).toHaveBeenCalledTimes(1);
  });

  it('logs warn and skips emit when git snapshot fails', async () => {
    gitTrimmedMock.mockRejectedValue(new Error('not a git repo'));
    tapDiffReview(makePrePayload(), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(makePostPayload(), cwdMap);
    expect(dispatchSyntheticMock).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it('uses payload.cwd when sessionId is not in sessionCwdMap (terminal-launched claude)', async () => {
    const emptyCwdMap = new Map<string, string>();
    tapDiffReview(
      makePrePayload({ sessionId: 'external-uuid', cwd: '/external/proj' }),
      emptyCwdMap,
    );
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();
    expect(gitTrimmedMock).toHaveBeenCalledWith('/external/proj', ['rev-parse', 'HEAD']);

    tapDiffReview(makePostPayload({ sessionId: 'external-uuid' }), emptyCwdMap);
    expect(dispatchSyntheticMock).toHaveBeenCalledTimes(1);
    const emitted = dispatchSyntheticMock.mock.calls[0][0];
    expect(emitted.projectRoot).toBe('/external/proj');
    expect(emitted.sessionId).toBe('external-uuid');
  });

  it('matching tool_use_id on pre and post correctly produces diff_review_ready', async () => {
    const toolUseId = 'tool-abc-123';
    tapDiffReview(makePrePayload({ correlationId: toolUseId }), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(makePostPayload({ correlationId: toolUseId }), cwdMap);
    expect(dispatchSyntheticMock).toHaveBeenCalledTimes(1);
    const emitted = dispatchSyntheticMock.mock.calls[0][0];
    expect(emitted.type).toBe('diff_review_ready');
    expect(emitted.snapshotHash).toBe('abc123');
  });

  it('mismatched correlationId on pre vs post does NOT emit (regression for Bug C)', async () => {
    const preCorrelationId = 'pre-uuid-aaaa';
    const postCorrelationId = 'post-uuid-bbbb';
    tapDiffReview(makePrePayload({ correlationId: preCorrelationId }), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(makePostPayload({ correlationId: postCorrelationId }), cwdMap);
    expect(dispatchSyntheticMock).not.toHaveBeenCalled();
  });

  // ── Ownership gate regression tests ───────────────────────────────────────

  it('skips git spawn for external session (no paneId) on pre_tool_use', async () => {
    // Simulates an external Claude session running on the same machine that fires
    // hooks into the IDE's named pipe. Without paneId the payload should be dropped
    // BEFORE any git work is triggered — the git spawn must never be called.
    tapDiffReview(makePrePayload({ paneId: undefined }), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();
    expect(gitTrimmedMock).not.toHaveBeenCalled();
  });

  it('skips diff_review_ready emit for external session (no paneId) on post_tool_use', async () => {
    // The pre event for an external session must have been dropped, so the stash
    // has no entry. But even if we call post directly, the ownership gate fires
    // on the post too and stops it before stash lookup.
    tapDiffReview(makePostPayload({ paneId: undefined }), cwdMap);
    expect(dispatchSyntheticMock).not.toHaveBeenCalled();
  });

  it('still processes diff-review for IDE-owned session (paneId present) on pre_tool_use', async () => {
    // Regression guard: the ownership gate must NOT block legitimate IDE sessions.
    tapDiffReview(makePrePayload({ paneId: 'wb-upper-cc' }), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();
    expect(gitTrimmedMock).toHaveBeenCalledWith('/proj', ['rev-parse', 'HEAD']);
  });

  it('still emits diff_review_ready for IDE-owned session (paneId present) end-to-end', async () => {
    tapDiffReview(makePrePayload({ paneId: 'wb-upper-cc' }), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(makePostPayload({ paneId: 'wb-upper-cc' }), cwdMap);
    expect(dispatchSyntheticMock).toHaveBeenCalledTimes(1);
    const emitted = dispatchSyntheticMock.mock.calls[0][0];
    expect(emitted.type).toBe('diff_review_ready');
    expect(emitted.sessionId).toBe('sess-1');
  });

  // ── Non-repo guard (defense-in-depth) tests ───────────────────────────────

  it('skips git spawn when cache reports cwd is not a git repo', async () => {
    // getCachedRepoStatus returning false means the repo-status cache already
    // confirmed this directory is not a git repo — no spawn needed.
    getCachedRepoStatusMock.mockReturnValue(false);
    tapDiffReview(makePrePayload(), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();
    expect(gitTrimmedMock).not.toHaveBeenCalled();
  });

  it('still spawns git when cache returns undefined (not yet checked)', async () => {
    // A cache miss means we have not yet checked this directory — allow the spawn.
    // The existing error-catch handles the case where it turns out not to be a repo.
    getCachedRepoStatusMock.mockReturnValue(undefined);
    tapDiffReview(makePrePayload(), cwdMap);
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();
    expect(gitTrimmedMock).toHaveBeenCalledWith('/proj', ['rev-parse', 'HEAD']);
  });

  it('handles MultiEdit filePaths forwarded from hook script', async () => {
    tapDiffReview(
      makePrePayload({
        toolName: 'MultiEdit',
        input: { edits: [{ file_path: 'a.ts' }, { file_path: 'b.ts' }] },
      }),
      cwdMap,
    );
    await vi.runAllTimersAsync();
    await vi.runAllTimersAsync();

    tapDiffReview(
      makePostPayload({ toolName: 'MultiEdit', data: { filePaths: ['a.ts', 'b.ts'] } }),
      cwdMap,
    );
    const emitted = dispatchSyntheticMock.mock.calls[0][0];
    expect(emitted.filePaths).toEqual(['a.ts', 'b.ts']);
  });
});
