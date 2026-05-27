---
status: SHIPPED
created: 2026-05-21
updated: 2026-05-22
wave: 4
slug: workbench-agent-sidebar-live
---

# Wave 4 — Agent Sidebar Live (5 panel bodies)

## Status

DRAFT · target v2.25.0 (minor — net-new live capability inside the experimental, default-off canon shell) · drafted 2026-05-21.

## Context — why this wave exists

Wave 1 (`v2.22.0`) built the canon workbench's agent sidebar as five **panel shells** with mock prop
defaults (`Workbench/AgentSidebar/{NowBlock,ContextBlock,FilesTouched,LatestHunk,HookTimeline}.tsx`).
Wave 3 (`v2.24.0`) made the surrounding chrome live — Agent Globe, inner-rail sessions, sidebar
**header**, status bar — via the `useWorkbenchAgentData` adapter, and deliberately **left the five panel
bodies on mock** (ADR D5) because the two hardest data sources weren't yet sourced. This wave closes that
gap: the five panel **bodies** become live, extending the **same** adapter (Wave-3 ADR D3 — no competing
adapter).

The two sub-problems HANDOFF flagged for plan-time are both **half-built already** (recon §0):
- **Latest Hunk** — the structured-diff pipeline exists since Wave 94: `hooksDiffReview.ts` emits a
  synthetic `diff_review_ready` event `{ snapshotHash, projectRoot, filePaths[] }` on every Edit/Write
  (`hooksDiffReview.ts:125–133`), and `git:diffReview` + `gitDiffParser.ts` already return structured
  `ParsedFileDiff[] → ParsedHunk[]` (`gitDiffParser.ts:7–23`). The gap is only that `diff_review_ready`
  isn't yet routed into the workbench adapter. **No new git op, no PostToolUse extension.**
- **Files Touched** — pure renderer derivation from `AgentSession.toolCalls` (Edit/Write/Read,
  `AgentMonitor/types.ts:88–98`), already in `AgentEventsContext`. The only gap (the `+N/−N` badges) is
  filled from the *same* `ParsedFileDiff` Latest Hunk fetches.

This is **not a new architectural surface** — every pipeline already exists and already feeds other
consumers (`useDiffReviewTrigger`, the legacy AgentMonitor). The work is derivation + wiring + one event
subscription. Renderer-only; no main-process, IPC-contract, or config-schema change.

## Goal

