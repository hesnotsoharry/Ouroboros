---
status: DRAFT
created: 2026-05-23
updated: 2026-05-23
blocked-on: [wave-10, wave-11, wave-12, wave-13, wave-14]
note: |
  Originally drafted as Wave 15 on 2026-05-23. Cole ran a live smoke of the canon
  Workbench that same day and surfaced extensive functional-wiring gaps across most
  surfaces (project switching, file viewer modal, terminal CRUD, agent-sidebar
  scoping, status-bar readouts). The "zero parity gaps" premise this plan was built
  on does not hold. This plan was renumbered to Wave 15 and deferred behind a new
  wiring set (Waves 10-14) that fixes the gaps. The deletion scope and decisions
  below remain directionally correct but will need a revision pass at the end of
  Wave 14 to reflect any new code surfaces the wiring waves introduce (e.g., a
  potentially project-keyed canonWorkbenchSessions schema replacing Wave 9's
  unprojected shape). Do NOT execute this plan until Waves 10-14 ship and a fresh
  revision pass updates this content.
---

# Wave 15 — Workbench Cutover & Teardown

## Context

Wave 9 (`v2.30.0`, shipped 2026-05-23) closed the canon session-restore + auto-resume gap via the new `canonWorkbenchSessions` electron-store key + `useWorkbenchRestore` / `useWorkbenchSessionPersist` hooks. The wave's result brief claimed "zero parity gaps remaining for the canon shell" — that claim was structurally true (canon mounts, tests pass, types pass) but functionally premature: a live smoke run by Cole on 2026-05-23 (the same day Wave 9 shipped) surfaced extensive wiring gaps across the canon surface (project switching, file viewer modal, terminal CRUD, agent-sidebar session-scoping, status-bar readouts). Those gaps are addressed by Waves 10–14:

