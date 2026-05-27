/**
 * configMigrations.ts — one-shot config migrations applied before first cache read.
 *
 * Each migration is idempotent: it checks for the presence of a legacy key before
 * acting, so re-running on a migrated config is a no-op.
 */

import { ensureStore } from './configStoreLazy';

function omitKey(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

function hasKey(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Wave 43 Phase A — layout.chatPrimary → layout.immersiveChat.
 *
 * If `layout.chatPrimary === true` is present in the stored config, flip to
 * `layout.immersiveChat = true` and remove the legacy key. On fresh installs
 * the key is absent and this is a no-op. On subsequent loads after migration
 * the key is gone, so this is also a no-op.
 */
export function migrateChatPrimary(): void {
  const s = ensureStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = s.get('layout') as any;
  if (!raw || raw.chatPrimary !== true) return;
  s.set('layout', {
    ...omitKey(raw as Record<string, unknown>, 'chatPrimary'),
    immersiveChat: true,
  });
}

/**
 * Wave 100 Phase I — purge chat-surface config keys.
 *
 * Removes config keys that were wired only to the retired in-IDE chat surface.
 * Keys still used by surviving features (dockPersistence, ecosystem.codexAppServerTransport,
 * layout.immersiveChat, layout.chatSidebarMode, theming.fonts.chat) are NOT removed here
 * because ChatOnlyShell (the terminal workbench shell) still references them.
 *
 * Idempotent: each removal is guarded by a key-existence check.
 */
export function migrateChatSurface(): void {
  const s = ensureStore();
  const raw = s.store as unknown as Record<string, unknown>;

  // Top-level keys removed in Phase H/G/F
  const topLevelRemovals = ['agentChatSettings', 'contextLayer', 'routerSettings', 'routerLastRetrainCount'];
  for (const key of topLevelRemovals) {
    if (hasKey(raw, key)) {
      s.delete(key as never);
    }
  }

  // modelSlots.agentChat — sub-key removed in Phase H
  const slots = s.get('modelSlots') as unknown as Record<string, unknown> | undefined;
  if (slots && hasKey(slots, 'agentChat')) {
    s.set('modelSlots', omitKey(slots, 'agentChat') as never);
  }
}