After Wave 4, flipping `layout.canonWorkbench` on renders an agent sidebar whose five panels show **real
runtime data** instead of mock constants: NOW shows the active tool/target/elapsed; Context shows the live
token/cost/model already produced by the Wave-3 adapter; Files Touched lists the files the active session
has read/edited (with `+N/−N` badges when the diff pipeline is on); Latest Hunk shows the structured diff
of the most recent Edit; and Hook Timeline shows the merged tool-call + prompt event stream. The diff-backed
surfaces degrade gracefully to empty/badge-free when `enableTerminalDiffReview` is off. With the flag off,
every existing shell renders byte-identically to before, and the canonical `AgentStatus` + `AgentSession`
shapes are untouched.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-4-workbench-agent-sidebar-live/wave-4-decisions.md`.

1. **Extend the SAME `useWorkbenchAgentData` adapter — no competing adapter** (inherits Wave-3 D3). The
   five panel-body derivations and the `diff_review_ready` subscription live in/under this hook. RESOLVED.
2. **Latest Hunk diff source = REUSE the Wave-94 pipeline**, not a new git op or a PostToolUse extension:
   subscribe to `diff_review_ready` in a panel-local effect, fetch via the existing `git:diffReview` IPC,
   map `ParsedFileDiff → ParsedHunk → MockDiffHunk`. RESOLVED — planner's call (recon §4).
3. **Latest Hunk state is ephemeral panel-local ref** — NOT on `AgentSession`, no reducer change, no SQLite
   schema/migration. Lost on reload (correct for a "current activity" panel). RESOLVED — planner's call.
4. **Files Touched list from `toolCalls`; `+N/−N` badges from the shared `ParsedFileDiff`.** The list is the
   primary; badges are decorative and degrade out when no diff is available. RESOLVED — planner's call.
5. **Diff gating = piggyback on the existing `enableTerminalDiffReview` flag; degrade gracefully when off**
   (Latest Hunk empty/placeholder, badges dropped, Files-Touched list still renders from `toolCalls`). No
   new flag, no auto-enable coupling to `layout.canonWorkbench`. **(Cole-locked, 2026-05-21.)**
6. **Hook Timeline: drop the `think` variant** (no wire source); map `tool → ToolCallEvent`,
   `prompt → ConversationTurn`. RESOLVED — planner's call (recon §6).
7. **Wire the existing Wave-1 panel shells; do NOT remount AgentMonitor rich components.** "Re-layout" is
   satisfied by the Wave-1 shells; importing `ToolCallTimeline`/`AgentCard`/etc. would drag in the
   ~48-file AgentMonitor coupling (same blast-radius D1 avoided). Extend a shell's own markup if too thin.
   RESOLVED — planner's call.
8. **The `MockXxx` interfaces remain the adapter's typed output contract; only the `MOCK_*` data constants
   are swept** once no panel imports them (mirrors Wave-3 D7). RESOLVED.

## Scope

**In scope:**
- Extend `Workbench/useWorkbenchAgentData.ts` with: a touched-files derivation from `AgentSession.toolCalls`
  (Edit/Write/Read → `{ path, status }`, ellipsis-tolerant dedup); a Hook-Timeline derivation merging
  `toolCalls` + `conversationTurns` (drop `think`); a panel-local `diff_review_ready` subscription that
  fetches `git:diffReview` and exposes the latest `ParsedFileDiff[]` (→ hunks + per-file adds/dels) as an
  ephemeral ref.
- Wire all five `Workbench/AgentSidebar/*` panel components from the adapter (replace mock prop defaults):
  `NowBlock`, `ContextBlock`, `FilesTouched` (list + optional badges), `LatestHunk`, `HookTimeline`.
- Graceful-degrade behavior for the diff-backed surfaces when `enableTerminalDiffReview` is off.
- Orchestrator-owned acceptance test for the diff-subscription→fetch→render contract (Phase 3, boundary).
  Derivation unit tests (touched-files dedup, timeline merge) + render/integration tests per the table.
- Sweep the now-orphaned sidebar `MOCK_*` data constants in `workbenchMockData.sidebar.ts` (keep the
  `MockXxx` types as the output contract); dead-export-audit clean.
- Update `Workbench/CLAUDE.md` (Wave 4 line: panels live; ephemeral diff ref; Decisions 1–8) + the gotcha
  about the 80-char truncated `toolCall.input` path.

**Out of scope:**
- Mutating `AgentStatus` / `AgentSession` / touching `AgentMonitor/**` consumers → not this wave (Wave-3 D1).
- Adding a `latestHunk` field to `AgentSession` / any SQLite schema change → D3 (ephemeral ref instead).
- Forwarding the full (untruncated) `file_path` over IPC for Files Touched → out of scope (dedup defensively
  in the renderer; recon §3). File a follow-up only if dedup proves insufficient in smoke.
- A new git op for diff/delta, or extending the PostToolUse payload to carry diffs → D2 (reuse the existing
  pipeline).
- A new config flag or auto-enabling the diff pipeline with the canon flag → D5 (piggyback + degrade).
- Live `+adds/−dels` *git-status* counts in the status bar / per-project dirty → separate OPEN follow-up
  `2026-05-21-workbench-live-git-diff-stats.md` (needs a new main-process git op; not this wave).
- Permission overlay / sidebar takeover re-skin → Wave 5. Theme treatment / responsive collapse → Wave 6.
  Cutover / deleting legacy shells → Wave 7.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-4-decisions.md`, Decisions 1–8 (Decision 2 carries the best-practice spectrum per `~/.claude/rules/best-practice-spectrum.md`: reuse-existing-pipeline vs new-git-op vs extend-PostToolUse). Gate to 1. |
| 1 | NOW + Context panels live (lowest-risk wiring) | sonnet-implementer | Pure adapter-field wiring — the data already exists. Wire `NowBlock` from adapter `activeTool`/`target`/`elapsedSec`; wire `ContextBlock` from adapter `contextStats` + `elapsedSec` (live since Wave 3, just unwired — recon §5). `progress`/`description` have no live source → indeterminate/`target` defaults; do NOT invent a progress signal. No new derivation, no IPC. Render tests; no acceptance test (no novel contract). |
| 2 | Files Touched **list** + Hook Timeline live (toolCalls/turns derivation, no IPC) | sonnet-implementer | Extend the adapter with two pure derivations: (a) touched-files from `AgentSession.toolCalls` filtered to Edit/Write/Read → `{ path, status: editing\|edited\|read }`, **ellipsis-tolerant dedup** (recon §3 — `input` is an 80-char truncated path); (b) Hook-Timeline merge of `toolCalls` + `conversationTurns` sorted by timestamp, **`think` variant dropped** (D6, no wire source). Wire `FilesTouched` (list only — no badges yet) + `HookTimeline`. **Conceptually-risky phase** (dedup correctness + the drop-`think` mapping are where a wrong mental model hides) → gets a `sonnet-phase-reviewer` pass. Orchestrator-owned derivation unit tests (dedup with a >80-char colliding-path fixture; timeline merge ordering). |
| 3 | Latest Hunk + Files Touched **badges** (diff-backed; **boundary phase**) | sonnet-implementer | **Boundary phase — orchestrator authors the failing acceptance test first; subagent may not modify it.** Add a panel-local effect in `useWorkbenchAgentData` that subscribes to `diff_review_ready` `{ snapshotHash, projectRoot, filePaths[] }` (recon §4), fetches via the existing `git:diffReview` IPC, maps `ParsedFileDiff → ParsedHunk → MockDiffHunk`, stores as an **ephemeral ref** (D3 — no `AgentSession`/SQLite change). Wire `LatestHunk` from it; enrich `FilesTouched` rows with per-file `adds`/`dels` badges from the same `ParsedFileDiff`. **Graceful degrade when `enableTerminalDiffReview` is off** (D5): empty Latest Hunk, no badges, list intact. Acceptance test expresses the event→fetch→`ParsedHunk`→render contract incl. the flag-off no-data path + the 60s-TTL-evicted no-snapshot path. Gets a `sonnet-phase-reviewer` pass (the IPC-consumption + ephemeral-ref lifecycle is the conceptual risk). |
| 4 | Mock sweep + wave wrap | orchestrator | Delete the orphaned sidebar `MOCK_*` data constants in `workbenchMockData.sidebar.ts` (keep `MockXxx` types — D8); confirm `MOCK_CONTEXT_STATS` isn't still referenced by `AgentGlobe` before deleting; dead-export audit clean. `test:layout` + `test:renderer`, full lint + typecheck + prettier, orchestrator full-wave diff review, `/review` mechanical gap-check (Check 6 if stryker). Update `Workbench/CLAUDE.md` + `wave-4-result.md` + `CHANGELOG [2.25.0]`. `/ui-smoke 4` (UI-bearing; live smoke deferred per Wave 0–3 posture — Cole not using the app until the remake is done — written + queued for next dev session). Local `git tag v2.25.0` (push per bulletin; merges wait for CI minutes). HANDOFF flip. `/promote-vendor-lessons 4` (likely no-op — no vendor SDK). `/audit-followups wave-4-workbench-agent-sidebar-live`. |

### Phase ordering

```
Phase 0 (ADR)
   |
   v
Phase 1 (NOW + Context)  ← lowest risk; establishes the wiring pattern panel→adapter prop
   |
   v
Phase 2 (Files Touched LIST + Hook Timeline)  ← adds the two toolCalls/turns derivations to the adapter
   |
   v
Phase 3 (Latest Hunk + Files Touched BADGES)  ← boundary; depends on Phase 2's FilesTouched list (badges enrich the existing rows)
   |
   v
Phase 4 (mock sweep + wrap)
```

Strictly sequential. Phase 1 is independent (data exists) but ordered first as the lowest-risk pattern
setter. Phase 3 **depends on Phase 2** — the `+N/−N` badges enrich the Files-Touched rows Phase 2 ships, so
the list must exist before badges attach; Latest Hunk itself is independent of Phase 2 but shares the diff
fetch with the badges, so they co-locate in Phase 3. Phase 4's sweep runs last so it catches every constant
orphaned by Phases 1–3.

## Risks

| Risk | Mitigation |
|---|---|
| `ToolCallEvent.input` is an 80-char truncated path summary (`useAgentEvents.payload.ts:301`) → deep paths collide on dedup, Files Touched shows wrong/merged rows | Phase 2 brief: dedup on an ellipsis-tolerant key (last-N path segments / suffix match), NOT raw-string equality. Unit test ships a >80-char colliding-path fixture. Do NOT add IPC to forward the full path (out of scope). |
| `diff_review_ready` is gated on `enableTerminalDiffReview`; if off, Latest Hunk + badges have no data | D5 + Phase 3 brief: graceful degrade — empty Latest Hunk placeholder, badges dropped, Files-Touched list still renders from `toolCalls`. Acceptance test asserts the flag-off no-data path explicitly. |
| 60s stash TTL in `hooksDiffReview.ts:19` evicts the pre-snapshot for slow Edits → `diff_review_ready` fires with no usable diff | Phase 3 handles a missing/empty `ParsedFileDiff` as the empty state (same path as flag-off). Acceptance test covers the no-snapshot branch. Don't crash; don't retry. |
| Implementer remounts AgentMonitor rich components into the panel shells, dragging in the ~48-file subsystem coupling | D7 + Note + Phase-2/3 phase-reviewer: panels render adapter data with the Wave-1 shell markup; reviewer flags any new `AgentMonitor/**` import inside `Workbench/AgentSidebar/`. |
| Latest Hunk state added to `AgentSession` would force a SQLite schema migration + ripple to ~48 consumers | D3: ephemeral panel-local ref only. Reviewer checks the diff doesn't touch `AgentSession`/`useAgentEvents.helpers.ts` reducer or `types.ts`. |
| `diff_review_ready` subscription double-fires / leaks (StrictMode, multiple panel mounts) | Phase 3 brief: single subscription owned by the adapter (one consumer), cleanup on unmount; StrictMode-safe (same discipline as Wave 2's `useWorkbenchTerminals`). Reviewer checks subscribe/unsubscribe symmetry. |
| Mock-sweep removes `MOCK_CONTEXT_STATS` still imported by `AgentGlobe` (Wave 3) → broken build | Phase 4 runs the dead-export audit + `tsc`/`eslint`; only removes symbols with **zero** remaining importers; explicitly checks `AgentGlobe` first (recon §7). |
| Flag-off regression — a panel wiring leaks into the legacy AgentMonitor shell | Render test asserts flag-off renders the existing shells byte-unchanged; all edits inside `Workbench/**` (gated by `layout.canonWorkbench`). |
| Hook Timeline `output`/`input` truncation (10KB / 80 char) makes events look empty | D6 + Phase 2 brief: the timeline renders tool name + status + timestamp + the truncated summary as-is; do NOT parse `output` for structured fields (recon §6). |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | NOW field mapping (activeTool/target/elapsed → panel props); Context stat formatting. | Render: `NowBlock` + `ContextBlock` show adapter data from a synthetic session; flag-off renders legacy shell unchanged. | Trophy. `test:layout`. |
| 2 | Touched-files derivation incl. **>80-char colliding-path dedup**; status mapping (editing/edited/read); timeline merge ordering + `think`-dropped. | Render: `FilesTouched` lists the touched files with correct status dots; `HookTimeline` shows merged tool+prompt events in order. | Honeycomb (derivation is the failure surface) + Trophy (render). `test:layout`/`test:renderer`. |
| 3 | `ParsedFileDiff → MockDiffHunk` mapping; per-file adds/dels extraction for badges. | **Orchestrator-owned acceptance test** (honeycomb — the event→fetch→render seam): synthetic `diff_review_ready` event → mocked `git:diffReview` returning `ParsedFileDiff[]` → assert `LatestHunk` renders the hunk lines AND `FilesTouched` rows show `+N/−N`; assert the **flag-off / no-snapshot** path renders empty Latest Hunk + badge-free list. | Honeycomb — the IPC-consumption + degrade paths are the failure surface. `test:layout`/`test:renderer`. |
| 4 | n/a | Dead-export audit clean; scoped suites green; `/review` PASS/FLAG-addressed; `/ui-smoke 4` written. | Wrap. |

## Acceptance criteria

- [ ] `useWorkbenchAgentData` is extended (no new adapter hook created) with: a touched-files derivation, a
  Hook-Timeline derivation, and a `diff_review_ready` subscription exposing the latest `ParsedFileDiff[]` as
  an ephemeral ref. `AgentSession`/`AgentStatus` at `AgentMonitor/types.ts` are **unchanged** (`git diff` empty).
- [ ] `NowBlock` renders the adapter's `activeTool`/`target`/`elapsedSec`; no `MockNowToolCall` data import remains in it.
- [ ] `ContextBlock` renders the adapter's `contextStats` + `elapsedSec`; no `MOCK_CONTEXT_STATS` import remains in it.
- [ ] `FilesTouched` lists files derived from `AgentSession.toolCalls` (Edit/Write/Read) with correct
  `editing/edited/read` status; dedup tolerates >80-char ellipsized paths (unit test with a colliding fixture passes).
- [ ] `FilesTouched` rows show `+N/−N` badges sourced from the `ParsedFileDiff` when `enableTerminalDiffReview`
  is on; when off, the list renders **without** badges and does not error.
- [ ] `LatestHunk` renders the structured hunk of the most recent Edit (lines from `ParsedHunk`) when the diff
  pipeline is on; when off / on TTL-eviction, it renders an empty/placeholder state and does not error.
- [ ] `HookTimeline` renders the merged `toolCalls` + `conversationTurns` stream in timestamp order; the
  `think` variant is absent from the live type.
- [ ] Latest Hunk state is an ephemeral ref — no field added to `AgentSession`, no change to
  `useAgentEvents.helpers.ts` reducer or any SQLite schema/migration.
- [ ] No `AgentMonitor/**` component is imported inside `Workbench/AgentSidebar/**` (D7 — shells wired, not remounted).
- [ ] The orphaned sidebar `MOCK_*` data constants are deleted from `workbenchMockData.sidebar.ts`; the
  `MockXxx` **types** remain; `tsc`/`eslint` dead-export clean; `AgentGlobe` still builds.
- [ ] Flag-off leaves the existing shells byte-unchanged (render test).
- [ ] The orchestrator-owned Phase 3 acceptance test passes against the implementation.
- [ ] Zero new hardcoded hex in `Workbench/**` except sanctioned platform/brand colors (lint clean); tsc clean.
- [ ] `Workbench/CLAUDE.md` updated (panels live; ephemeral diff ref; truncated-path gotcha); `wave-4-result.md`,
  `CHANGELOG [2.25.0]`, `/ui-smoke 4` report, local tag `v2.25.0`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR is the orchestrator's planning artifact — Cole reviews it; nothing renders. |
| 1 | The NOW + Context panels at the top of the agent sidebar in a live IDE (flag on) | a running `claude` session emits tool events → main `hooksNet` → preload `onAgentEvent` → `AgentEventsContext` → `useWorkbenchAgentData` (`activeTool`/`target`/`elapsedSec`/`contextStats`) → `AgentSidebar` → `NowBlock`/`ContextBlock` render | Cole sees the NOW panel name the tool the agent is actually running (e.g. "Edit src/…") with the elapsed timer ticking, and the Context panel show the session's real token count, cost, and model — not the frozen mock numbers; both go quiet/idle when no session runs. |
| 2 | The Files Touched + Hook Timeline panels in the agent sidebar (flag on) | tool events (Edit/Write/Read) → `AgentSession.toolCalls` + `conversationTurns` in `AgentEventsContext` → `useWorkbenchAgentData` (touched-files dedup + timeline merge) → `AgentSidebar` → `FilesTouched`/`HookTimeline` render | Cole sees Files Touched list the actual files the current `claude` session has edited/read, each with the right status dot (editing vs done vs read), and the Hook Timeline scroll the real sequence of tool calls and prompts as they happen — no invented entries, no "thinking" rows. |
| 3 | The Latest Hunk panel + the `+N/−N` badges on the Files Touched rows (flag on, `enableTerminalDiffReview` on) | agent Edit fires → `hooksDiffReview` emits `diff_review_ready` (main) → preload `onAgentEvent` → `useWorkbenchAgentData` panel effect → `git:diffReview` IPC → `gitDiffParser` `ParsedHunk` → `LatestHunk` renders + `FilesTouched` badges | Cole sees the Latest Hunk panel show the actual added/removed lines of the file the agent just edited (green/red diff lines), and each Files Touched row show its real `+N/−N` change counts; with the diff setting off, Latest Hunk reads empty and the rows simply show no badges — nothing breaks. |
| 4 | Internal — no observation point | n/a | Wrap phase — mock sweep, gates, brief, CHANGELOG, tag are build artifacts; the product surface is Phases 1–3, re-verified by `/ui-smoke 4`. |

### Data-shape probes

```bash
# Phase 1 — NOW + Context wiring
npx vitest run src/renderer/components/Workbench
#   grep -n "MockNowToolCall\|MOCK_CONTEXT_STATS" src/renderer/components/Workbench/AgentSidebar/{NowBlock,ContextBlock}.tsx  → no data-constant imports

# Phase 2 — Files Touched list + Hook Timeline derivations
npx vitest run src/renderer/components/Workbench src/renderer/hooks
#   AgentSession/AgentStatus untouched:
#   git diff src/renderer/components/AgentMonitor/types.ts  → empty

# Phase 3 — Latest Hunk + badges (boundary)
npx vitest run src/renderer/components/Workbench
#   No AgentSession schema/reducer change:
#   git diff src/renderer/hooks/useAgentEvents.helpers.ts  → empty
#   No AgentMonitor import leaked into the sidebar:
#   grep -rn "AgentMonitor" src/renderer/components/Workbench/AgentSidebar  → no matches

# Phase 4 — mock sweep + wrap
npm run lint && npm run typecheck
npx vitest run src/renderer/components/Workbench
#   Orphaned data constants gone (types kept):
#   grep -n "MOCK_FILES\|MOCK_HUNK\|MOCK_NOW\|MOCK_HOOK_EVENTS" src/renderer/components/Workbench/workbenchMockData.sidebar.ts  → only type defs remain
```

## Files the next agent should read first

1. `roadmap/wave-4-workbench-agent-sidebar-live/recon-4.md` — the seam map (the 5 shells, the adapter
   extension points, the diff pipeline, the toolCalls derivation, the dead-mock split), file:line-cited. Read first.
2. `roadmap/wave-4-workbench-agent-sidebar-live/wave-4-decisions.md` — the ADR (Decisions 1–8).
3. `src/renderer/components/Workbench/useWorkbenchAgentData.ts` — the adapter this wave extends (Wave-3 D3);
   already exposes `contextStats`/`activeTool`/`target`/`elapsedSec`.
4. `src/renderer/components/Workbench/AgentSidebar/{NowBlock,ContextBlock,FilesTouched,LatestHunk,HookTimeline}.tsx`
   — the five panel shells (mock prop defaults) to wire live.
5. `src/renderer/components/Workbench/workbenchMockData.sidebar.ts` — the `MockXxx` types (= adapter output
   contract, keep) + the `MOCK_*` data constants (sweep).
6. `src/renderer/components/AgentMonitor/types.ts` — `AgentSession`, `ToolCallEvent` (`:88–98`),
   `ConversationTurn` (`:54`), `AgentStatus` (`:10`, do NOT edit) — the shapes the derivations read from.
7. `src/renderer/hooks/useAgentEvents.payload.ts` — `TOOL_INPUT_HEURISTICS` (`:31–38`) + the 80-char
   `input` truncation (`:301`) the Files-Touched dedup must tolerate.
8. `src/main/hooksDiffReview.ts` — the `diff_review_ready` emitter (`:125–133`), the `enableTerminalDiffReview`
   gate (`:138`), the 60s stash TTL (`:19`).
9. `src/main/ipc-handlers/{gitOperationsExtended.ts,gitDiffParser.ts}` — `gitDiffReview` + `ParsedFileDiff`/`ParsedHunk` (`:7–23`).
10. `roadmap/wave-3-workbench-hook-pipeline-state-machine/{waveplan-3.md,wave-3-decisions.md}` — the adapter's
    origin + the derive-don't-mutate posture (D1/D3) this wave inherits.
11. `src/renderer/components/Workbench/CLAUDE.md` — the static-mock constraint this wave relaxes for the panels.

## Note to the implementer

The spirit of this wave is **make the five sidebar panels show real data by extending the existing adapter
and reusing the existing diff pipeline — not by inventing new infrastructure or by widening the domain
model.** Every data source you need already exists: the adapter (`useWorkbenchAgentData`), the session
tool-call log (`AgentSession.toolCalls`), and the Wave-94 diff pipeline (`diff_review_ready` →
`git:diffReview` → `gitDiffParser`). You wire the Wave-1 panel shells to it. Resist five temptations:
(a) do NOT create a second adapter hook — extend `useWorkbenchAgentData` (D1); (b) do NOT add a `latestHunk`
field to `AgentSession` or touch the `useAgentEvents` reducer / any SQLite schema — Latest Hunk is an
ephemeral panel-local ref (D3); (c) do NOT remount AgentMonitor's rich components (`ToolCallTimeline`,
`AgentCard`, …) into the shells — that drags in a ~48-file coupling; render the adapter data with the panel's
own markup (D7); (d) do NOT build a new git op or extend the PostToolUse payload for the diff — reuse the
pipeline (D2); (e) do NOT add a new config flag or auto-enable the diff pipeline — piggyback on
`enableTerminalDiffReview` and degrade gracefully when it's off (D5). Two specific traps: the `toolCall.input`
path is truncated at 80 chars, so dedup defensively (not raw-string equality); and the `diff_review_ready`
stash has a 60s TTL, so a missing diff is a normal empty state, not an error.

Before declaring a phase complete, restate the observation point from the Verification table in your own
words and describe what you actually observed there. If you could not observe it directly — no live IDE, no
triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime
observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

When a phase's gate is green and nothing Tier 3 surfaced, the orchestrator dispatches the next phase in the
same turn — it does not end the turn to summarize or ask. The turn ends between phases only for a Tier 3
discovery needing a user call, a genuine user-judgment decision, or wave-end. See the Phase-boundary
protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-4-workbench-agent-sidebar-live/wave-4-decisions.md` with
   Decisions 1–8 (Decision 2 carrying the best-practice spectrum). Gate to Phase 1.
2. **Phase 1 — sonnet-implementer.** Brief: wire `NowBlock` + `ContextBlock` from the adapter
   (`activeTool`/`target`/`elapsedSec`/`contextStats`); no new derivation/IPC. Gate: render tests green +
   `test:layout` green + lint/tsc clean + manual: NOW shows the live tool, Context shows real tokens/cost.
3. **Phase 2 — sonnet-implementer.** Brief: add the touched-files derivation (ellipsis-tolerant dedup) + the
   Hook-Timeline merge (drop `think`) to the adapter; wire `FilesTouched` (list only) + `HookTimeline`.
   Orchestrator authors the dedup + timeline-merge unit tests first (incl. a >80-char colliding-path fixture).
   Gate: derivation unit tests + render tests green + `test:layout`/`test:renderer` green + lint/tsc clean +
   **`sonnet-phase-reviewer` pass** (dedup + drop-`think` conceptual risk) + manual: Files Touched + Timeline
   reflect the real session. Orchestrator cross-phase check: do the `FilesTouched` row shapes leave room for
   Phase 3's badges?
4. **Author the Phase 3 acceptance test first (orchestrator).** Per
   `~/.claude/rules/orchestrator-owned-acceptance-tests.md`: a failing test expressing the
   event→fetch→`ParsedHunk`→render contract — synthetic `diff_review_ready` → mocked `git:diffReview`
   returning `ParsedFileDiff[]` → assert `LatestHunk` renders the hunk lines AND `FilesTouched` rows show
   `+N/−N`; assert the flag-off / no-snapshot path renders empty Latest Hunk + badge-free list. Confirm it FAILS before dispatch.
5. **Phase 3 — sonnet-implementer (boundary).** Brief: panel-local `diff_review_ready` subscription in the
   adapter → `git:diffReview` fetch → `ParsedFileDiff → ParsedHunk → MockDiffHunk`, ephemeral ref (no
   `AgentSession`/SQLite change); wire `LatestHunk` + the `FilesTouched` badges; graceful degrade when
   `enableTerminalDiffReview` off. Implement against the acceptance test (may not modify it). Gate: acceptance
   test passes + mapping unit test green + `test:layout`/`test:renderer` green + lint/tsc clean +
   **`sonnet-phase-reviewer` pass** (IPC-consumption + ephemeral-ref lifecycle risk) + manual: Latest Hunk
   shows the real diff, badges show real counts, flag-off degrades cleanly.
6. **Phase 4 — wave wrap.** Sweep the orphaned sidebar `MOCK_*` data constants (keep `MockXxx` types, D8) +
   dead-export audit (check `AgentGlobe` doesn't still import `MOCK_CONTEXT_STATS` first). `npm run lint`,
   `npm run typecheck`, prettier, `npx vitest run src/renderer/components/Workbench src/renderer/hooks`
   (+ full suite in background). Orchestrator full-wave diff review. `/review` mechanical gap-check (Check 6
   if stryker). Update `Workbench/CLAUDE.md` (panels live; ephemeral diff ref; truncated-path gotcha) + author
   `wave-4-result.md`. Append `CHANGELOG [2.25.0]`. Run `/ui-smoke 4` (UI-bearing; live smoke deferred per the
   Wave 0–3 posture — written + queued for next dev session). Local tag `v2.25.0` (push per the 2026-05-19
   bulletin — pushing safe, merges wait for CI minutes). Update `HANDOFF.md`. `/promote-vendor-lessons 4`
   (likely no-op — no vendor SDK). `/audit-followups wave-4-workbench-agent-sidebar-live`.
