// pre_tool_use.mjs
// PreToolUse hook. Sends pre_tool_use event to Ouroboros (fire-and-forget).
// Always exits 0 — the hook no longer waits for an approval decision.
// Approves unconditionally when Ouroboros is unreachable.

import { randomBytes } from 'node:crypto';

import { inferSessionId, loadTokens, readStdin, sendEvent, shouldSkipForNoIde } from './lib/ouroboros.mjs';
import { consumeScratch, detectSensitivePaths } from './lib/signals.mjs';

if (shouldSkipForNoIde()) process.exit(0);

// External (non-IDE-spawned) sessions must never open a socket to the IDE pipes.
// OUROBOROS_IDE_SESSION is set by buildBaseEnv() (src/main/ptyEnv.ts) for every
// IDE-spawned PTY and is absent in an external `claude` process.
// Exit 0 (approve) immediately — before loadTokens(), readStdin(), or any
// socket attempt — so no ouroboros-tools / agent-ide-hooks socket is ever opened.
if (process.env.OUROBOROS_IDE_SESSION !== '1') process.exit(0);

const { hooksToken } = loadTokens();
if (!hooksToken) process.exit(0);

const stdinData = await readStdin();
if (!stdinData.trim()) process.exit(0);

let toolInput;
try { toolInput = JSON.parse(stdinData); } catch { process.exit(0); }

const requestId = randomBytes(8).toString('hex');
const sessionId = inferSessionId(toolInput);
const toolName = toolInput.tool_name || toolInput.toolName || 'unknown';

// tool_use_id is the stable per-call identifier Claude Code includes in both
// PreToolUse and PostToolUse stdin. Use it as toolCallId so the main-process
// correlation pairing (hooksCorrelationPairing.ts) can match pre↔post.
// Fall back to requestId (random) when absent so older Claude Code versions
// still work; pairing will degrade gracefully in that case.
const toolUseId = toolInput.tool_use_id || null;

const payload = {
  type: 'pre_tool_use',
  sessionId,
  toolName,
  input: toolInput,
  requestId,
  cwd: process.cwd(),
  timestamp: Date.now(),
};
if (toolUseId) {
  payload.toolCallId = toolUseId;
} else {
  // Degraded mode: no tool_use_id from Claude Code — pairing will use requestId
  // which won't match post_tool_use (different event). Warn so the log is clear.
  payload.toolCallId = requestId;
  if (process.env.OUROBOROS_DEBUG === '1') {
    process.stderr.write('[ouroboros] pre_tool_use: tool_use_id absent — diff-review pairing degraded\n');
  }
}
const paneId = process.env.OUROBOROS_PANE_ID;
if (paneId) payload.paneId = paneId;
if (process.env.OUROBOROS_INTERNAL === '1') payload.internal = true;

// Path sensitivity flag: defensive marker for downstream redaction policy
if (detectSensitivePaths(toolName, toolInput.tool_input ?? toolInput, null)) {
  payload.touchedSensitivePath = true;
}

// Time-to-first-tool: written by UserPromptSubmit, consumed on first tool call
// of the turn. Uses raw Claude session_id for stable cross-event correlation
// (not the IDE-routing inferred id, which can be 'unknown' for chat sessions).
const correlationId = toolInput.session_id || toolInput.sessionId
  || process.env.CLAUDE_SESSION_ID || 'default';
const promptAtRaw = consumeScratch(correlationId, 'first_prompt_at');
if (promptAtRaw) {
  const promptAt = parseInt(promptAtRaw, 10);
  if (Number.isFinite(promptAt)) {
    const delta = payload.timestamp - promptAt;
    if (delta >= 0 && delta < 600000) payload.timeToFirstToolMs = delta;
  }
}

await sendEvent(payload, hooksToken);

process.exit(0);
