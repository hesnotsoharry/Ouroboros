/**
 * configDefaults.ts — Default/fallback values for CLI settings slices.
 *
 * CLAUDE_CLI_SETTINGS_FALLBACK and CODEX_CLI_SETTINGS_FALLBACK were relocated
 * here from agentChat/settingsResolver.ts (Wave 99 Phase A) so that
 * configSchemaTail.ts and other non-chat consumers can import them without
 * depending on the agentChat module.
 *
 * AGENT_CHAT_PROVIDERS, AGENT_CHAT_VERIFICATION_PROFILES,
 * AGENT_CHAT_CONTEXT_BEHAVIORS, AGENT_CHAT_DEFAULT_VIEWS, and
 * AGENT_CHAT_SETTINGS_DEFAULTS were relocated here in Wave 100 Phase A so that
 * configSchemaTail.ts no longer imports from agentChat/settingsResolver.ts.
 *
 * The resolver functions (resolveClaudeCliSettings, resolveCodexCliSettings)
 * and ResolvedAgentChatSettings remain in agentChat/settingsResolver.ts and
 * will be removed with the agentChat module in Phase D.
 */

import type {
  AgentChatContextBehavior,
  AgentChatDefaultView,
  AgentChatSettings,
} from '@shared/types/agentChat';
import type { OrchestrationProvider, VerificationProfileName } from '@shared/types/orchestrationDomain';

import type { ClaudeCliSettings, CodexCliSettings } from './config';

export const CLAUDE_CLI_SETTINGS_FALLBACK: ClaudeCliSettings = {
  permissionMode: 'default',
  model: '',
  effort: 'medium',
  appendSystemPrompt: '',
  verbose: false,
  maxBudgetUsd: 0,
  allowedTools: '',
  disallowedTools: '',
  addDirs: [],
  chrome: false,
  worktree: false,
  dangerouslySkipPermissions: false,
  useWarmProcess: true,
  enableTerminalDiffReview: false,
};

export const CODEX_CLI_SETTINGS_FALLBACK: CodexCliSettings = {
  model: '',
  reasoningEffort: 'medium',
  sandbox: 'workspace-write',
  approvalPolicy: 'on-request',
  profile: '',
  addDirs: [],
  search: false,
  skipGitRepoCheck: false,
  dangerouslyBypassApprovalsAndSandbox: false,
};

// ─── Agent chat schema constants (relocated from agentChat/settingsResolver.ts, Wave 100 Phase A) ─

export const AGENT_CHAT_PROVIDERS = [
  'anthropic-api',
  'claude-code',
  'codex',
] as const satisfies readonly OrchestrationProvider[];

export const AGENT_CHAT_VERIFICATION_PROFILES = [
  'fast',
  'default',
  'full',
] as const satisfies readonly VerificationProfileName[];

export const AGENT_CHAT_CONTEXT_BEHAVIORS = [
  'auto',
  'manual',
] as const satisfies readonly AgentChatContextBehavior[];

export const AGENT_CHAT_DEFAULT_VIEWS = [
  'chat',
  'monitor',
] as const satisfies readonly AgentChatDefaultView[];

export const AGENT_CHAT_SETTINGS_DEFAULTS: AgentChatSettings = {
  defaultProvider: 'claude-code',
  defaultVerificationProfile: 'default',
  contextBehavior: 'auto',
  showAdvancedControls: false,
  openDetailsOnFailure: false,
  defaultView: 'chat',
};
