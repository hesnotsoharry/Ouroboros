/**
 * hooksTapRunner.ts — Runs the registered hook taps on each dispatched payload.
 *
 * Extracted from hooks.ts to keep that file under the 300-line ESLint limit.
 * Every tap is fire-and-forget; failures must not break hook dispatch.
 */

import type { HookPayload } from './hooks';
import { tapDiffReview } from './hooksDiffReview';
import { tapConflictMonitor, tapEditProvenance } from './hooksEditTap';
import { tapGraphUsage } from './hooksGraphUsageTap';
import { tapPreToolResearch } from './hooksPreToolResearchTap';
import { tapSkillExecution } from './hooksSkillExecutionTap';
import { tapSubagentTracker } from './hooksSubagentTap';

export function runHookTaps(payload: HookPayload, sessionCwdMap: Map<string, string>): void {
  tapConflictMonitor(payload, sessionCwdMap);
  tapEditProvenance(payload);
  tapSubagentTracker(payload);
  tapPreToolResearch(payload);
  tapGraphUsage(payload);
  tapSkillExecution(payload);
  tapDiffReview(payload, sessionCwdMap);
}
