/**
 * mainStartupHelpers.ts — Bootstrap helpers extracted from mainStartup.ts
 * to keep that file under the 300-line ESLint limit.
 */

import { app, crashReporter } from 'electron';

export function bootstrapCrashReporter(): void {
  crashReporter.start({
    uploadToServer: false,
    compress: true,
  });
}

export function bootstrapApp(): void {
  // Must be called before app.ready fires.
  app.setName('Ouroboros');

  // Suppress GPU errors in dev. Must precede app.ready.
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  if (!app.isPackaged) {
    app.commandLine.appendSwitch('no-sandbox');
  }
}

// scheduleJsonlRetentionPurge + jsonlRetention.ts removed in Wave 101 Phase 6
// (all four JSONL basenames it managed belonged to deleted telemetry tiers;
//  with its only caller gone, the retention helpers were dead code)
