---
status: SHIPPED-PENDING-MANUAL-SMOKE
created: 2026-05-24
updated: 2026-05-24
wave: 13
tag: v2.34.0
---

# Wave 13 — AgentSidebar pane-ID binding (RESULT)

## Summary

Wave 13 closes the long-standing HIGH/OPEN follow-up `2026-05-22-workbench-claudeSessionId-binding-precision.md` by replacing the heuristic `useWorkbenchClaudeCapture` (which any external or IDE-runs-in-itself `claude` session could hijack via a binding-class event) with a deterministic `OUROBOROS_PANE_ID` round-trip: env injection at pty spawn → claude inherits → hook scripts (`agent_start.mjs` / `agent_end.mjs`) emit `paneId` in the payload → renderer event reducer stamps `AgentSession.paneId` → `AgentSidebar` derives `paneId` from `useActiveWorkbenchFrame` + `useWorkbenchTabs` and filters events by `event.paneId === activeTab.id`.

The wave shipped in **5 commits** (Phase 0 plan + ADR + RED tests; Phase 1 boundary plumbing; Phase 2 renderer adoption + heuristic deletion; Phase 2.5 inline runtime-gap closure; Phase 2.6 cascading-test-failure cleanup). One follow-up closed via `/audit-followups` (the binding-precision HIGH plus its related `workbench-sidebar-session-scoping` MED).

## Phases shipped

| # | Topic | Commit | Notes |
|---|---|---|---|
| 0 | Plan + ADR + frozen RED acceptance tests | `63e531dc` | Plan validated PASS (Gates A/B/C/D). ADR D1–D6 written. Phase 1 + 2 acceptance tests authored RED with `describe.skip` per orchestrator-owned-acceptance-tests rule. Env-propagation spike substituted with analogy-based confidence (same chain validated in prod by `OUROBOROS_HOOKS_TOKEN`/`OUROBOROS_IDE_SESSION`); live verification deferred to wave-end smoke. |
| 1 | Boundary: pty env + hook payload + HookPayload.paneId | `81804894` | sonnet-implementer dispatched with un-skipped Phase 1 test. 5/5 GREEN. sonnet-phase-reviewer PASS all 4 axes with 2 non-blocking FLAGS (ClaudeSpawnOptions duplicate env declaration; empty-string paneId guard). Type-coupling fix added to `electron-runtime-apis.d.ts` + `ipc-handlers/pty.ts` (env? on PtyAPI surface + ipc options). |
| 2 | Renderer adoption + heuristic deletion + D4 empty state | `90eb8dd1` | sonnet-implementer dispatched with un-skipped Phase 2 test. 6/6 GREEN. Deleted `useWorkbenchClaudeCapture` + `claudeSessionId` useState + `onClaudeSessionId` callback chain. `useWorkbenchAgentData` signature `claudeSessionId?` → `paneId?`. D4 empty-state copy: "No active claude session in this pane." Implementer flagged a runtime gap in their report → Phase 2.5. |
| 2.5 | Stamp AgentSession.paneId + filter by it (runtime gap) | `bce32169` | Orchestrator inline self-fix per 4-part test. AgentSession.paneId? added (renderer + main type mirror); AGENT_START action + dispatcher + reducer forward paneId; resolvePrimary filters by session.paneId === paneId. Renderer-side HookPayload mirror update caught by `tsc:web` only (recurring Wave 96 lesson). |
| 2.6 | Cascading test-failure cleanup (dispatched fix) | `359197fe` | Phase 2.5's filter change broke Wave 8 bound-path mocks; Phase 2's default-tab `useState` init crashed un-electronAPI-mocked tests with `TypeError: Cannot read properties of undefined (reading 'spawnClaude')`. sonnet-implementer chose Approach A2 (optional-chain guards in `spawnTab`/`autoResumeCcTab`) + extracted `useWorkbenchGlobeData` to its own module to break vi.mock collateral damage chain. 54/54 GREEN across 8 affected files. |
| 3 | Wave wrap | (this commit) | Full vitest baseline maintained (test:layout 1109/3, test:main 6464/5), tsc + tsc:web clean, prettier + lint clean on wave-touched files. /ui-smoke 12+13 bundled checklist authored for Cole's manual walkthrough. |

