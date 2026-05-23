---
status: DRAFT
created: 2026-05-23
updated: 2026-05-23
---

# Wave 15 — Architecture Decisions

## Decision 1: Smoke-first ordering — `/ui-smoke 9` runs BEFORE any deletion

**Context:** Wave 9 closed canon parity, and its gates were all green (1127 test files, 11760 passed, 0 failed; `tsc + tsc:web` clean; `eslint` 0 errors). But the user-facing auto-resume UX was never run live — Wave 9's `/ui-smoke 9` step was deferred per the Wave 0–8 posture ("Cole not actively using the app"). Wave 15 begins by deleting the legacy shell — if a Wave 9 RED exists, deleting first makes recovery painful.

**Options considered:**
- *Industry standard:* "Verify before teardown" — most cutover playbooks (blue/green, canary, big-bang) require the new system to be observed under load before the old one is decommissioned. See AWS / GCP migration patterns (e.g., AWS Application Migration Service "Test then cutover" model).
- *Emerging best practice:* Same — agent-driven smoke (per `sonnet-smoke-runner` rubric) is the 2026 evolution of manual cutover gates. Same principle, cheaper execution.
- *Experimental / cutting-edge:* Continuous verification with auto-rollback (canary deployment with feature flags + automated metric gates). Not applicable here — the deletion is irreversible (the legacy code is gone post-commit, no rollback dial).

**Pick:** Industry standard — Verify before teardown. Tier: standard.

**Rationale:** Wave 15 is irreversible at the commit boundary. Deleting `AppLayout`/`InnerAppLayout`/`ChatOnlyShell`/`Dispatch` is a `git rm` of ~50 files; "rollback" means reverting the commit and re-shipping under a flag that no longer exists. The cost of verifying first (one smoke session, ~15 min) is trivially less than the cost of a half-cutover with a real RED. Per `~/.claude/notes/wave-process.md` § Phase-boundary protocol, this is a verification checkpoint, not a stop-and-check-in — green smoke → dispatch Phase 1 in the same turn.

**Consequences:** Phase 0 is a verification gate, not a code phase. If smoke surfaces a real RED, Wave 15 PAUSES until either (a) the RED gets a Tier-1 inline fix as Phase 0.5 (single-file renderer scope), or (b) the user escalates and either accepts the finding as out-of-scope (documented in `wave-10-smoke-report.md`) or pivots Wave 15 into a fix-first wave. The smoke also doubles as proof of Wave 9's user-facing claim, retroactively closing that observation gap.

## Decision 2: Flag retirement — remove `layout.canonWorkbench` entirely, no soak period

**Context:** Wave 15's cutover flips canon from "opt-in behind a flag" to "the only path." Two options exist for retiring the flag: (a) flip default to `true` and leave the flag in place for a soak period (typical 2-week soak per `roadmap/roadmap.md` § 3 principle 9 for UX waves), then remove the flag in a follow-up wave; or (b) remove the flag in the same wave as the cutover commit.

