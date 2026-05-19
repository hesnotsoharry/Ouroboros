/**
 * typesProvider.ts — Re-exports orchestration API, event types, and provider
 * capability types from shared.
 *
 * All types previously defined here have been moved to
 * src/shared/types/orchestrationProvider.ts and src/shared/types/orchestrationApi.ts
 * (Wave 98). This file re-exports them so existing main-process imports
 * (`from './typesProvider'` or via the `./types` barrel) continue to work
 * without consumer changes.
 */
export type {
  ContextPacketResult,
  DiffFileSummary,
  DiffSummary,
  NextSuggestedAction,
  OperationResult,
  OrchestrationState,
  ProviderArtifact,
  ProviderCapabilities,
  ProviderContentBlockDelta,
  ProviderSessionReference,
  TaskAttemptRecord,
  TaskMutationResult,
  TaskResult,
  TaskSessionPatch,
  TaskSessionRecord,
  TaskSessionResult,
  TaskSessionsResult,
  TokenUsage,
  VerificationCommandResult,
  VerificationIssue,
  VerificationProfile,
  VerificationResult,
  VerificationStep,
  VerificationSummary,
} from '@shared/types/orchestration';
export type {
  OrchestrationAPI,
  OrchestrationEvent,
  OrchestrationEventBase,
  OrchestrationProviderProgressEvent,
  OrchestrationSessionUpdatedEvent,
  OrchestrationStateChangedEvent,
  OrchestrationTaskResultEvent,
  OrchestrationVerificationUpdatedEvent,
  ProviderProgressEvent,
} from '@shared/types/orchestration';
export type { ContextPacket } from '@shared/types/orchestration';
