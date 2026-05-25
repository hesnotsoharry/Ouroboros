/**
 * configDefaults.ts — Default/fallback values for CLI settings slices.
 *
 * CLAUDE_CLI_SETTINGS_FALLBACK and CODEX_CLI_SETTINGS_FALLBACK were relocated
 * here from agentChat/settingsResolver.ts (Wave 99 Phase A) so that
 * configSchemaTail.ts and other non-chat consumers can import them without
 * depending on the agentChat module.
 *
 * The resolver functions (resolveClaudeCliSettings, resolveCodexCliSettings)
 * and ResolvedAgentChatSettings remain in agentChat/settingsResolver.ts and
 * will be removed with the agentChat module in Phase D.
 */

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
