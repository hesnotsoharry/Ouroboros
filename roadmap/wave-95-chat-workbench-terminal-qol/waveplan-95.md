---
status: PLANNED
created: 2026-05-18
updated: 2026-05-18
wave: 95
slug: chat-workbench-terminal-qol
tag: v2.19.1
---

# Wave 95 — Chat-Workbench Terminal Quality-of-Life

## Context

Wave 94 (Chat-Workbench Completion, v2.19.0, SHIPPED 2026-05-18) closed the
five contract gaps Wave 89's terminal-first pivot left open. Its wave-wrap
smoke walk surfaced 5 additional QoL items — 4 pre-existing limitations
the pivot now makes visible (the terminal is the primary surface, not a
side panel), plus 1 net-new tab affordance request. Wave 94's Phase E
also shipped end-to-end diff review wiring after a 5-bug cascade fix
(`b7dede57`); during that smoke pass, 3 diff-review UX items surfaced
(panel layout 80/20 inverted, no cross-project grouping/attribution, and
one "wrong edit shown" trust bug). All 8 items have follow-up docs at
`roadmap/follow-ups/2026-05-18-*.md`. Each is small enough to bundle into
a single fix-sweep wave rather than chase individually.

Confirmed from the codebase:
- `src/renderer/components/Layout/ChatOnlyShell/projectTerminalsSchema.ts`
  already has `SessionTabRefSchema.title` — the field exists; this wave
  wires a setter through and adds `userRenamed: boolean`.
- `src/renderer/components/Terminal/CLAUDE.md` documents the
  WebGL-must-load-before-`term.open()` rule that Phase C will re-audit.
- `src/main/hooksDiffReview.ts` is the stash/correlation site introduced
  in Wave 94 commit `b7dede57` — Phase H investigates it.

This is a sanctioned fix-sweep wave per the pipeline (8 items, mixed
bugs + UX polish + investigations). Target tag: `v2.19.1` (patch — no
new contracts).

## Goal

After Wave 95, the chat-workbench terminal experience is polished and the
diff-review surface is trustworthy:

- Terminal tabs (dock-slot and inner rail) support inline rename that
  survives PTY `titleChange` events, project switches, and restarts.
- Long Claude TUI sessions retain scrollback (≥10k lines default,
  user-configurable).
- No ghost cursor when running interactive TUIs (WebGL load order
  re-verified at the documented seam).
- Claude CLI TUI renders with correct colors / box borders / cursor in
  the in-app terminal — visual parity with external Windows Terminal.
- Secondary dock slot's collapsed-empty chrome behavior matches the
  resolved-by-ADR option (A confirmed, or B/C implemented).
- Diff-review panel renders code at 75–80% width with a draggable,
  persistent splitter (not the current inverted 80/20).
- Diff-review panel groups changed files by project root with
  collapsible sections and per-row project badges.
