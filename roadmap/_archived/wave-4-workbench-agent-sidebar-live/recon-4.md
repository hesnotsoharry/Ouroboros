---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 4
slug: workbench-agent-sidebar-live
---

# Wave 4 — Recon: the 5-panel live-data seam map

> Distilled from the Wave-4 grounding exploration (sonnet-explorer, 2026-05-21) + the
> Wave-3 adapter. File:line citations are point-in-time (2026-05-21) — verify before editing.
> Read this first; it is the seam map the phase briefs are grounded in.

## §0 — The headline finding

Both sub-problems HANDOFF flagged as "hard" are **half-built already**. There is no greenfield
infrastructure in this wave:

- **Latest Hunk** has a production diff pipeline shipped in Wave 94 (`hooksDiffReview.ts`) +
  structured parsing (`gitDiffParser.ts`) + a live renderer IPC channel (`git:diffReview`). The
  only gap is that the `diff_review_ready` event is not yet routed into the workbench adapter.
- **Files Touched** is pure renderer derivation from `AgentSession.toolCalls`, already in
  `AgentEventsContext`. The only gap (the `+N/−N` badges) is filled from the *same* `ParsedFileDiff`
  that Latest Hunk fetches — free once the diff is fetched.

So Wave 4 is **derivation + wiring + one event subscription**, not a new pipeline.

## §1 — The 5 panel shells already exist (Wave 1)

`src/renderer/components/Workbench/AgentSidebar/`:

| Component | Panel | Mock prop today | Wave-4 live source |
|---|---|---|---|
| `AgentSidebar.tsx` | container; **header already live** (Wave 3) | — | — |
| `NowBlock.tsx` | ① NOW | `MockNowToolCall` | adapter `activeTool`/`target`/`elapsedSec` (exist) |
| `ContextBlock.tsx` | ② Context | `MockContextStats` | adapter `contextStats` (live since Wave 3, not yet wired to component) |
| `FilesTouched.tsx` | ③ Files Touched | `MockFileTouched[]` | NEW: derive list from `toolCalls`; badges from `ParsedFileDiff` |
| `LatestHunk.tsx` | ④ Latest Hunk | `MockDiffHunk` | NEW: `diff_review_ready` → `git:diffReview` → `ParsedHunk` |
| `HookTimeline.tsx` | ⑤ Hook Timeline | `MockHookEvent[]` | NEW: derive from `toolCalls` + `conversationTurns` |

Each panel takes an **optional typed prop** that defaults to its mock constant. The live-wiring
swap is "pass adapter-derived data as the prop instead of letting it fall through to the default" —
no component restructuring. **"Re-layout" is satisfied by the Wave-1 shells.** Do NOT remount
AgentMonitor's rich components (`ToolCallTimeline`, `AgentCard`, …) into the shells — that drags in
the ~48-file AgentMonitor subsystem coupling (the same blast-radius D1 avoided in Wave 3). Extend
the shell's own markup if a panel is too thin.

## §2 — The adapter is the single extension point (Wave 3 ADR D3)

`src/renderer/components/Workbench/useWorkbenchAgentData.ts` consumes `useAgentEventsContext()`,
selects the primary session (two-tier rule, Wave-3 D4), and returns canon-shaped data. Wave 3 already
exposes `contextStats: { usedTokens, maxTokens, costUsd, model }`, `activeTool`, `target`,
`elapsedSec` (`useWorkbenchAgentData.ts:48–54` per Wave-3 plan). Wave 4 **extends this same hook**
(D3 — no competing adapter) with the panel-body derivations + the `diff_review_ready` subscription.

## §3 — Files Touched (③): toolCalls derivation, no IPC

`AgentSession.toolCalls` is a `ToolCallEvent[]` (`AgentMonitor/types.ts:88–98`), in renderer state via
`AgentEventsContext`. Each entry has:

- `toolName: string` — `'Read'` / `'Edit'` / `'Write'` / `'Bash'` / …
- `input: string` — a **truncated** (≤80 char, `useAgentEvents.payload.ts:301`) summary; for
  Edit/Write/Read this is the `file_path` (`TOOL_INPUT_HEURISTICS`, `useAgentEvents.payload.ts:31–38`).
- `status: 'pending' | 'success' | 'error'`

Derivation: filter to Edit/Write/Read, dedup by path, derive `status` (`'editing'` = pending Edit/Write;
`'edited'` = complete Edit/Write; `'read'` = Read).

**Gap:** `adds`/`dels` are NOT on `ToolCallEvent`. Source them from the `ParsedFileDiff` Phase 3
fetches (per-file hunk line counts). When the diff pipeline is off/unavailable → drop the badges,
list still renders.

⚠ **Risk — truncated path:** `input` is ellipsized at 80 chars, so deep paths can collide on dedup.
Use a dedup key that tolerates ellipsis (e.g. last-N path segments) or accept that the raw `file_path`
only exists main-side (`hooksEditTap.ts:16–18`) and is NOT forwarded as a separate field. Do NOT add
IPC to forward the full path this wave — dedup defensively in the renderer.

