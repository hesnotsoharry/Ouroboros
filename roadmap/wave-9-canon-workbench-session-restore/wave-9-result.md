---
status: SHIPPED
created: 2026-05-23
updated: 2026-05-23
---

# Wave 9 — Canon Workbench Session-Restore — Result Brief

Renderer-only, behind the default-off `layout.canonWorkbench` flag. Closes the final cutover-blocking
parity gap so Wave 10 (cutover & teardown) can delete the legacy shell with zero feature gap. **Planned
as 2 implementation phases + wrap; shipped exactly that.** Mid-wave Tier 3 discovery (Phase 0
diagnosis) re-targeted the wave from SQLite Store B → electron-store Store A; ADR D3 superseded by
D4 + D5. See "Process notes" for the targeting correction.

## What shipped

### Phase 1 — `canonWorkbenchSessions` config key + restore/persist hooks (commit `5149bde2`)
New electron-store config key `canonWorkbenchSessions` shaped `{ upper: { cwd, claudeSessionId? } | null, lower: { cwd } | null }` (two-frame fixed model). Plus two new renderer hooks:

- **`useWorkbenchRestore`** (`Workbench/Terminals/useWorkbenchRestore.ts`) — one-shot reader on mount. Maps the persisted shape → `{ upperCwd, lowerCwd, resumeSessionId, isReady }`. Short-circuits to `{ isReady: true }` immediately when `persistTerminalSessions` is off (no `config.get` call). One-shot guard via `hasReadRef` prevents double-reads under StrictMode remount.
- **`useWorkbenchSessionPersist`** (`Workbench/Terminals/useWorkbenchSessionPersist.ts`) — debounced 750ms writer + 30s safety interval (mirrors legacy `persistCurrentSessions` cadence). On `claudeSessionId` change, queries `pty.getCwd` for both frames and writes the canon payload. Short-circuits when `persistTerminalSessions` is off (no `getCwd`, no `set`).

Schema landed in `configSchemaMiddle.ts` (142 → 174 lines, well under 300-line cap). `AppConfig` mirror in `electron-foundation.d.ts` via inline `import('@main/configTypes')`. `CanonWorkbenchSessions` interface in `configTypes.ts` next to the legacy `TerminalSessionSnapshot`.

- **Gate:** 11/11 unit tests green (`useWorkbenchRestore.test.ts` + `useWorkbenchSessionPersist.test.ts`); `tsc --noEmit` clean; `eslint src/renderer/components/Workbench src/main/configTypes.ts src/main/configSchema*.ts src/renderer/types/electron-foundation.d.ts` 0 errors; `npm run test:layout` 132/132 files, 1109/1109 tests. Pure renderer derivation + one config schema addition — no phase-reviewer dispatch (not boundary). No production wiring yet — that landed in Phase 2.

### Phase 2 — terminals restore + auto-resume integration (commit `96cbf658`)
Modified ONLY `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts`. Five additions per the wave plan:

- (a) Consumes `useWorkbenchRestore()` — destructures `{ upperCwd, lowerCwd, resumeSessionId, isReady }`.
- (b) Gates the spawn effect on `isReady` — added to deps; early-returns when `!isReady`. The cleanup-no-op-on-early-return decision avoids registering stale kill timers for unspawned sessions.
- (c) Upper frame conditional: `pty.spawnClaude(upperId, { cwd: upperCwd ?? projectRoot, resumeMode: resumeSessionId })` when `resumeSessionId` non-null; otherwise plain `pty.spawn(upperId, { cwd: upperCwd ?? projectRoot })`.
- (d) Lower frame always plain `pty.spawn(lowerId, { cwd: lowerCwd ?? projectRoot })`.
- (e) Mounts `useWorkbenchSessionPersist({ upperSessionId, lowerSessionId, claudeSessionId })` so canon sessions persist going forward.

**Implementer's `hasSpawnedRef` decision (correct):** the implementer added a `hasSpawnedRef` boolean to distinguish "stale cleanup from `isReady: false` run" from "real StrictMode remount." Without it, the cleanup from the `isReady: false` phase would populate `pendingKillsRef` with stale timers, and the `isReady: true` effect run would incorrectly enter the cancel-kills branch instead of spawning. The reviewer traced all four StrictMode + `isReady`-flip sequences and confirmed correctness.

