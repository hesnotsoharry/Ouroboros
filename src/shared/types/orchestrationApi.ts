/**
 * orchestrationApi.ts — Orchestration API surface, event types, and provider progress.
 *
 * Moved here from src/main/orchestration/typesProvider.ts (Wave 98) — these types
 * cross the main/renderer/preload boundary and belong in shared. The IPC surface
 * contract (`OrchestrationAPI`) and all orchestration event variants live here.
 */

import type {
  OrchestrationProvider,
  ProviderExecutionStatus,
  TaskRequest,
  VerificationProfileName,
} from './orchestrationDomain';
import type {
  ContextPacketResult,
  OrchestrationState,
  ProviderContentBlockDelta,
  ProviderSessionReference,
  TaskMutationResult,
  TaskResult,
  TaskSessionPatch,
  TaskSessionRecord,
  TaskSessionResult,
  TaskSessionsResult,
  TokenUsage,
  VerificationResult,
  VerificationSummary,
} from './orchestrationProvider';

export interface ProviderProgressEvent {
  provider: OrchestrationProvider;
  status: ProviderExecutionStatus;
  /** Status text for non-streaming events; text delta for legacy streaming path. */
  message: string;
  session?: ProviderSessionReference;
  timestamp: number;
  /** Structured content block delta — when present, carries block identity from the API. */
  contentBlock?: ProviderContentBlockDelta;
  /** Cumulative token usage for this request (populated on 'completed' status). */
  tokenUsage?: TokenUsage;
  /** Total cost in USD (populated on 'completed' status). */
  costUsd?: number;
  /** Total duration in milliseconds (populated on 'completed' status). */
  durationMs?: number;
}

export interface OrchestrationEventBase<TType extends string> {
  type: TType;
  taskId: string;
  sessionId?: string;
  timestamp: number;
}

export interface OrchestrationStateChangedEvent extends OrchestrationEventBase<'state_changed'> {
  state: OrchestrationState;
}

export interface OrchestrationProviderProgressEvent extends OrchestrationEventBase<'provider_progress'> {
  progress: ProviderProgressEvent;
}

export interface OrchestrationVerificationUpdatedEvent extends OrchestrationEventBase<'verification_updated'> {
  summary: VerificationSummary;
}

export interface OrchestrationSessionUpdatedEvent extends OrchestrationEventBase<'session_updated'> {
  session: TaskSessionRecord;
}

export interface OrchestrationTaskResultEvent extends OrchestrationEventBase<'task_result'> {
  result: TaskResult;
}

export type OrchestrationEvent =
  | OrchestrationStateChangedEvent
  | OrchestrationProviderProgressEvent
  | OrchestrationVerificationUpdatedEvent
  | OrchestrationSessionUpdatedEvent
  | OrchestrationTaskResultEvent;

export interface OrchestrationAPI {
  createTask: (
    request: TaskRequest,
  ) => Promise<TaskMutationResult>;
  startTask: (taskId: string) => Promise<TaskMutationResult>;
  previewContext: (
    request: TaskRequest,
  ) => Promise<ContextPacketResult>;
  buildContextPacket: (
    request: TaskRequest,
  ) => Promise<ContextPacketResult>;
  loadSession: (
    sessionId: string,
  ) => Promise<TaskSessionResult>;
  loadSessions: (
    workspaceRoot?: string,
  ) => Promise<TaskSessionsResult>;
  loadLatestSession: (
    workspaceRoot?: string,
  ) => Promise<TaskSessionResult>;
  updateSession: (
    sessionId: string,
    patch: TaskSessionPatch,
  ) => Promise<TaskSessionResult>;
  resumeTask: (
    sessionId: string,
  ) => Promise<TaskMutationResult>;
  rerunVerification: (
    sessionId: string,
    profile?: VerificationProfileName,
  ) => Promise<VerificationResult>;
  cancelTask: (taskId: string) => Promise<TaskMutationResult>;
  pauseTask: (taskId: string) => Promise<TaskMutationResult>;
  onStateChange: (
    callback: (state: OrchestrationState) => void,
  ) => () => void;
  onProviderEvent: (callback: (event: ProviderProgressEvent) => void) => () => void;
  onVerificationSummary: (
    callback: (summary: VerificationSummary) => void,
  ) => () => void;
  onSessionUpdate: (
    callback: (session: TaskSessionRecord) => void,
  ) => () => void;
}