- The "wrong edit shown" failure mode is reproduced, root-caused, and
  prevented by a regression test — users trust the surface.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-95-chat-workbench-terminal-qol/wave-95-decisions.md`.
Decisions 1, 2, 5 RESOLVED 2026-05-18. Decisions 3, 4 PENDING —
investigation-gated, resolve after C/D diagnosticians return briefs.

1. **Phase A — PTY `titleChange` vs user-rename precedence — RESOLVED:
   permanent stick.** `userRenamed: boolean` persisted on
   `SessionTabRef`; OSC titleChange suppressed for the session's
   lifetime and across restarts (industry standard — matches VS Code /
   iTerm2 / Warp).
2. **Phase B — Default scrollback — RESOLVED: 50000 lines** (min 1000,
   max 100000) at `terminal.scrollback` config key. User-tunable via
   Settings → Terminal → Scrollback lines. Memory footprint ~50 MB
   per terminal at the default.
3. **Phase C — WebGL vs Canvas fallback — PENDING.** Investigation-gated.
   Diagnostician audits the WebGL load order against the documented rule
   in `Terminal/CLAUDE.md`; ADR updates after the brief.
4. **Phase D — OSC 11 (bg color read) policy — PENDING.**
   Investigation-gated. Diagnostician compares dock-slot vs external
   Windows Terminal side-by-side to narrow root cause; ADR updates
   after the brief.
5. **Phase E — Secondary slot collapsed-empty chrome — RESOLVED:
   Option B preceded by Lane B mini-investigation.** Cole confirmed
   the comparison point was an earlier smoke state where the slot
   rendered at 0px — a real regression. Phase E re-shapes:
   `sonnet-diagnostician` traces the render-gating regression, then
   `sonnet-implementer` lands Option B (hide secondary slot when
   `collapsed && empty`; add "show secondary slot" expand affordance
   on primary slot header or title bar).

## Scope

**In scope:**

- All 8 follow-up items (`roadmap/follow-ups/2026-05-18-*.md`) — Phases A
  through H, one phase per follow-up.
- Schema additions: `SessionTabRefSchema.userRenamed: boolean` (Phase A),
  `terminal.scrollback: number` settings key (Phase B). Both additive
  with sane defaults — no destructive migration.
- Tests for new behavior: tab rename persistence, scrollback config
  read, hooks-diff-review tool-filter regression.
- Visual / manual smoke for items without unit-testable surface
  (ghost cursor, TUI colors, panel splitter drag).
- CLAUDE.md updates per subsystem: `Terminal/CLAUDE.md` for B/C/D;
  `ChatOnlyShell/CLAUDE.md` for A/E; `agentChat/CLAUDE.md` or
  whichever owns the diff-review panel for F/G; `hooksDiffReview.ts`
  inline doc for H.

**Out of scope:**

- New chat-workbench surfaces or interactive `claude` substrate work
  (Wave 90 / 91 — pre-existing, separate scope).
- Terminal subsystem rewrites — all patches within existing primitives.
- Cross-window IDE-tool delegation (separate follow-up, untouched).
- Full extraction of `ClaudeCliSettings` shared-types (deferred to Wave
  97 per Wave 96's ADR).
- Tabs in IDE-view `TerminalPane` parity work — chat-workbench dock
  slots already have tabs (Wave 94 Phase C); this wave only adds
  *rename* there. IDE-view tabs predate dock-slot tabs and remain on
  their own schedule.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Resolve Decisions 1–5 (or stub as PENDING for investigation-gated phases C/D/E). Author `wave-95-decisions.md`. Gate to A. |
| A | Terminal tab rename + PTY-title precedence | sonnet-implementer | **Persistence schema touch.** Adds `userRenamed: boolean` to `SessionTabRefSchema`, wires `renameSession(id, title)` through `useProjectTerminals.SlotHandle`, double-click edit in `DockSlotTabs.tsx`, context-menu in `InnerSidebarTerminals.tsx`, suppresses PTY `titleChange` overwrite when `userRenamed`. Test shape: trophy (UI + persistence). |
| B | Scrollback buffer bump + setting | haiku-implementer | Tight spec. Bump xterm `scrollback` option default to 10000 at `TerminalSession.tsx` init, add `terminal.scrollback` key to `configSchemaTail*.ts` (default 10000, doc memory note in CLAUDE.md). Test shape: trophy. |
| C | Ghost-cursor audit + fix | sonnet-diagnostician → sonnet-implementer | **Investigate-first.** Diagnostician: instrument `TerminalSession.tsx` xterm/WebGL init, verify `loadAddon(WebglAddon)` runs BEFORE `term.open()`, check `@xterm/addon-webgl` version for known cursor bugs. Then implementer applies the fix (re-order, version bump, or Canvas fallback per ADR 3). Test shape: trophy (visual). |
| D | Claude CLI color rendering | sonnet-diagnostician → sonnet-implementer | **Investigate-first.** Side-by-side compare claude TUI in dock-slot vs external Windows Terminal, identify wrong element (cursor color / box borders / bg). Likely candidates: OSC 11 blocker, theme palette ANSI slots, terminfo. Fix per ADR 4. Test shape: trophy (visual). |
| E | Secondary slot collapsed-empty regression + Option B | sonnet-diagnostician → sonnet-implementer | **Investigate-first (Lane B mini).** Diagnostician traces the render-gating regression — earlier in smoke the slot rendered at 0px; now it renders 28px chrome when `collapsed && empty`. Identify the gating change (likely in `ChatWorkbenchTerminalDock.tsx` or `useDockSlotHeights`). Implementer then lands Option B per ADR 5: hide secondary slot when `collapsed && empty`, add "show secondary slot" affordance on primary slot header (or title bar). Test shape: trophy. |
| F | Diff-review panel layout (split inversion + splitter) | sonnet-implementer | Swap flex ratios so code occupies 75–80%, file list 20–25%; add draggable splitter with min-widths (file list 180px, code 400px); persist ratio per-window. Reuse existing workbench splitter pattern. Test shape: trophy. |
| G | Diff-review cross-project grouping + attribution | sonnet-implementer | Group files by `projectRoot` (already in `diff_review_ready` payload, currently ignored by consumer) with collapsible sections (`▼ Agent IDE (3 files)`) + per-row project badge. Reuse FileTree collapsible primitive. Test shape: trophy. |
| H | Wrong-edit-shown — Lane B investigation + fix | sonnet-diagnostician → sonnet-implementer | **Boundary-adjacent — hooks producer/consumer correlation.** Lane B B0 repro (two terminals, one Edit + one Bash, verify only Edit surfaces). B1: enumerate 5–7 candidates (stash key collision under `tool_use_id` reuse / tool-filter scope / per-terminal session scoping / event race / panel "active diff" selection). B2: instrument `hooksDiffReview.ts`. B3: fix + regression test. Test shape: honeycomb. |
| I | Wave wrap | orchestrator | Scoped vitest suites (`test:layout`, `test:agentchat`, `test:main`), full lint + typecheck + formatter, `/review` mechanical gap-check including Check 6 mutation if stryker config present, `wave-95-result.md`, `CHANGELOG.md [2.19.1]` entry, manual smoke walk on terminal-only checklist, `git tag v2.19.1` (held local per 2026-05-18 bulletin — GH Actions minutes exhausted until 2026-06-01), HANDOFF flip, `/promote-vendor-lessons 95` (likely no-op — no new vendor SDK). |

## Phase ordering

```
Phase 0 (ADR — Decisions 1, 2, 5 ideally resolved; 3/4 may PEND until C/D investigate)
   |
   +---> A (tab rename)            ----+
   +---> B (scrollback)            ----+
   +---> C (ghost cursor diag→fix) ----+
   +---> D (CLI colors diag→fix)   ----+
   +---> E (chrome clarify→?)      ----+
   +---> H (wrong-edit diag→fix)   ----+--+
                                          |
                                          +---> F (panel layout) ---> G (grouping) ---+
                                                                                       |
                                                                                       v
                                                                                Phase I (wrap)