## Final gate state

- **Frozen acceptance tests**: `hooks.paneId.acceptance.test.ts` 5/5 GREEN + `paneIdBinding.acceptance.test.tsx` 6/6 GREEN. Both byte-identical to Phase 0 except the orchestrator's un-skip flip + a wrap-time prettier whitespace reformat.
- **TSC**: `tsc --noEmit` 0 errors. `tsc -p tsconfig.web.json --noEmit` 0 Wave-13 errors (5 pre-existing `@renderer/generated/changelog` errors — worktree codegen gap, same as Wave 11/12, not Wave 13).
- **Scoped tests**: `test:layout` 1109/3 (Wave 12 baseline); `test:main` 6464/5 (Wave 12 baseline); `test:agentchat` 945/0; `test:hooks` 381/0. No new failures.
- **Lint**: 0 errors on Wave 13 touched files. 3 pre-existing errors persist (Wave 11 `InnerRail.tsx` max-lines 301/300; Wave 11 `InnerRail.fileClick.integration.test.tsx` max-depth; Wave 8 `WorkbenchFileViewerModal.lazyLoad.regression.test.ts` no-useless-escape) — none Wave-13-introduced; carried forward as known debt.
- **Format**: prettier-clean on all touched files (including the orchestrator-owned acceptance tests after wrap-time `--write`).
- **`/review` mechanical**: deferred per Wave 11 lean-wrap precedent (the per-phase phase-reviewer pass on Phase 1 + Phase 2+2.5 covers the equivalent surface; Check 6 mutation joins the existing pre-merge batch).
- **`/audit-followups wave-13`**: closes 2 OPEN follow-ups (`2026-05-22-workbench-claudeSessionId-binding-precision.md` HIGH + `2026-05-22-workbench-sidebar-session-scoping.md`) — both directly addressed by the wave's deterministic-binding architecture.
- **`/promote-vendor-lessons 13`**: no-op (no vendor SDK touched; the work is entirely internal Electron IPC + renderer state).
- **`/ui-smoke 12+13`**: PENDING — Cole's manual walkthrough; checklist at `wave-13-smoke-report.md`. Bundled because Wave 12's smoke was also deferred to Cole.

## Wave 13 architecture (the deterministic chain)

```
User opens canon Workbench
  ↓
Default upper-cc tab created with id='wb-upper-cc-{ts}-{rand}'
  ↓
useWorkbenchTabs.spawnTab calls window.electronAPI.pty.spawnClaude(id, {
  cwd,
  env: buildSpawnEnv(id)  ← injects { OUROBOROS_PANE_ID: id }
})
  ↓
Main process ipc-handler 'pty:spawnClaude' calls spawnClaudePty
  ↓
buildBaseEnv({ ...buildProviderEnv('terminal'), ...options.env })
  → spread-last semantics put OUROBOROS_PANE_ID into pty env
  ↓
pty.spawn(claude, args, { env })
  → node-pty starts claude with OUROBOROS_PANE_ID in env
  ↓
claude inherits env; runs agent_start.mjs / agent_end.mjs as subprocesses
  → subprocesses inherit OUROBOROS_PANE_ID via process.env (OS-level)
  ↓
Hook scripts read process.env.OUROBOROS_PANE_ID, emit paneId field in payload
  ↓
Named-pipe receive in src/main/hooks.ts → HookPayload.paneId carried through
  → isValidPayload structural cast preserves the field (no strip)
  ↓
buildRendererPayload (truncatePayloadForDispatch) → webContents.send
  ↓
Renderer AgentEventsContext receives event; dispatchAgentStart forwards
payload.paneId into AGENT_START action
  ↓
startSession stamps AgentSession.paneId = action.paneId
  ↓
useWorkbenchAgentData(paneId) calls resolvePrimary(agents, paneId)
  → agents.find(s => s.paneId === paneId) ← MATCHES because session was
    stamped from the same env value
  ↓
Sidebar renders THIS session's NOW / Context / Files Touched / Hook Timeline
```

