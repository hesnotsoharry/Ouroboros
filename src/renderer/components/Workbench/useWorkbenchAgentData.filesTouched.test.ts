/**
 * Orchestrator-owned contract test for Wave 4 Phase 2 — `deriveFilesTouched`.
 *
 * Authored by the orchestrator BEFORE the Phase 2 implementation (per
 * `~/.claude/rules/orchestrator-owned-acceptance-tests.md`). The implementer
 * makes this pass and MAY NOT modify this file. It pins the derivation contract
 * the implementer's own mental model could otherwise diverge from:
 *
 *   - dedup key is the ToolCallEvent.input string (the only path signal the
 *     renderer has — it is truncated to ≤80 chars, recon §3; two files with
 *     identical truncated inputs unavoidably merge, which is acceptable).
 *   - status precedence on a deduped path:
 *       any pending Edit/Write            → 'editing'
 *       else any (completed) Edit/Write   → 'edited'
 *       else (Read only)                  → 'read'
 *   - only Edit/Write/Read tool calls participate; Bash/Grep/Glob are excluded.
 *   - adds/dels are 0 in Phase 2 (badges arrive in Phase 3 from the diff fetch).
 *   - rows are ordered by each path's first appearance (ascending timestamp).
 *   - null session → [].
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession, ToolCallEvent } from '../AgentMonitor/types';
import { deriveFilesTouched } from './useWorkbenchAgentData';

// ── fixture helpers ─────────────────────────────────────────────────────────

let seq = 0;
function tc(
  toolName: string,
  input: string,
  status: ToolCallEvent['status'],
  timestamp: number,
): ToolCallEvent {
  return { id: `tc-${seq++}`, toolName, input, timestamp, status };
}

function session(toolCalls: ToolCallEvent[]): AgentSession {
  return {
    id: 's1',
    taskLabel: 'test',
    status: 'running',
    startedAt: 0,
    toolCalls,
    inputTokens: 0,
    outputTokens: 0,
  };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe('deriveFilesTouched (Wave 4 Phase 2 contract)', () => {
  it('returns [] for a null session', () => {
    expect(deriveFilesTouched(null)).toEqual([]);
  });

  it('lists one row per Edit/Write/Read file with adds/dels = 0', () => {
    const result = deriveFilesTouched(
      session([
        tc('Edit', 'src/a.ts', 'success', 10),
        tc('Write', 'src/b.ts', 'success', 20),
        tc('Read', 'src/c.ts', 'success', 30),
      ]),
    );
    expect(result).toEqual([
      { path: 'src/a.ts', adds: 0, dels: 0, status: 'edited' },
      { path: 'src/b.ts', adds: 0, dels: 0, status: 'edited' },
      { path: 'src/c.ts', adds: 0, dels: 0, status: 'read' },
    ]);
  });

  it('excludes non-file tools (Bash, Grep, Glob)', () => {
    const result = deriveFilesTouched(
      session([
        tc('Bash', 'npm test', 'success', 10),
        tc('Grep', 'pattern', 'success', 20),
        tc('Glob', '**/*.ts', 'success', 30),
        tc('Read', 'src/only.ts', 'success', 40),
      ]),
    );
    expect(result).toEqual([{ path: 'src/only.ts', adds: 0, dels: 0, status: 'read' }]);
  });

  it('dedups repeated calls on the same input into one row', () => {
    const result = deriveFilesTouched(
      session([
        tc('Read', 'src/x.ts', 'success', 10),
        tc('Read', 'src/x.ts', 'success', 20),
        tc('Read', 'src/x.ts', 'success', 30),
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ path: 'src/x.ts', adds: 0, dels: 0, status: 'read' });
  });

  it('status precedence: an Edit on a path overrides a prior Read on the same path', () => {
    const result = deriveFilesTouched(
      session([tc('Read', 'src/y.ts', 'success', 10), tc('Edit', 'src/y.ts', 'success', 20)]),
    );
    expect(result).toEqual([{ path: 'src/y.ts', adds: 0, dels: 0, status: 'edited' }]);
  });

  it("status precedence: a pending Edit/Write yields 'editing' (overrides a completed edit)", () => {
    const result = deriveFilesTouched(
      session([tc('Edit', 'src/z.ts', 'success', 10), tc('Edit', 'src/z.ts', 'pending', 20)]),
    );
    expect(result).toEqual([{ path: 'src/z.ts', adds: 0, dels: 0, status: 'editing' }]);
  });

  it('orders rows by each path first-appearance timestamp (ascending)', () => {
    const result = deriveFilesTouched(
      session([
        tc('Read', 'src/late.ts', 'success', 100),
        tc('Edit', 'src/early.ts', 'success', 5),
        tc('Read', 'src/early.ts', 'success', 110), // re-touch must not reorder
      ]),
    );
    expect(result.map((r) => r.path)).toEqual(['src/early.ts', 'src/late.ts']);
  });

  it('dedups two distinct files whose ≤80-char truncated inputs collide, without crashing', () => {
    // Simulates recon §3: ToolCallEvent.input is truncated, so two different
    // deep paths can share an identical input string. Merging them is the
    // least-wrong behavior (they are indistinguishable in the renderer).
    const truncated = 'src/' + 'a/'.repeat(40) + 'deep'; // >80 chars, identical for both
    const result = deriveFilesTouched(
      session([tc('Edit', truncated, 'success', 10), tc('Edit', truncated, 'success', 20)]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('edited');
  });
});
