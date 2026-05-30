/**
 * hooksSessionHandlers.ts — Session lifecycle event handlers extracted from hooks.ts.
 *
 * Handles: session_start, session_end, session_stop, CLAUDE.md auto-generation.
 * Functions take `sessionCwdMap` as a parameter so they remain pure with respect
 * to that shared module-scope state owned by hooks.ts.
 */

import { generateClaudeMd } from './claudeMdGenerator';
import { getConfigValue } from './config';
import { dispatchActivationEvent } from './extensions';
import type { HookPayload } from './hooks';
import { evaluateStop } from './hooks/gotchaUpdateNudge';
import log from './logger';

// ─── CLAUDE.md auto-generation ───────────────────────────────────────────────

export function triggerClaudeMdGeneration(
  trigger: 'post-session' | 'post-commit',
  payload: HookPayload,
  sessionCwdMap: Map<string, string>,
): void {
  try {
    const settings = getConfigValue('claudeMdSettings');
    if (!settings?.enabled || settings.triggerMode !== trigger) return;

    const projectRoot = payload.cwd ?? sessionCwdMap.get(payload.sessionId) ?? null;
    sessionCwdMap.delete(payload.sessionId);

    if (!projectRoot) {
      log.info(
        `Skipping auto-generation — cannot determine project root for session ${payload.sessionId}`,
      );
      return;
    }

    log.info(`Auto-generating for ${projectRoot} (session ${payload.sessionId})`);
    generateClaudeMd(projectRoot).catch((err: unknown) => {
      log.error('Auto-generation failed:', err);
    });
  } catch {
    // Config not available yet — ignore
  }
}

// ─── Session lifecycle handlers ───────────────────────────────────────────────

export function handleSessionStart(payload: HookPayload): void {
  dispatchActivationEvent('onSessionStart', { sessionId: payload.sessionId }).catch(() => {});
}

export function handleSessionEnd(payload: HookPayload): void {
  dispatchActivationEvent('onSessionEnd', { sessionId: payload.sessionId }).catch(() => {});
}

export function handleSessionStop(payload: HookPayload, sessionCwdMap: Map<string, string>): void {
  if (!payload.internal) {
    triggerClaudeMdGeneration('post-session', payload, sessionCwdMap);
    try {
      evaluateStop(payload);
    } catch (err) {
      log.warn('[claude-md:nudge] evaluateStop failed:', err);
    }
  }
}
