---
status: SHIPPED
created: 2026-05-23
updated: 2026-05-23
---

# Wave 9 — Architecture Decisions

Three decisions were pre-locked in the session that authored the wave plan (2026-05-23). Each is grounded in the architect-validated FITS plan at `roadmap/deferred/2026-05-22-canon-workbench-session-restore.md` and the Cole sequencing decision that produced this wave.

## Decision 1: Auto-resume UX on relaunch

**Context:** When the canon shell's upper frame had a `claude` session running prior to shutdown, what should happen on relaunch — restore only the cwd and let the user type `claude`, or auto-launch `claude --resume <claudeSessionId>` so the conversation is immediately back? The legacy `RestoreSessionsGate` already auto-restored the pty (with a one-click "Restore all" confirmation), but it spawned plain shells — it never auto-launched claude. This is genuinely new behavior for the canon shell.

**Options considered:**
- *Industry standard:* Restore only the cwd; user re-launches `claude` manually if desired. Most terminal multiplexers (tmux session restore, etc.) work this way — they restore the shell, not the program that was running inside it.
- *Emerging best practice:* Auto-launch the prior agent with `--resume` so the conversation context is preserved end-to-end. Mirrors the IDE-as-product pattern (VS Code restores tabs + content, not just folder paths). Matches the canon shell's product intent (terminal-first, conversation continuity).
- *Experimental:* Show a non-blocking toast — "Resuming claude session… click to skip" — with a 2-second delay before auto-resume. Hybrid of the two, optimizes for surprise reduction.

**Pick:** Auto-launch `claude --resume <claudeSessionId>`. — *emerging*

**Rationale:** The whole point of session-restore in this product is conversation continuity — cwd-only restore would break the mental model that "my prior work is here when I come back." The legacy gate already auto-restored the pty on user consent; making the canon shell *more passive* than its predecessor would be a regression. Cole is the primary user; he's terminal-first; the conversation IS the work. The "experimental" toast hybrid was rejected as ceremony — the user opted into `persistTerminalSessions` deliberately; transparent restore matches that opt-in.

**Consequences:** Phase 3 calls `pty.spawnClaude(upperId, { cwd, resumeMode: resumeSessionId })` strictly conditional on a non-null `resumeSessionId`. First-time-after-restart UX is silent — no banner, no "Restoring…" message; the user sees their prior claude conversation in the upper frame. If user feedback later surfaces a "wait, what happened?" reaction, a one-time hint toast is a cheap follow-up. The lower frame stays plain shell (no auto-resume for it; restore only its cwd) — it's the "terminal terminal" of the canon model.

## Decision 2: Drop the gate-dialog UX in the canon shell — transparent auto-restore

**Context:** The legacy `RestoreSessionsGate` mounts a dialog ("Restore all / Restore selected / Discard / ×") because the legacy shell could have N persisted sessions and the user chose which to restore. The canon shell has two fixed frames; there is no "which to choose" — the data layer maps N persisted → at-most-2 deterministically (claude-first for upper, first non-claude for lower).

**Options considered:**
- *Industry standard:* Port the dialog UX into the canon shell as a "Restore prior session?" confirmation, even though there's nothing for the user to choose — at least they know something happened.
- *Emerging best practice:* Transparent restore. The shell consumes the data layer directly; no dialog mounts. The user opted into `persistTerminalSessions`; restoration is what that opt-in means.
- *Alternative:* A status-bar indicator ("Restored from prior session — undo") with a one-time fade-out.

**Pick:** Transparent restore — the canon shell does NOT mount `RestoreSessionsGate`. — *emerging*

**Rationale:** A dialog with nothing to choose is dialog-as-ceremony — it forces a user click on every relaunch for zero decision value. The canon shell already trends toward "the right thing happens automatically" (auto-spawn on mount, etc.); the dialog would break that posture. The status-bar indicator is a reasonable follow-up if "wait, what happened?" feedback surfaces — but adding it speculatively is over-engineering. The legacy gate continues to render unchanged on the flag-off branch (legacy shell still has N-session dialog needs); that's the migration safety net.

**Consequences:** `RestoreSessionsGate.tsx` is NOT imported by anything under `src/renderer/components/Workbench/`. The canon path consumes `usePersistedTerminalSessions` directly via `useWorkbenchRestore`. At Wave 10 cutover, the gate is deleted alongside the rest of the legacy shell with zero canon-side migration. If a "restore happened" toast becomes warranted post-ship, it's a thin follow-up at the canon shell's status bar level, not a re-port of the gate.

