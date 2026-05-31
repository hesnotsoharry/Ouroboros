// statusline_capture.mjs — Ouroboros IDE statusline script.
// Captures Claude Code rate_limits to ~/.ouroboros/claude-usage.json and
// prints a compact status line with model + context + rate-limit info.
// Receives Claude Code session JSON on stdin. Fires every status refresh tick.

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { loadTokens, sendEvent, shouldSkipForNoIde } from './lib/ouroboros.mjs';

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
if (paneId && ctx && !shouldSkipForNoIde()) {
  const { hooksToken } = loadTokens();
  if (hooksToken) {
    const sessionId = process.env.CLAUDE_SESSION_ID || 'unknown';
    await sendEvent({
      type: 'context_update',
      paneId,
      sessionId,
      timestamp: Date.now(),
      contextUsedTokens: ctx.total_input_tokens,
      contextMaxTokens: ctx.context_window_size,
      contextUsedPct: ctx.used_percentage,
      model: data.model?.api_name ?? data.model?.display_name,
      costUsd: undefined,
    }, hooksToken, { timeoutMs: 200 });
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
