---
status: SHIPPED
created: 2026-05-23
updated: 2026-05-23
---

# Wave 9 — Canon Workbench Session-Restore (split-out)

## Context

Wave 8 (canon parity round 2, shipped `v2.29.0`) closed three of four cutover-blocking parity gaps. The fourth — **session-restore-on-launch in the canon two-frame Workbench** — was split out (Wave 8 ADR D4) because `sonnet-architect` validation found it needed a main-process IPC change plus a user-facing behavior change (auto `claude --resume` on relaunch).

**Targeting correction (2026-05-23, in-flight Decision D4).** Investigation during Wave 9 Phase 0 dispatch surfaced that the architect's "extend `PersistedSessionInfo` so the canon shell can read `claudeSessionId` from `pty:listPersistedSessions`" plan pointed at the wrong store. The codebase has **two parallel persistence layers**:

| Store | Backing | Carries `isClaude`/`claudeSessionId`? | Consumed by |
|---|---|---|---|
| **A** | electron-store, `terminalSessions` config key | YES (`TerminalSessionSnapshot` in `configTypes.ts:88-97`) | `useRestoreSessions` → legacy auto-resume (already working) |
| **B** | SQLite, `pty-sessions.db` | NO (`PersistedPtySession` + table schema in `ptyPersistence.ts:28-67`) | `usePersistedTerminalSessions` → `RestoreSessionsGate` (raw PTY-process restore) |

The architect's narrative said "electron-store" (Store A, correct) but the edit target (`PersistedSessionInfo` + `pty:listPersistedSessions`) is Store B (wrong). Reading Store A would skip the entire IPC extension + SQLite-migration concern; Store A already carries every field needed.

Wave 9 retargets to Store A. ADR D3 is superseded by D4 (renderer-only, no IPC extension). See `wave-9-decisions.md` for the full ADR history.

**Additional scope discovery.** Canon's `useWorkbenchTerminals` spawns directly via `pty.spawn` and does NOT participate in the legacy `TerminalSession[]` state, so existing `persistCurrentSessions` (in `useTerminalSessions.sync.ts`) — which iterates that state — never writes canon's sessions to `terminalSessions`. Wave 9 needs to add a **canon-side write path** as well as the read path. To avoid mutating legacy's `terminalSessions` key (which would conflict when the flag toggles), Wave 9 adds a new small electron-store key `canonWorkbenchSessions` scoped to the canon shell's two fixed frames. This is decision D5 in the ADR.

This is still the **last cutover prerequisite**. Once it lands, Wave 10 (cutover & teardown) can delete the legacy shell — `AppLayout`/`InnerAppLayout`, `ChatOnlyShell/`, `Dispatch/`, the legacy `SymbolSearch`/`FilePickerConnected`, the "Explain error" scrollback action, the orphaned `AgentMonitor/ApprovalDialog`, AND `RestoreSessionsGate` itself.

## Goal

After this wave, with `layout.canonWorkbench` enabled and `persistTerminalSessions` on, **relaunching the IDE auto-restores the two canon frames' prior working directories and resumes the prior `claude` session in the upper frame** via `claude --resume <claudeSessionId>`. No restore dialog. No user click. The lower frame returns to its prior cwd as a plain shell. With `persistTerminalSessions` off, the wave is a no-op — both frames spawn at the active project root. With `layout.canonWorkbench` off, the legacy `RestoreSessionsGate` continues to render unchanged from the legacy `terminalSessions` key.

## Locked decisions (Phase 0 — ADR)

See `roadmap/wave-9-canon-workbench-session-restore/wave-9-decisions.md` for the full ADR including supersessions:

1. **D1 — Auto-resume UX = YES.** Upper frame auto-launches `claude --resume <claudeSessionId>` when persisted; transparent restore, no dialog. *(locked 2026-05-23)*
2. **D2 — Drop gate-dialog UX in canon shell.** Canon does NOT mount `RestoreSessionsGate`. *(locked 2026-05-23)*
3. **D3 — SUPERSEDED by D4.** Original "renderer-only EXCEPT one main-process IPC extension" was based on a wrong store-identification.
4. **D4 — Renderer-only, no main-process IPC change.** Wave 9 reads `claudeSessionId` from electron-store Store A, not from SQLite Store B. *(in-flight, locked 2026-05-23 after diagnostic)*
5. **D5 — New electron-store key `canonWorkbenchSessions` for canon-side persistence.** Avoids mutual-exclusion bugs vs legacy `terminalSessions`. *(in-flight, locked 2026-05-23)*

