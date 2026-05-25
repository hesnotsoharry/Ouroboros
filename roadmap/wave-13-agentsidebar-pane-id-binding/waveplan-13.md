---
status: DRAFT
created: 2026-05-24
updated: 2026-05-24
---

# Wave 13 — AgentSidebar pane-ID binding (deterministic OUROBOROS_PANE_ID round-trip)

## Status

DRAFT · target v2.34.0 · drafted 2026-05-24.

## Context — why this wave exists

Wave 8 Phase 1 session-scoped the canon AgentSidebar by threading `claudeSessionId` into `useWorkbenchAgentData(claudeSessionId?)`. The scoping *logic* is correct and frozen-test-covered. But the **binding** that produces that `claudeSessionId` is a weak heuristic: `useWorkbenchClaudeCapture` (`src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts:169–191`) rebinds to the `session_id` of *any* binding-class agent event, regardless of which pty emitted it. Any external `claude` session — most centrally the **IDE-runs-in-itself** outer Claude session that Cole uses routinely — can hijack the bound id. The bound path bypasses the project-cwd fallback (by design), so the heuristic's no-binding rescue does not fire once the wrong session has latched. Full diagnosis: `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` (HIGH/OPEN since 2026-05-22).

Cole's architecture, confirmed 2026-05-24: inject `OUROBOROS_PANE_ID=<tab.id>` into the env when the IDE spawns a pty → claude inherits the env → claude's hook script subprocesses (`agent_start.mjs` / `agent_end.mjs`) read `process.env.OUROBOROS_PANE_ID` and forward it as `paneId` in the event payload → renderer filters events to `event.paneId === activeTab.id`. The renderer already has all the active-pane infrastructure: Wave 10 shipped `useActiveWorkbenchFrame` (`src/renderer/components/Workbench/useActiveWorkbenchFrame.tsx:24–62`) with a Wave 13 breadcrumb at line 9; Wave 12 shipped `useWorkbenchTabs` with `TabState.id === TabState.sessionId` set once at tab creation and never updated (`useWorkbenchTabs.ts:83–85`) — that stable `id` is the pane anchor. Env propagation feasibility is already validated in production: `OUROBOROS_HOOKS_TOKEN` / `OUROBOROS_HOOKS_ADDRESS` / `OUROBOROS_IDE_SESSION` all reach the hook scripts via the same `buildBaseEnv` → `pty.spawn(env: ...)` → claude-process-inheritance → hook-subprocess-inheritance chain (`src/main/ptyEnv.ts:53–74`).

Companion deletion: once paneId-binding ships, the `useWorkbenchClaudeCapture` heuristic is dead code. This wave removes it. The wave also closes a related follow-up (`2026-05-22-workbench-sidebar-session-scoping.md`) because the precise binding is what its diagnosis was deferring.

## Goal

After Wave 13, the canon Workbench's AgentSidebar binds deterministically to the active pane's claude session via `OUROBOROS_PANE_ID` round-trip (pty env → hook payload → renderer event filter), eliminating the heuristic capture path that any external or IDE-runs-in-itself claude session can hijack. The sidebar's NOW / Context / Files Touched / Hook Timeline / Latest Hunk panels reflect exactly the session running in the currently-focused upper-pane terminal tab, switching cleanly when Cole clicks a different tab or frame, and showing an explicit empty state when the active pane has no live claude session.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-13-agentsidebar-pane-id-binding/wave-13-decisions.md`.

