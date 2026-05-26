---
status: COMPLETED
created: 2026-05-25
updated: 2026-05-25
wave: 18
phase: 1A
lane: B
stage: B1
---

# Wave 18 Phase 1A — Diagnostic: 3-Window Spawn on `npm run dev`

## TL;DR

The 3-window spawn is working as designed — session restoration is intentional — but the design has no safety valve. On every startup, `restoreWindowSessions` opens one `BrowserWindow` for every `Session` record in the `sessionsData` electron-store key that has both a `projectRoot` and a `bounds` snapshot. There is no cap, no dev-mode override, no `archivedAt`/`deletedAt` exclusion, and no user-facing opt-out. Cole had 3 such sessions persisted from a prior run (each window that was open at clean shutdown gets its bounds written), and the restore path opens all of them synchronously during startup. The `[perf] startup` line firing 3 times, 6 "already marked" duplicates, and 6 unique xterm session IDs initialized in pairs are all symptoms of 3 independent renderers initializing concurrently — one per restored window. This is not a race condition or a bug in the restore code itself; it is the restore code doing exactly what it was designed to do, with no mechanism to limit it.

---

## Reproduction path

### 1. Entry point

`package.json:14`: `"dev": "electron-vite dev"` — compiles and launches `src/main/main.ts` as the Electron main process.

### 2. App lifecycle

`src/main/main.ts:283`:
```ts
setupThreadProtocol();
app.whenReady().then(initializeApplication);
```

`initializeApplication` is the single async path from app-ready to first visible window.

### 3. `initializeApplication` calls `initWindowsAndServices`

`src/main/main.ts:265-280` — after migrations, telemetry, and services, the last substantive call is:
```ts
await initWindowsAndServices(defaultRoot);
```

### 4. `initWindowsAndServices` — the window creation site

`src/main/main.ts:240-263`:
```ts
async function initWindowsAndServices(defaultRoot: string | undefined): Promise<void> {
  initializePerfMetrics({ getActiveWindows: getAllActiveWindows });
  const restored = restoreWindowSessions();        // opens N windows
  mainWindow = restored[0] ?? createWindow();      // fallback only if 0 restored
  buildApplicationMenu(mainWindow);
  await startBackgroundServices(mainWindow);
  // ...
}
```

`restoreWindowSessions()` returns an array of newly-created `BrowserWindow` instances. `createWindow()` is only called if the array is empty. With 3 sessions in the store, `restored` has 3 entries; `createWindow()` never fires.

### 5. `restoreWindowSessions` — the restore gate

`src/main/windowManagerSessions.ts:74-79`:
```ts
export function restoreWindowSessions(): BrowserWindow[] {
  const sessionsData = (getConfigValue('sessionsData') as Session[] | undefined) ?? [];
  const source = Array.isArray(sessionsData) ? sessionsDataToWindowSessions(sessionsData) : [];
  if (source.length === 0) return [];
  return source.map(restoreOneSession).filter((w): w is BrowserWindow => w !== null);
}
```

No cap. No environment check. No dev-mode guard. Returns one `BrowserWindow` per qualifying session.

### 6. `sessionsDataToWindowSessions` — the sole filter predicate

`src/main/windowManagerHelpers.ts:304-308`:
```ts
export function sessionsDataToWindowSessions(sessionsData: Session[]): WindowSession[] {
  return sessionsData
    .filter((s) => s.projectRoot && s.bounds)
    .map((s) => ({ projectRoots: [s.projectRoot], bounds: s.bounds }));
}
```

The entire gate is: `projectRoot` truthy AND `bounds` truthy. No check for `archivedAt`, `deletedAt`, or any other lifecycle field. Every session that ever had a window open and was not purged from the store will be restored.

### 7. How sessions accumulate bounds

`persistWindowSessions` at `src/main/windowManagerSessions.ts:52-62` is called on three triggers:

1. `win.on('close', ...)` — `src/main/windowManager.ts:188` — on every window close.
2. `setWindowProjectRoots` mutation — `src/main/windowManager.ts:330` — eager persist on every project root change (Wave 64 addition).
3. Any direct call to `persistWindowSessions()`.