```

- A, B, C, D, E independent — can parallelize (caveat: C and D both touch
  `TerminalSession.tsx` — sequence C → D, or hold both for the same
  implementer to avoid merge churn).
- H sequenced **before** F and G: if H reveals a contract-level issue in
  the diff-review payload or selection logic, F's layout polish and G's
  grouping should land on top of the corrected substrate.
- F sequenced before G: both touch the diff-review panel component; F
  reshapes the layout, G adds grouping into the reshaped layout.
- I (wrap) blocks on all.

## Risks

| Risk | Mitigation |
|---|---|
| Phase C / D investigations reveal a non-trivial root cause (xterm version bump, Canvas fallback, terminfo rewrite) that bumps wave from patch to minor | Investigate-first dispatch returns a diagnosis brief before the fix dispatch. If scope grows past patch-level, reclassify to v2.20.0 and surface to user before continuing. |
| Phase A's `userRenamed` flag persistence breaks the existing per-project schema migration path | Schema change is additive with default `false`. Run `tsc:node` after `projectTerminalsSchema.ts` edit; verify migration test in `useProjectTerminals.test.ts` if one exists. |
| Phase B scrollback bump to 10000 causes memory pressure at 4 concurrent sessions on low-RAM machines | Follow-up estimates ~50 MB per session worst-case. Default 10000 is conservative vs VS Code/Warp. Setting exposed for users to tune. |
| Phase H "wrong edit shown" repro is non-deterministic (depends on cross-terminal timing) | Lane B mandates instrumentation BEFORE the second fix attempt. If B0 repro is flaky, instrument first to capture one good trace, diagnose from observed data — do not guess. |
| Phase H's hooks-producer change re-opens the Wave 94 Phase E cascade | Any edit to `hooksDiffReview.ts` re-runs the Phase E orchestrator-owned acceptance test (`agentChat/diffReviewProducer.acceptance.test.ts` or equivalent). Verify the test still passes after the fix. |
| Phase E resolves to "no change needed" — phase becomes a no-op | Acceptable. Drop from wave at clarification time; document the decision in `wave-95-result.md`. |
| Phase F/G land conflicting changes in the diff-review panel component | Sequenced F → G (not parallel). G dispatch reads F's diff before starting. |
| Tag `v2.19.1` push is held local — risk of forgetting to push on June 1 | HANDOFF.md flagged with explicit "push held — see bulletin" line. Wave wrap creates tag locally; HANDOFF carries the deferred-push reminder. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| A | Schema migration (`userRenamed` default), `renameSession` mutates state correctly, PTY-title suppression when flag set | DockSlotTabs double-click → state → reload → title persists; PTY `titleChange` fires after rename → title unchanged | Honeycomb-ish — boundary is electron-store persistence; mostly unit-coverable. |
| B | Config schema accepts `terminal.scrollback`, xterm init reads the key | n/a | Manual smoke: scroll back through long claude run, verify ≥10k lines retained. |
| C | n/a | n/a | Investigation phase. Manual visual: no double cursor in claude TUI. |
| D | n/a | n/a | Investigation phase. Manual visual side-by-side: TUI parity with Windows Terminal. |
| E | Render-gating unit test (`secondary slot hidden when collapsed && empty`); "show secondary slot" affordance click handler unit test | Manual: collapse + empty → slot hidden; click expand affordance on primary → secondary slot reappears | Trophy — Lane B mini upfront, then implementation. |
| F | Split ratio persists to per-window state and round-trips | DiffReviewPanel renders with code 75–80% by default; splitter drag updates ratio | Manual: drag works, min-widths enforced. |
| G | Grouping function partitions files by `projectRoot` correctly with multi-project input | DiffReviewPanel renders grouped layout with collapsible sections and badges | Manual: multi-project claude session produces grouped view. |
| H | Tool-filter regression test (Bash event does NOT produce `diff_review_ready`; Edit/Write/MultiEdit/NotebookEdit DO); per-terminal session scoping test | Lane B B0 repro test (two terminals + Edit + Bash → only Edit's diff appears in panel) | Honeycomb — boundary-adjacent producer/consumer correlation. |
| I | n/a | Full scoped suites green, `/review` PASS or FLAG-with-flags-addressed | Wrap. |

## Acceptance criteria

- [ ] `SessionTabRefSchema` in `projectTerminalsSchema.ts` includes
      `userRenamed: z.boolean().default(false)`; existing persisted
      state migrates without data loss.
- [ ] `useProjectTerminals.SlotHandle` exposes `renameSession(id: string, title: string)`.
- [ ] `DockSlotTabs.tsx` supports double-click inline rename (Enter
      submits, Escape cancels) and context-menu "Rename" item.
- [ ] `InnerSidebarTerminals.tsx` rows expose a "Rename" context-menu
      item invoking the same affordance.
- [ ] After user rename, subsequent PTY `titleChange` events for that
      session do NOT overwrite the title (verified by integration test).
- [ ] Tab title persists across (a) project switch + return, (b) full
      app restart with session restore.
- [ ] `configSchemaTail*.ts` adds `terminal.scrollback` (number, default 50000, min 1000, max 100000).
- [ ] `TerminalSession.tsx` reads `terminal.scrollback` from config at xterm init.
- [ ] No double / ghost cursor visible when claude TUI is active in a
      dock-slot terminal (manual smoke).
- [ ] `loadAddon(WebglAddon)` provably runs BEFORE `term.open()` at the
      init site (verified by instrumentation log or code-review).
- [ ] Claude CLI TUI box borders / cursor color / bullet markers render
      correctly in dock-slot terminal — visual parity with external
      Windows Terminal (manual smoke side-by-side screenshot).
- [ ] Secondary slot consumes 0px when `collapsed && empty` (render
      gated on `!collapsed || hasSessions` in `ChatWorkbenchTerminalDock`).
- [ ] Primary slot header (or title bar) has a "show secondary slot"
      affordance that, when clicked, reveals the secondary slot.
- [ ] Diagnostician brief identifies the gating change that caused the
      28px chrome regression (filed in Phase E commit or `wave-95-result.md`).
- [ ] DiffReviewPanel default split is code 75–80% / file list 20–25%
      (verified by computed style or measured DOM).
- [ ] Splitter is draggable with min-widths (file list ≥180px, code ≥400px); ratio persists per-window across reload.
- [ ] DiffReviewPanel groups files by project root with collapsible
      headers showing project name + file count (`▼ Agent IDE (3 files)`).
- [ ] Each file row in DiffReviewPanel shows a project badge.
- [ ] `hooksDiffReview.ts` tool filter restricted to
      `{Edit, Write, MultiEdit, NotebookEdit}` — Bash / Read / Grep
      events do NOT produce `diff_review_ready`.
- [ ] Two-terminal repro (Edit in terminal A + Bash in terminal B) shows
      ONLY terminal A's edit in DiffReviewPanel — Bash leakage is gone.
- [ ] Regression test for the wrong-edit-shown failure mode exists and
      fails on the pre-fix commit, passes on the post-fix commit.
- [ ] `CHANGELOG.md` has a `[2.19.1] — 2026-05-XX` entry listing all
      shipped phases.
- [ ] `wave-95-result.md` exists with per-phase outcomes, smoke checklist
      results, dropped-phase notes (if E or others drop).
- [ ] Tag `v2.19.1` created locally; HANDOFF carries the deferred-push reminder per bulletin.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like |
|---|---|---|---|
| 0 | ADR file on disk | n/a (orchestrator authors) | `wave-95-decisions.md` exists with 5 decision sections; pending decisions clearly stubbed PENDING with context. |
| A | Dock-slot tab strip in chat-workbench, user-renamed title | User double-clicks tab → DockSlotTabs inline-edit submits Enter → useProjectTerminals.renameSession → SessionTabRef.title + userRenamed flag → electron-store persist → reload → tab renders | The tab shows the user-typed title. After running a command that fires PTY OSC `titleChange`, the tab title is UNCHANGED. After project switch + return, title persists. After app restart, title persists. |
| B | Scrollback in a dock-slot terminal during a long claude run | User runs `claude` interactive session in dock-slot → xterm Terminal instance honors `terminal.scrollback` config key (default 50000) → scroll wheel up | User can scroll back through ≥50,000 lines of session history mid-session without "history gone" gap. Settings → Terminal → Scrollback lines slider updates the value at next session spawn. |
| C | Active cursor rendering in dock-slot terminal during claude TUI | User runs `claude` interactively → TerminalSession xterm + WebGL addon → render | Only ONE cursor visible (the active one). No ghost cursor in random locations during Claude's "thinking" state. No ghost cursor in front of the typing cursor. |
| D | Claude TUI box borders, cursor color, bullet markers in dock-slot terminal | User runs `claude` → ptyEnv TERM/COLORTERM + TerminalSession xterm theme + OSC handlers → visible TUI render | Visual parity with external Windows Terminal when both run the same claude command against the same project — box borders are clean, status panel bg is correct, bullets render in intended color. |
| E | Secondary dock slot when collapsed AND empty; "show secondary slot" affordance on primary | User has primary slot with sessions, secondary collapsed with no sessions → ChatWorkbenchTerminalDock render gating reads `!collapsed || hasSessions` → secondary slot NOT rendered → primary slot header shows "show secondary slot" button → click → secondary slot reappears | Secondary slot consumes 0px when collapsed && empty. Primary slot header has an expand affordance that reveals the secondary slot on click. Matches the pre-regression baseline Cole was comparing to. |
| F | Diff-review panel after a claude session edits files | User triggers diff_review_ready (claude in terminal does an Edit) → DiffReviewPanel renders → user looks at split ratio | Code occupies ~75–80% of panel width; file list is the narrow column at ~20–25%. Dragging the splitter resizes; releasing persists the ratio. Reload → same ratio restored. |
| G | Diff-review panel after a claude session edits files across two projects | User runs claude in two terminals against two different projects → both fire diff_review_ready → DiffReviewPanel grouped renderer | Files appear under collapsible project headers (e.g. `▼ Agent IDE (3 files)`, `▼ Gamify (2 files)`). Clicking a header collapses/expands the group. Each file row shows a project badge. |
| H | Diff-review panel correctness with concurrent sessions | User runs `claude` (Edit) in terminal A, runs `claude` (Bash command, no Edit) in terminal B → both fire post_tool_use → hooksDiffReview tool-filter → stash correlation → consumer → panel | Panel surfaces ONLY terminal A's Edit diff. Terminal B's Bash event produces NO entry. The diff content matches the file actually edited (not a stale or wrong-correlated one). |
| I | Wave-result brief + tag + smoke checklist | Orchestrator runs gates, authors `wave-95-result.md`, creates local tag, walks terminal-only smoke checklist | All checklist items pass; `wave-95-result.md` exists with per-phase outcomes; `git tag v2.19.1` exists locally; HANDOFF.md updated with deferred-push reminder per bulletin. |

### Data-shape probes

```bash
# Phase A: confirm schema migration + setter
npx vitest run src/renderer/components/Layout/ChatOnlyShell/projectTerminalsSchema.test.ts \
  src/renderer/hooks/useProjectTerminals.test.ts

