import { buildCodexCliArgs } from './codex';
import type { CodexCliSettings } from './config';
import { escapePowerShellArg } from './ptyArgEscape';

export function buildCodexArgs(settings: CodexCliSettings): string[] {
  return buildCodexCliArgs(settings);
}

export function buildCodexCommand(settings: CodexCliSettings): string {
  return ['codex', ...buildCodexArgs(settings).map(escapeCliArg)].join(' ');
}

function escapeCliArg(arg: string): string {
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export function buildCodexLaunchArgs(
  baseArgs: string[],
): { shell: string; args: string[] } {
  // resumeThreadId param removed (product decision Cole 2026-05-31):
  // interactive PTY Codex sessions always start fresh.
  const codexArgs = [...baseArgs];

  if (process.platform === 'win32') {
    const escaped = ['codex', ...codexArgs].map(escapePowerShellArg).join(' ');
    return {
      shell: 'powershell.exe',
      args: ['-NoLogo', '-NoExit', '-Command', `& ${escaped}`],
    };
  }

  return { shell: 'codex', args: codexArgs };
}
