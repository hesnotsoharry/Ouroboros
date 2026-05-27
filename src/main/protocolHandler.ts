/**
 * protocolHandler.ts — thread:// deep-link registration and dispatch.
 *
 * Phase A (Wave 100): The thread:// deep-link handling has been removed.
 * There is no chat thread to deep-link to after the chat surface is retired
 * (see wave-100-decisions.md Decision 9). The exports remain as no-ops so
 * that main.ts callers continue to compile without change; the callers will
 * be removed in a later phase.
 */

import log from './logger';

export function registerThreadProtocol(): void {
  log.debug('[protocolHandler] thread:// deep-link disabled (chat surface removed)');
}

export function setupThreadProtocol(): void {
  registerThreadProtocol();
}

export function extractPermalinkFromArgv(_argv: readonly string[]): null {
  return null;
}

export function dispatchPermalink(_url: string): void {
  // no-op: thread:// deep-link removed
}

export function dispatchPermalinkFromArgv(_argv: readonly string[]): void {
  // no-op: thread:// deep-link removed
}

export function scheduleInitialPermalinkFromArgv(): void {
  // no-op: thread:// deep-link removed
}