# Phase A: grep that userRenamed is referenced where PTY titleChange is handled
# (expect at least one branch reading userRenamed before applying title change)
# Use Grep tool on `src/renderer/components/Terminal/useTerminalSessions.sync.ts`
# for `userRenamed` references.

# Phase B: confirm config key exists and TerminalSession reads it
# Use Grep tool on `src/main/configSchemaTail*.ts` for `scrollback`
# and on `src/renderer/components/Terminal/TerminalSession.tsx`
# for `scrollback` in the xterm constructor options.

# Phase C/D: visual — no programmatic probe. Smoke checklist line.

# Phase F: confirm split ratio is read from persisted state
# Use Grep on the diff-review panel component for the split ratio
# read path; expect it to consume from per-window state, not hardcoded.

# Phase G: confirm grouping function exists and projectRoot is consumed
# Use Grep on the diff-review panel for `projectRoot` usage in render.

# Phase H: regression test exists
npx vitest run src/main/hooksDiffReview.test.ts
# Expected: the regression test for the wrong-edit-shown failure mode
# is in the suite and passes.

# Wrap: full scoped + lint + typecheck
npm run lint
npm run typecheck
npx vitest run --reporter=verbose \
  src/renderer/components/Layout \
  src/renderer/components/Terminal \
  src/main/hooksDiffReview.test.ts
