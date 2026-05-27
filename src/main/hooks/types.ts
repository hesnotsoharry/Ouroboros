/**
 * hooks/types.ts — Shared types for the hooks tap layer.
 *
 * ActiveStreamContext was relocated here from agentChat/chatOrchestrationBridgeTypes.ts
 * (Wave 99 Phase A) so that hook-layer consumers (hooksSkillExecutionTap.ts) can
 * import it without depending on the agentChat module.
 */

import type {
  AgentChatContentBlock,
  AgentChatOrchestrationLink,
  AgentChatStreamChunk,
} from '@shared/types/agentChat';
import type { SkillExecutionRecord } from '@shared/types/ruleActivity';

/**
 * Tracks active streaming sends so that provider event and session update
 * subscriptions can forward progress into the chat stream channel.
 */
export interface ActiveStreamContext {
  threadId: string;
  assistantMessageId: string;
  taskId: string;
  sessionId: string;
  link: AgentChatOrchestrationLink;
  accumulatedText: string;
  firstChunkEmitted: boolean;
  tokenUsage?: { inputTokens: number; outputTokens: number };
  /** Provider-reported cost in USD (set on completion). */
  costUsd?: number;
  /** Resolved model ID (e.g. 'claude-opus-4-6') for this send. */
  model?: string;
  /** Buffered chunks for replay on reconnect. Capped at 500 most recent. */
  bufferedChunks: AgentChatStreamChunk[];
  /**
   * Monotonic per-turn chunk counter stamped onto each emitted chunk's `seq`
   * field. Ensures renderer dedup keys stay unique even when multiple chunks
   * share the same ms-precision timestamp.
   */
  chunkSequence: number;
  /** Accumulated tool activity for smart title generation */
  toolsUsed: Array<{ name: string; filePath?: string }>;
  /** Accumulated content blocks for message persistence — mirrors streaming blocks */
  accumulatedBlocks: AgentChatContentBlock[];
  /** Whether agent_start has been emitted to Agent Monitor for this session */
  monitorStartEmitted: boolean;
  /** Provider-native session ID (Claude session UUID, Codex thread UUID, etc.) */
  providerSessionId?: string;
  /** User prompt for this thread — used as task label in the Agent Monitor */
  userPrompt?: string;
  /** Timer handle for periodic incremental persistence flush. */
  flushTimer?: ReturnType<typeof setInterval>;
  /** Set to true when a terminal event fires — prevents in-flight flushes from overwriting the final message. */
  streamEnded: boolean;
  /** Estimated history tokens at send time — used for calibration feedback. */
  estimatedHistoryTokens?: number;
  /** Skill execution records accumulated from hook events during this send. */
  skillExecutions?: SkillExecutionRecord[];
  /** Wall-clock send start (Date.now()) — used to log true time-to-first-chunk and total turn duration. */
  sendStartedAt?: number;
  /** Set once the first streaming chunk has been emitted; gates the TTFC log. */
  firstChunkLogged?: boolean;
  /**
   * Router traceId for the context packet built for this turn. Used by the
   * Phase B context outcome observer to link tool-call touches back to the
   * decisions JSONL (join key: traceId on decisions ↔ traceId on outcomes).
   * Absent when the router is disabled or no packet was built.
   */
  outcomeTraceId?: string;
  /**
   * Tracks synthetic agent_start/agent_end emissions for Task tool child sessions.
   * Keys on toolCallId. Enforces idempotence across mid-turn refreshes.
   * Wave 57 Phase C.
   */
  chatSubagentEmissions: Map<string, { started: boolean; ended: boolean }>;
}
