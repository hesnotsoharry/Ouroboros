/**
 * configSlices.ts — CLI-integration settings interfaces shared between
 * main and renderer.
 *
 * Owns the canonical definitions for ClaudeCliSettings and CodexCliSettings.
 * src/main/configTypes.ts re-exports these for main-side import-path stability;
 * src/renderer/types/electron-foundation.d.ts imports these directly (W97).
 *
 * Adding a new CLI-integration settings family? Add it here.
 * Adding a field to one of these interfaces? Add it here — both sides pick it up.
 */

export interface ClaudeCliSettings {
  /** Permission mode: 'default' | 'acceptEdits' | 'plan' | 'auto' | 'bypassPermissions' */
  permissionMode: string;
  /** Model override: '' means CLI default. e.g. 'sonnet', 'opus', 'haiku', or full model ID */
  model: string;
  /** Effort level: 'low' | 'medium' | 'high' | 'max' */
  effort: string;
  /** Extra system prompt appended to default */
  appendSystemPrompt: string;
  /** Verbose output */
  verbose: boolean;
  /** Max budget in USD (0 = unlimited) */
  maxBudgetUsd: number;
  /** Allowed tools (comma-separated, empty = all) */
  allowedTools: string;
  /** Disallowed tools (comma-separated, empty = none) */
  disallowedTools: string;
  /** Additional directories to allow tool access */
  addDirs: string[];
  /** Enable Claude in Chrome integration */
  chrome: boolean;
  /** Use git worktree for sessions */
  worktree: boolean;
  /** Dangerously skip all permission checks */
  dangerouslySkipPermissions: boolean;
  /** Use long-lived warm process for multi-turn cache reuse (default: true) */
  useWarmProcess: boolean;
  /** Wave 94 Phase E — enable diff-review capture on terminal write-class tool calls (default: true) */
  enableTerminalDiffReview: boolean;
}

export interface CodexCliSettings {
  /** Model override: '' means CLI default. e.g. 'gpt-5.4' */
  model: string;
  /** Reasoning effort override: 'low' | 'medium' | 'high' | 'xhigh' */
  reasoningEffort: string;
  /** Sandbox mode for command execution */
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access';
  /** Approval policy for command execution */
  approvalPolicy: 'untrusted' | 'on-request' | 'never';
  /** Optional config profile from ~/.codex/config.toml */
  profile: string;
  /** Additional directories Codex can write to */
  addDirs: string[];
  /** Enable live web search */
  search: boolean;
  /** Allow running outside a git repository */
  skipGitRepoCheck: boolean;
  /** Dangerously bypass approvals and sandbox entirely */
  dangerouslyBypassApprovalsAndSandbox: boolean;
}
