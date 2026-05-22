---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 4
slug: workbench-agent-sidebar-live
---

# Wave 4 — Architecture Decision Record

> Phase 0 deliverable. Decision 5 was Cole-locked (diff-gating scope call, 2026-05-21);
> Decisions 1–4 + 6–8 are planner/tech-lead calls. Decision 2 carries the full best-practice
> spectrum per `~/.claude/rules/best-practice-spectrum.md`; the rest use the abbreviated
> Context / Pick / Rationale form. Inherits Wave-3's derive-don't-mutate posture (Wave-3 D1/D3).

## Decision 1: Extend the SAME `useWorkbenchAgentData` adapter — no competing adapter

**Context:** Five panel bodies need live data; Wave-3 D3 established `useWorkbenchAgentData` as the single
adapter and made its `MockXxx` interfaces the typed output contract.

**Pick:** Extend the existing hook with the panel-body derivations + the diff subscription. No new adapter.

**Rationale:** One source of truth; `tsc` catches output-shape drift at the consumer sites. A second hook
would fragment primary-session selection and re-derive the same `AgentEventsContext` state twice.

## Decision 2: Latest Hunk diff source — reuse the Wave-94 pipeline

**Context:** The Latest Hunk panel needs a structured diff of the agent's most recent Edit. No
`tool_response.diff` reaches the renderer today (recon §4); reconciliation Open Q2 framed this as
"git delta vs. extended PostToolUse." Investigation found a third, already-shipped option.

**Options considered:**
- *Industry standard:* A new main-process git op (`child_process` `git diff` / simple-git) invoked per
  edited file, surfaced over a new IPC channel. — duplicates infrastructure that already exists.
- *Emerging best practice:* Extend the PostToolUse hook payload to carry the Edit diff inline. — bloats
  the named-pipe envelope (already 10KB-truncated, `hooksDispatchLogic.ts:45–62`) and changes a wire contract.
- *Already-shipped (reuse):* The Wave-94 `hooksDiffReview.ts` pipeline already snapshots pre-edit `HEAD`
  and emits `diff_review_ready { snapshotHash, projectRoot, filePaths[] }`; `git:diffReview` + `gitDiffParser`
  already return structured `ParsedFileDiff[] → ParsedHunk[]`. Only the routing into the workbench adapter is missing.

**Pick:** **Reuse the Wave-94 pipeline** — subscribe to `diff_review_ready` in a panel-local adapter effect,
fetch via the existing `git:diffReview` IPC, map `ParsedFileDiff → ParsedHunk → MockDiffHunk`.

**Rationale:** Zero new main-process code, zero new IPC contract, zero wire-envelope change. The pipeline is
production-tested (Wave 94) and already feeds `useDiffReviewTrigger`. Both alternatives rebuild capability
that exists.

**Consequences:** Latest Hunk inherits the pipeline's constraints — gated on `enableTerminalDiffReview`
(→ D5) and a 60s pre-snapshot TTL (slow edits yield no diff → empty state). The same `ParsedFileDiff`
also supplies the Files-Touched `+N/−N` badges (D4), so one fetch serves two panels.

## Decision 3: Latest Hunk state is an ephemeral panel-local ref

**Context:** The fetched diff has to live somewhere. The session-reducer path would add a `latestHunk`
field to `AgentSession` — which is persisted to SQLite, so it would need a schema migration and a
`restored`-session guard, and ripple toward the ~48 `AgentMonitor/**` consumers.

**Pick:** Hold the latest `ParsedFileDiff[]` in an ephemeral ref inside `useWorkbenchAgentData`. No
`AgentSession` field, no reducer change, no SQLite migration.

**Rationale:** Latest Hunk is a "what just happened" panel, not session history. Ephemeral state is the
correct lifetime; losing it on reload is acceptable and avoids dragging a panel-local concern into the
persisted domain model. Matches Wave-3 D1's blast-radius containment.

**Consequences:** A reloaded workbench shows an empty Latest Hunk until the next Edit fires — by design.

## Decision 4: Files Touched list from `toolCalls`; `+N/−N` badges from the shared `ParsedFileDiff`

**Context:** The Files Touched panel wants `{ path, status, adds, dels }`. `AgentSession.toolCalls` gives
path + status for free; `adds`/`dels` are not on `ToolCallEvent` (recon §3).