## Scope

**In scope:**
- Add new electron-store config key `canonWorkbenchSessions` (schema + types). Shape: `{ upper: { cwd: string, claudeSessionId?: string } | null, lower: { cwd: string } | null }`.
- New renderer hook `useWorkbenchSessionPersist` (`Workbench/Terminals/useWorkbenchSessionPersist.ts`) — mounted inside `useWorkbenchTerminals` (or sibling), writes `canonWorkbenchSessions` on cwd-change and `claudeSessionId`-capture, debounced to mirror legacy 750ms cadence.
- New renderer hook `useWorkbenchRestore` (`Workbench/Terminals/useWorkbenchRestore.ts`) — reads `canonWorkbenchSessions` once on mount; returns `{ upperCwd, lowerCwd, resumeSessionId, isReady }`. When `persistTerminalSessions` false → short-circuit (`isReady: true`, all cwds undefined).
- Thread restored cwds + resume id into `useWorkbenchTerminals`: add `isReady` gate to the spawn effect; conditional `spawnClaude({cwd, resumeMode: resumeSessionId})` for the upper frame when `resumeSessionId` is non-null; lower always plain `pty.spawn`.
- Behind the existing default-off `layout.canonWorkbench` flag. Flag-off path unchanged.
- `persistTerminalSessions` off → no-op (`isReady` resolves true immediately, no restore data, project-root spawn).

**Out of scope:**
- Deleting `RestoreSessionsGate.tsx` or the legacy restore path. → Wave 10 cutover.
- Extending SQLite Store B (`pty_sessions` table) — no schema migration. The wave targets Store A (electron-store).
- Extending `PersistedSessionInfo` / `pty:listPersistedSessions` — Store B IPC, unused for Wave 9's purpose.
- Multi-session (N > 2) restore in the canon shell. → Dies with the legacy shell at Wave 10.
- Auto-resume UX for the lower frame. → Lower is always plain shell on restore; only the upper resumes.
- A "restore was applied" toast/log surface. → Transparent restore is D1.
- Fixing the residual `claudeSessionId` binding-precision issue (Wave 8 follow-up `2026-05-22-workbench-claudeSessionId-binding-precision.md`). → Separate main-process surface.
- `/ui-smoke 9` live-run. → Per Wave 0–8 posture (Cole not actively using the app); checklist queued at wave-end.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 1 | New `canonWorkbenchSessions` config key + `useWorkbenchRestore` (read) + `useWorkbenchSessionPersist` (write) | `sonnet-implementer` | **Pure renderer derivation + new electron-store key.** Add the key to `src/main/configSchema*.ts` (correct domain split per CLAUDE.md) + `TerminalSessionSnapshot`-style entry in `configTypes.ts` + default `{ upper: null, lower: null }` + `AppConfig` mirror in `electron-foundation.d.ts`. Create `useWorkbenchRestore.ts` — reads via `window.electronAPI.config.get('canonWorkbenchSessions')` once on mount (memoized via `useState` lazy initializer + async effect), maps the persisted shape → `{ upperCwd, lowerCwd, resumeSessionId, isReady }`. Create `useWorkbenchSessionPersist.ts` — debounced 750ms writer; takes `{ upperSessionId, lowerSessionId, claudeSessionId }`, queries `pty.getCwd` for each, calls `config.set('canonWorkbenchSessions', ...)`. Short-circuit both hooks when `persistTerminalSessions` is false (no read, no write). Test shape: **pyramid** (pure derivation + schema-validate). |
| 2 | Thread restored cwds + auto-resume into `useWorkbenchTerminals` | `sonnet-implementer` | **CONCEPTUALLY-RISKY (startup-race sensitivity, StrictMode lifecycle).** Orchestrator authors a FAILING acceptance test pre-dispatch — see Notes below. Modify `Workbench/Terminals/useWorkbenchTerminals.ts`: (a) consume `useWorkbenchRestore()`; (b) gate the empty-dep spawn effect on `isReady` — add `isReady` to deps + early-return when false; (c) upper frame: `spawnClaude(upperSessionId, { cwd: restoredCwds.upper ?? projectRootRef.current, resumeMode: resumeSessionId })` when `resumeSessionId` non-null, else plain `pty.spawn` (current behavior); (d) lower frame: always plain `pty.spawn` with `restoredCwds.lower ?? projectRootRef.current`; (e) mount `useWorkbenchSessionPersist()` (or call into it) so canon sessions get persisted going forward. The `pendingKillsRef.size > 0` StrictMode cancel-kill branch must continue to fire correctly on the second mount when `isReady` is true. `sonnet-phase-reviewer` pass before gate. Test shape: **honeycomb** (startup sequencing + auto-spawn race). |
| 3 | Wave wrap | `orchestrator` | Full suite + `eslint src/` + tsc + prettier; `/review` mechanical gap-check; `/audit-followups wave-9-canon-workbench-session-restore` (should close the deferred restore item); `/promote-vendor-lessons 9` (no-op expected); `/ui-smoke 9` deferred (checklist queued); update `roadmap/HANDOFF.md` + `roadmap/wave-temperature-log.md`; flip wave folder status to SHIPPED; commit + push + tag (no `package.json` bump, per workbench-wave convention). |

