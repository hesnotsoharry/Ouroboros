/**
 * gitExec.ts — portable `git` subprocess wrapper.
 *
 * Extracted from `ipc-handlers/gitOperations.ts` so it's importable from
 * subsystems that don't run inside Electron (the standalone MCP server,
 * Wave 60). The original location pulled in a chain of IDE-only modules
 * (extensions, contextLayer, agentChat) at import time, which crashed
 * the standalone bundle.
 *
 * Pure: only uses `child_process.execFile` and module-level constants.
 * No Electron, no IDE state, no transitive IDE deps.
 *
 * `gitOperations.ts` re-exports these symbols so existing IDE callers
 * keep their `import ... from '../ipc-handlers/gitOperations'` paths.
 */

import { execFile } from 'child_process';

export const GIT_TIMEOUT_MS = 30_000;
export const MB = 1024 * 1024;

/**
 * Global concurrency cap across ALL git subprocess spawns. EVERY git call in
 * the app (branch, status, statusDetailed, diff, …) routes through `gitExec`,
 * so this single semaphore bounds the whole process table.
 *
 * Why it exists: renderer git hooks (`useGitBranch` has ~9 mount sites alone,
 * plus `useGitStatus`/`useGitStatusDetailed`) each subscribe to `files:change`
 * and refresh per root. With multiple project roots and active Claude sessions
 * churning files, every change fanned out to dozens of concurrent `git` spawns
 * with no cap — saturating the Windows process table, slowing each `git` from
 * ~50ms to 7+ seconds, blowing past the 5s cache TTL (so the cache never hit),
 * and under sustained load taking the whole machine down.
 *
 * Cap = 4 (≈ one per project root + a spare) keeps the UI responsive while
 * bounding the process table. Excess calls queue FIFO. A wedged process always
 * releases its slot via the GIT_TIMEOUT_MS `execFile` timeout (which fires the
 * callback → `finally` → release), so the queue can never deadlock.
 */
const MAX_CONCURRENT_GIT = 4;
let activeGitProcesses = 0;
const gitQueue: Array<() => void> = [];

function acquireGitSlot(): Promise<void> {
  if (activeGitProcesses < MAX_CONCURRENT_GIT) {
    activeGitProcesses += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    gitQueue.push(() => {
      activeGitProcesses += 1;
      resolve();
    });
  });
}

function releaseGitSlot(): void {
  activeGitProcesses -= 1;
  const next = gitQueue.shift();
  if (next) next();
}

export async function gitExec(
  args: string[],
  opts: { cwd: string; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  await acquireGitSlot();
  try {
    return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(
        'git',
        args,
        { ...opts, timeout: GIT_TIMEOUT_MS, maxBuffer: opts.maxBuffer ?? MB },
        (err, stdout, stderr) => (err ? reject(err) : resolve({ stdout, stderr })),
      );
    });
  } finally {
    releaseGitSlot();
  }
}

export async function gitStdout(
  root: string,
  args: string[],
  maxBuffer: number = MB,
): Promise<string> {
  return (await gitExec(args, { cwd: root, maxBuffer })).stdout;
}