**Pick:** Derive the list (path + editing/edited/read status) from `toolCalls`; source the `+N/−N` badges
from the `ParsedFileDiff` already fetched for Latest Hunk (D2). Badges are decorative — drop them when no
diff is available.

**Rationale:** The list is the load-bearing content and needs no IPC. The badges ride free on the diff
fetch that Latest Hunk already does — no separate per-file `git diff` call.

**Consequences:** With `enableTerminalDiffReview` off, the list renders badge-free (D5). Files Touched and
Latest Hunk co-locate in Phase 3 for the badge enrichment, though the list itself ships in Phase 2.

## Decision 5: Diff gating — piggyback on `enableTerminalDiffReview`, degrade gracefully

**Context:** The diff pipeline (D2) is gated on the existing `claudeCliSettings.enableTerminalDiffReview`
(`hooksDiffReview.ts:138`). If a user has it off, Latest Hunk + badges get no data. Options were:
piggyback as-is, auto-enable when `layout.canonWorkbench` is on, or add a dedicated workbench-diff flag.

**Pick:** **Piggyback on `enableTerminalDiffReview`; degrade gracefully when off** — empty Latest Hunk,
no badges, Files-Touched list still renders from `toolCalls`. **(Cole-locked, 2026-05-21.)**

**Rationale:** Simplest; no new surface area; no flag-coupling. A user who has diff-review off has opted
out of the snapshot cost — honoring that and degrading is correct, not a bug. Auto-enabling would silently
re-introduce the snapshot cost the user opted out of.

**Consequences:** The two diff-backed surfaces are only fully populated when the user has diff-review on.
Documented as expected behavior in `Workbench/CLAUDE.md`; the acceptance test asserts the degrade path.

## Decision 6: Hook Timeline drops the `think` variant

**Context:** `MockHookEvent` has `tool` / `prompt` / `think` variants. The named-pipe protocol carries
`pre/post_tool_use`, `agent_start/end`, `UserPromptSubmit`, `Elicitation` — but **no thinking signal**
(recon §6).

**Pick:** Map `tool → ToolCallEvent`, `prompt → ConversationTurn`; **drop `think`** from the live type.

**Rationale:** A variant the wire can never populate is dead UI. Better to remove it than render a row that
never appears or fake a thinking signal.

**Consequences:** If a thinking-token signal is added to the hook protocol later, `think` is re-introduced
then — not speculatively now.

## Decision 7: Wire the existing Wave-1 panel shells; do not remount AgentMonitor components

**Context:** Reconciliation §09 said "re-layout, don't rebuild" and noted high reuse potential from
AgentMonitor (`ToolCallTimeline`, `AgentCard`, `ToolCallFeed`). But Wave 1 already built fresh panel shells
under `Workbench/AgentSidebar/`, and AgentMonitor's components carry their own styling + the 4-value
`AgentStatus` coupling across ~48 files.

**Pick:** Render the adapter's data with the **Wave-1 panel shells' own markup**. Do NOT import
AgentMonitor components into `Workbench/AgentSidebar/**`. Extend a shell's markup if it's too thin.

**Rationale:** "Re-layout" is already satisfied by the Wave-1 shells. Remounting AgentMonitor would couple
the workbench to the subsystem D1 deliberately kept at arm's length, and would inherit AgentMonitor's visual
treatment (Wave 6 owns canon theming). Containment over reuse here.

**Consequences:** Some presentational logic (e.g. timeline row rendering) is written in the shell rather
than reused. Accepted — the shells are small and the decoupling is worth more than the duplication.

## Decision 8: Sweep only the orphaned `MOCK_*` data constants; keep the `MockXxx` types

**Context:** Once the panels render adapter data, the sidebar's `MOCK_*` data constants in
`workbenchMockData.sidebar.ts` are orphaned — but the `MockXxx` interfaces are the adapter's typed output
contract (D1, inherited from Wave-3 D3/D7).

**Pick:** Delete the `MOCK_*` data constants (Phase 4, after a dead-export audit confirms zero importers —
checking `AgentGlobe` for a lingering `MOCK_CONTEXT_STATS` import first); KEEP the `MockXxx` types.

**Rationale:** Removing the contract types would break the adapter's typed output; removing the data is the
cleanup. Mirrors Wave-3 D7's split exactly.

**Consequences:** `workbenchMockData.sidebar.ts` shrinks to type definitions. The wrap phase verifies
`tsc`/`eslint` dead-export clean.
