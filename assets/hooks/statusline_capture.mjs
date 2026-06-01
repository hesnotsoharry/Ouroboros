// statusline_capture.mjs — Ouroboros IDE statusline script.
// Captures Claude Code rate_limits to ~/.ouroboros/claude-usage.json and
// prints a compact status line with model + context + rate-limit info.
// Receives Claude Code session JSON on stdin. Fires every status refresh tick.

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { loadTokens, parseAddress, sendEvent, shouldSkipForNoIde } from './lib/ouroboros.mjs';

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) { resolve(''); return; }
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

const stdinData = await readStdin();
if (!stdinData.trim()) process.exit(0);

let data;
try { data = JSON.parse(stdinData); } catch { process.exit(0); }

if (data.rate_limits) {
  try {
    const dir = join(homedir(), '.ouroboros');
    mkdirSync(dir, { recursive: true });
    const json = JSON.stringify({ rate_limits: data.rate_limits, captured_at: Date.now() });
    writeFileSync(join(dir, 'claude-usage.json'), json);
  } catch { /* best-effort */ }
}

const paneId = process.env.OUROBOROS_PANE_ID;
const ctx = data.context_window;
// cwd: the statusline subprocess inherits the Claude session's working directory,
// so process.cwd() is the stable cross-process identifier we use for session matching.
const cwdValue = process.cwd();
// data.session_id may be present in some Claude Code versions — include as bonus.
const sessionIdFromData = (typeof data.session_id === 'string' && data.session_id)
  ? data.session_id
  : null;

// [trace:ctx-gauge] Write diagnostic entry to confirm fix (expanded from prior version).
// Remove after end-to-end verified in IDE relaunch.
try {
  import('node:fs').then(({ appendFileSync, mkdirSync }) => {
    import('node:os').then(({ homedir }) => {
      import('node:path').then(({ join }) => {
        const dir = join(homedir(), '.ouroboros');
        mkdirSync(dir, { recursive: true });
        const entry = JSON.stringify({
          ts: new Date().toISOString(),
          paneId: paneId ?? null,
          CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID ?? null,
          sessionIdFromData,
          cwd: cwdValue,
          ctxPresent: Boolean(ctx),
          ctxUsed: ctx?.total_input_tokens ?? null,
          ctxMax: ctx?.context_window_size ?? null,
          dataKeys: Object.keys(data),
          sendEventFired: ctx != null && !shouldSkipForNoIde(),
        }) + '\n';
        appendFileSync(join(dir, 'statusline-trace.log'), entry, 'utf8');
      });
    });
  });
} catch { /* trace must never break the hook */ }

// Guard: fire when ctx data is present and the IDE is reachable.
// No longer requires paneId — cwd is the session identifier instead.
if (ctx && !shouldSkipForNoIde()) {
  const { hooksToken } = loadTokens();
  if (hooksToken) {
    const sessionId = sessionIdFromData ?? process.env.CLAUDE_SESSION_ID ?? 'unknown';
    const resolvedAddr = parseAddress();
    const sent = await sendEvent({
      type: 'context_update',
      paneId: paneId ?? undefined,
      sessionId,
      cwd: cwdValue,
      timestamp: Date.now(),
      contextUsedTokens: ctx.total_input_tokens,
      contextMaxTokens: ctx.context_window_size,
      contextUsedPct: ctx.used_percentage,
      model: data.model?.api_name ?? data.model?.display_name,
      costUsd: undefined,
    }, hooksToken, { timeoutMs: 200 });
    // Append sendEvent result to the trace so we confirm delivery end-to-end.
    try {
      import('node:fs').then(({ appendFileSync }) => {
        import('node:os').then(({ homedir }) => {
          import('node:path').then(({ join }) => {
            appendFileSync(
              join(homedir(), '.ouroboros', 'statusline-trace.log'),
              JSON.stringify({
                ts: new Date().toISOString(),
                sendEventResult: sent,
                cwd: cwdValue,
                resolvedAddr,
              }) + '\n',
              'utf8',
            );
          });
        });
      });
    } catch { /* best-effort */ }
  }
}

const parts = [];
const model = data.model?.display_name;
if (model) parts.push('[' + model + ']');

if (ctx && typeof ctx.used_percentage === 'number') {
  parts.push('ctx:' + Math.round(ctx.used_percentage) + '%');
}

const rl = data.rate_limits;
if (rl?.five_hour) {
  const left = Math.round(100 - rl.five_hour.used_percentage);
  parts.push('5h:' + left + '%');
}
if (rl?.seven_day) {
  const left = Math.round(100 - rl.seven_day.used_percentage);
  parts.push('7d:' + left + '%');
}

process.stdout.write(parts.join(' | '));