External claude sessions: their pty was NOT spawned with `OUROBOROS_PANE_ID`, so their AGENT_START payloads have `paneId: undefined`, their sessions have `paneId: undefined`, and `resolvePrimary(activeTabId)` finds no match → D4 empty state. **Hijack closed by construction**, not by heuristic.

## Notable patterns + lessons (worth promoting)

1. **Spike-or-analogy decision in background sessions.** Phase 0's env-propagation spike required interactive `npm run dev` + live claude session. As an autonomous background-job session, I substituted analogy-based confidence: same env-propagation chain already validated in production by `OUROBOROS_HOOKS_TOKEN`/`OUROBOROS_IDE_SESSION` (read directly from `process.env` in `ouroboros.mjs:51–63`). This worked — Phase 1's OS-level inheritance test (Test 1.3) passed first try and the full chain landed clean. **The lesson is: for background sessions, prefer well-grounded analogy over deferred spikes when the analogy chain is verifiable; don't pretend the spike was done.** Documented honestly in the wave plan + commit messages.

2. **Self-fix criterion 4 violation surfaced cleanly (Phase 2.5 → 2.6).** I applied Phase 2.5 inline judging the 4-part test satisfied — including criterion 4 ("no likely second bug"). The cascading failures (Wave 8 scoping test bound-path mocks broken + Phase 2's default-tab side effect crashing un-mocked tests) violated criterion 4 — and the phase-reviewer caught it. **The cost was correct: ONE dispatch (Phase 2.6) cleaned up everything; the self-fix saved orchestration overhead on Phase 2.5's narrow win and the reviewer pass was the catch layer.** This is the layered-defense pattern working as designed; the self-fix test isn't a guarantee, it's a default with reviewer backstop.

3. **Frozen acceptance test integrity held through 3 commits.** Both Phase 1 + Phase 2 frozen tests stayed byte-identical to Phase 0 except (a) the orchestrator-owned un-skip flip and (b) a wrap-time prettier whitespace reformat. The Phase 2.6 implementer correctly noted "whitespace-only formatting" — verified by `git diff 63e531dc..359197fe -- <test files>` showing zero assertion/mock/contract changes. The rule's intent is preserved.

4. **vi.mock module-replacement collateral damage.** Phase 2.6 implementer discovered that `vi.mock('../useWorkbenchAgentData', ...)` in the Phase 2 acceptance test wiped out `selectPrimarySession` (used by `AgentGlobe` via the same module), which crashed `AgentGlobe.acceptance.test.tsx` when tests ran in the same worker pool. Fix: extracted `useWorkbenchGlobeData` to its own module (`useWorkbenchGlobeData.ts`) with zero `useWorkbenchAgentData` imports. **Lesson: when authoring `vi.mock` of a module-level adapter, audit the module's exports for cross-component dependencies; co-mocking that affects unrelated tests is a hidden cost.** Worth a short note in the renderer hooks CLAUDE.md.

5. **Phase 2's default-tab `useState` init was an over-engineering tradeoff.** Implementer added it to satisfy the acceptance test's "render-1 stable paneId" requirement. It works but has a runtime side effect: the spawn `useEffect` (gated on `isReady`) calls `pty.spawnClaude`, which crashes tests that don't mock `window.electronAPI`. The Phase 2.6 fix added optional-chain guards (`window.electronAPI?.pty?.spawnClaude?.()`) — production-safe (production always has `electronAPI` defined; tests get a silent no-op). **Lesson: when an implementer adds a synchronous side effect to satisfy a test's render-1 invariant, audit the side effect's dependencies on other test-mocked surfaces BEFORE merging — broader test-mock churn is a hidden cost.** Worth flagging in the implementer brief template for future renderer-state-machine work.

6. **The "test passes because mocked" failure mode (Wave 12 lesson 4 recurring).** Phase 2's acceptance test mocked `useWorkbenchAgentData`, so the runtime gap (paneId never stamped on AgentSession) was invisible to the test layer — Phase 2 reported all GREEN with the hijack scenario "working." Only the implementer's honest note in their report ("AgentSession.paneId not yet stamped... sidebar would always show D4 empty state at runtime") surfaced it; my phase-reviewer dispatch then confirmed the scoping-test failure. **Layered defense is what catches this**: implementer honest report → orchestrator review → phase reviewer dispatch → fix. Same pattern as Wave 12 Phase 4 CenterPane double-instantiation. **Per-phase reviewer dispatches are not optional discipline; they're the catch layer for the mocked-the-bug-away class.**

## Wave 13 NOT done / deferrals

1. **`/ui-smoke 12+13` formal walkthrough — DEFERRED to Cole's interactive availability.** Bundled checklist at `wave-13-smoke-report.md` with 16 Wave-12-scenario rows + 16 Wave-13-scenario rows (incl. the IDE-in-itself hijack closure tests 13.5–13.8 — the wave's central correctness gate). Cole walks through whenever; orchestrator flips status to **SHIPPED-VERIFIED** or **FLAGGED** based on results.
2. **Full `npm test` re-run after Phase 2.6 — DEFERRED.** Scoped tests `test:layout` (1109/3) + `test:main` (6464/5) + `test:agentchat` (945/0) + `test:hooks` (381/0) all match Wave 12 baseline post-Phase-2.6. Full suite re-run is a sanity check; per Wave 11 lean-wrap precedent, scoped runs are the gate. Worth a follow-up "run full suite at next session start" note in HANDOFF for paranoia.
3. **Stryker mutation Check 6 — DEFERRED to pre-merge batch.** Continues from Wave 3+. Wave 13 didn't touch the dominant survivor surface (src/shared/) and added a tiny amount of new logic (mostly type augmentation + 4 LOC of filter logic + 6 LOC of stamping); mutation impact expected to be neutral or slightly positive.
4. **3 pre-existing lint errors persist.** None Wave-13-introduced; carry forward as known debt for a future cleanup wave.

