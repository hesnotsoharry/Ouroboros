/**
 * ptySpawn.ts — Claude Code and Codex PTY session spawners.
 * Extracted from pty.ts to keep each file under the 300-line limit.
 */

import { BrowserWindow } from 'electron';
import * as pty from 'node-pty';

import { type ClaudeCliSettings, type CodexCliSettings } from './config';
import log from './logger';
import {
  cleanupSession,
  escapePowerShellArg,
  notifyTerminalCreated,
  registerSession,
  scheduleStartupCommand,
  sessions,
  type SpawnOptions,
} from './pty';
import { buildClaudeArgs, resolveClaudeCwd } from './ptyClaude';
import { buildCodexArgs, buildCodexLaunchArgs } from './ptyCodex';
import { buildBaseEnv, buildProviderEnv, resolveSpawnOptions } from './ptyEnv';

function buildClaudeLaunchArgs(
  baseArgs: string[],
): { shell: string; args: string[] } {
  // resumeMode param removed (product decision Cole 2026-05-31):
  // interactive PTY Claude sessions always start fresh — no --resume / --continue.
  // Only the agentChat/chat-bridge orchestration path (ptyAgent.ts) may use those flags.
  const claudeArgs = [...baseArgs];

  if (process.platform === 'win32') {
    // Security: single-quote escaping prevents command injection via PowerShell metacharacters
    const escaped = ['claude', ...claudeArgs].map(escapePowerShellArg).join(' ');
    return { shell: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-Command', `& ${escaped}`] };
  }
  return { shell: 'claude', args: claudeArgs };
}

export function spawnClaudePty(
  id: string,
  win: BrowserWindow,
  settings: ClaudeCliSettings,
  options: SpawnOptions & { initialPrompt?: string } = {},
): { success: boolean; error?: string } {
  // [trace:bind] claudeSpawnAttempt — every pty:spawnClaude IPC call.
  // sessionAlreadyExists:true = blocked by dedup guard (no spawn happens).
  // resumeMode never present on this path (always-fresh policy, 2026-05-31).
  log.info('[trace:bind] claudeSpawnAttempt', {
    paneId: options.env?.['OUROBOROS_PANE_ID'] ?? null,
    sessionAlreadyExists: sessions.has(id),
  });

  if (sessions.has(id)) return { success: false, error: `Session ${id} already exists` };

  const { cwd: defaultCwd, cols, rows } = resolveSpawnOptions(options);
  const cwd = resolveClaudeCwd(win.id, defaultCwd);
  const launch = buildClaudeLaunchArgs(buildClaudeArgs(settings));
  // [trace:bind] claudeSpawn — spawn proceeding; argv never contains --resume/--continue.
  log.info('[trace:bind] claudeSpawn', { paneId: options.env?.['OUROBOROS_PANE_ID'] ?? null, cwd, argv: launch.args });
  log.debug(`[pty] spawnClaude id=${id} shell=${launch.shell} args=${JSON.stringify(launch.args)} cwd=${cwd}`);
  try {
    const proc = pty.spawn(launch.shell, launch.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: buildBaseEnv({ ...buildProviderEnv('terminal'), ...options.env }),
    });
    registerSession({ id, proc, cwd, shell: launch.shell, win });
    if (options.initialPrompt) scheduleStartupCommand(id, proc, options.initialPrompt);
    notifyTerminalCreated(id, cwd);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error(`[pty] spawnClaude failed id=${id}: ${msg}`);
    cleanupSession(id);
    return { success: false, error: msg };
  }
}

export function spawnCodexPty(
  id: string,
  win: BrowserWindow,
  settings: CodexCliSettings,
  options: SpawnOptions & { initialPrompt?: string } = {},
): { success: boolean; error?: string } {
  // resumeThreadId removed (product decision Cole 2026-05-31): interactive Codex
  // tabs always start fresh. Only the agentChat orchestration path may resume.
  if (sessions.has(id)) return { success: false, error: `Session ${id} already exists` };

  const { cwd, cols, rows } = resolveSpawnOptions(options);
  const launch = buildCodexLaunchArgs(buildCodexArgs(settings));
  try {
    const proc = pty.spawn(launch.shell, launch.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: buildBaseEnv(options.env),
    });
    registerSession({ id, proc, cwd, shell: launch.shell, win });
    if (options.initialPrompt) scheduleStartupCommand(id, proc, options.initialPrompt);
    notifyTerminalCreated(id, cwd);
    return { success: true };
  } catch (error) {
    cleanupSession(id);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
