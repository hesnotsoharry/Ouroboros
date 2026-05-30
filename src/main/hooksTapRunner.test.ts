/**
 * hooksTapRunner.test.ts — Asserts runHookTaps fires every registered tap.
 * Wave 101 Phase 4: tapEditProvenance, tapGraphUsage, tapPreToolResearch removed.
 * Remaining taps: tapConflictMonitor, tapSubagentTracker, tapSkillExecution, tapDiffReview.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock every tap module before importing runHookTaps so spies attach.
vi.mock('./hooksEditTap', () => ({
  tapConflictMonitor: vi.fn(),
}));
vi.mock('./hooksSkillExecutionTap', () => ({ tapSkillExecution: vi.fn() }));
vi.mock('./hooksSubagentTap', () => ({ tapSubagentTracker: vi.fn() }));
vi.mock('./hooksDiffReview', () => ({ tapDiffReview: vi.fn() }));

import type { HookPayload } from './hooks';
import { tapDiffReview } from './hooksDiffReview';
import { tapConflictMonitor } from './hooksEditTap';
import { tapSkillExecution } from './hooksSkillExecutionTap';
import { tapSubagentTracker } from './hooksSubagentTap';
import { runHookTaps } from './hooksTapRunner';

describe('runHookTaps', () => {
  it('fires every registered tap with the payload', () => {
    const payload = {
      type: 'post_tool_use',
      sessionId: 's',
      timestamp: 1,
    } as unknown as HookPayload;
    const cwdMap = new Map<string, string>();

    runHookTaps(payload, cwdMap);

    expect(tapConflictMonitor).toHaveBeenCalledWith(payload, cwdMap);
    expect(tapSubagentTracker).toHaveBeenCalledWith(payload);
    expect(tapSkillExecution).toHaveBeenCalledWith(payload);
    expect(tapDiffReview).toHaveBeenCalledWith(payload, cwdMap);
  });
});
