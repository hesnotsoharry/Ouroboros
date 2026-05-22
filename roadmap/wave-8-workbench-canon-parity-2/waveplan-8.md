---
status: SHIPPED
created: 2026-05-22
updated: 2026-05-22
---

# Wave 8 — Canon Workbench Parity Round 2 (cutover prerequisites)

> **SHIPPED 2026-05-22 — 3 of 4 phases.** Phases 1 (sidebar scoping), 2 (live FileTree),
> 3 (file quick-open + FileViewer modal) shipped. Phase 4 (session-restore) SPLIT to its own
> wave (ADR D4 + `roadmap/deferred/2026-05-22-canon-workbench-session-restore.md`). See
> `wave-8-result.md`, `wave-8-mechanical-review.md`, `wave-8-followup-audit.md`.

## Context

Wave 7 (parity completion, shipped `v2.28.0`) closed the canon §06 TitleBar right cluster
(Settings cog, Ctrl-K palette, Bell). A live smoke of the canon workbench on 2026-05-22
(Modern theme, `layout.canonWorkbench` enabled) confirmed those work — but surfaced four
parity gaps that each block the Wave 9 cutover, because deleting the legacy shell while any
of them stands would ship a silent regression in the sole shell:

1. **Agent sidebar is not session-scoped.** `useWorkbenchAgentData` takes no input and
   selects from the global session pool — `selectPrimarySession(agents)` at
   `useWorkbenchAgentData.ts:387`, where `agents` is the full unfiltered
   `AgentEventsContext.agents` list fed by the named-pipe hook server
   (`src/main/hooks.ts`), which receives events from **every `claude` process on the
   machine** (external sessions + the IDE-runs-in-itself session). Result: the NOW / Files
   Touched / Hook Timeline panels show the wrong/aggregate session, and the Context panel
   stays at `0/200k` because token stats are read from the wrong `primary`. Diagnosed
   (code-evident, authoritative): `roadmap/follow-ups/2026-05-22-workbench-sidebar-session-scoping.md`.
   The binding that exists in the legacy shell (`useClaudeSessionCapture` in
   `useTerminalSessions.sync.ts`, populating `TerminalSession.claudeSessionId`) was never
   wired into the workbench's parallel terminal stack (`useWorkbenchTerminals`, which tracks
   only `wb-cc-*`/`wb-shell-*` pty IDs). `AgentSession.id` IS the `claudeSessionId`.

2. **FileTree is mock.** `InnerRail` renders `MOCK_FILE_TREE` (`InnerRail.tsx:19`); canon §07
   specifies a live tree. `roadmap/follow-ups/2026-05-22-workbench-live-filetree.md`.

3. **FilePicker / SymbolSearch / session-restore** were classified AMBIGUOUS in the Wave 7
   parity audit. Cole resolved them 2026-05-22 (`…workbench-canon-product-decisions.md`,
   RESOLVED): FilePicker → fold into the Ctrl-K palette; SymbolSearch → drop with legacy
   (teardown no-op, not ported); session-restore → keep, wire into the canon Workbench.

Companion fix held for this wave's push: the terminal tinted-well mount-sync fix
(commit `57b750b1`, local — `useThemeSync` now syncs on mount) plus Modern's well tuned to
`rgba(6,8,16,0.1)`. Both are already committed; their push is bundled with this wave.

## Goal