- **Wave 15:** project-scoped state foundation + all project-switching wiring (outer rail, inner rail dropdown, title bar dropdown + branch, layout/profile buttons, "+" project)
- **Wave 11:** file tree + viewer modal (cross-project browse, click-to-open)
- **Wave 12:** terminal CRUD + chrome (spawn/delete/rename/+/split/maximize, fix tab-header overlap, project-scoped collection)
- **Wave 13:** AgentSidebar terminal-scoped binding (NOW/Context/Files Touched/Latest Hunk/Hook Timeline all bind to the currently-viewed upper terminal's claude session; likely the wave that finally fixes `2026-05-22-workbench-claudeSessionId-binding-precision.md` via main-process `CLAUDE_SESSION_ID` forwarding)
- **Wave 14:** status bar real values (context, cost, tests)

Wave 15 — this plan — is the original deletion wave, deferred until Waves 10–14 ship and a final smoke confirms canon is functionally complete. The deletion scope (legacy shell + ChatOnlyShell + Dispatch + orphans + legacy session persistence) remains valid; the *premise* (smoke gating proves canon ready) just moves from "Phase 0 of Wave 15" to "smoke at end of Wave 14, gates Wave 15."

The original Wave-9 → Wave-10 framing (zero gaps; pure deletion next) is preserved in `roadmap/wave-9-canon-workbench-session-restore/wave-9-result.md:96-104` for context. Wave 15 supersedes that next-action.

The deletion scope was mapped in `roadmap/wave-8-workbench-canon-parity-2/wave-8-followup-audit.md` and confirmed in `roadmap/wave-9-canon-workbench-session-restore/wave-9-result.md:96-104`. Wave 15 is the cutover that flips `layout.canonWorkbench` default `false → true`, removes every flag-check branch, deletes the legacy shell and its support code, retires the legacy `terminalSessions` electron-store key, and leaves the canon Workbench as the sole render path.

Before any deletion begins, Phase 0 absorbs the **deferred `/ui-smoke 9` checklist** queued at Wave 9 wrap. That checklist verifies four user-facing scenarios under the *currently-shipped* code: (a) relaunch the IDE and confirm `claude --resume <claudeSessionId>` fires transparently in the upper frame without a restore dialog; (b) the IDE-runs-in-itself isolation (parent + child Electron share `userData` — confirm what behavior is acceptable in this wave); (c) the shutdown-race window where a `claudeSessionId` capture <750ms before exit is lost; (d) the lower frame returns to its prior cwd as a plain shell. Deletion does NOT begin until the smoke gate either passes or its findings are explicitly accepted as out-of-scope.

Companion item: the pre-existing **HIGH/OPEN follow-up** `2026-05-22-workbench-claudeSessionId-binding-precision.md` is main-process scope (forward `CLAUDE_SESSION_ID` from pty spawn) and stays untouched by Wave 15 per ADR-D4 of Wave 9. This wave is renderer-only.

## Goal

After this wave, `src/renderer/components/Layout/AppLayout*.tsx`, `InnerAppLayout*.tsx`, `AppLayoutConnected.tsx`, the entire `Layout/ChatOnlyShell/` directory (30 files), the entire `components/Dispatch/` directory (15 files), the orphaned `AgentMonitor/ApprovalDialog.tsx`, the legacy `Terminal/RestoreSessionsGate.tsx` (+ test + sibling `RestoreSessionsDialog.tsx` + `usePersistedTerminalSessions.ts`), the entire `useTerminalSessions.*.ts` hook family (sync/restore/effects/handlers/main), and the legacy `terminalSessions` electron-store key + schema entry are **gone**. The `layout.canonWorkbench` config key is removed entirely (no longer a flag — canon is the only path). `App.helpers.tsx` mounts the canon Workbench unconditionally. Full vitest suite + `tsc --noEmit` + `tsc -p tsconfig.web.json` + `eslint src/` are green with no references to deleted symbols anywhere in the tree.

## Locked decisions (Phase 0 — ADR)

See `roadmap/wave-15-workbench-cutover-teardown/wave-15-decisions.md` for the full ADR:

1. **D1 — Smoke-first ordering.** Phase 0 runs `/ui-smoke 9` against the currently-shipped Wave 9 code BEFORE any deletion. Any RED finding either gets a Tier-1 inline fix as Phase 0.5 OR is accepted out-of-scope with rationale before Phase 1 starts. *(locked 2026-05-23)*
2. **D2 — Flag retirement: remove the flag entirely.** No "default-true soak" — `layout.canonWorkbench` is deleted from the schema in Phase 2, all flag-check branches collapse to the canon path, and `useCanonWorkbenchFlag.ts` is removed. Canon is the only render path post-wave. *(locked 2026-05-23)*
3. **D3 — terminalSessions key retired in-wave.** Once `useTerminalSessions.sync.ts` is deleted, the `terminalSessions` electron-store key has zero writers. Phase 3 removes the key from `configSchema*.ts` + `AppConfig` + any reader hooks in the same wave to avoid leaving dead schema. *(locked 2026-05-23)*
4. **D4 — ChatOnlyShell deleted entirely.** Per memory `project_chat_surface_retired.md`, the in-IDE chat surface is retired in favor of terminal-driven design. ChatOnlyShell, the `isChatWindow` second-window mode, and the `immersiveFlag` branch all delete in Phase 2 alongside the legacy shell. *(locked 2026-05-23)*
5. **D5 — Orphan probes are best-effort.** Phase 1 greps for legacy `SymbolSearch`, `FilePickerConnected`, and the "Explain error" scrollback action; deletes whatever is found; reports "not present" if not. Wave 8 audit named these but the Wave 9 explorer couldn't locate them — likely already gone. Do NOT fabricate deletion targets. *(locked 2026-05-23)*

## Scope

**In scope:**
- Phase 0 verification: run `/ui-smoke 9` against the currently-shipped Wave 9 code; capture findings in `wave-15-smoke-report.md`; gate Phase 1 on smoke verdict.
- Delete orphan files first: `src/renderer/components/Terminal/RestoreSessionsGate.tsx` + `.test.tsx` + `RestoreSessionsDialog.tsx` (if no canon importer) + `usePersistedTerminalSessions.ts`; `src/renderer/components/AgentMonitor/ApprovalDialog.tsx` + `ApprovalDialogCard.tsx` (if orphan after ApprovalDialog removal); probe-and-delete legacy `SymbolSearch`, `FilePickerConnected`, and "Explain error" scrollback action.
- The cutover commit (Phase 2): remove `layout.canonWorkbench` from `configSchema*.ts` + `AppConfig` (`electron-foundation.d.ts`) + every consumer; delete `useCanonWorkbenchFlag.ts`; collapse every `if (canonWorkbench) ? canon : legacy` branch (notably in `App.helpers.tsx`) to the canon arm; collapse the `isChatWindow || immersiveFlag` branch to the canon path (D4).
- Delete legacy shell as a unit alongside the cutover commit (Phase 2): `Layout/AppLayout.tsx` + `.mobile.tsx` + `.mobile.test.tsx` + `.dnd.test.tsx` + `AppLayoutConnected.tsx`; `Layout/InnerAppLayout.tsx` + `.overlays.tsx` + `.agent.tsx` + all related tests; `Layout/ChatOnlyShell/` directory in full; `components/Dispatch/` directory in full; update `Layout/index.ts` barrel.
- Delete legacy session persistence (Phase 3): `useTerminalSessions.sync.ts` + `.restore.ts` + `.ts` + `.effects.ts` + `.handlers.ts` (and tests); remove `terminalSessions` electron-store key from `configSchema*.ts` and from `AppConfig`.
- Update touched-import sites if any post-deletion grep surfaces dangling references.
- Per-phase gates: targeted vitest scope (`test:layout`, `test:agentchat`, `test:renderer`, plus full suite at wrap), `tsc --noEmit`, `tsc -p tsconfig.web.json`, `eslint src/` zero errors, prettier clean.

**Out of scope:**
- `2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN) — main-process scope, deferred per Wave 9 ADR-D4. → Separate follow-up, owned by a future main-process wave.
- IDE-runs-in-itself `userData` isolation (parent + child Electron sharing the same store path). → Acknowledged as a known consideration in Wave 9 result; not a Wave 15 concern unless smoke finds active corruption.
- `claudeSessionId` shutdown-race window (capture lost if <750ms before exit). → Documented Wave 9 inherited constraint; not solved here.
- Mutation testing (Check 6) expansion to new Workbench surfaces. → Wave 15 is pure deletion; mutation set shrinks naturally. Stryker config update can ship as a separate follow-up if scores drift.
- Tagging a `v2.31.0` release vs a `v2.30.1` — `package.json` version-bump convention for workbench-cutover waves to be decided at wrap (likely minor: deletion of public-surface flag is a meaningful behavior change).
- Any new canon-shell features. → Strict deletion wave only; resist all temptations to "while we're in here…".

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | `/ui-smoke 9` verification gate | `orchestrator` | **Verification gate, no code change.** Run `/ui-smoke 9` via `sonnet-smoke-runner` against the currently-shipped Wave 9 code on `master @ 79c4cb4f`. Smoke checklist (queued at Wave 9 wrap): (a) relaunch with prior `claude` session in upper frame → confirm `claude --resume <id>` fires transparently, no dialog; (b) lower frame returns to prior cwd as plain shell; (c) IDE-in-itself isolation behavior — document what happens when parent + child Electron share `canonWorkbenchSessions` (acceptable for Wave 15 if it doesn't corrupt; logged for future userData-separation wave); (d) shutdown-race verification — capture `claudeSessionId`, immediately quit, relaunch — document loss-window behavior. Output: `wave-15-smoke-report.md` with per-scenario PASS/FAIL/ACCEPTED-AS-IS. Gate: every scenario either PASS or explicitly ACCEPTED-AS-IS (Tier-3 escalation to user if a real RED surfaces). Test shape: **trophy** (manual smoke + console + network checks). |
| 1 | Delete unmounted orphans | `sonnet-implementer` | **Pure deletion, safe-first.** `git rm`: `src/renderer/components/Terminal/RestoreSessionsGate.tsx` + `.test.tsx`; verify `RestoreSessionsDialog.tsx` and `usePersistedTerminalSessions.ts` have no remaining importers (they will once Phase 2 lands; check now to confirm canon doesn't import them) and delete if orphan; `src/renderer/components/AgentMonitor/ApprovalDialog.tsx` + recursively-orphaned `ApprovalDialogCard.tsx`/parts. Probe-and-delete (D5): grep `SymbolSearch` (legacy), `FilePickerConnected`, "Explain error" scrollback action — delete if present, report not-present if absent. After each delete: `tsc --noEmit` + `tsc -p tsconfig.web.json` + `eslint src/` must stay green (no dangling imports). Test shape: **pyramid** (deletion-only; surviving tests are the safety net). |
| 2 | Cutover commit — flag retirement + legacy shell deletion | `sonnet-implementer` | **CONCEPTUALLY-RISKY (the load-bearing cutover).** Three coordinated changes in one commit so the tree is never half-cutover: (a) Remove `layout.canonWorkbench` from `src/main/configSchema*.ts` + `AppConfig` mirror in `electron-foundation.d.ts` + any `useConfig()` consumers + delete `src/renderer/hooks/useCanonWorkbenchFlag.ts`; (b) Collapse `App.helpers.tsx`'s `if (canonWorkbench) ? Workbench : InnerAppLayout` and `isChatWindow || immersiveFlag ? ChatOnlyShellWrapper : ...` (D4) branches to the canon arm only; (c) Delete `Layout/AppLayout.tsx`, `Layout/InnerAppLayout.tsx`, `Layout/AppLayoutConnected.tsx`, all `.test.tsx` siblings, `Layout/AppLayout.mobile.tsx` + sibling test, `Layout/InnerAppLayout.overlays.tsx` + `.agent.tsx` + tests, the entire `Layout/ChatOnlyShell/` directory, the entire `components/Dispatch/` directory; update `Layout/index.ts` barrel (remove `AppLayout` and `AppLayoutProps` re-exports — verify no remaining importers via grep before deletion). `sonnet-phase-reviewer` PASS required before gate green (boundary-of-shell phase; high blast radius; user-facing behavior change). Test shape: **trophy** (UI-heavy structural deletion; type checker + surviving tests are the safety net). |
| 3 | Delete legacy session persistence + retire `terminalSessions` key | `sonnet-implementer` | **Cascading deletion.** With the legacy shell gone in Phase 2, the `useTerminalSessions.*.ts` family has no consumers. `git rm`: `src/renderer/hooks/useTerminalSessions.sync.ts`, `useTerminalSessions.restore.ts`, `useTerminalSessions.ts`, `useTerminalSessions.effects.ts`, `useTerminalSessions.handlers.ts`, plus all `*.test.ts` siblings. Confirm zero importers via grep before each delete. Remove `terminalSessions` electron-store key from `src/main/configSchema*.ts` + `AppConfig` (`electron-foundation.d.ts`) + `configTypes.ts` (`TerminalSessionSnapshot` type if it has zero remaining importers; check `canonWorkbenchSessions` family does not depend on it). Keep `canonWorkbenchSessions` (Wave 9). `sonnet-phase-reviewer` PASS required (schema-removal phase; check `~/.claude/notes/wave-process.md` Check 4 schema-removal migration safety implications — accepted: experimental flag was default-off, no production data migration concern). Test shape: **pyramid** (hook deletion + schema removal; surviving Workbench tests confirm canon hooks survive). |
| 4 | Wave wrap | `orchestrator` | Full `npx vitest run` green; full `eslint src/` 0 errors; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean (Wave 9's friction pattern — verify upfront); prettier clean on all wave-touched files; `/review` mechanical gap-check (forward-trace + dead-export audit will be busy this wave — deleted symbols should NOT surface as dead-export findings, but any *surviving* code that references deleted paths should); `/audit-followups wave-15-workbench-cutover-teardown` — close `2026-05-22-orphaned-agentmonitor-approvaldialog.md` and `2026-05-22-wave8-teardown-prep-discoveries.md` if their items shipped; `/promote-vendor-lessons 10` (no-op expected; this wave touches no vendor SDK); update `roadmap/HANDOFF.md` (next action becomes "post-cutover stabilization" or whatever Cole chooses); append entry to `roadmap/wave-temperature-log.md`; flip wave folder + plan + ADR status to SHIPPED; commit + push to `origin/master`; tag `v2.31.0` on origin (minor bump — removal of user-visible flag + legacy code path is a behavior change worth a minor bump; confirm with Cole at wrap if uncertain). |

## Phase ordering

```
Phase 0 (smoke gate) ──► Phase 1 (orphan delete) ──► Phase 2 (cutover commit) ──► Phase 3 (legacy persist delete) ──► Phase 4 (wrap)
```

Strictly linear. Phase 0 gates everything — a RED smoke finding either gets a Tier-1 inline fix as Phase 0.5 (raise to Cole if Tier-3) or is explicitly ACCEPTED-AS-IS before Phase 1 begins. Phase 1 is independent of Phase 2 only by tradition (it's "free deletion" of code that already has no importers in canon); doing it first keeps the cutover-commit diff narrower and easier to review. Phase 2 is the load-bearing cutover; Phase 3 cannot start until Phase 2 lands because the deletions in Phase 3 depend on the legacy shell being gone. Phase 4 is wrap.

No parallelization opportunity — every phase depends on the previous one's gate.

## Risks

| Risk | Mitigation |
|---|---|
| **Phase 0 smoke surfaces an actual RED** — `claude --resume` doesn't fire, lower frame doesn't restore cwd, IDE-in-itself shows hijack. | Tier-1 inline fix becomes a Phase 0.5 if scope is bounded (single-file renderer fix). Tier-3 escalation to Cole if the finding requires a main-process change or otherwise expands wave scope — Wave 15 PAUSES, follow-up filed, separate wave. Do NOT proceed to deletion under an unverified smoke. |
| **Hidden importer of a "legacy-only" file from canon code** — Phase 1 deletes `RestoreSessionsDialog` or `ApprovalDialogCard`, then `tsc` fails because a canon module quietly imported it. | Per-file delete sequence (not batch): grep importers, delete, immediately run `tsc --noEmit` + `tsc -p tsconfig.web.json` + targeted `npm run test:layout`. Roll back the single delete on failure; investigate the importer; either fix the import or move the file to a "kept" list. The orchestrator runs the gate after each individual deletion, not at the phase end. |
| **Phase 2 cutover-commit diff is too large to review confidently.** Deleting ~50 files + flipping flag + collapsing branches in one commit. | The diff IS large by necessity (the deletions must ship atomically with the branch collapse so the tree never has dead `if (canonWorkbench) ? legacy : canon` branches). Mitigation: `sonnet-phase-reviewer` dispatch BEFORE gate-green with explicit "verify every branch-collapse direction picks the canon arm, verify every deleted file has zero surviving importer, verify the diff has NO behavioral change to surviving Workbench code." Reviewer's 4-axis verdict (file-change scope / spec alignment / integrity / runtime viability) is the gate. |
| **`tsc:web` catches a renderer→main type-coupling that per-phase scoped checks miss** — Wave 9 hit this exact pattern (commit `1b6404fc`). Wave 15 deletes type-import sites; the risk is the inverse — a surviving renderer file still imports `TerminalSessionSnapshot` after Phase 3 removes it. | Phase 3 grep for `TerminalSessionSnapshot` (and any other `terminalSessions`-adjacent types) BEFORE deleting from `configTypes.ts`. If any surviving importer is found, either move the type to renderer-side `electron-foundation.d.ts` (Wave 9/96/97 pattern) or delete the importer (likely; it would be legacy). The wrap phase runs full `tsc -p tsconfig.web.json` as an explicit early gate (not after everything else). |
| **`/audit-followups` mis-classifies the `2026-05-22-workbench-claudeSessionId-binding-precision.md` follow-up as RESOLVED.** It is NOT — Wave 15 doesn't touch the main-process binding. | The follow-up's frontmatter explicitly notes `status: OPEN, priority: HIGH, scope: main-process`. `haiku-followup-auditor` reads frontmatter; should classify ACTIVE. Verify at wrap; manually reopen if wrong. |
| **`useCanonWorkbenchFlag.ts` deletion misses a consumer** — flag is read in tests (per explorer report: `Workbench.test.tsx:1121-1128`). | Phase 2 sequence: (1) grep all consumers of `useCanonWorkbenchFlag` and `layout.canonWorkbench` config key; (2) update or delete each consumer (test assertions that the flag works → delete those test cases, the flag no longer exists); (3) THEN delete the hook itself. Per-phase typecheck catches any miss. |
| **HANDOFF.md `next-action` line becomes wrong if not updated at wrap.** Wave 9's HANDOFF says "Wave 15 — cutover & teardown" is next; after this wave, the next-action must reflect post-cutover state. | Phase 4 (wrap) explicitly updates `HANDOFF.md` next-action to "post-cutover stabilization" or "TBD per Cole." Audit at wrap: read HANDOFF.md after wrap and verify it doesn't still reference Wave 15 as in-flight. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a — verification gate | `/ui-smoke 9` agent-driven smoke via `sonnet-smoke-runner` against Wave 9 shipped code | **Trophy.** Smoke checklist + console + network capture. Output: `wave-15-smoke-report.md` per `sonnet-smoke-runner`'s contract. |
| 1 | Pre-existing tests for surviving modules (canon Workbench, surviving primitives) must stay green after each individual file deletion. No new unit tests — pure deletion. | `test:layout` + `test:renderer` after each deletion; `tsc --noEmit` + `tsc:web` + `eslint src/` after each deletion. | **Pyramid.** Deletion-only; the existing test suite is the safety net (a deleted file with no importer should leave no test fail). |
| 2 | n/a — pure deletion + branch collapse. | `test:layout` + `test:agentchat` + `test:renderer` (Workbench-adjacent — broadest reasonable scope short of the full suite); `tsc --noEmit` + `tsc:web` + `eslint src/`. | **Trophy.** UI-heavy structural change; type checker + surviving tests carry the load. `sonnet-phase-reviewer` PASS required before gate. |
| 3 | n/a — hook + schema deletion. | `test:layout` + `test:renderer` + `test:main` (the `terminalSessions` schema removal touches `src/main/configSchema*.ts`); `tsc --noEmit` + `tsc:web` + `eslint src/`. | **Pyramid.** `sonnet-phase-reviewer` PASS required (schema-removal phase — Check 4 of `/review`). |
| 4 | Full suite | Full `npx vitest run` + `/review` mechanical gap-check (forward-trace + plan-universals + dead-export audit + Check 4 schema-removal + Check 5 boundary-test invariants + Check 6 mutation — note: Check 6 likely shows a smaller mutation set after deletions land; that's expected, not regression). | **Trophy.** Full wave-end gate set. |

## Acceptance criteria

- [ ] `wave-15-smoke-report.md` exists at `roadmap/wave-15-workbench-cutover-teardown/wave-15-smoke-report.md` with PASS or ACCEPTED-AS-IS for every checklist item (a–d above). If any RED → Wave 15 PAUSES, escalation to Cole, follow-up filed.
- [ ] `src/renderer/components/Terminal/RestoreSessionsGate.tsx` and its `.test.tsx` are gone (file system check: `! test -f`).
- [ ] `src/renderer/components/AgentMonitor/ApprovalDialog.tsx` is gone.
- [ ] `src/renderer/components/Layout/AppLayout.tsx`, `InnerAppLayout.tsx`, `AppLayoutConnected.tsx`, and all `.test.tsx` siblings are gone.
- [ ] `src/renderer/components/Layout/ChatOnlyShell/` directory is gone (file system check: `! test -d`).
- [ ] `src/renderer/components/Dispatch/` directory is gone (file system check: `! test -d`).
- [ ] `src/renderer/hooks/useCanonWorkbenchFlag.ts` is gone.
- [ ] `src/renderer/hooks/useTerminalSessions.sync.ts`, `.restore.ts`, `.ts`, `.effects.ts`, `.handlers.ts` (+ test siblings) are gone.
- [ ] `layout.canonWorkbench` key is NOT present in any of `src/main/configSchema.ts`, `configSchemaMiddle.ts`, `configSchemaTail.ts`, `electron-foundation.d.ts`, `configTypes.ts`.
- [ ] `terminalSessions` key is NOT present in any of `src/main/configSchema*.ts`, `electron-foundation.d.ts`, `configTypes.ts`.
- [ ] `grep -r "canonWorkbench" src/` returns ZERO matches (excluding `Workbench/` directory name itself in unrelated contexts — verify by spot check).
- [ ] `grep -r "terminalSessions" src/` returns ZERO matches outside `canonWorkbenchSessions`.
- [ ] `grep -r "RestoreSessionsGate\|RestoreSessionsDialog\|usePersistedTerminalSessions\|ApprovalDialog\|AppLayout\|InnerAppLayout\|ChatOnlyShell\|Dispatch" src/` returns ZERO matches outside legitimate canon survivors (verify per match).
- [ ] `npx vitest run` — full suite green (expect baseline `1127 files / 11760 passed` ± deletions removing a few tests; **8 skipped** + **0 failed** must hold).
- [ ] `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean.
- [ ] `eslint src/` — 0 errors (the 4 pre-existing warnings from Wave 9 noted in `wave-9-result.md:78` may shift in count if any of them are in deleted files — re-baseline, no new ones).
- [ ] Prettier clean on all wave-touched files.
- [ ] Canon Workbench mounts on app launch unconditionally (no flag gate). Verified by reading `App.helpers.tsx` post-Phase-2.
- [ ] `roadmap/HANDOFF.md` `next-action` line no longer references "Wave 15" as in-flight; reflects post-cutover state.
- [ ] `roadmap/wave-temperature-log.md` has a Wave 15 entry.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | The live IDE on `master @ 79c4cb4f` (Wave 9 shipped state), launched after a prior session left `canonWorkbenchSessions` populated | `npm run dev` → app boots → `useWorkbenchRestore` reads `canonWorkbenchSessions` → `useWorkbenchTerminals` mounts → upper frame `pty.spawnClaude(..., { resumeMode: <id> })` → xterm shows `claude --resume` startup → claude resumes prior conversation visible in the terminal | The upper terminal pane shows the prior `claude` session resumed — Cole's previous conversation visible in scrollback, claude's prompt is ready, NO restore dialog appeared, lower terminal shows the prior cwd as a plain shell prompt. IDE-in-itself launched as a child confirms isolation behavior is acceptable (document either way). |
| 1 | The same running IDE after `git rm` of `RestoreSessionsGate.tsx` + `ApprovalDialog.tsx` + probe-deletions, then dev rebuild | `npm run dev` → app boots → renderer compiles cleanly (no missing-import errors in the dev console) → all surviving panes render as before | `Internal — no observation point` for individual file deletes (the deletion has no user-facing surface); the gate is type/lint/test green. Spot-check: the dev console shows no missing-module errors and the Workbench panes render. |
| 2 | The same running IDE after the cutover commit | `npm run dev` → app boots → `App.helpers.tsx` no longer reads `canonWorkbenchSessions` flag → mounts `Workbench` unconditionally → renderer compiles cleanly → terminals spawn + restore exactly as Wave 9 confirmed | The IDE looks IDENTICAL to the Wave 9 post-cutover-experience state — same canon glass shell, same two-frame Workbench, same auto-restore + auto-resume behavior. The user-perceivable change is invisible (no flag to toggle, but visible behavior is unchanged because the flag was already default-on for Cole's dev work). The DIFF, however, is large — many fewer files in the tree, and the `isChatWindow` second-window mode and `immersiveFlag` ChatOnlyShell mode are gone (Cole can confirm by attempting to open a chat-only window — it should not exist as a path). |
| 3 | The same running IDE after legacy session persistence is gone | `npm run dev` → app boots → `useWorkbenchRestore` (canon) reads `canonWorkbenchSessions` (canon key, untouched) → restore + auto-resume fires exactly as before; legacy `terminalSessions` key is no longer read or written by any code path | `Internal — no observation point` from the user's perspective (the user sees Wave 9's restore behavior unchanged); the verification is that the legacy `terminalSessions` electron-store key is no longer being written. Check via dev-console `await window.electronAPI.config.get('terminalSessions')` returning `undefined` after relaunch (and after subsequent terminal lifecycle events). |
| 4 | Wave wrap | n/a — internal | `Internal — no observation point`. Wrap phase runs gates + ship; user-facing behavior already verified at Phases 0 and 2. |

### Data-shape probes

```bash
# Phase 0 — smoke report exists and has the expected shape
test -f "C:/Web App/Agent IDE/roadmap/wave-15-workbench-cutover-teardown/wave-15-smoke-report.md"
grep -c "^## Scenario " "C:/Web App/Agent IDE/roadmap/wave-15-workbench-cutover-teardown/wave-15-smoke-report.md"  # expect ≥4 (one per smoke item a/b/c/d)

# Phases 1, 2, 3 — file-system probes (run after each phase's deletions)
for f in \
  "src/renderer/components/Terminal/RestoreSessionsGate.tsx" \
  "src/renderer/components/AgentMonitor/ApprovalDialog.tsx" \
  "src/renderer/components/Layout/AppLayout.tsx" \
  "src/renderer/components/Layout/InnerAppLayout.tsx" \
  "src/renderer/components/Layout/AppLayoutConnected.tsx" \
  "src/renderer/hooks/useCanonWorkbenchFlag.ts" \
  "src/renderer/hooks/useTerminalSessions.sync.ts"; do
  [ ! -e "$f" ] && echo "DELETED: $f" || echo "STILL PRESENT: $f"
done
[ ! -d "src/renderer/components/Layout/ChatOnlyShell" ] && echo "DELETED: ChatOnlyShell/" || echo "STILL PRESENT: ChatOnlyShell/"
[ ! -d "src/renderer/components/Dispatch" ] && echo "DELETED: Dispatch/" || echo "STILL PRESENT: Dispatch/"

# Phase 2 + 3 — schema probes (after wrap)
grep -r "canonWorkbench\b" src/main/configSchema*.ts src/renderer/types/electron-foundation.d.ts src/main/configTypes.ts || echo "OK — no canonWorkbench references"
grep -r "\bterminalSessions\b" src/main/configSchema*.ts src/renderer/types/electron-foundation.d.ts src/main/configTypes.ts | grep -v canonWorkbenchSessions || echo "OK — no terminalSessions (legacy) references"

# Wrap — full gates
npx vitest run
npx tsc --noEmit
npx tsc -p tsconfig.web.json
npx eslint src/
```

## Files the next agent should read first

1. `roadmap/wave-15-workbench-cutover-teardown/wave-15-decisions.md` — locked ADR (D1–D5).
2. `roadmap/wave-9-canon-workbench-session-restore/wave-9-result.md` — Wave 9 result brief; section "Wave 15 prerequisites — green light" (lines 96–104) is the deletion-scope handoff.
3. `roadmap/wave-8-workbench-canon-parity-2/wave-8-followup-audit.md` — Wave 8 audit; original deletion-scope mapping that Wave 9 forwarded.
4. `roadmap/HANDOFF.md` — current session-pickup; `next-action` line confirms Wave 15 is up.
5. `src/renderer/App.helpers.tsx` — the primary Phase 2 edit site (flag-check branch lives here; `isChatWindow`/`immersiveFlag` branch lives here).
6. `src/renderer/components/Layout/index.ts` — barrel re-exports; Phase 2 must update.
7. `src/main/configSchema.ts` + `configSchemaMiddle.ts` + `configSchemaTail.ts` — the three-file split; Phase 2 removes `layout.canonWorkbench`, Phase 3 removes `terminalSessions`.
8. `src/renderer/types/electron-foundation.d.ts` — `AppConfig` mirror; Phase 2/3 sync with schema.
9. `src/main/configTypes.ts` — `TerminalSessionSnapshot` lives here; Phase 3 deletes if no surviving importer.
10. `src/renderer/hooks/useCanonWorkbenchFlag.ts` — the flag-reader hook; Phase 2 deletes.
11. `src/renderer/components/Workbench/` (whole subtree) — the canon shell; the SURVIVING code. Nothing here should be modified beyond what Phase 2's branch-collapse requires.
12. `src/renderer/hooks/useTerminalSessions.sync.ts` — `persistCurrentSessions` writer; Phase 3 deletes the entire family.
13. `roadmap/wave-9-canon-workbench-session-restore/waveplan-9.md` — exemplar for the canonical wave-plan shape (Wave 15 mirrors it).
14. `~/.claude/notes/wave-process.md` — wave-end gate set (Sites 1/2/3 rules, mutation-test Check 6, schema-removal Check 4).

## Note to the implementer

This wave is **disciplined deletion**, not refactoring. The spirit is: Wave 9 closed the last parity gap; Wave 15 reaps the dividend by removing what's now dead weight. Every file in the deletion list has a confirmed reason to die (no canon importer, no user-facing surface, no production value). Your job is to delete them without breaking the surviving canon Workbench and without leaving dangling references or dead schema.

Three temptations to resist:

1. **Don't refactor surviving code "while you're in there."** If Phase 2's branch-collapse reveals a function that could be simplified now that the legacy arm is gone — file a follow-up. Wave 15's diff should be 99% deletion and 1% collapse, not 80% deletion and 20% refactor. Refactor waves are separate; deletion + refactor in one wave makes the diff unreviewable.

2. **Don't fix `claudeSessionId` binding precision.** That follow-up (`2026-05-22-workbench-claudeSessionId-binding-precision.md`) is HIGH/OPEN and tempting — the IDE-in-itself smoke item in Phase 0 will brush against it. It is **main-process scope** (forward `CLAUDE_SESSION_ID` from pty spawn). Out of Wave 15's renderer-only scope per Wave 9 ADR-D4. Document smoke findings, leave the follow-up OPEN.

3. **Don't ship a half-cutover.** Phase 2 (flag retirement + branch collapse + legacy shell deletion) MUST land in one atomic commit. A commit where the flag is removed but the legacy shell is still in the tree leaves dead unreachable code that confuses future readers; a commit where the legacy shell is gone but the flag still gates code leaves a typecheck-broken state. Stage everything together. The `sonnet-phase-reviewer` PASS gate is there to catch this.

Phase 0 is the load-bearing gate. Do NOT skip it because "Wave 9 was green." Wave 9's gates were green on tests; the user-facing UX (transparent auto-resume) was never run live. If smoke surfaces RED, escalate to Cole as Tier 3 before any deletion. Better to PAUSE the wave at Phase 0 than to delete the legacy shell and discover the canon shell has a subtle UX gap.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means dispatch the next phase **in the same turn** — the gate is a verification checkpoint, not a stop-and-check-in. End the turn between phases only for a Tier 3 discovery needing Cole's call, a genuine user-judgment decision, or wave-end.

1. **Verify ADR** exists at `roadmap/wave-15-workbench-cutover-teardown/wave-15-decisions.md` with D1–D5 locked. Wave status `IN-PROGRESS` in both this plan's frontmatter and the ADR's.
2. **Phase 0 — `/ui-smoke 9` verification gate.** Invoke `/ui-smoke 9` (dispatches `sonnet-smoke-runner`). Smoke targets the four checklist items (a–d from Goal/Context). Output: `wave-15-smoke-report.md`. Gate: every scenario PASS or explicitly ACCEPTED-AS-IS. If any RED → STOP, file follow-up if main-process or otherwise out-of-scope, escalate to Cole. If Cole accepts an inline fix, that becomes Phase 0.5 (Tier-1 fix, single-file renderer scope).
3. **Phase 1 — Delete unmounted orphans.** Dispatch `sonnet-implementer` with the brief from the Phases table. Gate per-file: grep importers → `git rm` → `tsc --noEmit` + `tsc -p tsconfig.web.json` + `eslint src/` clean + `npm run test:layout` green. Roll back any individual deletion that fails the gate; investigate. No `sonnet-phase-reviewer` dispatch — pure orphan removal, low risk.
4. **Phase 2 — Cutover commit (flag retirement + legacy shell deletion).** Dispatch `sonnet-implementer` with the brief + explicit constraint "atomic commit; no half-cutover; collapse every branch to canon." Gate: `npm run test:layout` + `test:agentchat` + `test:renderer` green + `tsc --noEmit` + `tsc -p tsconfig.web.json` clean + `eslint src/` 0 errors + `sonnet-phase-reviewer` PASS on all four axes (boundary-of-shell phase). If reviewer FLAGs file-change scope (too broad, refactor smuggled in) — STOP, file the smuggle as a follow-up, redirect the implementer.
5. **Phase 3 — Delete legacy session persistence + retire `terminalSessions` key.** Dispatch `sonnet-implementer`. Gate: per-file deletion sequence (grep importers → delete → `tsc:web` + targeted tests); `sonnet-phase-reviewer` PASS (schema-removal phase — Check 4 of `/review` applies; reviewer confirms the experimental-flag rationale for skipping migration is documented in this plan).
6. **Phase 4 — Wave wrap.**
   - Full suite (`npx vitest run`) green.
   - Full `eslint src/` 0 errors; `tsc --noEmit` clean; `tsc -p tsconfig.web.json` clean (run this EARLY in wrap — Wave 9 hit `tsc:web` friction late); prettier clean on all wave-touched files.
   - `/review` mechanical gap-check. Verdict gates: PASS or FLAG-with-flags-addressed. Note: forward-trace and dead-export audit should report DOWN (fewer exports surviving — expected, not regression).
   - `/audit-followups wave-15-workbench-cutover-teardown` — should close `2026-05-22-orphaned-agentmonitor-approvaldialog.md` and likely `2026-05-22-wave8-teardown-prep-discoveries.md`. Should LEAVE `2026-05-22-workbench-claudeSessionId-binding-precision.md` as ACTIVE (main-process scope, untouched).
   - `/promote-vendor-lessons 10` — no-op expected (this wave touches no vendor SDK).
   - Update `roadmap/HANDOFF.md` to reflect Wave 15 SHIPPED + new next-action (TBD per Cole — post-cutover stabilization OR start of next-track wave, e.g., the deferred `claudeSessionId` binding-precision fix in a main-process wave).
   - Append entry to `roadmap/wave-temperature-log.md`.
   - Flip this plan's frontmatter to `status: SHIPPED`; flip the ADR's similarly; flip the resolved follow-ups (auto-closed by `/audit-followups`).
   - Commit + push to `origin/master` (bulletin sanctions pushes; CI minutes still exhausted until 2026-06-01 — workflows skip cleanly; PR merge blocked but local push proceeds).
   - Tag `v2.31.0` on origin (minor bump for behavior change: removal of `layout.canonWorkbench` flag is user-visible; flag will no longer appear in any config UI). Confirm with Cole at wrap if unsure between `v2.30.1` patch vs `v2.31.0` minor.
