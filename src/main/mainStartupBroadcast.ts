/**
 * mainStartupBroadcast.ts — Shared broadcast helper used by mainStartup.ts
 * (auto-updater events) and mainStartupGraph.ts (graph index progress).
 * Kept in a separate module to avoid circular dependencies between the two.
 */

import { broadcastToWebClients } from './web';
import { getAllActiveWindows } from './windowManager';

export function broadcastToActiveWindows(channel: string, payload: unknown): void {
  for (const win of getAllActiveWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
  broadcastToWebClients(channel, payload);
}