**Phase 2 orchestrator-owned acceptance test (author before dispatch, subagent may not modify):**
`src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.restore.acceptance.test.ts` — given `useWorkbenchRestore` returns `{ upperCwd: '/a', lowerCwd: '/b', resumeSessionId: 'sess-X', isReady: true }`, mounting `useWorkbenchTerminals` results in EXACTLY ONE `pty.spawnClaude` call for the upper id with `{ cwd: '/a', resumeMode: 'sess-X' }` AND EXACTLY ONE `pty.spawn` call for the lower id with `{ cwd: '/b' }`. When `isReady: false`, NO spawn fires on the first effect run; when `isReady` flips true, spawns fire exactly once. When `resumeSessionId` is null, the upper uses plain `pty.spawn`, not `spawnClaude`. Orchestrator runs it RED before dispatch.

## Phase ordering

```
Phase 1 (config key + restore/persist hooks) ──► Phase 2 (terminals integration) ──► Phase 3 (wrap)
```

Strictly linear. Phase 2 depends on Phase 1's hooks (consumes `useWorkbenchRestore` return shape, mounts `useWorkbenchSessionPersist`). No parallelization opportunity at 2 implementation phases.

## Risks

| Risk | Mitigation |
|---|---|
| **`canonWorkbenchSessions` schema add must follow the config-schema split convention.** `src/main/config.ts` merges `configSchema.ts` → `configSchemaMiddle.ts` → `configSchemaTail.ts`. Pick the wrong file and the 300-line lint cap triggers. | Phase 1 starts with `wc -l` on each of the three split files; pick the smallest by line count. The new entry is small (~6 lines). The mirror in `AppConfig` (`electron-foundation.d.ts`) and `configTypes.ts` follows the existing `TerminalSessionSnapshot` pattern. |
| **Adding `isReady` to `useWorkbenchTerminals`' empty-dep spawn effect changes its lifecycle** — StrictMode mount→cleanup→mount race against the deferred-kill timer pattern. | Phase 2's acceptance test covers the `isReady: false → true` transition (no spawn on first run, exactly-one spawn on the flip). The existing `pendingKillsRef.size > 0` cancel-kill branch is preserved unchanged — it fires on the second StrictMode mount when `isReady` is already true. Manual smoke in the live IDE confirms no double-spawn. |
| **`spawnClaude` auto-launches `claude`** — must stay STRICTLY conditional on non-null `resumeSessionId`. | Phase 2 acceptance test asserts: `resumeSessionId === null` → plain `pty.spawn` for the upper (current behavior). The conditional sits in `useWorkbenchTerminals` itself, NOT in `useWorkbenchRestore` (which is pure derivation). Code review at phase gate verifies the branch. |
| **`useWorkbenchSessionPersist` write cadence must not thrash electron-store.** Legacy uses 750ms debounce. | Mirror the legacy 750ms debounce + 30s safety interval pattern from `useTerminalSessions.sync.ts:persistCurrentSessions`. Phase 1 unit test covers debounce timing with vitest fake timers. |
| **`useWorkbenchRestore` short-circuit when `persistTerminalSessions` is off** is read via `useConfig()` not threaded as a prop — config-hook-read timing. | The hook reads `useConfig()` (which is the renderer's canonical config-access pattern). If `persistTerminalSessions` is false, the hook returns `{ isReady: true, ...all undefined }` immediately — no `config.get('canonWorkbenchSessions')` call. Unit test covers the flag-off short-circuit. |
| **IDE-runs-in-itself isolation** (Cole's common dev pattern). The parent Electron instance has its own `canonWorkbenchSessions`; the child IDE-in-itself instance should not pick up the parent's persisted sessions. | electron-store is per-app `userData` directory, and both instances share the same `app.getName()` → same store path. This wave does NOT change that. The risk is pre-existing (legacy `terminalSessions` has the same exposure); the canon path inherits it, doesn't worsen it. Flag explicitly as wave-9 NOT solving — a separate follow-up for `userData` separation if it becomes painful. |
| **Auto-resume UX change is silent the first time it happens** — user relaunches and a `claude --resume` fires without warning. | Documented in the result brief as the explicit Cole decision (D1). The legacy gate's "Restore all" button was a one-click confirmation; the canon path is zero-click. If user feedback surfaces a need for a one-time "auto-restore is on" hint, add a toast in a follow-up. Do NOT add it speculatively. |
| **Persist hook coverage gap** — `useWorkbenchSessionPersist` writes captured `claudeSessionId` but capture is itself asynchronous (`useWorkbenchClaudeCapture` listens to agent events). First-launch under canon: no persist exists yet; on shutdown, the latest captured id should be written before exit. | The persist hook subscribes to the same `claudeSessionId` value `useWorkbenchTerminals` already exposes; the debounced writer fires on every change. The legacy `persistCurrentSessions` does NOT block on shutdown either — it relies on the debounce having recently fired. We inherit that constraint. If a session capture happens <750ms before shutdown, that capture is lost on the next launch — same as legacy. Documented; not solved in Wave 9. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 1 | `useWorkbenchRestore` derivation tests (empty / claude-only / claude+plain inputs); `useWorkbenchSessionPersist` debounce + write-trigger tests; flag-off short-circuit tests (both hooks). Schema entry validated via `useConfig` typecheck pass. | Hook tests with mocked `window.electronAPI.config.get`/`set` covering the three real persisted shapes (empty / claude-only / claude+plain) + the flag-off path. | **Pyramid** — pure derivation; unit tests carry the load. |
| 2 | None beyond the acceptance test; the integration IS the unit | Orchestrator-owned `useWorkbenchTerminals.restore.acceptance.test.ts` (RED before dispatch) — exercises the full mount + spawn sequence with a mocked `useWorkbenchRestore` | **Honeycomb** — startup sequencing + race conditions. |
| 3 | n/a — wrap phase | n/a — wrap phase | Full suite + `/review` mechanical gap-check. |

## Acceptance criteria

- [ ] `canonWorkbenchSessions` exists in `AppConfig` (`electron-foundation.d.ts`) and in one of `configSchema*.ts` with the documented shape and default `{ upper: null, lower: null }`.
- [ ] `src/renderer/components/Workbench/Terminals/useWorkbenchRestore.ts` exists and exports a hook returning `{ upperCwd, lowerCwd, resumeSessionId, isReady }`.
- [ ] `src/renderer/components/Workbench/Terminals/useWorkbenchSessionPersist.ts` exists and writes `canonWorkbenchSessions` debounced 750ms on cwd / claudeSessionId changes.
- [ ] `useWorkbenchRestore` does NOT call `restore()` or `restoreAll()` from `usePersistedTerminalSessions` (Store B / SQLite) — Store A only.
- [ ] `useWorkbenchTerminals` consumes `useWorkbenchRestore` and gates its spawn effect on `isReady`.
- [ ] When `resumeSessionId` is non-null on first mount: `pty.spawnClaude(upperId, { cwd, resumeMode: resumeSessionId })` is called for the upper frame.
- [ ] When `resumeSessionId` is null: `pty.spawn(upperId, { cwd })` is called for the upper frame (no auto-launch of claude).
- [ ] When `persistTerminalSessions` is false: no `config.get('canonWorkbenchSessions')` call fires, no `config.set('canonWorkbenchSessions', ...)` call fires; both frames spawn at project root.
- [ ] `useWorkbenchTerminals.restore.acceptance.test.ts` exists and passes (was RED pre-implementation).
- [ ] `RestoreSessionsGate.tsx` is NOT imported by anything under `src/renderer/components/Workbench/`.
- [ ] Legacy flag-off path (`layout.canonWorkbench === false`): `RestoreSessionsGate` continues to render via its existing mount point in `InnerAppLayout`, unchanged. The legacy `terminalSessions` key is untouched by canon writes (separate key).
- [ ] Full suite green; `eslint src/` 0 errors; tsc clean; prettier clean.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 1 | A test-harness rendering of `useWorkbenchRestore` against a mocked `config.get('canonWorkbenchSessions')` returning a seed shape | `config.get('canonWorkbenchSessions')` → hook reads → maps → returns `{ upperCwd, lowerCwd, resumeSessionId, isReady }` | Internal — no end-user observation point. Per Site 2 rule: `Internal — no observation point.` (The hook's output only becomes visible through Phase 2's spawn behavior.) The Phase 1 unit tests carry the verification load. |
| 2 | The canon workbench's upper terminal pane on relaunch, after a prior claude session was running there | App start → `useWorkbenchRestore` reads `canonWorkbenchSessions` from electron-store → returns `{ upperCwd, lowerCwd, resumeSessionId, isReady: true }` → `useWorkbenchTerminals` consumes (with `isReady: true` and restoredCwds populated) → spawn effect fires once → `pty.spawnClaude(upperId, { cwd: restoredCwd, resumeMode: 'sess-X' })` → upper xterm shows `claude --resume <id>` startup → claude resumes its conversation history visible in the terminal | The upper terminal frame shows the prior `claude` session resumed — Cole's previous conversation is visible in the scrollback, claude's prompt is ready, NO restore dialog appeared, the lower terminal shows the prior working directory as a plain shell prompt. |
| 3 | n/a — wave wrap | n/a | `Internal — no observation point.` Wrap phase runs gates + ship; user-facing behavior was already verified at Phase 2. |

### Data-shape probes

```ts
// Phase 2 — the spawn contract (orchestrator runs at wrap):
//   npx vitest run src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.restore.acceptance.test.ts
// Asserts: isReady:false → 0 spawn calls; isReady:true+resumeSessionId set →
//   1 spawnClaude(upper, {cwd, resumeMode}) + 1 spawn(lower, {cwd});
//   resumeSessionId:null → 1 spawn(upper, {cwd}) + 1 spawn(lower, {cwd}), 0 spawnClaude.
```

Phase 1 is pure derivation — primary signal is its unit tests; no additional programmatic probe beyond those.

## Files the next agent should read first

1. `roadmap/wave-9-canon-workbench-session-restore/wave-9-decisions.md` — locked ADR (D1, D2; D3 superseded by D4; D5).
2. `roadmap/wave-8-workbench-canon-parity-2/wave-8-decisions.md` ADR D4 — the original split-out decision; carries the architect's pre-validation summary (NOTE: architect's "Option C" pointed at the wrong store; corrected by D4 in this wave).
3. `src/main/configTypes.ts:88-97` — `TerminalSessionSnapshot` shape used by legacy (the model for canon's smaller analogue).
4. `src/main/configSchema.ts` / `configSchemaMiddle.ts` / `configSchemaTail.ts` — pick the smallest by line count for the new `canonWorkbenchSessions` entry.
5. `src/renderer/types/electron-foundation.d.ts` — `AppConfig` interface mirror; add `canonWorkbenchSessions` here.
6. `src/renderer/hooks/useTerminalSessions.restore.ts:59-63` — the proven `readSavedSessionSnapshots()` pattern (model for `useWorkbenchRestore`'s reader).
7. `src/renderer/hooks/useTerminalSessions.sync.ts:persistCurrentSessions` — the proven debounced writer pattern (model for `useWorkbenchSessionPersist`).
8. `src/renderer/hooks/useConfig.ts` — canonical config-access pattern for renderer.
9. `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` — Phase 2 primary edit site.
10. `src/renderer/types/electron-runtime-apis.d.ts:75-87` — `spawnClaude` API with `resumeMode` (Phase 2 conditional call site).
11. `src/renderer/components/Terminal/RestoreSessionsGate.tsx` — the 44-line presentational gate the canon shell intentionally does NOT mount; understand what's being bypassed.

## Note to the implementer

The spirit of this wave is **close the last cutover prerequisite with the smallest correct change**. The original wave plan targeted the wrong persistence store (SQLite Store B instead of electron-store Store A); D4 + D5 in the ADR correct that. You are NOT extending SQLite, NOT touching `pty:listPersistedSessions`, NOT touching `PersistedSessionInfo`. You ARE adding one new electron-store key (`canonWorkbenchSessions`) and two small renderer hooks.

Resist three temptations: (1) **don't port `RestoreSessionsGate` into the canon shell** — D2 (transparent auto-restore). (2) **don't generalize `useWorkbenchRestore`** for hypothetical future N-session needs — the canon shell is two fixed frames forever; the hook is wave-9-specific glue. (3) **don't fix the `claudeSessionId` binding-precision issue** while you're in `useWorkbenchTerminals` — that's a separate follow-up targeting the pty-spawn `CLAUDE_SESSION_ID` forwarding, not the restore path.

The phase-2 acceptance test is the load-bearing contract — the upper frame uses `spawnClaude` with `resumeMode` ONLY when `resumeSessionId` is non-null; otherwise plain `pty.spawn`. This is the line between "session-restore wave" (good) and "auto-launch claude even when nothing to resume" (regression). The acceptance test will catch it if you blur the branch.

`useWorkbenchSessionPersist` is the **new** write path. Mirror the legacy `persistCurrentSessions` debounce pattern (750ms + 30s safety interval) for consistency. Persistence shape is `{ upper: { cwd, claudeSessionId? } | null, lower: { cwd } | null }` — never undefined arrays, never N-sessions, never the legacy `SavedSessionSnapshot[]` shape.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means dispatch the next phase **in the same turn** — the gate is a verification checkpoint, not a stop-and-check-in. End the turn between phases only for a Tier 3 discovery needing Cole's call, a genuine user-judgment decision, or wave-end.

1. **Verify ADR** exists at `roadmap/wave-9-canon-workbench-session-restore/wave-9-decisions.md` with D1, D2 locked, D3 superseded, D4/D5 locked. Wave status `IN-PROGRESS` in both this plan's frontmatter and the ADR's.
2. **Phase 1 — config key + restore/persist hooks.** Dispatch `sonnet-implementer` with the brief from the Phases table + Files-to-read list. Gate: unit tests green + tsc clean + `eslint src/renderer/components/Workbench src/main src/renderer/types` 0 errors + touched-tests green. (No phase-reviewer dispatch — pure renderer derivation + one config-schema addition, not a cross-boundary IPC.)
3. **Phase 2 — Terminals integration.** Author `useWorkbenchTerminals.restore.acceptance.test.ts` (orchestrator-owned, frozen), run it RED. Dispatch `sonnet-implementer` with the brief + the existing `useWorkbenchTerminals` annotated as the primary edit site + the explicit constraint. Gate: acceptance test green + existing `useWorkbenchTerminals` tests still green (StrictMode cancel-kill regression check) + tsc clean + `eslint src/` 0 errors + touched-tests green + `sonnet-phase-reviewer` PASS on the diff (conceptually-risky phase).
4. **Phase 3 — Wave wrap.**
   - Full suite (`npx vitest run`) green.
   - Full `eslint src/` 0 errors; `tsc --noEmit` clean; prettier clean on all wave-touched files.
   - `/review` mechanical gap-check. Verdict gates: PASS or FLAG-with-flags-addressed.
   - `/audit-followups wave-9-canon-workbench-session-restore` — should close the deferred restore item (`roadmap/deferred/2026-05-22-canon-workbench-session-restore.md`); archive that file with a resolution note pointing to this wave.
   - `/promote-vendor-lessons 9` — no-op expected (no vendor SDK touched); confirm.
   - `/ui-smoke 9` — DEFERRED per Wave 0–8 posture (Cole not actively using the app). Queue the smoke checklist at `wave-9-smoke-report.md` with the explicit relaunch-with-prior-claude scenario; flag the IDE-in-itself isolation as a smoke item to verify when run live.
   - Update `roadmap/HANDOFF.md` to reflect Wave 9 SHIPPED + Wave 10 (cutover) as next action.
   - Append entry to `roadmap/wave-temperature-log.md`.
   - Flip this plan's frontmatter to `status: SHIPPED`; flip the deferred doc's frontmatter to `status: RESOLVED` with a resolution-pointer line.
   - Commit + push to `origin/master` (bulletin sanctions pushes; CI minutes still exhausted until 2026-06-01 — workflows skip cleanly).
   - Tag `v2.30.0` on origin (no `package.json` bump per workbench-wave convention).