- **Gate:** orchestrator-owned acceptance test `useWorkbenchTerminals.restore.acceptance.test.ts` **7/7** (RED→green, frozen, subagent could not modify; authored RED pre-dispatch — 5 fail / 2 pass coincidentally because they assert project-root fallback which current code happened to match). Pre-existing `CenterPane.acceptance.test.tsx` **6/6** (StrictMode cancel-kill regression check). Phase 1 hook tests still **11/11**. `tsc --noEmit` clean; `eslint src/renderer/components/Workbench` 0 errors; `test:layout` 132/132. `sonnet-phase-reviewer` **PASS** all four axes (file-change scope, spec alignment, integrity, runtime correctness).

## What did NOT ship — out-of-scope items

Per the wave plan (preserved here for Wave 10's reference):
- `RestoreSessionsGate.tsx` deletion — Wave 10 cutover. Legacy gate continues to render unchanged on the flag-off branch.
- SQLite Store B (`pty_sessions` table) extension — not needed per D4 (Store A already carries the data).
- Migrating users from `terminalSessions` → `canonWorkbenchSessions` — cold-start under canon is accepted (D5; flag is experimental + default-off, no production canon state to migrate).
- Lower-frame auto-resume — only upper resumes; lower is always plain shell.
- A "restore was applied" toast — D1 (transparent restore is the explicit decision).
- `claudeSessionId` binding-precision fix — separate main-process scope, follow-up `2026-05-22-workbench-claudeSessionId-binding-precision.md` carries unchanged.

## Process notes

**Tier 3 discovery — Phase 0 targeting correction (the value-add of the wave).** Before authoring the Phase 1 acceptance test, the orchestrator read the SQLite-backed `src/main/ptyPersistence.ts` and found the `pty_sessions` table schema has NO `is_claude` / `claude_session_id` columns. This contradicted the wave plan's foundational assumption ("the fields ARE persisted, only the IPC read strips them"). Dispatched `sonnet-diagnostician` to verify; verdict (a) — there are **two parallel persistence stores** with the architect's narrative-vs-target mismatched:

| Store | Backing | Carries `claudeSessionId`? | Used by |
|---|---|---|---|
| **A** | electron-store, `terminalSessions` key (`configTypes.ts:88-97`) | YES — `TerminalSessionSnapshot` end-to-end | Legacy auto-resume (already working) |
| **B** | SQLite, `pty-sessions.db` | NO | `RestoreSessionsGate` raw PTY-process restore |

The architect's text correctly said "electron-store" but the IMPLEMENTATION TARGET (`PersistedSessionInfo` + `pty:listPersistedSessions`) is Store B. Re-targeted the wave to read from Store A; collapsed Phase 1 (IPC extension) and consolidated to 2 implementation phases. ADR D3 superseded by D4 + D5 (in-flight decisions, fully written up with options/rationale/consequences). Surfaced to Cole as a Tier 3 ("which path is best?"); Cole delegated ("whichever is best"); selected Option A2 (new `canonWorkbenchSessions` key, fully renderer-only).

**Why a NEW config key (D5) and not reuse `terminalSessions`.** Canon's `useWorkbenchTerminals` spawns via plain `pty.spawn` and does NOT participate in the legacy `TerminalSession[]` state — so the existing `persistCurrentSessions` writer (which iterates that state) never writes canon's sessions. Reusing `terminalSessions` would require either threading canon's sessions through legacy state (architectural backstep, conflicts with workbench-owned-sessions ADR) or mutual-exclusion gating on the flag (risky on flag toggle — canon writes overwrite legacy snapshots). A new key keeps stores cleanly independent. Wave 10 should add a follow-up to retire BOTH keys at teardown.

**Acceptance test went RED with the expected shape.** 5 of 7 failures hit the Phase 2 contract directly (`spawnClaude` not called when `resumeSessionId` set; restored cwds not used). 2 passed coincidentally — both "fall back to project root" cases that current code already satisfies because the current code uses project root unconditionally. After Phase 2 wiring, all 7 went green. The coincidental-pass cases still validate the post-implementation behavior; they just weren't load-bearing on the RED→green transition.

**Two orchestrator-owned-test rule applications.** Phase 2's `useWorkbenchTerminals.restore.acceptance.test.ts` was authored RED by the orchestrator pre-dispatch, frozen, and the implementer was briefed with the "may not modify" constraint. Implementation went 7/7 green on first attempt with no test edits requested.

**Pre-push tsc:web caught a Wave-96-shaped renderer→main type-coupling repeat (commit `1b6404fc`).** Phase 1's `useWorkbenchSessionPersist.ts` imported `CanonWorkbenchSessions` from `@main/configTypes`, which `tsconfig.web.json` does NOT include. Per-phase scoped tsc + per-phase test gates use the unified tsconfig and missed it; the pre-push project-wide `tsc -p tsconfig.web.json` caught it. Fix mirrors the Wave 96 / Wave 97 pattern: declared `CanonWorkbenchSessions` directly in `electron-foundation.d.ts` as the renderer-side authoritative type (kept in sync with the main-side definition by convention; not auto-derived); consumer imports from `../../../types/electron`. Same lesson as Wave 96/97: every time the renderer touches a new type defined in `src/main/`, this friction will surface at push time. Worth a future systemic fix (full shared-types extraction for this type, OR pre-commit `tsc:web` run if the time cost is acceptable).

## Gates (wave-end)

- Orchestrator-owned acceptance test (Phase 2): **7/7** green (authored RED pre-dispatch, frozen).
- Pre-existing `CenterPane.acceptance.test.tsx`: **6/6** (StrictMode regression check).
- Phase 1 hook tests: **11/11** (`useWorkbenchRestore` 5; `useWorkbenchSessionPersist` 6).
- Phase 2 `sonnet-phase-reviewer`: **PASS** all four axes.
- Full workbench/layout suite: `test:layout` **132/132**.
- Full project test suite: **1127 files, 11760 passed / 8 skipped / 0 failed** (Wave 8 baseline 11742 → +18 new Wave 9 tests across +3 new files).
- `tsc --noEmit`: **clean**.
- `eslint src/`: **0 errors** (4 pre-existing warnings, none new — `chatOrchestrationSingletons.ts:43` unused eslint-disable + `patterns.test.ts:57` unsafe regex + `FileViewerChrome.tsx:275` exhaustive-deps).
- Prettier: clean on all wave-touched files (the orchestrator-owned acceptance test was caught at wrap missing prettier and reformatted in the wrap commit — same friction pattern as WB-6 and WB-8).
- `/review` mechanical (inline): forward-trace OK (all new exports consumed); plan universals OK (all acceptance criteria met); dead-export audit OK (`WorkbenchRestoreState` has 2 consumers — hook + acceptance test, not over-exported); schema-removal migration safety N/A (Wave 9 only adds, doesn't remove); boundary-phase acceptance test held (Phase 2 frozen, RED→green); mutation testing deferred per Wave 8's batched-pre-merge posture.

## Follow-ups (this wave)

No new follow-ups generated by Wave 9 itself. Two **pre-existing** items remain active and unchanged by this wave:

- **`2026-05-22-workbench-claudeSessionId-binding-precision.md` (OPEN, HIGH)** — `useWorkbenchClaudeCapture` binds to any binding-class agent event; an IDE-in-itself session can hijack the bound id. Wave 9 inherits the same exposure (the persisted `claudeSessionId` is only as precise as the capture mechanism that fed it). Fix is main-process scope (forward `CLAUDE_SESSION_ID` from pty spawn), out of Wave 9's renderer-only scope per D4.
- **`2026-05-22-canon-workbench-session-restore.md` (DEFERRED, status → RESOLVED at wrap)** — the architect's integration plan that motivated Wave 9. Resolves with this wave; archived with a resolution pointer at wrap.

The deferred doc's Steps 1-2 (IPC extension to `PersistedSessionInfo` + handler passthrough) are noted as **N/A — superseded by ADR D4**; Steps 3-7 (renderer hook + integration) are preserved in shape, retargeted at electron-store Store A.

**Wave-9 NOT solving (acknowledged):**
- IDE-runs-in-itself isolation. Parent and child Electron instances share the same `userData` path → same `canonWorkbenchSessions` store. Pre-existing exposure (legacy `terminalSessions` has the same issue); the canon path inherits it, doesn't worsen it. Filed as a known consideration for a future userData-separation wave if it becomes painful.
- Shutdown race on `claudeSessionId` capture. If capture happens <750ms before shutdown, that capture is lost (same as legacy). Documented; not solved.

## Wave 10 prerequisites — green light

With Wave 9 SHIPPED, Wave 10 (cutover & teardown) has zero parity gaps remaining for the canon shell. Deletion scope per the Wave 8 follow-up audit:
- Legacy shells: `AppLayout`/`InnerAppLayout`, `ChatOnlyShell/`, `Dispatch/`.
- Legacy-only utilities: legacy `SymbolSearch`, `FilePickerConnected`, "Explain error" scrollback action.
- Orphaned: `AgentMonitor/ApprovalDialog`.
- Now-canon-replaced: `RestoreSessionsGate.tsx` (this wave's bypass made it canon-replaced).
- Optional retirement candidate: `terminalSessions` electron-store key + `useTerminalSessions.sync.ts`'s `persistCurrentSessions` writer (entirely legacy-bound once the legacy shell is gone). The `canonWorkbenchSessions` key stays.

The Wave 10 wave plan should consume the deletion scope from `wave-8-followup-audit.md` plus this section.