## Decision 3: ~~Renderer-only EXCEPT one main-process IPC extension~~ — SUPERSEDED by D4

**Status (2026-05-23):** SUPERSEDED. The architect's FITS validation that motivated this decision identified the wrong persistence store as the auto-resume data source. Investigation during Phase 0 dispatch (`sonnet-diagnostician` trace) found that `claudeSessionId` is already available end-to-end via electron-store Store A (`terminalSessions` key → `TerminalSessionSnapshot` in `configTypes.ts:88-97`), not via SQLite Store B (`pty_sessions` → `PersistedSessionInfo`) which the architect targeted. The IPC extension this decision committed to is unnecessary. See D4.

The original decision body is preserved below for traceability.

<details>
<summary>Original D3 (pre-supersession)</summary>

**Context:** Wave 8 was scoped renderer-only. The architect's FITS validation surfaced ONE necessary main-process change: `PersistedSessionInfo` (the IPC read type for `pty:listPersistedSessions`) omits `isClaude` and `claudeSessionId`, which ARE persisted in `SavedSessionSnapshot` (the electron-store write shape) but stripped on the IPC read. Auto-resume needs `claudeSessionId` on the renderer side. Three ways to bridge the gap.

**Pick:** Extend `PersistedSessionInfo` + verify/extend the handler passthrough. — *standard*

**Rationale:** The fields ARE persisted; the IPC type stripped them for no documented reason. Extending the type is the smallest correct change.

</details>

---

## In-flight decisions (added during execution)

## Decision 4: Renderer-only, no main-process IPC change — read from electron-store Store A

**Context:** During Phase 0 (pre-Phase-1) dispatch, the orchestrator dispatched `sonnet-diagnostician` to verify the architect's "two-part fix" risk (whether SQLite `PtyPersistence.listSessions()` strips `isClaude`/`claudeSessionId`). The diagnostician's trace established **two parallel persistence stores**:

- **Store A (electron-store, `terminalSessions` config key)** — `TerminalSessionSnapshot[]` carries `cwd`, `isClaude`, `claudeSessionId`, `isCodex`, `codexThreadId` end-to-end. Written by `useTerminalSessions.sync.ts:persistCurrentSessions` on a 750ms debounce. Read by `useTerminalSessions.restore.ts:readSavedSessionSnapshots`. This is the data source the architect's narrative referenced ("electron-store `terminalSessions` key").
- **Store B (SQLite, `pty-sessions.db` via `ptyPersistence.ts`)** — `PersistedPtySession[]` carries cwd + shell descriptor + dims + env-hash. Does NOT carry `isClaude`/`claudeSessionId` (no columns). Written by `PtyPersistence.saveSession` on every `pty:spawn`. Read by `usePersistedTerminalSessions` → `RestoreSessionsGate` (raw PTY-process restore).

The architect's text correctly named Store A in the narrative but committed Wave 9 to editing Store B's IPC surface (`PersistedSessionInfo` + `pty:listPersistedSessions`) — a misnaming. Reading Store A directly skips the IPC extension AND the would-be SQLite schema migration the original D3 risk-table anticipated ("Step 1 may be a two-part fix"). The wave can stay strictly renderer-only.

**Options considered:**
- *Industry standard:* Stay with D3 — extend `PersistedSessionInfo` IPC type + extend SQLite `PtyPersistence` with two new columns (v1→v2 schema migration, first ever in this codebase) + extend `saveSession` call sites to pass the new fields. Larger scope, sets precedent for SQLite migrations, but consolidates onto Store B.
- *Emerging best practice:* Read `claudeSessionId` from Store A (`config.get('terminalSessions')`) — the path that already works for the legacy shell. No IPC change. No SQLite migration. Add a separate small electron-store key for canon-side writes (see D5) to keep stores independent.
- *Alternative:* Direct electron-store read from the renderer via raw store-file path. Skips the IPC layer entirely. Rejected outright — quiet erosion of the main-process boundary.

**Pick:** Read from Store A via the existing `config.get('terminalSessions')` IPC; no extension to Store B. — *emerging*

