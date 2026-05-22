/**
 * Unit tests for `deriveTimeline` (Wave 4 Phase 2).
 *
 * Contract assertions:
 *   - null session → []
 *   - ToolCallEvents map to MockToolEvent (kind:'tool') with correct status mapping
 *   - ConversationTurns of type 'prompt'/'elicitation' map to MockPromptEvent (kind:'prompt')
 *   - Events sorted by source timestamp ascending (oldest first, most negative t first)
 *   - NO event has kind === 'think' (D6 — no wire source)
 *   - status mapping: pending → 'running', error → 'warn', success → 'ok'
 */

import { describe, expect, it } from 'vitest';

import type { AgentSession, ConversationTurn, ToolCallEvent } from '../AgentMonitor/types';
import { deriveTimeline } from './useWorkbenchAgentData';

// ── fixture helpers ───────────────────────────────────────────────────────────

let seq = 0;

function tc(
  toolName: string,
  input: string,
  status: ToolCallEvent['status'],
  timestamp: number,
): ToolCallEvent {
  return { id: `tc-${seq++}`, toolName, input, timestamp, status };
}

function tcDur(base: ToolCallEvent, duration: number): ToolCallEvent {
  return { ...base, duration };
}

function turn(
  type: ConversationTurn['type'],
  content: string,
  timestamp: number,
): ConversationTurn {
  return { type, content, timestamp };
}

function session(toolCalls: ToolCallEvent[], conversationTurns?: ConversationTurn[]): AgentSession {
  return {
    id: 's1',
    taskLabel: 'test',
    status: 'running',
    startedAt: 0,
    toolCalls,
    inputTokens: 0,
    outputTokens: 0,
    conversationTurns,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('deriveTimeline (Wave 4 Phase 2)', () => {
  it('returns [] for a null session', () => {
    expect(deriveTimeline(null)).toEqual([]);
  });

  it('returns [] for a session with no tool calls or turns', () => {
    expect(deriveTimeline(session([], []))).toEqual([]);
  });

  it('maps a pending ToolCallEvent to kind:tool with status:running', () => {
    const result = deriveTimeline(session([tc('Edit', 'src/a.ts', 'pending', 1000)]));
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('tool');
    if (result[0].kind === 'tool') {
      expect(result[0].tool).toBe('Edit');
      expect(result[0].target).toBe('src/a.ts');
      expect(result[0].status).toBe('running');
    }
  });

  it('maps a success ToolCallEvent to kind:tool with status:ok', () => {
    const result = deriveTimeline(session([tc('Read', 'src/b.ts', 'success', 2000)]));
    expect(result[0].kind).toBe('tool');
    if (result[0].kind === 'tool') {
      expect(result[0].status).toBe('ok');
    }
  });

  it('maps an error ToolCallEvent to kind:tool with status:warn', () => {
    const result = deriveTimeline(session([tc('Bash', 'npm test', 'error', 3000)]));
    expect(result[0].kind).toBe('tool');
    if (result[0].kind === 'tool') {
      expect(result[0].status).toBe('warn');
    }
  });

  it('maps a duration to the tool event duration field', () => {
    const result = deriveTimeline(session([tcDur(tc('Edit', 'f.ts', 'success', 1000), 420)]));
    if (result[0].kind === 'tool') {
      expect(result[0].duration).toBe(420);
    }
  });

  it('uses 0 duration when ToolCallEvent.duration is undefined', () => {
    const result = deriveTimeline(session([tc('Read', 'f.ts', 'success', 1000)]));
    if (result[0].kind === 'tool') {
      expect(result[0].duration).toBe(0);
    }
  });

  it("maps a ConversationTurn type:'prompt' to kind:prompt", () => {
    const result = deriveTimeline(session([], [turn('prompt', 'fix the bug', 5000)]));
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('prompt');
    if (result[0].kind === 'prompt') {
      expect(result[0].text).toBe('fix the bug');
      expect(result[0].tokens).toBe(0);
    }
  });

  it("maps a ConversationTurn type:'elicitation' to kind:prompt", () => {
    const result = deriveTimeline(session([], [turn('elicitation', 'confirm?', 6000)]));
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('prompt');
  });

  it("excludes ConversationTurn type:'elicitation_result'", () => {
    const result = deriveTimeline(session([], [turn('elicitation_result', 'yes', 7000)]));
    expect(result).toHaveLength(0);
  });

  it('sorts merged tool+prompt events by timestamp ascending (oldest first)', () => {
    const result = deriveTimeline(
      session(
        [tc('Edit', 'src/late.ts', 'success', 9000), tc('Read', 'src/early.ts', 'success', 1000)],
        [turn('prompt', 'middle prompt', 5000)],
      ),
    );
    expect(result).toHaveLength(3);
    // t values are relative-seconds from now (negative = past), so older timestamps
    // have smaller (more negative) t values → come first in ascending sort
    const ts = result.map((e) => e.t);
    expect(ts[0]).toBeLessThan(ts[1]);
    expect(ts[1]).toBeLessThan(ts[2]);
    // Verify the order by tool/kind identity
    expect(result[0].kind).toBe('tool');
    if (result[0].kind === 'tool') expect(result[0].target).toBe('src/early.ts');
    expect(result[1].kind).toBe('prompt');
    expect(result[2].kind).toBe('tool');
    if (result[2].kind === 'tool') expect(result[2].target).toBe('src/late.ts');
  });

  it('never emits an event with kind === "think"', () => {
    const result = deriveTimeline(
      session(
        [
          tc('Edit', 'src/a.ts', 'success', 1000),
          tc('Read', 'src/b.ts', 'pending', 2000),
          tc('Bash', 'npm test', 'error', 3000),
        ],
        [turn('prompt', 'do the thing', 500), turn('elicitation', 'ok?', 1500)],
      ),
    );
    for (const event of result) {
      expect(event.kind).not.toBe('think');
    }
  });
});
