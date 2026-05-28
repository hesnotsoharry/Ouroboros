/**
 * sessionStartHookPaneId.test.ts — regression guard for the Wave 14-smoke bug.
 *
 * BUG (found in Wave 14 manual smoke): assets/hooks/session_start.mjs did not
 * read OUROBOROS_PANE_ID, so in-app Claude sessions reached the renderer with
 * paneId: undefined. The pane-scoped AgentSidebar then never matched the session
 * and stayed permanently empty. The sibling agent_start.mjs already emitted
 * paneId; session_start.mjs was simply missing the two lines.
 *
 * This test runs the REAL session_start.mjs as a child process and captures the
 * payload it sends over the hook transport, asserting paneId is present. It fails
 * if the emission is ever removed again.
 *
 * Transport note: sendEvent() tries the named pipe \\.\pipe\agent-ide-hooks first,
 * then falls back to TCP at OUROBOROS_HOOKS_ADDRESS. In CI (no IDE running) the
 * pipe is absent and the TCP fallback hits our in-test server. When the IDE IS
 * running locally the pipe succeeds and bypasses our server — so we probe the
 * pipe up front and skip rather than flake.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../assets/hooks/session_start.mjs', import.meta.url));
const PANE = 'wb-upper-cc-regression-pane';
const PIPE_PATH = '\\\\.\\pipe\\agent-ide-hooks';

const pipeUp = await probePipe();

describe('session_start.mjs paneId emission (Wave 14 smoke regression)', () => {
  it.skipIf(pipeUp)(
    'emits paneId from OUROBOROS_PANE_ID in the session_start payload',
    async () => {
      const payload = await runHookAndCapture();
      expect(payload.type).toBe('session_start');
      expect(payload.paneId).toBe(PANE);
    },
    15000,
  );
});

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

function buildChildEnv(home: string, port: number): Record<string, string> {
  const env: Record<string, string> = {
    USERPROFILE: home,
    HOME: home,
    APPDATA: home,
    OUROBOROS_HOOKS_ADDRESS: `127.0.0.1:${port}`,
    OUROBOROS_HOOKS_TOKEN: 'test-token',
    OUROBOROS_PANE_ID: PANE,
    OUROBOROS_IDE_SESSION: '1',
  };
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.Path) env.Path = process.env.Path;
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  return env;
}

function runHookAndCapture(): Promise<Record<string, unknown>> {
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
      const child = spawn(process.execPath, [SCRIPT], {
        env: buildChildEnv(home, port),
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      child.on('error', reject);
      child.stdin.write(JSON.stringify({ session_id: 'sess-regression' }));
      child.stdin.end();
    });
  });
}
