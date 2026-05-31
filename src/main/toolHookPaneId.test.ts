/**
 * toolHookPaneId.test.ts — regression guard for the 2026-05-31 AgentSidebar
 * silent-after-turn-1 bug.
 *
 * BUG: assets/hooks/pre_tool_use.mjs and post_tool_use.mjs never read
 * OUROBOROS_PANE_ID, so tool events arrived at the main process with
 * paneId: null. Once agent_end (SubagentStop) wrongly evicted the parent
 * session from ownedSessionIds, isOwnedSession() returned false for all
 * subsequent tool events → AgentSidebar went silent after turn 1.
 *
 * FIX: both hooks now read OUROBOROS_PANE_ID and stamp payload.paneId,
 * mirroring agent_end.mjs and session_start.mjs.
 *
 * This test runs the REAL hook scripts as child processes and captures the
 * payload, asserting paneId is present. It fails (red) if the stamp is
 * ever removed again.
 *
 * Transport note: same pipe-probe/TCP-fallback pattern as
 * sessionStartHookPaneId.test.ts — skips when the IDE named pipe is live
 * to avoid flaking on developer machines where the IDE is running.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PRE_TOOL_SCRIPT = fileURLToPath(
  new URL('../../assets/hooks/pre_tool_use.mjs', import.meta.url),
);
const POST_TOOL_SCRIPT = fileURLToPath(
  new URL('../../assets/hooks/post_tool_use.mjs', import.meta.url),
);
const PANE = 'wb-upper-cc-tool-pane-regression';
const PIPE_PATH = '\\\\.\\pipe\\agent-ide-hooks';

const pipeUp = await probePipe();

function probePipe(): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ path: PIPE_PATH });
    const done = (v: boolean) => {
      try {
        sock.destroy();
      } catch {
        /* noop */
      }
      resolve(v);
    };
    sock.setTimeout(300);
    sock.on('connect', () => done(true));
    sock.on('error', () => done(false));
    sock.on('timeout', () => done(false));
  });
}

function buildChildEnv(
  home: string,
  port: number,
  extra: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = {
    USERPROFILE: home,
    HOME: home,
    APPDATA: home,
    OUROBOROS_HOOKS_ADDRESS: `127.0.0.1:${port}`,
    OUROBOROS_HOOKS_TOKEN: 'test-token',
    OUROBOROS_PANE_ID: PANE,
    OUROBOROS_IDE_SESSION: '1',
    ...extra,
  };
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.Path) env.Path = process.env.Path;
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  return env;
}

function runHookAndCapture(
  scriptPath: string,
  stdinJson: string,
  extraEnv: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const server = createServer((sock) => {
      let buf = '';
      sock.on('data', (d) => {
        buf += d.toString('utf8');
        const lines = buf.split('\n').filter(Boolean);
        // line 0 = auth handshake, line 1 = the hook payload
        if (lines.length >= 2) {
          server.close();
          try {
            resolve(JSON.parse(lines[1]) as Record<string, unknown>);
          } catch (e) {
            reject(e as Error);
          }
        }
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const home = mkdtempSync(join(tmpdir(), 'ouro-hook-'));
      const child = spawn(process.execPath, [scriptPath], {
        env: buildChildEnv(home, port, extraEnv),
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      child.on('error', reject);
      child.stdin.write(stdinJson);
      child.stdin.end();
    });
  });
}

describe('pre_tool_use.mjs paneId emission (AgentSidebar silent-after-turn-1 regression)', () => {
  it.skipIf(pipeUp)(
    'emits paneId from OUROBOROS_PANE_ID in the pre_tool_use payload',
    async () => {
      const stdinJson = JSON.stringify({
        session_id: 'sess-pre-tool-regression',
        tool_name: 'Read',
        tool_use_id: 'toolu_regression_pre',
        tool_input: { file_path: '/tmp/test.ts' },
      });
      const payload = await runHookAndCapture(PRE_TOOL_SCRIPT, stdinJson);
      expect(payload.type).toBe('pre_tool_use');
      expect(payload.paneId).toBe(PANE);
    },
    15000,
  );
});

describe('post_tool_use.mjs paneId emission (AgentSidebar silent-after-turn-1 regression)', () => {
  it.skipIf(pipeUp)(
    'emits paneId from OUROBOROS_PANE_ID in the post_tool_use payload',
    async () => {
      const stdinJson = JSON.stringify({
        session_id: 'sess-post-tool-regression',
        tool_name: 'Read',
        tool_use_id: 'toolu_regression_post',
        output: 'file contents',
      });
      const payload = await runHookAndCapture(POST_TOOL_SCRIPT, stdinJson);
      expect(payload.type).toBe('post_tool_use');
      expect(payload.paneId).toBe(PANE);
    },
    15000,
  );
});
