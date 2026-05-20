/**
 * useAgentCompletionIndicators.test.ts
 *
 * Tests for the pure deriveCompletionStatus helper (no React needed).
 * Covers: complete, error, error-outranks-complete, running, unseen logic,
 * re-light, undefined cwd, Windows path normalization, nested projects,
 * the mark-viewed watermark behavior, and the critical split-watermark
 * interaction (project and session marks are independent).
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../components/AgentMonitor/types';
import { deriveCompletionStatus, normalizePath } from './useAgentCompletionIndicators';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentSession>): AgentSession {
  return {
    id: 'agent-1',
    taskLabel: 'test task',
    status: 'complete',
    startedAt: 1000,
    completedAt: 2000,
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    cwd: 'C:/projects/foo',
    ...overrides,
  };
}

// ─── Test 1: unseen complete agent → statusByProject and statusByClaudeSessionId ──

describe('deriveCompletionStatus', () => {
  it('complete agent under project → statusByProject complete + sessionId complete', () => {
    const agents = [makeAgent({ id: 'a1', status: 'complete', completedAt: 2000 })];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
    expect(result.statusByClaudeSessionId['a1']).toBe('complete');
  });

  // ─── Test 2: error agent → 'error' in both maps ──────────────────────────

  it('error agent → statusByProject error + sessionId error', () => {
    const agents = [makeAgent({ id: 'a2', status: 'error', completedAt: 3000 })];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    expect(result.statusByProject['C:/projects/foo']).toBe('error');
    expect(result.statusByClaudeSessionId['a2']).toBe('error');
  });

  // ─── Test 3: project with unseen complete + error → error wins ───────────

  it('project with both unseen complete and error → error outranks complete', () => {
    const agents = [
      makeAgent({ id: 'a3a', status: 'complete', completedAt: 2000 }),
      makeAgent({ id: 'a3b', status: 'error', completedAt: 3000 }),
    ];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    expect(result.statusByProject['C:/projects/foo']).toBe('error');
  });

  // ─── Test 4: running agent → 'running' in sessionId map, not in project map

  it('running agent → statusByClaudeSessionId running, absent from statusByProject', () => {
    const agents = [makeAgent({ id: 'a4', status: 'running', completedAt: undefined })];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    expect(result.statusByClaudeSessionId['a4']).toBe('running');
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  // ─── Test 5: session watermark clears the session entry only ────────────
  // Under the split-watermark design, stamping the session watermark clears the
  // per-terminal indicator but NOT the project dot (project dot uses the project
  // watermark). If both need to be cleared, both watermarks must be stamped.

  it('session watermark omits the session from statusByClaudeSessionId; project dot still shows', () => {
    const agents = [makeAgent({ id: 'a5', status: 'complete', completedAt: 2000 })];
    const projects = ['C:/projects/foo'];
    // lastSessionViewedAt equals completedAt → session seen
    const result = deriveCompletionStatus(agents, projects, {}, { a5: 2000 });

    // Session entry is cleared
    expect(result.statusByClaudeSessionId['a5']).toBeUndefined();
    // Project dot remains (project watermark not stamped)
    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  // ─── Test 6: re-light — completedAt newer than BOTH watermarks → reappears ─

  it('newer completedAt than both watermarks → re-lights (reappears in both maps)', () => {
    const agents = [makeAgent({ id: 'a6', status: 'complete', completedAt: 5000 })];
    const projects = ['C:/projects/foo'];
    // Previous project view at 3000, session view at 3000, but new completion at 5000
    const result = deriveCompletionStatus(
      agents,
      projects,
      { 'c:/projects/foo': 3000 },
      { a6: 3000 },
    );

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
    expect(result.statusByClaudeSessionId['a6']).toBe('complete');
  });

  // ─── Test 7: undefined cwd → no project contribution, no throw ───────────

  it('agent with undefined cwd contributes to no project and does not throw', () => {
    const agents = [makeAgent({ id: 'a7', status: 'complete', cwd: undefined })];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
    // Session indicator is still set (cwd only affects project map)
    expect(result.statusByClaudeSessionId['a7']).toBe('complete');
  });

  // ─── Test 8: Windows path normalization ──────────────────────────────────

  it('Windows backslash cwd matches forward-slash project path', () => {
    const agents = [
      makeAgent({
        id: 'a8a',
        status: 'complete',
        completedAt: 2000,
        cwd: 'C:\\Web App\\Agent IDE\\src',
      }),
    ];
    const projects = ['C:/Web App/Agent IDE'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    expect(result.statusByProject['C:/Web App/Agent IDE']).toBe('complete');
  });

  it('backslash project path also normalizes and matches backslash cwd', () => {
    const agents = [
      makeAgent({
        id: 'a8b',
        status: 'complete',
        completedAt: 2000,
        cwd: 'C:\\Web App\\Agent IDE\\src',
      }),
    ];
    const projects = ['C:\\Web App\\Agent IDE'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    // Key is the original un-normalized project path from the array
    expect(result.statusByProject['C:\\Web App\\Agent IDE']).toBe('complete');
  });

  // ─── Test 9: nested projects — agent assigns to deepest matching project ──

  it('nested projects: agent cwd under deeper project assigns only to the deeper one', () => {
    const agents = [
      makeAgent({
        id: 'a9',
        status: 'complete',
        completedAt: 2000,
        cwd: 'C:/projects/foo/bar/src',
      }),
    ];
    const projects = ['C:/projects/foo', 'C:/projects/foo/bar'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    // Shallow project gets nothing
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
    // Deeper project gets the indicator
    expect(result.statusByProject['C:/projects/foo/bar']).toBe('complete');
  });

  // ─── Test 10: clearing both maps requires stamping both watermarks ───────

  it('stamping both watermarks clears both statusByProject and statusByClaudeSessionId', () => {
    const agents = [makeAgent({ id: 'a10', status: 'complete', completedAt: 2000 })];
    const projects = ['C:/projects/foo'];

    // Before mark: unseen in both maps
    const before = deriveCompletionStatus(agents, projects, {}, {});
    expect(before.statusByProject['C:/projects/foo']).toBe('complete');
    expect(before.statusByClaudeSessionId['a10']).toBe('complete');

    // After stamping BOTH watermarks: both maps are cleared
    const after = deriveCompletionStatus(
      agents,
      projects,
      { 'c:/projects/foo': 9999 },
      { a10: 9999 },
    );
    expect(after.statusByProject['C:/projects/foo']).toBeUndefined();
    expect(after.statusByClaudeSessionId['a10']).toBeUndefined();
  });

  // ─── Bonus: exact cwd === project (not just nested) matches ──────────────

  it('exact cwd === project path (no trailing slash) matches correctly', () => {
    const agents = [
      makeAgent({ id: 'a11', status: 'complete', completedAt: 2000, cwd: 'C:/projects/foo' }),
    ];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus(agents, projects, {}, {});

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  // ─── Interaction Test 1: markProjectViewed clears project dot, NOT session dots ─

  it('project watermark clears statusByProject but leaves statusByClaudeSessionId for that session', () => {
    const agents = [makeAgent({ id: 'ix1', status: 'complete', completedAt: 2000 })];
    const projects = ['C:/projects/foo'];

    // Simulate markProjectViewed: stamp the normalized project path in lastProjectViewedAt
    const lastProjectViewedAt = { 'c:/projects/foo': 9999 };
    const lastSessionViewedAt = {}; // session watermark untouched

    const result = deriveCompletionStatus(
      agents,
      projects,
      lastProjectViewedAt,
      lastSessionViewedAt,
    );

    // Project dot is cleared
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
    // Per-terminal/session dot persists
    expect(result.statusByClaudeSessionId['ix1']).toBe('complete');
  });

  // ─── Interaction Test 2: markSessionViewed clears session, NOT project dot ──

  it('session watermark clears statusByClaudeSessionId but leaves statusByProject', () => {
    const agents = [makeAgent({ id: 'ix2', status: 'complete', completedAt: 2000 })];
    const projects = ['C:/projects/foo'];

    // Simulate markSessionViewed: stamp the session id in lastSessionViewedAt
    const lastProjectViewedAt = {}; // project watermark untouched
    const lastSessionViewedAt = { ix2: 9999 };

    const result = deriveCompletionStatus(
      agents,
      projects,
      lastProjectViewedAt,
      lastSessionViewedAt,
    );

    // Session dot is cleared
    expect(result.statusByClaudeSessionId['ix2']).toBeUndefined();
    // Project dot persists
    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  // ─── Interaction Test 3: re-light after both watermarks → reappears in both ─

  it('completedAt newer than both project and session watermarks → reappears in both maps', () => {
    const agents = [makeAgent({ id: 'ix3', status: 'complete', completedAt: 9000 })];
    const projects = ['C:/projects/foo'];

    // Both watermarks are older than the new completedAt
    const lastProjectViewedAt = { 'c:/projects/foo': 5000 };
    const lastSessionViewedAt = { ix3: 5000 };

    const result = deriveCompletionStatus(
      agents,
      projects,
      lastProjectViewedAt,
      lastSessionViewedAt,
    );

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
    expect(result.statusByClaudeSessionId['ix3']).toBe('complete');
  });
});

// ─── normalizePath unit tests ─────────────────────────────────────────────────

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\foo\\bar')).toBe('c:/foo/bar');
  });

  it('strips a trailing slash', () => {
    expect(normalizePath('C:/foo/bar/')).toBe('c:/foo/bar');
  });

  it('lowercases the path', () => {
    expect(normalizePath('C:/FOO/Bar')).toBe('c:/foo/bar');
  });

  it('does not double-strip a path with no trailing slash', () => {
    expect(normalizePath('C:/foo/bar')).toBe('c:/foo/bar');
  });
});