After this wave, the canon workbench (still behind the default-off `layout.canonWorkbench`
flag) is **functionally at parity with the legacy shell** for everything that survives
cutover: the agent sidebar reflects only the Claude session bound to the selected terminal
in the selected project (and the Context panel populates from that session's real tokens);
the InnerRail file section renders the live project file tree; the rail "Search files"
button + Ctrl-K palette open file quick-open; and terminal session-restore-on-launch is
preserved in the canon two-frame model. Nothing in the legacy shell is deleted yet — that
is Wave 9. The result is a canon shell that can be made the sole shell without losing a
feature.

## Locked decisions (Phase 0 — ADR)

See `roadmap/wave-8-workbench-canon-parity-2/wave-8-decisions.md`.

1. **Sidebar scoping = bind + thread + scope, reuse the existing capture mechanism.** Extract/
   reuse `useClaudeSessionCapture`'s binding for the workbench upper (`wb-cc-*`) terminal;
   thread the bound `claudeSessionId` `useWorkbenchTerminals → CenterPane → Workbench →
   AgentSidebar`; `useWorkbenchAgentData(claudeSessionId?)` selects `agents.find(s => s.id === id)`
   with `selectPrimarySession` retained as the no-binding fallback, additionally filtered by
   `cwd` matching the active window's project root.
2. **FileTree = canon-styled tree over the shared data layer, NOT the legacy component.** Reuse
   the data source (`useFileWatcher` + `ProjectContext` roots + `window.electronAPI.files`),
   render a Workbench-local canon §07-styled tree. The legacy `FileTree`/`SidebarSections`
   are slated for teardown — the canon shell must not depend on them.
3. **FilePicker = a file-quick-open command in the existing command registry.** The rail
   "Search files" button and Ctrl-K both reach the same command; no standalone overlay.
4. **Session-restore = adapt to the canon two-frame model (PENDING architect validation).**
   The canon shell has two fixed frames (upper `claude`, lower shell), not the legacy dock's
   arbitrary-N sessions, so `RestoreSessionsGate` is adapted, not dropped in wholesale —
   restore the two frames' working directories and offer `claude --resume` for the upper
   frame. Phase 4 opens with a short `sonnet-architect` pass to validate this against
   `RestoreSessionsGate`'s actual API before implementing.

## Scope

**In scope:**
- Session-scope the agent sidebar to the active terminal's bound `claudeSessionId` + project.
- Fix the Context panel (populates once the correct session is selected).
- Live canon-styled FileTree in `InnerRail` over the real file-data layer.
- File quick-open command wired to the rail "Search files" button + Ctrl-K palette.
- Session-restore-on-launch adapted into the canon two-frame Workbench.
- Bundle + push the held tinted-well mount-sync fix (`57b750b1`).

**Out of scope (→ Wave 9 cutover/teardown):**
- Deleting `AppLayout` / `InnerAppLayout`, `ChatOnlyShell/`, `Dispatch/`, the legacy
  `SymbolSearch`, legacy `FilePickerConnected`, the orphaned `AgentMonitor/ApprovalDialog`,
  the "Explain error" scrollback action.
- SymbolSearch in the canon shell — dropped (decision 2); simply not ported.
- Permission-overlay smoke (#5) re-run — deferred until sidebar scoping lands (its
  sidebar-takeover half reads the same data); re-smoke at wave-end.
- `enableTerminalDiffReview` Latest-Hunk accuracy audit — separate follow-up.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 1 | Agent sidebar session scoping | `sonnet-implementer` | **Conceptually-risky + boundary (session-identity match).** Orchestrator authors a FAILING acceptance test pre-dispatch (see Notes below). Capture `claudeSessionId` on the `wb-cc-*` terminal via `useClaudeSessionCapture` (or shared extraction); thread through `useWorkbenchTerminals → CenterPane → Workbench → AgentSidebar`; scope `useWorkbenchAgentData(claudeSessionId?)` with project-`cwd` fallback; fix BOTH call sites (`AgentSidebar.tsx:267` + `SidebarHeader` `:121`). Update frozen `useWorkbenchAgentData.sessions.acceptance.test.ts` fallback contract. `sonnet-phase-reviewer` pass before gate. Test shape: honeycomb. |
| 2 | Live canon FileTree | `sonnet-implementer` | Replace `MOCK_FILE_TREE` (`InnerRail.tsx:19`) with a canon §07-styled tree over `useFileWatcher` + `ProjectContext` roots + `window.electronAPI.files`. Workbench-local; token-based styling; respects per-window roots. Test shape: trophy (UI + integration; manual smoke). |
| 3 | FilePicker → command palette | `sonnet-implementer` | Add a file-quick-open command to the command registry; wire the InnerRail "Search files" button (§07) + Ctrl-K to it. No standalone overlay. Touches `InnerRail.tsx` — sequence after Phase 2. Test shape: trophy. |
| 4 | Session-restore (canon two-frame) | `sonnet-architect` → `sonnet-implementer` | **Conceptually-risky.** Opens with a short architect pass (read `RestoreSessionsGate` + `useTerminalSessions` restore path, confirm the two-frame adaptation in ADR D4 fits the actual API; revise D4 if not). Then wire restore-on-launch into the canon Workbench respecting `persistTerminalSessions`. Touches `useWorkbenchTerminals` — sequence after Phase 1. `sonnet-phase-reviewer` pass. Test shape: honeycomb (startup sequencing). |

**Phase 1 orchestrator-owned acceptance test (author before dispatch, subagent may not modify):**
`useWorkbenchAgentData.scoping.acceptance.test.ts` — given an `AgentEventsContext` with
multiple sessions (one bound id `X` with token data, one unrelated "more recent" session,
one with a non-matching `cwd`): `useWorkbenchAgentData('X')` returns the session with `id===X`
(NOT the most-recent), and its `contextStats.usedTokens` reflects `X`'s `inputTokens+outputTokens`;
with no id passed, the fallback returns only sessions whose `cwd` matches the active project root.
Orchestrator runs it RED before dispatch.

## Phase ordering

```
Phase 1 (sidebar scoping) ──┐ (touches useWorkbenchTerminals)
                            └─► Phase 4 (session-restore — also touches useWorkbenchTerminals)
Phase 2 (FileTree) ─────────┐ (touches InnerRail.tsx)
                            └─► Phase 3 (FilePicker — also touches InnerRail.tsx)
```

Two independent chains (1→4 share `useWorkbenchTerminals`; 2→3 share `InnerRail.tsx`).
Linear dispatch order **1 → 2 → 3 → 4** satisfies both shared-file dependencies and avoids
merge churn. No phase is a hard blocker for a different chain, but 4 must follow 1 and 3
must follow 2.

## Risks

| Risk | Mitigation |
|---|---|
| `useClaudeSessionCapture` is coupled to the legacy `TerminalSession` model and can't be reused cleanly for `wb-cc-*` | Phase 1 first inspects the hook; if coupled, extract the pure binding logic (heuristic claudeSessionId capture) into a shared util both stacks call. Acceptance test guards the contract regardless of mechanism. |
| The claudeSessionId-capture heuristic mis-binds (background-launched `claude`, per Wave 99 known debt) | Accept the same heuristic the legacy shell uses; the fallback (project-`cwd` filter) bounds the blast radius. Document the heuristic limitation; don't over-engineer a perfect binding this wave. |
| Session-restore (Phase 4) doesn't map to the canon two-frame model — `RestoreSessionsGate` restores N arbitrary sessions | ADR D4 is explicitly PENDING architect validation; Phase 4 leads with a `sonnet-architect` read of the actual API and revises D4 before any implementation. If the gap is large, Phase 4 splits to its own wave rather than forcing a bad fit. |
| Canon FileTree diverges visually from canon §07 or duplicates legacy behavior | Phase 2 styles strictly from canon §07 tokens (depth×12px, dir icon `--accent-hi`, file `--ink-3`, M/A badges); reuses only the data layer, not legacy markup. |
| Updating the frozen `…sessions.acceptance.test.ts` masks a real regression | Only the fallback-path contract changes; the orchestrator re-reads the diff to confirm the existing assertions still hold for the non-fallback path, and the new scoping acceptance test is additive. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 1 | Scoping logic in `useWorkbenchAgentData` (id-match + cwd fallback) | Orchestrator-owned `…scoping.acceptance.test.ts` (RED before dispatch) | Honeycomb — the boundary is session-identity matching. |
| 2 | Tree-shape derivation from file-data | FileTree renders against a mocked `files` API | Trophy — UI-heavy; manual smoke is primary signal. |
| 3 | Command registration | Palette opens file quick-open from button + Ctrl-K | Trophy. |
| 4 | Restore-decision logic (what to restore for 2 frames) | Restore-on-launch wires into Workbench mount without double-spawn | Honeycomb — startup sequencing vs auto-spawn race. Architect pass first. |

## Acceptance criteria

- [ ] `useWorkbenchAgentData` accepts an optional `claudeSessionId` and, when supplied, returns `agents.find(s => s.id === id)` (not `selectPrimarySession`) — verifiable at `useWorkbenchAgentData.ts`.
- [ ] Both `AgentSidebar.tsx:267` and the `SidebarHeader` call site pass the same `claudeSessionId`.
- [ ] `useWorkbenchTerminals` exposes the upper terminal's bound `claudeSessionId` on its return shape.
- [ ] `useWorkbenchAgentData.scoping.acceptance.test.ts` exists and passes (was RED pre-implementation).
- [ ] With two `claude` sessions running (one in the workbench, one external), the workbench sidebar shows ONLY the workbench terminal's session; the Context panel shows non-zero tokens for it.
- [ ] `InnerRail` no longer imports `MOCK_FILE_TREE`; the file section renders real project files from `useFileWatcher`/`window.electronAPI.files`.
- [ ] The rail "Search files" button and Ctrl-K both open a working file quick-open.
- [ ] With `persistTerminalSessions` on, relaunching restores the canon two frames' prior working directory (per ADR D4's validated shape).
- [ ] Full suite green; `eslint src/` 0 errors; tsc clean; prettier clean.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 1 | Canon workbench agent sidebar (right panels) during a live `claude` run | `wb-cc-*` terminal hook event → `claudeSessionId` captured in `useWorkbenchTerminals` → `CenterPane` → `Workbench` → `AgentSidebar` → `useWorkbenchAgentData(id)` → NOW/Context panels | NOW shows the workbench terminal's tool/target; Context shows its real token count climbing; an external `claude` session running elsewhere does NOT change the panels. |
| 2 | InnerRail "Files" section | `window.electronAPI.files` → `useFileWatcher` → canon tree component → `InnerRail` | Real project files/folders render with canon §07 styling; expanding a folder shows real children; editing a file off-screen updates M/A badges. |
| 3 | Ctrl-K palette / rail "Search files" button | button click / Ctrl-K → command registry → file-quick-open command → palette list | Typing a filename filters to real project files; selecting one opens it. |
| 4 | Canon workbench on relaunch | app start → `RestoreSessionsGate` (adapted) → `useWorkbenchTerminals` spawn → two frames | After a restart with `persistTerminalSessions` on, the two frames come back in their prior working directories rather than blank `cwd`. |