`buildLiveBoundsByRoot` (invoked inside `persistWindowSessions`) snapshots bounds for every live, non-destroyed window at call time. So any session that was open during a clean shutdown, or whose project roots were mutated while other windows were also open, gets `bounds` written. 3 windows open at shutdown → 3 sessions with bounds → 3 windows on next launch.

### 8. Other hypotheses checked

- **`app.on('activate')` handler** (`main.ts:165-167`): guarded by `BrowserWindow.getAllWindows().length === 0`. With 3 restored windows live, this never fires. Not a contributor.
- **IPC-triggered `createWindow`**: Only call sites in `src/main` are `menu.ts` (menu actions, user-initiated) and `focusOrCreateWindow` (focus-or-create, also user-initiated). No startup IPC path creates windows.
- **`createChatWindow`**: triggered only by `sessionCrud:openChatWindow` IPC from the renderer (`src/main/ipc-handlers/sessionCrud.ts:179`). User-initiated only.

---

## Per-hypothesis verdict

### H1: `sessionsData` restoration opens 3 windows because Cole's prior session had 3 open

**CONFIRMED.**

Evidence: `sessionsDataToWindowSessions` at `windowManagerHelpers.ts:304-308` maps every `Session` with `projectRoot && bounds` to a `WindowSession`. `restoreWindowSessions` at `windowManagerSessions.ts:74-79` opens one `BrowserWindow` per entry with no cap. Cole's `sessionsData` config store contains 3 such records from a prior multi-window session.

Call chain: `main.ts:243` → `restoreWindowSessions()` → `windowManagerSessions.ts:75-78` → `sessionsDataToWindowSessions` → `windowManagerHelpers.ts:304-308`.

### H2: No dev-mode override

**CONFIRMED** (absence of override is confirmed).

Neither `restoreWindowSessions`, `sessionsDataToWindowSessions`, nor `initWindowsAndServices` reads `process.env.NODE_ENV` or any dev-specific flag. A grep across all `src/main/*.ts` for `NODE_ENV` returns only: logger level (`logger.ts:29-30`), navigation guard (`main.ts:327`), protocol handler (`protocolHandler.ts:21`), DevTools open (`windowManagerHelpers.ts:220`), and CSP connect-src expansion (`windowManagerHelpers.ts:246`). None of these affect window count. There is no `--single-window` CLI flag, no env var, no config key that controls max restored windows.

### H3: Startup race causing duplicate `createWindow` calls

**REFUTED.**

`createWindow` is called in two places at startup:

1. `main.ts:243` — the `restored[0] ?? createWindow()` fallback, which only fires if `restoreWindowSessions()` returns `[]`.
2. `main.ts:166` — the `app.on('activate')` handler, guarded by `BrowserWindow.getAllWindows().length === 0`.

`restoreWindowSessions` is synchronous (electron-store reads are synchronous). IPC handlers are registered per-window inside `registerManagedWindow` at `windowManager.ts:155`, which runs synchronously inside `_createWindow`. No startup IPC fires that could create an additional window before the restore completes.

### H4: Vite HMR dev-server reload spawning extra windows

**REFUTED.**

HMR restarts the main process only when a watched source file changes. At initial cold launch, no files change, so `initializeApplication` runs exactly once. The `watchIgnored` list in `electron.vite.config.ts:36-49` excludes most volatile paths. Even if HMR fires after startup, it kills and respawns the Electron process — the new process runs `restoreWindowSessions` once. HMR does not layer on top of existing windows.

### H5 (new): `archivedAt`/`deletedAt` sessions not excluded from restoration

**CONFIRMED as a latent correctness bug, distinct from the immediate cause.**

`sessionsDataToWindowSessions` at `windowManagerHelpers.ts:305` has no check for `archivedAt` (string, set by archive action) or `deletedAt` (epoch ms, Wave 21 30-day grace period), both defined on the `Session` type at `src/main/session/session.ts:37-38`. An archived or soft-deleted session that still has `bounds` will be restored as a window. This is not the cause of Cole's current 3-window problem (his sessions are almost certainly active, not archived), but it is a correctness gap that would surface as "ghost windows" for users who archive sessions.

---

## Dominant cause

**File:** `src/main/windowManagerHelpers.ts`
**Lines:** 304-308
**Function:** `sessionsDataToWindowSessions`

