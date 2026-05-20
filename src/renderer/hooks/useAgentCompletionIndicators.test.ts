/**
 * useAgentCompletionIndicators.test.ts
 *
 * Tests for the pure deriveCompletionStatus helper (no React needed).
 * Covers: complete, error, error-outranks-complete, running, unseen logic,
 * re-light, undefined cwd, Windows path normalization, nested projects,
 * the mark-viewed watermark behavior, and the critical split-watermark
 * interaction (project and session marks are independent).
 *
 * Wave 99 follow-up: added sessionProjectMap regression tests — agent with
 * undefined cwd but an entry in sessionProjectMap lights the project dot,
 * and cwd fallback still works when sessionProjectMap has no entry.
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession } from '../components/AgentMonitor/types';
import {
  COMPLETION_DEBOUNCE_MS,
  deriveCompletionStatus,
  normalizePath,
} from './useAgentCompletionIndicators';

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
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
    expect(result.statusByClaudeSessionId['a1']).toBe('complete');
  });

  // ─── Test 2: error agent → 'error' in both maps ──────────────────────────

  it('error agent → statusByProject error + sessionId error', () => {
    const agents = [makeAgent({ id: 'a2', status: 'error', completedAt: 3000 })];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

    expect(result.statusByProject['C:/projects/foo']).toBe('error');
    expect(result.statusByClaudeSessionId['a2']).toBe('error');
  });

  // ─── Subagent exclusion: child sessions never light an indicator ─────────

  it('excludes subagent (parentSessionId) sessions from both maps', () => {
    const agents = [
      makeAgent({ id: 'child', status: 'complete', completedAt: 2000, parentSessionId: 'top' }),
    ];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      sessionProjectMap: { child: 'C:/projects/foo' },
    });

    expect(result.statusByClaudeSessionId['child']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  it('a running subagent does not appear as a Live session', () => {
    const agents = [makeAgent({ id: 'child', status: 'running', parentSessionId: 'top' })];
    const result = deriveCompletionStatus({
      agents,
      projects: ['C:/projects/foo'],
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

    expect(result.statusByClaudeSessionId['child']).toBeUndefined();
  });

  it('a top-level session (no parentSessionId) still lights when a subagent is present', () => {
    const agents = [
      makeAgent({ id: 'top', status: 'complete', completedAt: 2000 }),
      makeAgent({ id: 'child', status: 'complete', completedAt: 2100, parentSessionId: 'top' }),
    ];
    const result = deriveCompletionStatus({
      agents,
      projects: ['C:/projects/foo'],
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

    expect(result.statusByClaudeSessionId['top']).toBe('complete');
    expect(result.statusByClaudeSessionId['child']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  // ─── Test 3: project with unseen complete + error → error wins ───────────

  it('project with both unseen complete and error → error outranks complete', () => {
    const agents = [
      makeAgent({ id: 'a3a', status: 'complete', completedAt: 2000 }),
      makeAgent({ id: 'a3b', status: 'error', completedAt: 3000 }),
    ];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

    expect(result.statusByProject['C:/projects/foo']).toBe('error');
  });

  // ─── Test 4: running agent → 'running' in sessionId map, not in project map

  it('running agent → statusByClaudeSessionId running, absent from statusByProject', () => {
    const agents = [makeAgent({ id: 'a4', status: 'running', completedAt: undefined })];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

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
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: { a5: 2000 },
    });

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
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: { 'c:/projects/foo': 3000 },
      lastSessionViewedAt: { a6: 3000 },
    });

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
    expect(result.statusByClaudeSessionId['a6']).toBe('complete');
  });

  // ─── Test 7: undefined cwd → no project contribution, no throw ───────────

  it('agent with undefined cwd contributes to no project and does not throw', () => {
    const agents = [makeAgent({ id: 'a7', status: 'complete', cwd: undefined })];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

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
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

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
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

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
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

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
    const before = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });
    expect(before.statusByProject['C:/projects/foo']).toBe('complete');
    expect(before.statusByClaudeSessionId['a10']).toBe('complete');

    // After stamping BOTH watermarks: both maps are cleared
    const after = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: { 'c:/projects/foo': 9999 },
      lastSessionViewedAt: { a10: 9999 },
    });
    expect(after.statusByProject['C:/projects/foo']).toBeUndefined();
    expect(after.statusByClaudeSessionId['a10']).toBeUndefined();
  });

  // ─── Bonus: exact cwd === project (not just nested) matches ──────────────

  it('exact cwd === project path (no trailing slash) matches correctly', () => {
    const agents = [
      makeAgent({ id: 'a11', status: 'complete', completedAt: 2000, cwd: 'C:/projects/foo' }),
    ];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
    });

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  // ─── Interaction Test 1: markProjectViewed clears project dot, NOT session dots ─

  it('project watermark clears statusByProject but leaves statusByClaudeSessionId for that session', () => {
    const agents = [makeAgent({ id: 'ix1', status: 'complete', completedAt: 2000 })];
    const projects = ['C:/projects/foo'];

    // Simulate markProjectViewed: stamp the normalized project path in lastProjectViewedAt
    const lastProjectViewedAt = { 'c:/projects/foo': 9999 };
    const lastSessionViewedAt = {}; // session watermark untouched

    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt,
      lastSessionViewedAt,
    });

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

    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt,
      lastSessionViewedAt,
    });

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

    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt,
      lastSessionViewedAt,
    });

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
    expect(result.statusByClaudeSessionId['ix3']).toBe('complete');
  });

  // ─── sessionProjectMap regression tests (Wave 99 follow-up) ─────────────
  // Root cause: terminal-launched sessions never set agent.cwd, so the outer
  // project rail dot never lit. The fix threads a sessionProjectMap (derived
  // from the terminal→SessionRecord→projectRoot join) into the derivation.

  it('agent with undefined cwd but matching sessionProjectMap entry → statusByProject set', () => {
    // This test FAILS on the pre-fix code because applyProjectIndicator returned
    // early on !cwd, ignoring the sessionProjectMap entirely.
    const agents = [
      makeAgent({ id: 'sp1', status: 'complete', cwd: undefined, completedAt: 2000 }),
    ];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      sessionProjectMap: { sp1: 'C:/projects/foo' },
    });

    // Project dot must light via the sessionProjectMap path
    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
    // Session indicator also set (independent path — unaffected by the fix)
    expect(result.statusByClaudeSessionId['sp1']).toBe('complete');
  });

  it('agent with undefined cwd and sessionProjectMap pointing to different project → correct project lights', () => {
    const agents = [makeAgent({ id: 'sp2', status: 'error', cwd: undefined, completedAt: 3000 })];
    const projects = ['C:/projects/foo', 'C:/projects/bar'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      sessionProjectMap: { sp2: 'C:/projects/bar' },
    });

    expect(result.statusByProject['C:/projects/bar']).toBe('error');
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  it('agent with cwd but no sessionProjectMap entry → still matches by cwd fallback', () => {
    // Regression guard: sessionProjectMap support must not break the cwd path.
    const agents = [
      makeAgent({ id: 'sp3', status: 'complete', cwd: 'C:/projects/foo/src', completedAt: 2000 }),
    ];
    const projects = ['C:/projects/foo'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      sessionProjectMap: {}, // no entry for sp3
    });

    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  it('sessionProjectMap entry takes priority over cwd when both are present', () => {
    // If both exist, sessionProjectMap wins (it has stronger binding certainty).
    const agents = [
      makeAgent({
        id: 'sp4',
        status: 'complete',
        cwd: 'C:/projects/foo',
        completedAt: 2000,
      }),
    ];
    const projects = ['C:/projects/foo', 'C:/projects/bar'];
    const result = deriveCompletionStatus({
      agents,
      projects,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      sessionProjectMap: { sp4: 'C:/projects/bar' },
    });

    // sessionProjectMap override wins
    expect(result.statusByProject['C:/projects/bar']).toBe('complete');
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });
});

// ─── Debounce eligibility tests ───────────────────────────────────────────────
// All cases pass explicit `now` so results are deterministic and independent of
// wall-clock time.

describe('deriveCompletionStatus — debounce gate', () => {
  const NOW = 1_000_000;
  const PROJECTS = ['C:/projects/foo'];

  // ── complete agent, age 0 (just completed) → NOT in either map ─────────────

  it('complete agent with completedAt === now (age 0) is not yet eligible → absent from both maps', () => {
    const agents = [makeAgent({ id: 'db1', status: 'complete', completedAt: NOW })];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
      debounceMs: COMPLETION_DEBOUNCE_MS,
    });

    expect(result.statusByClaudeSessionId['db1']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  // ── complete agent, age > 10 s → eligible → IN both maps ───────────────────

  it('complete agent with completedAt = now - 11_000 (age > debounce) → in both maps', () => {
    const agents = [makeAgent({ id: 'db2', status: 'complete', completedAt: NOW - 11_000 })];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
      debounceMs: COMPLETION_DEBOUNCE_MS,
    });

    expect(result.statusByClaudeSessionId['db2']).toBe('complete');
    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  // ── error agent, age 0 → NOT in either map ─────────────────────────────────

  it('error agent with completedAt === now (age 0) is not yet eligible → absent from both maps', () => {
    const agents = [makeAgent({ id: 'db3', status: 'error', completedAt: NOW })];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
    });

    expect(result.statusByClaudeSessionId['db3']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  // ── error agent, age > 10 s → eligible → IN both maps ─────────────────────

  it('error agent with completedAt = now - 11_000 (age > debounce) → in both maps as error', () => {
    const agents = [makeAgent({ id: 'db4', status: 'error', completedAt: NOW - 11_000 })];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
    });

    expect(result.statusByClaudeSessionId['db4']).toBe('error');
    expect(result.statusByProject['C:/projects/foo']).toBe('error');
  });

  // ── running agent → 'running' immediately, debounce does not apply ──────────

  it('running agent → statusByClaudeSessionId running immediately, debounce does not apply', () => {
    const agents = [makeAgent({ id: 'db5', status: 'running', completedAt: undefined })];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
    });

    expect(result.statusByClaudeSessionId['db5']).toBe('running');
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  // ── subagent still excluded regardless of age ───────────────────────────────

  it('subagent (parentSessionId) is excluded from both maps even when older than debounce', () => {
    const agents = [
      makeAgent({
        id: 'db6',
        status: 'complete',
        completedAt: NOW - 60_000, // 60 s ago — way past debounce
        parentSessionId: 'parent',
      }),
    ];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
      sessionProjectMap: { db6: 'C:/projects/foo' },
    });

    expect(result.statusByClaudeSessionId['db6']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  // ── completedAt undefined → not eligible (no debounce clock to measure) ────

  it('complete agent with completedAt undefined → absent from both maps (no clock reference)', () => {
    const agents = [makeAgent({ id: 'db7', status: 'complete', completedAt: undefined })];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
    });

    expect(result.statusByClaudeSessionId['db7']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  // ── age exactly at threshold (debounceMs - 1) → still not eligible ──────────

  it('complete agent with age = debounceMs - 1 → still not eligible (strict less-than gate)', () => {
    const agents = [
      makeAgent({ id: 'db8', status: 'complete', completedAt: NOW - COMPLETION_DEBOUNCE_MS + 1 }),
    ];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
    });

    expect(result.statusByClaudeSessionId['db8']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
  });

  // ── age exactly at threshold (debounceMs) → eligible ───────────────────────

  it('complete agent with age = debounceMs exactly → eligible (boundary case)', () => {
    const agents = [
      makeAgent({ id: 'db9', status: 'complete', completedAt: NOW - COMPLETION_DEBOUNCE_MS }),
    ];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: {},
      lastSessionViewedAt: {},
      now: NOW,
    });

    expect(result.statusByClaudeSessionId['db9']).toBe('complete');
    expect(result.statusByProject['C:/projects/foo']).toBe('complete');
  });

  // ── viewed watermark still respected for eligible agents ───────────────────

  it('eligible (old enough) but viewed agent → absent from both maps (watermark still respected)', () => {
    const COMPLETED_AT = NOW - 11_000;
    const agents = [makeAgent({ id: 'db10', status: 'complete', completedAt: COMPLETED_AT })];
    const result = deriveCompletionStatus({
      agents,
      projects: PROJECTS,
      lastProjectViewedAt: { 'c:/projects/foo': COMPLETED_AT },
      lastSessionViewedAt: { db10: COMPLETED_AT },
      now: NOW,
    });

    expect(result.statusByClaudeSessionId['db10']).toBeUndefined();
    expect(result.statusByProject['C:/projects/foo']).toBeUndefined();
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