### Data-shape probes

```ts
// Phase 1 — the scoping contract (orchestrator runs at wrap):
//   npx vitest run src/renderer/components/Workbench/useWorkbenchAgentData.scoping.acceptance.test.ts
// Asserts: useWorkbenchAgentData('X') → session.id === 'X'; contextStats.usedTokens === X.input+X.output;
//          no-id fallback excludes sessions whose cwd != active project root.
```
Phases 2-4 are UI/startup surfaces — primary signal is the experiential observation table; no
additional programmatic probe beyond the phase tests.

## Files the next agent should read first

1. `roadmap/wave-8-workbench-canon-parity-2/wave-8-decisions.md` — the locked ADR (esp. D4 PENDING).
2. `roadmap/follow-ups/2026-05-22-workbench-sidebar-session-scoping.md` — authoritative Phase 1 diagnosis (root cause + 5-step fix + blast radius).
3. `roadmap/follow-ups/2026-05-22-workbench-live-filetree.md` — Phase 2 grounding.
4. `roadmap/follow-ups/2026-05-22-workbench-canon-product-decisions.md` (RESOLVED) — Phases 3 + 4 decisions.
5. `src/renderer/components/Workbench/useWorkbenchAgentData.ts` — Phase 1 primary edit (`:387` selection; `deriveContextStats` ~`:220`).
6. `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` — Phases 1 + 4 (add `claudeSessionId`; restore interaction).
7. `src/renderer/components/Workbench/Rails/InnerRail.tsx` — Phases 2 + 3 (`:19` mock import; "Search files" button).
8. `src/renderer/hooks/useTerminalSessions.sync.ts` — `useClaudeSessionCapture` (Phase 1 reuse) + restore path (Phase 4).
9. `src/renderer/components/Terminal/RestoreSessionsGate.tsx` — Phase 4.
10. `src/renderer/components/Workbench/AgentSidebar.tsx` + `SidebarHeader` — Phase 1 dual call site.