The filter predicate `s.projectRoot && s.bounds` is the sole gate for window restoration. It has no cap, no dev-mode bypass, and no lifecycle-state exclusion. Combined with `restoreWindowSessions` at `windowManagerSessions.ts:74-79` being called unconditionally from `initWindowsAndServices` at `main.ts:243`, the result is: however many sessions have bounds in the store, that many windows open at startup.

---

## Proposed fixes (shape only — do not implement here)

### Option A: `OUROBOROS_SINGLE_WINDOW=1` env var (recommended for dev ergonomics)

In `restoreWindowSessions` at `windowManagerSessions.ts:74-79`, after building `source`, clamp: `if (process.env.OUROBOROS_SINGLE_WINDOW) source.splice(1)`. In `package.json:14`, prefix the dev command: `"dev": "OUROBOROS_SINGLE_WINDOW=1 electron-vite dev"`.

**Tradeoff:** opt-in; production unaffected; Cole gets single-window dev by default without touching the store. Downside: env var is invisible in the UI. If Cole wants multi-window in dev he unsets it or overrides at the CLI. Cross-platform note: the `VAR=value cmd` syntax works on macOS/Linux; on Windows, electron-vite may need `cross-env` to set it (`cross-env OUROBOROS_SINGLE_WINDOW=1 electron-vite dev`). Check lockfile for existing `cross-env` presence before adding a dep.

### Option B: `maxRestoredWindows` config key with Settings UI

Add a config key `maxRestoredWindows` (default: `0` = unlimited, or a concrete number like `5`). In `sessionsDataToWindowSessions` at `windowManagerHelpers.ts:305`, apply `.slice(0, max)` when the key is set. Expose in Settings > General.

**Tradeoff:** user-visible, persistent, works in both dev and prod. Requires a config schema change, a Settings UI addition, and a migration (existing stores have no key, default to unlimited). More work than Option A; does not solve the "dev = 1" default ask without also setting a dev-specific default.

### Option C: Exclude `archivedAt`/`deletedAt` sessions from restoration (fixes latent H5)

In `sessionsDataToWindowSessions` at `windowManagerHelpers.ts:305`, change the filter to:
`(s) => s.projectRoot && s.bounds && !s.archivedAt && !s.deletedAt`

This is a correctness fix independent of the cap issue. Should be done regardless of which window-count option is chosen. Low risk — both fields are optional on `Session`; the check is safe against records that predate those fields.

### Option D: "Restore from last clean shutdown" flag

On `window-all-closed`, record which sessions were open. On restore, only open those. Solves the "old session with stale bounds" case but adds state complexity. Not recommended — Options A+C address the practical problems more cleanly.

**Recommended combination:** Option A (env var, immediate dev relief) + Option C (archivedAt/deletedAt exclusion, correctness fix). Option B (config cap) is additive and deferred.

---

## Phase 2+ hand-off

An implementer for Phase 2 needs:

### Files to edit

| File | Change | Option |
|---|---|---|
| `src/main/windowManagerSessions.ts` | Add `OUROBOROS_SINGLE_WINDOW` clamp in `restoreWindowSessions` | A |
| `package.json` | Prefix `dev` script with `cross-env OUROBOROS_SINGLE_WINDOW=1` | A |
| `src/main/windowManagerHelpers.ts` | Add `&& !s.archivedAt && !s.deletedAt` to `sessionsDataToWindowSessions` filter | C |
| `src/main/windowManagerSessions.test.ts` | Add test for single-window clamp; add test for archived/deleted exclusion | A+C |
| `src/main/windowManager.test.ts` | Update `sessionsDataToWindowSessions` describe block for new filter | C |

### Scoped test run

`npm run test:main` covers `windowManagerSessions`, `windowManagerHelpers`, and `windowManager`. Run after each change.

### Verification

After Option A: `npm run dev` must open exactly 1 window regardless of how many sessions are in `sessionsData`.

After Option C: an archived session (`archivedAt` set) or deleted session (`deletedAt` set) with a `bounds` field must not produce a restored window on next launch.

### Cross-env dependency check

Before adding `cross-env OUROBOROS_SINGLE_WINDOW=1` to `package.json:14`, verify `cross-env` is already in `devDependencies` (check `package.json`). If not, `npm install --save-dev cross-env` or use an alternative like an `.env.development` that electron-vite picks up.