1. **D1 — Reuse `TabState.id` as `OUROBOROS_PANE_ID` (no parallel field).** `TabState.id` is set once at tab creation via `makeTabId(frame, kind)` and persists across project switches, claude restarts, and the Wave 9 auto-resume path. `TabState.sessionId` is always equal to `id` (see `useWorkbenchTabs.ts:83–85`); adding a parallel `paneId` field would be ceremonial. No schema migration needed — existing persisted tabs already have a stable `id`. *(Cole delegated this decision to plan-time inspection on 2026-05-24; grounding confirms reuse is correct.)*
2. **D2 — Env-var name: `OUROBOROS_PANE_ID`.** Matches the existing `OUROBOROS_*` convention in `ptyEnv.ts` (`OUROBOROS_IDE_SESSION`, `OUROBOROS_HOOKS_TOKEN`, `OUROBOROS_HOOKS_ADDRESS`, `OUROBOROS_CHAT_SESSION`). *(Cole-confirmed 2026-05-24.)*
3. **D3 — Hook payload field name: `paneId` (camelCase).** Matches the `HookPayload` interface convention (`sessionId`, `parentSessionId`, `taskLabel`, `costUsd`, `ideSpawned`). The hook scripts read `process.env.OUROBOROS_PANE_ID` and emit `paneId: <value>` in the payload object.
4. **D4 — Fallback behavior when active pane has no `paneId`-tagged events. REQUIRES USER LOCK.** Recommended: **Option A — show explicit empty state ("No active session in this pane").** *(Industry-standard: deterministic-only, no heuristic fallback. The heuristic IS the bug.)* Emerging alternative: Option B — fall back to project-cwd filter (Wave 8 P1's no-binding rescue path). Option B is graceful but re-introduces a weaker version of the hijack (an external claude in the same project would appear). Option A is purer; Option B is friendlier when no IDE-spawned claude is running. **Recommended: A.** This decision controls the AgentSidebar's behavior in three cases: (1) Cole has no claude running in the active pane at all, (2) Cole runs an external claude in the active project (outside the IDE), (3) Cole's first-load before any tab spawn. A says all three → empty state. B says (1) empty / (2,3) project-fallback.
5. **D5 — Eliminate `useWorkbenchClaudeCapture` heuristic in same wave (no overlap window).** Recommended: remove it in Phase 2 alongside the new paneId-keyed binding. Keeping it as a fallback would re-enable the hijack the wave is trying to close. The heuristic has no other consumers per the grounding consumer list (`Workbench.tsx:215`, `CenterPane.tsx:192–195`, `AgentSidebar.tsx:121–125, 274–276`) — all five re-point to the paneId-derived binding. *(Cole authority: Cole approved the deletion-in-place pattern Wave 11/12 used for similar replacements.)*
6. **D6 — Wave 9 auto-resume path (`autoResumeCcTab`) also receives the env injection.** The renderer-side injection point is `spawnTab` in `useWorkbenchTabs.ts:51–56`, AND the auto-resume call at `useWorkbenchTabs.ts:59–72` which currently does not pass `env`. A `buildSpawnEnv(tabId)` helper that both call sites use closes the gap. Acceptance test must cover the restore path. *(Mechanical implementation invariant, surfaced by grounding risk 3.)*

## Scope

**In scope:**

- Add `OUROBOROS_PANE_ID=<tab.id>` injection at both pty spawn sites in the renderer (`useWorkbenchTabs.ts:spawnTab` AND `useWorkbenchTabs.ts:autoResumeCcTab`), via a shared `buildSpawnEnv(tabId)` helper.
- Extend `assets/hooks/agent_start.mjs` and `assets/hooks/agent_end.mjs` to read `process.env.OUROBOROS_PANE_ID` and emit a `paneId` field in the event payload.
- Extend `HookPayload` interface in `src/main/hooks.ts:54–87` with `paneId?: string`.
- Update the named-pipe payload→event mapping (`src/main/hooks.ts` or `hooksDispatchLogic.ts` — Phase 0 confirms exact site) to forward `paneId` to renderer events.
- Add `paneId` to the event object the renderer consumes (`AgentEventsContext` / `useAgentEvents` event shape).
- Refactor `useWorkbenchAgentData` to accept and filter by `paneId` (signature change from `claudeSessionId?` to `paneId?` OR additive; Phase 2 brief decides based on the consumer surface — recommendation: rename for clarity).
- Update all five `claudeSessionId` consumers (`AgentSidebar.tsx` header + body; `Workbench.tsx:215, 184, 137`; `CenterPane.tsx:192–195`) to derive the pane id from `useActiveWorkbenchFrame` + `useWorkbenchTabs` and pass it through.
- **Delete** `useWorkbenchClaudeCapture` from `useWorkbenchTerminals.ts:169–191` and its state plumbing (`claudeSessionId` useState in `Workbench.tsx:215`, `onClaudeSessionId` callback prop in `CenterPane.tsx`).
- Implement D4's chosen empty-state behavior in `AgentSidebar`.
- Orchestrator-owned acceptance tests per phase (Phase 1 boundary round-trip; Phase 2 IDE-in-itself hijack scenario).
- Wave-wrap gates per Wave 12 precedent (full suite + lint + tsc + `/review` + `/audit-followups` + `/promote-vendor-lessons` + `/ui-smoke 12+13`).

**Out of scope:**

- Forwarding the real `CLAUDE_SESSION_ID` from the pty spawn payload back through IPC. The follow-up's "proper fix" cites this; Wave 13 uses a *different* deterministic anchor (`OUROBOROS_PANE_ID` — our own value, not claude's) which closes the same hijack without needing claude-cooperation. Out of scope unless Phase 0 spike reveals env propagation doesn't work in some claude version (deferral path: file new follow-up).
- Legacy shell's `useClaudeSessionCapture` heuristic. The legacy shell is scheduled for Wave 15 teardown; fixing its heuristic mid-stream is wasted work. Deferral path: Wave 15 deletes the file outright.
- Multi-window pane-id collision handling. `tab.id` uses `Date.now() + random.toString(36).slice(2,8)` per `useWorkbenchTabs.ts:39–41` — globally unique by construction. No cross-window collision risk to mitigate.
- Stryker mutation-score tightening for Wave 13 surface. Joins the existing pre-merge batch task (Waves 3+ carry-forward) — same posture as Wave 12.
- AgentSidebar UX polish beyond the empty-state added by D4 (no new "No session" illustration, no "Spawn a session" CTA — text-only empty state).

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | Pre-flight audit, env propagation spike, `HookPayload` mock-site inventory, ADR write | `orchestrator` | (1) Read every `HookPayload` mock fixture in `src/main/**/*.test.ts` and renderer-side event mocks; produce a list to be additively updated in Phase 1. (2) **Env propagation spike:** temporarily add `console.log('[wave-13-spike] OUROBOROS_PANE_ID=', process.env.OUROBOROS_PANE_ID)` to `agent_start.mjs`, set a fake env var via a one-off pty spawn in dev, verify it lands. If it doesn't, halt — escalate to Cole before Phase 1 dispatch. (3) Author the ADR file with D1–D6 entries. (4) Write the Phase 1 acceptance test (RED) at `src/main/hooks.paneId.acceptance.test.ts` and the Phase 2 acceptance test (RED, with describe.skip) at `src/renderer/components/Workbench/AgentSidebar/paneIdBinding.acceptance.test.tsx`. Per `~/.claude/rules/orchestrator-owned-acceptance-tests.md`, orchestrator owns both. |
| 1 | Boundary: pty env injection + hook script payload + `HookPayload` interface | `sonnet-implementer` | **BOUNDARY PHASE.** Five edits: (a) `useWorkbenchTabs.ts` — add `buildSpawnEnv(tabId)` helper; thread through `spawnTab` AND `autoResumeCcTab`. (b) `agent_start.mjs` — read env, add `paneId` to payload. (c) `agent_end.mjs` — same. (d) `src/main/hooks.ts:HookPayload` — add `paneId?: string`. (e) `src/main/hooks.ts` payload-receive site — forward `paneId` from inbound payload to renderer event. Orchestrator un-skips Phase 1 acceptance test (RED→GREEN). Additively update HookPayload mock fixtures from Phase 0 inventory. `sonnet-phase-reviewer` PASS required on all 4 axes (file-change scope / spec alignment / integrity / runtime). |
| 2 | Renderer adoption: paneId-keyed binding + heuristic deletion + empty state | `sonnet-implementer` | **CONCEPTUALLY-RISKY PHASE** (the mental-model risk is "is the active-pane→tab.id derivation correct in every frame state including maximize and no-tabs-yet?"). Edits: (a) `useWorkbenchAgentData.ts` — accept `paneId?` param, filter event stream by `event.paneId === paneId`; implement D4 empty-state behavior. (b) `AgentSidebar.tsx` (header + body) — derive paneId from `useActiveWorkbenchFrame` → `useWorkbenchTabs(activeFrame)` → `activeTab.id`; pass to `useWorkbenchAgentData(paneId)`. (c) **Delete** `useWorkbenchClaudeCapture` in `useWorkbenchTerminals.ts`. (d) Delete `claudeSessionId` useState in `Workbench.tsx:215` and the `onClaudeSessionId` callback chain through `CenterPane.tsx`. (e) Update any test that mocked the old `useWorkbenchAgentData(claudeSessionId)` signature. Orchestrator un-skips Phase 2 acceptance test (RED→GREEN), including the IDE-in-itself hijack scenario (mock two events with different paneIds — only the active one's events reach the sidebar). `sonnet-phase-reviewer` PASS required. |
| 3 | Wave wrap | `orchestrator` | Full vitest suite + lint + tsc + tsc:web + `/review` mechanical (6 checks) + `/audit-followups wave-13` (expected: closes `2026-05-22-workbench-claudeSessionId-binding-precision.md` + `2026-05-22-workbench-sidebar-session-scoping.md`) + `/promote-vendor-lessons 13` (no-op expected) + `/ui-smoke 12+13` (Cole's deferred-Wave-12 + Wave-13 manual smoke per HANDOFF) + HANDOFF + temperature-log entry + ADR finalize + commit + cherry-pick Wave 12 + Wave 13 to master + push + tag v2.34.0 (CI minutes restore 2026-06-01 per bulletin — push proceeds, merge waits if branch-protection requires CI-green). |

### Phase ordering

Strict linear with one external dependency:

```
Phase 0 (orchestrator: audit + spike + ADR + acceptance tests RED)
   │
   │  GATE: spike GREEN (env propagates) — if RED, halt + escalate
   │
   ▼
Phase 1 (sonnet-implementer: boundary)
   │
   │  GATE: Phase 1 acceptance test GREEN, phase-reviewer PASS, scoped tests GREEN
   │
   ▼
Phase 2 (sonnet-implementer: renderer adoption + heuristic deletion)
   │
   │  GATE: Phase 2 acceptance test GREEN incl. hijack scenario, phase-reviewer PASS, scoped tests GREEN
   │
   ▼
Phase 3 (orchestrator: wave wrap)
```

No parallelizable phases — each strictly depends on its predecessor. Phase 0's spike is the load-bearing assumption-check that gates the entire wave; a Phase 0 RED spike is the only path to Cole mid-wave before Phase 1 dispatch.

## Risks

| Risk | Mitigation |
|---|---|
| **R1 — Hook script env propagation fails in some claude version** (claude strips non-allow-listed env, or runs hooks in a clean-env subprocess). | Phase 0 **spike** — temporarily log `process.env.OUROBOROS_PANE_ID` from `agent_start.mjs`, set a fake env via a one-off pty spawn, confirm value lands. If it doesn't, halt Phase 1 dispatch + escalate to Cole. Fallback paths if spike fails: (a) write paneId to a temp file the hook reads (filesystem channel instead of env), (b) defer wave + file follow-up to investigate claude version-specific behavior. |
| **R2 — `HookPayload` mock fixtures across the codebase don't include `paneId`, causing TS errors after the interface extension.** | Phase 0 inventory step — grep `HookPayload` + `(payload as HookPayload)` + `vi.mocked` of `hooks.*` across the repo; produce a list. Phase 1 implementer additively updates each fixture (`paneId` is optional so `undefined` is valid; no behavior change). |
| **R3 — Sidebar shows nothing when active pane is a plain shell tab (no claude) → looks broken.** | D4's explicit empty-state copy ("No active claude session in this pane") + visual treatment that reads as intentional, not as a missing-data bug. Verify in Phase 2's acceptance test. |
| **R4 — Active-pane derivation breaks in maximize mode (lower frame absent) or no-tabs-yet state.** | Phase 0 acceptance test for Phase 2 includes explicit cases: (a) maximize mode (lower frame unmounted, active=upper, paneId=upper-active-tab.id), (b) zero-tab state (active frame has no tabs → paneId undefined → D4 empty state). `useActiveWorkbenchFrame` default `'upper'` covers cold-start. |
| **R5 — Wave 9 auto-resume path (`autoResumeCcTab`) bypasses the env injection if Phase 1 only updates `spawnTab`.** | Mandatory `buildSpawnEnv(tabId)` helper used by BOTH call sites — Phase 1 acceptance test asserts both spawn paths set `OUROBOROS_PANE_ID` (mock both flows). Phase 1's diff review verifies the helper is the only spawn-env code path. |
| **R6 — Multi-window: same `tab.id` across two open Ouroboros windows triggers cross-window event leakage.** | `tab.id` uses `Date.now() + random.toString(36).slice(2,8)` (`useWorkbenchTabs.ts:39–41`) — collision probability is ~1 in 10^9 per second-window. Acceptance test asserts uniqueness across N=1000 calls in a tight loop. If collision concern resurfaces in real use, scope expansion is a 2-line patch (prepend window UUID). |
| **R7 — Test theater: Phase 2's acceptance test mocks `useWorkbenchTabs` and `useActiveWorkbenchFrame` separately, missing a real integration bug** (Wave 12 Phase 4 had this exact failure mode — CenterPane double-instantiation invisible to mocked-shell tests). | Phase 2 acceptance test MUST mount the full Workbench (not isolated sidebar) for the IDE-in-itself hijack scenario, exercising the real `ActiveFrameProvider` + `useWorkbenchTabs` plumbing. Use the Wave 12 Workbench.maximize / Workbench.activeProjectRemoval acceptance tests as exemplar shape. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | Audit + spike + ADR. The spike's env-propagation check IS a test, but ephemeral — gets reverted before Phase 1 dispatch. The Phase 1 and Phase 2 acceptance tests are AUTHORED in Phase 0 (orchestrator-owned, RED, frozen for the implementer). |
| 1 | 1 new unit test for `buildSpawnEnv(tabId)` helper (asserts returned env object has `OUROBOROS_PANE_ID` set to input id and preserves any other env). | 1 orchestrator-owned acceptance test at `src/main/hooks.paneId.acceptance.test.ts` — spawn a fake pty with `OUROBOROS_PANE_ID=test-pane-1`, post a hook event from a child process inheriting env, confirm `HookPayload.paneId === 'test-pane-1'`. Covers both `spawnTab` and `autoResumeCcTab` paths via mocked pty. Frozen. |
| 2 | Unit tests for `useWorkbenchAgentData(paneId)` filter logic (events match → returned; events don't match → filtered out; empty paneId → D4 empty state). | 1 orchestrator-owned acceptance test at `src/renderer/components/Workbench/AgentSidebar/paneIdBinding.acceptance.test.tsx` — mounts full Workbench, simulates two concurrent hook event streams with different `paneId`s (one matching activeFrame's activeTab.id, one not — the IDE-in-itself hijack scenario), asserts sidebar reflects only the active-pane events; flips activeFrame to lower, asserts D4 empty state. Frozen. PLUS update existing tests that mocked `useWorkbenchAgentData(claudeSessionId)` signature; PLUS regression test that `useWorkbenchClaudeCapture` deletion doesn't break Wave 9 auto-resume. |
| 3 | n/a | Full vitest suite (~11800 tests; pre-existing 5 failures from Wave 12 expected to persist). | + `/review` Check 6 mutation (joins pre-merge batch). |

## Acceptance criteria

- [ ] `assets/hooks/agent_start.mjs` reads `process.env.OUROBOROS_PANE_ID` and emits `paneId: <value>` in the event payload object.
- [ ] `assets/hooks/agent_end.mjs` does the same.
- [ ] `src/main/hooks.ts:HookPayload` interface includes `paneId?: string`.
- [ ] `src/main/hooks.ts` payload-receive site forwards `paneId` to the renderer event object.
- [ ] `src/renderer/components/Workbench/Terminals/useWorkbenchTabs.ts` exports a `buildSpawnEnv(tabId)` helper (or equivalent named function) that returns `{ OUROBOROS_PANE_ID: tabId, ...otherEnv }`.
- [ ] `spawnTab(id, kind, cwd)` in `useWorkbenchTabs.ts` calls `pty.spawn` / `pty.spawnClaude` with `{ env: buildSpawnEnv(id) }`.
- [ ] `autoResumeCcTab` path in `useWorkbenchTabs.ts:59–72` calls `pty.spawnClaude` with `{ env: buildSpawnEnv(tab.id) }`.
- [ ] `src/renderer/components/Workbench/useWorkbenchAgentData.ts` signature accepts a `paneId?: string | null` parameter and filters events by `event.paneId === paneId`.
- [ ] `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.tsx` derives paneId from `useActiveWorkbenchFrame()` + `useWorkbenchTabs(activeFrame)` and passes to `useWorkbenchAgentData`.
- [ ] `useWorkbenchClaudeCapture` (lines 169–191 of `useWorkbenchTerminals.ts`) is **removed**, AND the `claudeSessionId` useState in `Workbench.tsx:215`, AND the `onClaudeSessionId` callback prop in `CenterPane.tsx`.
- [ ] D4's empty-state ("No active claude session in this pane" or Cole-locked alternative) renders when active pane has no `paneId`-tagged events in the stream.
- [ ] Orchestrator-owned Phase 1 acceptance test (`hooks.paneId.acceptance.test.ts`) passes — env→hook→event paneId round-trip verified for both spawnTab and autoResumeCcTab paths.
- [ ] Orchestrator-owned Phase 2 acceptance test (`paneIdBinding.acceptance.test.tsx`) passes — IDE-in-itself hijack scenario does NOT pollute the sidebar; maximize-mode case; empty-state case.
- [ ] `npx tsc --noEmit` clean.
- [ ] `npx tsc -p tsconfig.web.json --noEmit` clean (catches renderer→main type-coupling per the recurring lesson).
- [ ] `npm run lint` clean (0 errors; existing warnings only).
- [ ] `npm run format:check` clean on wave-touched files.
- [ ] Scoped vitest scripts green: `test:layout`, `test:main`, `test:hooks`, `test:preload`.
- [ ] `/review` mechanical Gates 1–5 PASS; Check 6 mutation joins pre-merge batch (no regression vs. Wave 12's 31.72%).
- [ ] `/audit-followups wave-13-agentsidebar-pane-id-binding` closes both `2026-05-22-workbench-claudeSessionId-binding-precision.md` and `2026-05-22-workbench-sidebar-session-scoping.md` (auto-moved to `_archived/follow-ups/`).
- [ ] `/promote-vendor-lessons 13` runs (expected no-op — no vendor SDK touched).
- [ ] `/ui-smoke 12+13` walkthrough completes with Cole; report status PASS-MANUAL or FLAGGED with explicit findings.
- [ ] HANDOFF.md top entry updated with Wave 13 SHIPPED summary.
- [ ] `roadmap/wave-temperature-log.md` appended with Wave 13 entry per template.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | `Internal — no observation point` | n/a | Audit + ADR + RED-test authorship is pre-implementation infrastructure. The env-propagation spike's success is the gate condition, not a user observation; its `console.log` is reverted before Phase 1 dispatch. |
| 1 | `Internal — no observation point` | n/a | Boundary plumbing with no direct UI consequence — the heuristic still binds the sidebar in Phase 1's state; the paneId field rides quietly through pty env → claude env → hook subprocess env → named-pipe payload → renderer event object, with no consumer reading it yet. Phase 2 is the visible consumer. The Phase 1 acceptance test confirms the round-trip programmatically. |
| 2 | The running `npm run dev` Electron Workbench with `layout.canonWorkbench` enabled, Cole watching the right-hand AgentSidebar | Cole runs `claude` in workbench upper-pane terminal tab A → pty spawn injects `OUROBOROS_PANE_ID=<tab-A.id>` → claude inherits env → claude spawns `agent_start.mjs` hook subprocess inheriting env → hook reads `process.env.OUROBOROS_PANE_ID` → payload `paneId=<tab-A.id>` sent over named pipe → `src/main/hooks.ts` receives → forwards `paneId` to renderer event object → `AgentEventsProvider` stores event with `.paneId` → `AgentSidebar` reads `useActiveWorkbenchFrame.activeFrame='upper'` → `useWorkbenchTabs('upper').activeTab.id` = `<tab-A.id>` → `useWorkbenchAgentData(<tab-A.id>)` filters event stream by `event.paneId === '<tab-A.id>'` → returns the matching session → NOW/Context/Files Touched panels render its tool activity | The AgentSidebar's NOW panel shows what the upper-pane claude is doing right now (e.g., "Editing useWorkbenchTabs.ts" if claude is mid-Edit), Context shows its real token count, Files Touched lists the files claude has read/written this turn. When Cole runs a SECOND claude session in an external terminal (or the IDE-in-itself outer claude is active), that session's tool activity does NOT appear in the sidebar — the panel keeps showing only the upper-pane session. When Cole clicks a different upper-pane tab (different `tab.id`), the sidebar swaps to that tab's claude session. When Cole switches active frame to lower (`onMouseDown` on lower terminal) and lower has no claude tab, the sidebar shows the D4 empty state copy. |
| 3 | The running Workbench in `npm run dev` with Cole walking each scenario in `/ui-smoke 12+13` live | Orchestrator runs `/ui-smoke 12+13` → generates manual smoke checklist (Wave 12 deferred surfaces + Wave 13 scenarios: IDE-in-itself hijack, multi-pane switching, empty-state, maximize mode, restore-via-auto-resume) → hands to Cole → Cole boots `npm run dev` with canon flag enabled → Cole drives each scenario in the live app → Cole observes the AgentSidebar / terminal tabs / project rail respond per spec → Cole reports per-scenario findings back → orchestrator records verdicts in `wave-13-smoke-report.md` | For each scenario, Cole sees the documented expected behavior in the live app (e.g., for "IDE-in-itself hijack": sidebar stays pinned to upper-pane session even while outer claude runs Edit/Bash; for "empty-state": sidebar shows "No active claude session in this pane" copy when lower pane is focused without a claude tab); if any scenario fails, the report names exactly what Cole observed instead (e.g., "sidebar still showed outer-claude's NOW panel"). |

### Data-shape probes

```bash
# After Phase 1, in the dev-built app with a freshly-spawned upper-pane claude:
# - Inspect the renderer's hook event log (via DevTools console) for the latest agent_start event:
#   it should carry a `paneId` field equal to the active upper-pane tab.id
#   (NB: requires Phase 0 spike to have verified env propagation first)

# After Phase 2, programmatic confirmation that the heuristic is gone:
$ grep -r "useWorkbenchClaudeCapture" src/
# Expected: 0 hits (only the deleted file's git-history will reference it)

$ grep -r "claudeSessionId" src/renderer/components/Workbench/
# Expected: 0 hits OR only references in deprecated/test-helper files (Phase 2 brief must enumerate which)
```

```typescript
// Phase 1 unit-test shape probe — buildSpawnEnv contract:
expect(buildSpawnEnv('wb-upper-cc-1234-abc')).toEqual({
  OUROBOROS_PANE_ID: 'wb-upper-cc-1234-abc',
});
expect(buildSpawnEnv('')).toEqual({
  OUROBOROS_PANE_ID: '',
}); // empty-string edge: still injected, downstream filter handles
```

## Files the next agent should read first

1. `roadmap/wave-13-agentsidebar-pane-id-binding/wave-13-decisions.md` — ADR with D1–D6 entries; the locked decisions this wave is built on.
2. `roadmap/wave-12-terminal-and-project-crud-chrome/waveplan-12.md` — Wave 12's Phases table, Verification table, and Dispatch checklist as the shape exemplar (Wave 13 mirrors its structure).
3. `roadmap/wave-12-terminal-and-project-crud-chrome/wave-12-result.md` — Wave 12 lessons load-bearing for Wave 13: split-dispatch pattern for boundary phases, test-mocks-the-bug-away failure mode (Phase 2 acceptance test design directly counters this), commit-discipline gap on orchestrator-owned tests.
4. `roadmap/follow-ups/2026-05-22-workbench-claudeSessionId-binding-precision.md` — the HIGH/OPEN follow-up this wave closes; full root-cause diagnosis and the proper-fix path Wave 13 takes.
5. `roadmap/follow-ups/2026-05-22-workbench-sidebar-session-scoping.md` — the related follow-up (Wave-99-era diagnosis) also closed by this wave.
6. `src/main/ptyEnv.ts` — the env injection chain (`buildBaseEnv` at lines 53–74; `buildShellEnv` at 140–146). Wave 13 doesn't modify this file; reads it to confirm `extraEnv` parameter is the injection vehicle.
7. `src/main/ptySpawn.ts` — the Claude spawn path (`spawnClaudePty` at 43–75; `buildClaudeLaunchArgs` Windows branch at 34–40). Wave 13 doesn't modify this file; reads to confirm env path.
8. `src/main/pty.ts` — the plain shell spawn path (lines 193–221). Confirms env path.
9. `src/main/hooks.ts` — `HookPayload` interface at 54–87 (Wave 13 adds `paneId?`); payload-receive site (Wave 13 forwards `paneId` to renderer event).
10. `assets/hooks/agent_start.mjs` and `assets/hooks/agent_end.mjs` — the two hook scripts Wave 13 extends.
11. `src/renderer/components/Workbench/Terminals/useWorkbenchTabs.ts` — `TabState` type (17–23), `buildNewTab` (83–85, the `id`/`sessionId` invariant), `spawnTab` (51–56), `autoResumeCcTab` (59–72).
12. `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts` — `useWorkbenchClaudeCapture` at 169–191 (Wave 13 deletes); `makeUpperId`/`makeLowerId` at 47–52.
13. `src/renderer/components/Workbench/useWorkbenchAgentData.ts` — current `useWorkbenchAgentData(claudeSessionId?)` signature; Wave 13 rewires.
14. `src/renderer/components/Workbench/useActiveWorkbenchFrame.tsx` — `ActiveFrameProvider` at 24–62 (already Wave-13-prepped per line 9 breadcrumb).
15. `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.tsx` — header at 121–125 and body at 274–276 (the two `useWorkbenchAgentData` consumers Wave 13 re-points).
16. `src/renderer/components/Workbench/Workbench.tsx` — `claudeSessionId` useState at 215 and props threading at 137/184 (Wave 13 deletes).
17. `~/.claude/rules/orchestrator-owned-acceptance-tests.md` — the rule governing Phase 0's authorship of the Phase 1 and Phase 2 acceptance tests; constraint that the implementer cannot modify those tests.

## Note to the implementer

Wave 13 is a precision wave: it closes one long-standing HIGH follow-up by replacing a heuristic that has been documented-but-tolerated since Wave 8. The spirit is **deterministic round-trip** — `OUROBOROS_PANE_ID` flows from the renderer's tab creation through the pty env, into claude's process env, into the hook subprocess env, into the hook payload, into the renderer event, back to the renderer's filter. Every link is mechanical; the only design questions are at the seams (D1, D3, D4) and those are locked in the ADR.

The temptations to resist: (1) **leaving `useWorkbenchClaudeCapture` as a fallback** "for safety" — the heuristic IS the bug; keeping it as fallback re-enables the hijack the wave exists to close. D5 locks deletion in the same wave. (2) **adding a parallel `paneId` field to `TabState`** — Cole delegated this decision; grounding confirms reuse is correct (D1). Adding a parallel field is ceremonial churn. (3) **expanding scope to fix legacy shell's `useClaudeSessionCapture`** — that lives in code scheduled for Wave 15 deletion; fixing it now is wasted work. (4) **isolating Phase 2's acceptance test to the sidebar component** — Wave 12 Phase 4's CenterPane double-instantiation bug was invisible to isolated-mount tests; the IDE-in-itself hijack scenario MUST mount the full Workbench with real providers (R7 in the Risks table).

The Phase 0 spike is load-bearing. If `process.env.OUROBOROS_PANE_ID` does not land inside `agent_start.mjs` in the dev-built app, the entire architecture is wrong and the wave must halt — there is no fix in Phase 1 that recovers from that. The spike is 5 minutes of work; do it before dispatching Phase 1.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

When a phase's gate is green and nothing Tier 3 surfaced, the orchestrator dispatches the next phase in the same turn — it does not end the turn to summarize or ask. The turn ends between phases only for a Tier 3 discovery needing a user call, a genuine user-judgment decision, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists.** Confirm `roadmap/wave-13-agentsidebar-pane-id-binding/wave-13-decisions.md` contains entries for D1–D6 (D4 locked by Cole's selection). If absent, author it from this plan's "Locked decisions" section before any other step.
2. **Phase 0 — orchestrator runs the audit + spike + acceptance-test authorship.**
   - (a) Grep `HookPayload` across the repo; produce a list of mock-fixture sites Phase 1 will additively update.
   - (b) Env-propagation spike: temporarily add `console.log('[wave-13-spike] env paneId:', process.env.OUROBOROS_PANE_ID)` to `assets/hooks/agent_start.mjs`. In a dev session, run `npm run dev` → enable canon workbench flag → spawn a tab → run `claude` → verify the log line shows `wb-upper-cc-...`. Revert the `console.log` before continuing. **If the spike RED**, halt + escalate to Cole.
   - (c) Author the Phase 1 acceptance test at `src/main/hooks.paneId.acceptance.test.ts` (with `describe.skip` for CI hygiene per orchestrator-owned-acceptance-tests rule); run it; confirm RED for the right reason.
   - (d) Author the Phase 2 acceptance test at `src/renderer/components/Workbench/AgentSidebar/paneIdBinding.acceptance.test.tsx` (with `describe.skip`); run; confirm RED for the right reason.
   - **Gate to advance:** spike GREEN, both acceptance test files committed (RED, skipped), ADR finalized.
3. **Phase 1 — dispatch `sonnet-implementer` with the boundary brief.**
   - Brief includes: the five edit sites; the path to the acceptance test; the constraint "you may not modify the acceptance test; un-skip and make pass"; the HookPayload mock-fixture inventory from Phase 0.
   - Orchestrator un-skips `hooks.paneId.acceptance.test.ts` (`describe.skip` → `describe`) BEFORE dispatch; commit the un-skip as part of the Phase 1 commit (per `~/.claude/rules/orchestrator-owned-acceptance-tests.md` step 3).
   - **Gate to advance:** Phase 1 acceptance test GREEN, `sonnet-phase-reviewer` PASS all 4 axes (file-change scope / spec alignment / integrity / runtime — boundary phase so reviewer is mandatory), scoped tests GREEN (`test:main`, `test:hooks`, `test:layout`, `test:preload`), tsc clean.
4. **Phase 2 — dispatch `sonnet-implementer` with the renderer-adoption brief.**
   - Brief includes: the five edit areas; the path to the Phase 2 acceptance test; the constraint "you may not modify the acceptance test; un-skip and make pass"; D4's locked empty-state copy; the explicit instruction to delete `useWorkbenchClaudeCapture` and the `claudeSessionId` callback chain (D5).
   - Orchestrator un-skips `paneIdBinding.acceptance.test.tsx` BEFORE dispatch; commit the un-skip as part of the Phase 2 commit.
   - **Gate to advance:** Phase 2 acceptance test GREEN incl. IDE-in-itself hijack + maximize + empty-state cases, `sonnet-phase-reviewer` PASS all 4 axes, scoped tests GREEN, tsc + tsc:web clean, eslint 0 errors.
5. **Phase 3 — orchestrator runs wave wrap gates.**
   - Full vitest suite (`npm test` — ~17 min Windows-local; pre-existing 5 Wave 12 failures expected to persist; no Wave 13 regressions).
   - `eslint src/` 0 errors.
   - `tsc --noEmit` clean.
   - `tsc -p tsconfig.web.json --noEmit` clean (catches renderer→main type-coupling).
   - `prettier --check` clean on wave-touched files.
   - `/review` mechanical — Checks 1–5 PASS; Check 6 mutation joins pre-merge batch.
   - `/audit-followups wave-13-agentsidebar-pane-id-binding` — expected to close both targeted follow-ups; verify auto-archive.
   - `/promote-vendor-lessons 13` — no-op expected.
   - `/ui-smoke 12+13` — generate manual smoke checklist covering Wave 12 deferred surfaces (per HANDOFF) and Wave 13 scenarios (IDE-in-itself hijack, multi-pane switching, empty-state, maximize, restore-via-auto-resume); hand off to Cole for live walkthrough.
   - Update `roadmap/HANDOFF.md` top entry with Wave 13 SHIPPED summary.
   - Append `roadmap/wave-temperature-log.md` entry.
   - Author `roadmap/wave-13-agentsidebar-pane-id-binding/wave-13-result.md`.
   - Commit wrap. Cherry-pick the Wave 12 + Wave 13 commits to master. Push. Tag `v2.34.0`. (CI minutes restore 2026-06-01 per bulletin — push proceeds; merge into protected branches waits for CI-green if branch-protection requires.)