## Note to the implementer

The spirit of this wave is **make the canon shell tell the truth** — every panel must reflect
the user's actual selected terminal/project, the file tree must be real, and nothing the user
relies on (file open, session restore) may silently vanish at cutover. This is not a
build-new-features wave; it's a finish-the-wiring wave. Resist two temptations: (1) don't
"fix" the sidebar by making `selectPrimarySession` smarter — the fix is to *scope to the bound
session*, not to guess better globally; (2) don't reach for the legacy `FileTree`/`SidebarSections`
components to save time — they're deleted in Wave 9, so the canon shell owning its own
canon-styled tree over the shared data layer is the point. Phase 4 has a real model mismatch
(two fixed frames vs N restored sessions) — do the architect pass first; if `RestoreSessionsGate`
doesn't fit the two-frame model, say so and split Phase 4 out rather than forcing it.

Before declaring a phase complete, restate the observation point from the Verification table in
your own words and describe what you actually observed there. If you could not observe it
directly — no live IDE, no triggered `claude` session, no rendered panel — say so explicitly.
Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is
necessary but not sufficient.

## Orchestrator dispatch checklist

A green per-phase gate with nothing Tier 3 means dispatch the next phase **in the same turn** —
the gate is a verification checkpoint, not a stop-and-check-in. End the turn between phases only
for a Tier 3 discovery needing Cole's call, a genuine user-judgment decision, or wave-end.

