/**
 * utils.ts — Shared utility helpers for the main process.
 * Import from here instead of defining locally in each file.
 */

/**
 * Extract a human-readable error message from an unknown caught value.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