**Rationale:** The architect's intent was correct (use the store that already carries `claudeSessionId`); the implementation target was misaddressed. Realigning the implementation to the architect's intent is smaller AND lower-risk than the original D3. The standard option (extend Store B) would do significant work for no functional gain since Store A already has the data — Store B doesn't need the columns for any current purpose. Sticking with D3 would also set a SQLite-migration precedent under wave-end pressure rather than as a deliberate architectural choice.

**Consequences:** This wave stays renderer-only (the original Wave 8 hope, preserved). No `src/main/` touch beyond a new electron-store config key per D5. No IPC extension. The "two-part fix" risk in the original plan is eliminated. Wave 9's phase count drops from 3 implementation phases to 2 (the original Phase 1 IPC extension collapses; the original Phase 2 + Phase 3 remain). Wave 10 cutover stays renderer-only as planned. The original architect-validated 7-step blueprint in `roadmap/deferred/2026-05-22-canon-workbench-session-restore.md` is partly invalidated — its Steps 1-2 (IPC type + handler passthrough verification) are now N/A; Steps 3-7 (renderer hook + integration) are preserved in shape with the data source swapped.

## Decision 5: Add new electron-store key `canonWorkbenchSessions` for canon-side persistence

**Context:** D4 settled the READ side (Store A's `terminalSessions` key already has the data). But canon's `useWorkbenchTerminals` spawns directly via `pty.spawn` and does NOT participate in the legacy `TerminalSession[]` state — which means the existing `persistCurrentSessions` writer (in `useTerminalSessions.sync.ts`) iterates legacy state only and NEVER writes canon's sessions to `terminalSessions`. So even though Store A is the right SHAPE, canon's data isn't IN it. Three options:

- *Industry standard:* Reuse `terminalSessions`. Canon writes into the same key the legacy reader uses, gated on `layout.canonWorkbench`. Renderer-only mutual exclusion. Risk: toggling `layout.canonWorkbench` mid-life means canon overwrites legacy snapshots (and vice versa) — data conflicts on flag flip.
- *Emerging best practice:* New small electron-store key `canonWorkbenchSessions` shaped `{ upper: { cwd, claudeSessionId? } | null, lower: { cwd } | null }`. Two-frame fixed shape (matches the canon model). Independent of legacy. Adds one schema entry + types mirror; no IPC change. No conflict on flag flip — each shell has its own store.
- *Alternative:* Use Store B (SQLite, already auto-populated by canon's `pty.spawn`) for cwd, then a separate small key for `claudeSessionId` only. Hybrid. More moving parts. Doesn't actually need SQLite to be extended (it doesn't need `claudeSessionId`), but adds a small key anyway, so the total work is similar to the standalone-key option.

**Pick:** New `canonWorkbenchSessions` electron-store key. — *emerging*

**Rationale:** The shape matches the product (two fixed frames) instead of forcing it into the N-session legacy shape. Stores stay independent → no flag-flip data conflicts. Pure renderer-side (no SQLite migration, no IPC change beyond the schema entry — which is type-only). The legacy `terminalSessions` key continues serving the legacy reader unchanged; when Wave 10 deletes the legacy shell, `terminalSessions` can be retired in the same teardown. The standard "reuse" option was rejected because the mutual-exclusion gate is the kind of subtle invariant that's easy to break in future waves; cleaner to separate the data.

**Consequences:** One new schema entry in one of the three `configSchema*.ts` split files (per the 300-line cap; pick the smallest) + one new `AppConfig` field in `electron-foundation.d.ts` + a small `CanonWorkbenchSessions` type in `configTypes.ts`. Default value `{ upper: null, lower: null }`. Wave 10 should add a follow-up to retire BOTH `terminalSessions` (legacy) AND `canonWorkbenchSessions` (canon) keys at teardown, OR consolidate onto one when the legacy shell goes away. Wave 9 explicitly does NOT migrate users from `terminalSessions` to `canonWorkbenchSessions` — first-launch under canon with no prior canon-store data is treated as a cold start (legacy-stored snapshots stay in legacy's key, ignored by canon). Acceptable because the canon flag is experimental + default-off; no production user has canon-mode state to migrate.

---

*Reserve below for further in-flight decisions. Per `~/.claude/rules/best-practice-spectrum.md`, decisions made mid-wave still record industry-standard / emerging / experimental options + the pick + rationale + consequences. Trivial "use the existing pattern" calls get the abbreviated form: Context / Pick / Rationale.*