1. **Verify ADR** exists at `wave-8-decisions.md` with D1-D3 locked and D4 marked PENDING-architect.
2. **Phase 1** — author `useWorkbenchAgentData.scoping.acceptance.test.ts`, run it RED. Dispatch `sonnet-implementer`. Gate: acceptance test green + frozen `…sessions.acceptance.test.ts` updated + `sonnet-phase-reviewer` PASS + tsc/lint/touched-tests green.
3. **Phase 2** — dispatch `sonnet-implementer`. Gate: FileTree renders real files in a manual check; tree tests + tsc/lint green.
4. **Phase 3** — dispatch `sonnet-implementer`. Gate: file quick-open opens from button + Ctrl-K; tests + tsc/lint green.
5. **Phase 4** — dispatch `sonnet-architect` (validate D4) → revise ADR if needed → dispatch `sonnet-implementer`. Gate: restore-on-launch works without double-spawn; `sonnet-phase-reviewer` PASS; tests + tsc/lint green.
6. **Wave wrap** — full suite + `eslint src/` + tsc + prettier; `/review` mechanical gap-check; `/ui-smoke 8` (UI-bearing — re-runs the canon smoke incl. the deferred #5 permission overlay now that scoping is fixed); `/audit-followups wave-8-workbench-canon-parity-2` (should close the 3 parity follow-ups); bundle-push incl. held `57b750b1`; tag (no package.json bump, per workbench convention); update HANDOFF + temperature log; flip status SHIPPED.
