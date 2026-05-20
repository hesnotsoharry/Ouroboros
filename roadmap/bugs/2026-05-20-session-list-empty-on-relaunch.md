---
status: TRIAGED
created: 2026-05-20
severity: high
area: main/session-persistence
---

# Sessions empty in workbench rail after app relaunch (data safe on disk)

## Symptom

Closing and reopening the app (dev: `npm run dev` dev-instance restart) shows
no previously-existing sessions in the workbench rail. The user perceives this
as "all my old sessions disappeared and don't persist."

## Key finding — data is NOT lost

The session data is intact on disk. `C:\Users\coles\AppData\Roaming\Ouroboros\config.json`
`sessionsData` contains the sessions (3 at time of diagnosis), all valid (no
`archivedAt` / `deletedAt`). This is a **load/display bug, not a persistence or
wipe bug.** Write path, electron-store schema validation, `configPreflight`
stripping, and renderer-side filtering were all eliminated.

## Root cause (confirmed to the IPC layer; final trigger needs one relaunch to confirm)

`src/main/ipc-handlers/sessionCrud.ts:66-69`:

```ts
function handleList(): HandlerResult<{ sessions: Session[] }> {
  const store = getSessionStore();
  if (!store) return ok({ sessions: [] });   // ← silent empty on null store
  return ok({ sessions: store.listAll() });
}
```

`getSessionStore()` (`src/main/session/sessionStore.ts:149`) returns the
module-level `singleton`, which is `null` at the moment the renderer issues its
first `sessionCrud:list` call. So the rail receives `[]` and renders nothing,
even though the store's adaptor would read the populated `sessionsData`.

Why is `singleton` null at list-time? Static reading shows startup ordering is
nominally correct (`initSessionStore()` at `main.ts:272` runs before
`createWindow()` registers handlers). The only code that nulls the singleton is
`closeSessionStore()` (via `closeSessionServices()` ← `performWillQuitShutdown()`,
`mainShutdown.ts:64`), guarded against double-run by `shutdownComplete`. So the
remaining candidates are:
- **(a) A startup race** — the renderer's first `sessionCrud:list` fires before
  `initSessionStore()` completes.
- **(b) A swallowed init error** — `runStartupStep` (`main.ts:83-93`) catches and
  silently swallows non-critical step errors; if `initSessionStore()` threw, the
  singleton stays null and nothing surfaces.

## Confirming instrumentation (one relaunch settles it)

Add temporarily:
- `src/main/session/sessionStore.ts` `initSessionStore()`: `log.info('[trace:sessionStore] init running')` before `singleton = buildStore(...)`.
- `src/main/session/sessionStore.ts` `getSessionStore()`: `log.info('[trace:sessionStore] get; null?', singleton === null)`.
- `src/main/ipc-handlers/sessionCrud.ts` `handleList()`: `log.warn('[trace:sessionCrud] list before store init')` in the null branch.

Relaunch and read the order. If `get; null? true` appears before/without
`init running` completing → race (a). If `init running` errors → swallowed
error (b).

## Recommended fix (after confirmation)

Two layers:
1. **Defensive:** `handleList()` should not silently return `[]` on a null store.
   Either lazily `initSessionStore()` then retry, or return a distinguishable
   error so the renderer can retry rather than render an empty (and persist that
   empty view).
2. **Root:** depending on (a)/(b): make `initSessionStore()` synchronous-before-
   handler-registration guaranteed (race), or stop swallowing its error in
   `runStartupStep` and surface/retry (init failure).

## Attribution

**Pre-existing.** Not caused by Wave 99 (renderer-only completion indicators) or
the concurrent uncommitted Wave 100 (chat-surface removal — only import-renames
in `sessionCrud.ts`, no behavioral change). Eliminated both by diff inspection.

## Coordination note

The fix touches `src/main/**` (`sessionCrud.ts`, `sessionStore.ts`, `main.ts`
startup) — the same area the concurrent Wave 100 session is editing. Coordinate
before patching to avoid collision (Wave 100 already modified `sessionCrud.ts`'s
imports).