```

## Files the next agent should read first

1. `roadmap/wave-95-chat-workbench-terminal-qol/wave-95-decisions.md` — ADR; check which decisions are RESOLVED vs PENDING before dispatching any work phase.
2. `roadmap/wave-94-chat-workbench-completion/wave-94-result.md` — preceding wave's outcomes; especially the Phase E 5-bug cascade context for Phase H.
3. `roadmap/follow-ups/2026-05-18-terminal-tab-rename.md` — Phase A spec.
4. `roadmap/follow-ups/2026-05-18-terminal-scrollback-truncated.md` — Phase B spec.
5. `roadmap/follow-ups/2026-05-18-terminal-ghost-cursor-resurfaced.md` — Phase C spec.
6. `roadmap/follow-ups/2026-05-18-claude-cli-color-rendering-in-terminal.md` — Phase D spec.
7. `roadmap/follow-ups/2026-05-18-secondary-slot-collapsed-chrome.md` — Phase E spec.
8. `roadmap/follow-ups/2026-05-18-diff-review-panel-layout-inverted.md` — Phase F spec.
9. `roadmap/follow-ups/2026-05-18-diff-review-cross-project-grouping.md` — Phase G spec.
10. `roadmap/follow-ups/2026-05-18-diff-review-wrong-edit-shown.md` — Phase H spec.
11. `src/renderer/components/Layout/ChatOnlyShell/projectTerminalsSchema.ts` — Phase A schema touch site.
12. `src/renderer/hooks/useProjectTerminals.ts` — Phase A setter wire-through; Phase D rail integration consumer.
13. `src/renderer/components/Layout/ChatOnlyShell/DockSlotTabs.tsx` — Phase A double-click affordance site.
14. `src/renderer/components/Layout/ChatOnlyShell/InnerSidebarTerminals.tsx` — Phase A context-menu site.
15. `src/renderer/components/Terminal/TerminalSession.tsx` — Phase B (scrollback option) + Phase C (WebGL load order) + Phase D (theme/OSC handlers).
16. `src/renderer/components/Terminal/CLAUDE.md` — Phase C WebGL-load-order rule reference; Phase D OSC handler policy reference.
17. `src/main/ptyEnv.ts` — Phase D TERM/COLORTERM source.
18. `src/main/configSchemaTail*.ts` — Phase B new scrollback config key.
19. `src/main/hooksDiffReview.ts` — Phase H tool-filter and stash correlation site (introduced in Wave 94 `b7dede57`).
20. The diff-review panel component (search `DiffReviewPanel` in `src/renderer/`) — Phase F layout, Phase G grouping, Phase H selection logic.

## Note to the implementer

The spirit of this wave is **polish, not rebuild**. Eight independent
follow-up items, each scoped to ≤6 files. The temptation will be to
"while I'm in here, also fix that nearby thing" — resist. If a
non-trivial discovery surfaces (Tier 3 per the scope-creep tiers), stop,
write a follow-up doc, continue the planned phase. Especially for
Phase H: do NOT propose a fix from code-reading alone — the Lane B
"after-one-failed-fix instrument" gate is hard. Phase C and D are also
investigate-first; the diagnostician returns a diagnosis brief before
the implementer dispatches. If the diagnostician's brief recommends a
scope larger than patch-level, surface to user and reclassify the wave
before continuing.

The diff-review panel (F/G/H) is the trust-critical surface this wave
ships. F and G are visual polish; H is correctness. Land H first so
F and G build on a known-good substrate. After H, re-run the Wave 94
Phase E orchestrator-owned acceptance test to confirm the producer/consumer
contract is still honored — Phase H touches the same `hooksDiffReview.ts`
file that test gates.

**Before declaring a phase complete, restate the observation point from
the Verification table in your own words and describe what you actually
observed there. If you could not observe it directly — no live IDE,
no triggered chat session, no rendered panel — say so explicitly. Do
not substitute "tests pass" for runtime observation. Tests passing at
the unit boundary is necessary but not sufficient.**

## Orchestrator dispatch checklist

A green gate with nothing Tier 3 means the orchestrator dispatches the
next phase in the same turn — the turn ends between phases only for a
Tier 3 discovery needing a user call, a genuine user-judgment decision,
or wave-end. See the Phase-boundary protocol in
`~/.claude/notes/wave-process.md`.

1. **Verify ADR exists.** `roadmap/wave-95-chat-workbench-terminal-qol/wave-95-decisions.md` is present with Decisions 1–5 either RESOLVED or explicitly PENDING. Decisions 1, 2, 5 ideally resolved before A/B/E dispatch; 3 and 4 may resolve after C/D investigations return.
2. **Phase A — sonnet-implementer.** Brief includes: follow-up doc path, the `userRenamed` flag rule per ADR 1, the schema-additive constraint. Gate: scoped tests green (`test:layout`, `test:agentchat`), schema migration test passes, manual round-trip (rename → restart → title persists) confirmed.
3. **Phase B — haiku-implementer.** Tight spec: add config key, bump default at xterm init, doc the memory note. Orchestrator runs `test:layout` + `test:main` after the haiku reports DONE (haiku has no Bash). Gate: tests green, config schema typechecks.
4. **Phase C — sonnet-diagnostician THEN sonnet-implementer.** Diagnostician dispatched with the WebGL-load-order rule from `Terminal/CLAUDE.md` and the Phase 2 instrumentation guidance from `debug-before-fix.md`. Returns: diagnosis brief naming the root cause (re-order needed / version bump needed / Canvas fallback needed). Orchestrator updates ADR Decision 3. Implementer dispatched with the diagnosis. Gate: scoped tests green, manual visual confirmation (no ghost cursor).
5. **Phase D — sonnet-diagnostician THEN sonnet-implementer.** Diagnostician compares dock-slot vs external Windows Terminal side-by-side, narrows root cause to OSC / theme palette / terminfo. Orchestrator updates ADR Decision 4. Implementer applies the fix. Gate: manual visual parity confirmed.
6. **Phase E — sonnet-diagnostician THEN sonnet-implementer.** Diagnostician traces the secondary-slot render-gating regression (compare current `data-collapsed="true"` 28px state against the earlier 0px state Cole observed; identify the gating predicate change). Brief returns the root cause. Implementer lands Option B per ADR 5: gate secondary slot render on `!collapsed || hasSessions`, add "show secondary slot" expand affordance on primary slot header (or title bar). Gate: scoped tests green, manual visual (slot is gone when collapsed+empty, expand button surfaces it).
7. **Phase H — sonnet-diagnostician THEN sonnet-implementer.** **Boundary-adjacent — per-phase `sonnet-phase-reviewer` pass after implementation** because Phase H touches the Wave 94 Phase E producer/consumer contract. Diagnostician does Lane B B0 repro + B1 enumeration + B2 instrumentation. Implementer applies B3 fix + regression test. Phase reviewer checks the diff against the follow-up brief + the Wave 94 Phase E acceptance test. Gate: regression test passes, Wave 94 acceptance test still passes, manual repro confirms wrong-edit-shown is gone.
8. **Phase F — sonnet-implementer.** Brief includes: target split ratio, splitter min-widths, per-window persistence pattern reference. Gate: scoped tests green, manual drag + reload confirmation.
9. **Phase G — sonnet-implementer.** Sequenced after F. Brief includes: `projectRoot` consumer wiring, FileTree collapsible primitive reference, badge styling pattern. Gate: scoped tests green, manual multi-project session confirmation.
10. **Phase I — wave wrap.** Run `npm run lint`, `npm run typecheck`, scoped vitest (`test:layout`, `test:agentchat`, `test:main`), then full suite (in background if available). Run `/review` mechanical gap-check (includes Check 6 mutation if stryker config present). Author `wave-95-result.md`. Append CHANGELOG `[2.19.1]` entry. Walk manual smoke checklist (terminal-only items + diff-review items). Create local tag `v2.19.1` (HOLD push per 2026-05-18 bulletin — GH Actions minutes exhausted until 2026-06-01). Update `HANDOFF.md` with the deferred-push reminder. Run `/promote-vendor-lessons 95` (likely no-op).