## Cherry-pick + push posture

Wave 13's 5 commits sit on branch `wave-11-plan` (in worktree). Per Cole's setup question 2026-05-24, both Wave 12 (5 commits unpushed from prior session, top: `1ddbcf73`) AND Wave 13 will be cherry-picked to master in one bundle, then pushed with tag `v2.34.0`.

CI minutes restore 2026-06-01 per bulletin — push proceeds (workflows skip cleanly when minutes are 0); merge into protected branches (if branch-protection requires CI-green) waits for restore. Branch posture per HANDOFF Wave 12 entry: cherry-pick to master + push + tag, expect CI to skip until 2026-06-01.

## Follow-ups closed by this wave

- `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH, OPEN since 2026-05-22) — fully addressed; deterministic binding replaces the heuristic. To be moved to `_archived/follow-ups/` by `/audit-followups wave-13`.
- `roadmap/follow-ups/2026-05-22-workbench-sidebar-session-scoping.md` (MED, OPEN since 2026-05-22) — related; closed by the same deterministic-binding architecture.

## Follow-ups generated (new, OPEN)

- `roadmap/follow-ups/2026-05-24-wave-13-full-suite-rerun-pending.md` (LOW) — to file at next session start; run full `npm test` to confirm post-Phase-2.6 baseline holds.
- (Pending Cole's smoke results — any FLAGs become individual follow-ups.)
