---
name: window-close-leaks-session-entry
status: OPEN
created: 2026-05-25
priority: MED
discovered: wave-13-smoke-prep
---

# Window close doesn't remove its session from `sessionsData`

## Symptom

Once a user has opened N windows simultaneously, every subsequent launch restores N windows — even if they closed N-1 of them in-app. Cole hit this with 3 persisted windows (Agent IDE / Contractor App / Gamify) from past parallel work, all restoring on every launch with no UI to trim.

## Root cause

`src/main/windowManager.ts:183-203` — `setupWindowCloseHandler`:

```ts
win.on('close', () => {
  clearBoundsTimer(winId);
  if (!win.isMaximized()) saveWindowBounds(win, false);
  persistWindowSessions();  // ← only updates bounds for LIVE windows
  killPtySessionsForWindow(winId);
});
```

`persistWindowSessions()` in `src/main/windowManagerSessions.ts:52-62` calls `buildLiveBoundsByRoot()` which only walks CURRENTLY-OPEN windows, then `mergeBoundsIntoSessions(existing, byRoot)` — which updates bounds for existing entries but never removes them.

Net effect: closing a window only updates its last-known bounds. The session entry persists indefinitely.

## Fix

In the `closed` handler (`windowManager.ts:193`), after the window is destroyed, remove its corresponding entry from `sessionsData` by matching on the `windowId` → `session.id` mapping. Need to confirm where that mapping lives — the `ManagedWindow` struct has the session id; use it to filter `sessionsData` and `setConfigValue('sessionsData', filtered)`.

Approximately 5-10 LOC.

## Test

Acceptance:
- Open 2 windows, each in a different project
- Close window B in-app
- Quit the app
- Relaunch
- Only window A restores

## Notes

Discovered during Wave 13 smoke prep when investigating "why do 3 windows open on launch." Not a Wave 12/13 regression — pre-existing since multi-window support shipped.

The user-facing impact compounds with `2026-05-25-canon-workbench-window-controls-no-onclick.md` (close button was broken — could not close extra windows even if you wanted to). With that fix landed (commit f5ea8763) the workaround is now possible: close in-app each session to keep sessionsData from leaking new entries — but the leak still persists existing entries until manually edited out of config.json.