**Options considered:**
- *Industry standard:* Two-phase retirement — flip default, soak, then remove flag. LaunchDarkly/Optimizely/Statsig docs all recommend this for production rollouts where partial-rollback is valuable. (See LaunchDarkly's "Flag lifecycle" doc, current as of 2026.)
- *Emerging best practice:* Same, but with telemetry-driven soak gating (auto-remove once 100% adoption + zero error spike sustained N days). Requires observability infra.
- *Experimental / cutting-edge:* Same-commit removal — appropriate when the flag was always experimental, never default-on for users, and the alternative path is dead code.

**Pick:** Experimental / cutting-edge — Same-commit removal. Tier: appropriate-for-context.

**Rationale:** The "industry standard" assumes a user base where some fraction would benefit from a soak-period rollback. That doesn't apply here: (a) the flag has been default-`false` (legacy default) the entire time; (b) Cole is the user, and Cole has been running canon-on for Wave 7-9 dev cycles; (c) Wave 9's Phase 0 smoke (Wave 15 Phase 0) is the live verification — passing smoke is the soak. Keeping the flag in place after the legacy code is deleted creates an inconsistent state: the flag exists, the legacy branch doesn't. That's strictly worse than removing both in one commit.

**Consequences:** Commits `layout.canonWorkbench` is gone from `configSchema*.ts`, `AppConfig`, every `useConfig()` consumer, and `useCanonWorkbenchFlag.ts` is deleted in Phase 2. No flag in Settings UI; no migration concern (the flag was experimental, no production users to migrate). If Cole ever wants a "legacy mode" again, that's a fresh wave — the legacy code is gone from git history forward.

## Decision 3: Retire the legacy `terminalSessions` electron-store key in-wave

**Context:** Wave 9 introduced `canonWorkbenchSessions` as a NEW electron-store key, explicitly to avoid mutating the legacy `terminalSessions` key while the flag could still toggle (Wave 9 ADR D5). With Wave 15 deleting the legacy shell, `terminalSessions` has no surviving writer (`useTerminalSessions.sync.ts:persistCurrentSessions` is deleted) and no surviving reader (legacy `useTerminalSessions.restore.ts` is deleted). The key can be removed from the schema, OR left in as dead schema for a future cleanup.

**Options considered:**
- *Industry standard:* Leave the key in schema for one release as a safety net; remove in a follow-up. Standard "soft-deprecation" pattern from API design (deprecate-then-remove over 2 release cycles).
- *Emerging best practice:* Remove in same wave as the code that writes/reads it, if the key was always experimental or single-user. Cleaner git history; no dead-schema noise.
- *Experimental / cutting-edge:* Schema migration step that proactively reads `terminalSessions` on first launch post-wave and discards any persisted data (defensive cleanup). Overkill — electron-store ignores unknown keys.

**Pick:** Emerging best practice — Remove in same wave. Tier: standard.

**Rationale:** Cole is the only user, the canon shell has been live in dev for waves, and Wave 9 added `canonWorkbenchSessions` as the new key. Persisted `terminalSessions` data on disk is irrelevant — Wave 15's deletions remove every reader. Leaving the schema entry creates a "this key exists but nothing reads or writes it" state that confuses future readers and bait-and-switches anyone who greps the schema looking for legacy persistence.

**Consequences:** Phase 3 removes `terminalSessions` from `configSchema*.ts` + `AppConfig` + the related `TerminalSessionSnapshot` type in `configTypes.ts` IF the type has no surviving importer (verify Phase 3 grep). Persisted `terminalSessions` data in user `userData` directories will be silently ignored by electron-store (unknown keys are not migrated, not errored). No migration script needed.

## Decision 4: Delete `ChatOnlyShell/` entirely — chat surface retirement

**Context:** `ChatOnlyShell/` (30 files) was introduced in Waves 42–44 as an immersive chat surface, mounted when the app runs as a secondary "chat window" or when `immersiveFlag` is set. Per memory `project_chat_surface_retired.md` ("In-IDE chat being retired for terminal-driven design") + Wave 9 result brief naming `ChatOnlyShell/` in Wave 15's deletion scope (line 98), the chat surface is being removed entirely as part of the cutover.

**Options considered:**
- *Industry standard:* Same as D2 — soft-deprecate, soak, then remove. Same reasoning doesn't apply (chat surface usage is zero post-direction-change).
- *Emerging best practice:* Same-commit removal alongside the legacy shell deletion. The canon Workbench is the terminal-first replacement; chat-only mode has no canon equivalent because the direction explicitly retired it.
- *Experimental / cutting-edge:* Migrate ChatOnlyShell users to a canon "chat-only layout preset" — would require building a preset that's terminal-focused but chat-prominent. Out of scope; the direction is terminal-first, not chat-prominent.

**Pick:** Emerging best practice — Same-commit removal. Tier: standard.

**Rationale:** The memory note + roadmap direction make the disposition clear: chat surface is retired. The canon Workbench is the replacement (terminal-first). Migrating to a hybrid preset would be net-new feature work that contradicts the stated direction. Deleting ChatOnlyShell + the `isChatWindow`/`immersiveFlag` branches in `App.helpers.tsx` is the cleanest expression of the direction.

**Consequences:** The `isChatWindow` second-window mode is gone (Phase 2 collapses the branch to canon-only). Any keyboard shortcut or command that opened a chat-only window stops working — the command palette + keybindings must be audited in Phase 2 for any "open chat window" command and that command must be deleted. The 30 files under `Layout/ChatOnlyShell/` + their tests are deleted in Phase 2 alongside the legacy shell. Net: the canon Workbench is the *only* render path; no second-window chat mode survives.

## Decision 5: Orphan probes (legacy `SymbolSearch`, `FilePickerConnected`, "Explain error") — best-effort, no-op if absent

**Context:** Wave 8 followup audit + Wave 7 audit both named three items in the cutover deletion scope: a "legacy `SymbolSearch`" (distinct from any canon search primitive), a `FilePickerConnected` connector, and an "Explain error" terminal scrollback action. The Wave 9 grounding explorer probed for all three in the current tree and reported NOT FOUND for each — likely already deleted in Waves 7/8 cleanup, or named pre-Wave-7 and superseded.

**Options considered:**
- *Industry standard:* Trust the audit, fail loudly if the items are absent. Forces the audit to stay accurate.
- *Emerging best practice:* Probe-and-act — delete if found, report "not present" if not. Acknowledges that audits can be stale and that the worst case (deleting nothing) is also the correct outcome if the items are already gone.
- *Experimental / cutting-edge:* N/A — this is a documentation discipline question, not a technical pattern.

**Pick:** Emerging best practice — Probe-and-act. Tier: pragmatic.

**Rationale:** Treating "audit said these exist" as load-bearing fact creates a failure mode where Phase 1 stops on a non-existent file. The audits are pointers, not contracts. The orphan-deletion phase should be tolerant of the items not being present, log the absence for the audit trail, and proceed.

**Consequences:** Phase 1 includes explicit `git grep` probes for `SymbolSearch` (excluding canon-Workbench matches), `FilePickerConnected`, and the "Explain error" action. Any match is deleted with the standard per-file gate sequence. No-match is logged in the result brief as "Wave 8 audit referenced X, X not present in tree — already deleted or superseded."
