/** Orchestration provider, verification, session, and IPC result types. */

import type { ContextPacket } from './orchestrationContext';
import type {
  NextSuggestedAction,
  OperationResult,
  OrchestrationProvider,
  OrchestrationStatus,
  ProviderExecutionStatus,
  TaskRequest,
  VerificationProfileName,
  VerificationRunStatus,
  VerificationStepKind,
} from './orchestrationDomain';

export interface OrchestrationState {
  status: OrchestrationStatus;
  activeTaskId?: string;
  activeSessionId?: string;
  activeAttemptId?: string;
  provider?: OrchestrationProvider;
  verificationProfile?: VerificationProfileName;
  contextPacketId?: string;
  message?: string;
  pendingApproval?: boolean;
  updatedAt: number;
}

export interface VerificationIssue {
  filePath?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface VerificationCommandResult {
  stepId: string;
  status: VerificationRunStatus;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
}

export interface VerificationSummary {
  profile: VerificationProfileName;
  status: VerificationRunStatus;
  startedAt: number;
  completedAt?: number;
  commandResults: VerificationCommandResult[];
  issues: VerificationIssue[];
  summary: string;
  requiredApproval: boolean;
}

export interface ProviderSessionReference {
  provider: OrchestrationProvider;
  sessionId?: string;
  requestId?: string;
  externalTaskId?: string;
  linkedTerminalId?: string;
}

export interface ProviderArtifact {
  provider: OrchestrationProvider;
  status: ProviderExecutionStatus;
  submittedAt: number;
  completedAt?: number;
  session: ProviderSessionReference;
  lastMessage?: string;
}

export interface DiffFileSummary {
  filePath: string;
  additions: number;
  deletions: number;
  summary?: string;
  risk?: 'low' | 'medium' | 'high';
}

export interface DiffSummary {
  files: DiffFileSummary[];
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  summary: string;
}

export interface TaskResult {
  taskId: string;
  sessionId: string;
  attemptId?: string;
  status: OrchestrationStatus;
  contextPacketId?: string;
  providerArtifact?: ProviderArtifact;
  verificationSummary?: VerificationSummary;
  diffSummary?: DiffSummary;
  unresolvedIssues: string[];
  nextSuggestedAction?: NextSuggestedAction;
  message?: string;
}

export interface TaskAttemptRecord {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: OrchestrationStatus;
  contextPacketId?: string;
  providerArtifact?: ProviderArtifact;
  verificationSummary?: VerificationSummary;
  diffSummary?: DiffSummary;
  unresolvedIssues: string[];
  nextSuggestedAction?: NextSuggestedAction;
  resultMessage?: string;
}

export interface TaskSessionRecord {
  version: 1;
  id: string;
  taskId: string;
  workspaceRoots: string[];
  createdAt: number;
  updatedAt: number;
  request: TaskRequest;
  status: OrchestrationStatus;
  contextPacket?: ContextPacket;
  providerSession?: ProviderSessionReference;
  lastVerificationSummary?: VerificationSummary;
  latestResult?: TaskResult;
  attempts: TaskAttemptRecord[];
  unresolvedIssues: string[];
  nextSuggestedAction?: NextSuggestedAction;
}

export interface TaskSessionPatch {
  status?: OrchestrationStatus;
  contextPacket?: ContextPacket;
  providerSession?: ProviderSessionReference;
  lastVerificationSummary?: VerificationSummary;
  latestResult?: TaskResult;
  unresolvedIssues?: string[];
  nextSuggestedAction?: NextSuggestedAction;
  appendAttempt?: TaskAttemptRecord;
}

export interface ContextPacketResult extends OperationResult {
  packet?: ContextPacket;
}

export interface TaskMutationResult extends OperationResult {
  taskId?: string;
  session?: TaskSessionRecord;
  state?: OrchestrationState;
  result?: TaskResult;
}

export interface TaskSessionResult extends OperationResult {
  session?: TaskSessionRecord;
}

export interface TaskSessionsResult extends OperationResult {
  sessions?: TaskSessionRecord[];
}

export interface VerificationResult extends OperationResult {
  summary?: VerificationSummary;
  session?: TaskSessionRecord;
  state?: OrchestrationState;
}

// ─── Provider capability and event primitives (moved from typesProvider.ts, Wave 98) ─

export interface ProviderCapabilities {
  provider: OrchestrationProvider;
  supportsStreaming: boolean;
  supportsResume: boolean;
  supportsStructuredEdits: boolean;
  supportsToolUse: boolean;
  supportsContextCaching: boolean;
  maxContextHint: number | null;
  requiresTerminalSession: boolean;
  requiresHookEvents: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Structured content block delta — carries block identity from the provider API
 * through to the renderer so blocks can be placed at exact positions.
 *
 * This replaces the old prefix-encoded string approach (__tool__:, __thinking__:)
 * that lost block indices and forced heuristic reconstruction downstream.
 */
export interface ProviderContentBlockDelta {
  /** Position of the content block in the assistant message (global across turns) */
  blockIndex: number;
  /** Type of content block */
  blockType: 'text' | 'thinking' | 'tool_use';
  /** Text delta for text/thinking blocks */
  textDelta?: string;
  /** Tool activity for tool_use blocks */
  toolActivity?: {
    name: string;
    status: 'running' | 'complete';
    toolUseId?: string;
    filePath?: string;
    inputSummary?: string;
    editSummary?: { oldLines: number; newLines: number };
    /** Tool result content — extracted from stream-json tool_result blocks. */
    output?: string;
    /** Nested subagent tool activity — emitted when processing subagent events. */
    subToolActivity?: {
      name: string;
      status: 'running' | 'complete';
      filePath?: string;
      inputSummary?: string;
      editSummary?: { oldLines: number; newLines: number };
      output?: string;
      subToolId: string;
    };
    /** Nested child-agent transcript delta — emitted for child thread text/thinking. */
    subAgentMessage?: {
      entryId: string;
      subAgentId: string;
      label?: string;
      kind: 'text' | 'thinking';
      textDelta: string;
    };
  };
}

export interface VerificationStep {
  id: string;
  label: string;
  kind: VerificationStepKind;
  command?: string;
  requiresApproval: boolean;
  readOnly: boolean;
}

export interface VerificationProfile {
  name: VerificationProfileName;
  label: string;
  description: string;
  steps: VerificationStep[];
  allowsExpensiveSteps: boolean;
  mayRequireApproval: boolean;
}