## §4 — Latest Hunk (④): reuse the Wave-94 diff pipeline

`src/main/hooksDiffReview.ts` (Wave 94 Phase E), gated on `claudeCliSettings.enableTerminalDiffReview`
(`hooksDiffReview.ts:138`):

- `pre_tool_use` (Edit/Write/MultiEdit) → `git rev-parse HEAD`, stash `{ snapshotHash, projectRoot,
  correlationId }` in-memory (TTL 60s, cap 100 — `hooksDiffReview.ts:19,29`).
- `post_tool_use` → pop stash, dispatch synthetic `diff_review_ready` IPC event `{ snapshotHash,
  projectRoot, filePaths[] }` (`hooksDiffReview.ts:125–133`) on the `hooks:event` channel.

Today only `useDiffReviewTrigger` consumes it — NOT `AgentEventsContext`, NOT the adapter.

Fetch path: `git:diffReview` IPC (registered in `git.ts`; `gitOperationsExtended.ts` `gitDiffReview`)
returns `ParsedFileDiff[]` → `ParsedHunk[]` `{ oldStart, newStart, lines: string[] }`
(`gitDiffParser.ts:7–23`) → maps directly onto `MockDiffHunk`.

**Wiring (D3-compliant):** a **panel-local effect inside `useWorkbenchAgentData`** subscribes to
`diff_review_ready` (via `window.electronAPI.hooks.onAgentEvent` or the existing context event stream)
and fetches the diff. Hunk state is an **ephemeral panel-local ref** — NOT on `AgentSession`, NO
reducer change, NO SQLite schema/migration. Lost on reload (correct — it's a "current activity" panel).

⚠ **Risk — 60s stash TTL:** a slow Edit evicts the pre-snapshot → `diff_review_ready` fires with no
diff. Existing constraint; degrade gracefully (empty Latest Hunk). ⚠ **Risk — flag off:** if
`enableTerminalDiffReview` is off, no `diff_review_ready` ever fires → Latest Hunk empty + badges
dropped (Cole-locked: piggyback + degrade, no new flag, no auto-enable).

## §5 — NOW (①) + Context (②): pure wiring, data exists

NOW: `MockNowToolCall` ≈ adapter `activeTool` (name) + `target` (file) + `elapsedSec` (all exist).
`description` = `target` or a formatted string; `progress` has no live source → indeterminate default.

Context: adapter already returns `contextStats` (live since Wave 3). `ContextBlock` still reads
`MOCK_CONTEXT_STATS` — Wave 3 left it unwired (intentional, Wave-3 explorer Q5). Wire = pass
`contextStats` + `elapsedSec` through `AgentSidebar` → `ContextBlock`. Zero new data.

## §6 — Hook Timeline (⑤): toolCalls + conversationTurns, drop `think`

`MockHookEvent` has 3 variants: `tool` → `ToolCallEvent`; `prompt` → `ConversationTurn`
(`AgentSession.conversationTurns`, `AgentMonitor/types.ts:54`); `think` → **no wire source** (the named
pipe carries no thinking signal). Decision: **drop the `think` variant** from the live type. Sort merged
events by `timestamp`. ⚠ `output` on `ToolCallEvent` is also truncated (10KB, `hooksDispatchLogic.ts:45–62`)
— don't rely on parsing it for structured fields.

## §7 — Mock constants orphaned after the swap

After the 5 panels go live, the sidebar mock constants in `workbenchMockData.sidebar.ts`
(`MockNowToolCall`/`MOCK_NOW…`, `MockContextStats`/`MOCK_CONTEXT_STATS`, `MockFileTouched`/`MOCK_FILES…`,
`MockDiffHunk`/`MOCK_HUNK`, `MockHookEvent`/`MOCK_HOOK_EVENTS`) split into:
- **Types** (`MockFileTouched`, `MockDiffHunk`, `MockHookEvent`, …) → KEEP as the adapter's typed output
  contract (D3 pattern — same as Wave 3).
- **Data constants** (`MOCK_*`) → DELETE once no panel imports them. Run the dead-export audit in the wrap
  phase; only remove symbols with zero remaining importers. (`MOCK_CONTEXT_STATS` may still be referenced
  by `AgentGlobe` per Wave 3 — confirm before deleting.)

## §8 — Boundary classification

Phase 3 (Latest Hunk + badges) **consumes a boundary**: the `git:diffReview` IPC + the
`diff_review_ready` event. Per `~/.claude/rules/orchestrator-owned-acceptance-tests.md`, the orchestrator
authors the failing acceptance test (event → fetch → `ParsedHunk` → panel render contract) before
dispatch; the subagent implements against it and may not modify it. This is consuming an *existing*
boundary, not introducing a new architectural surface → not a walking-skeleton wave.
