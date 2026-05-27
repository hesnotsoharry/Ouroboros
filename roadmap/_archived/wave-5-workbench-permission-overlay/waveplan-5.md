---
status: DRAFT
created: 2026-05-22
updated: 2026-05-22
wave: 5
slug: workbench-permission-overlay
---

# Wave 5 — Workbench Permission Overlay (canon §13 dual-presentation)

## Status

DRAFT · target v2.26.0 (minor — net-new UI capability inside the experimental, default-off canon shell) · drafted 2026-05-22.

## Context — why this wave exists

Waves 0–4 built the canon workbench shell behind the default-off `layout.canonWorkbench` flag: token
foundations, static shell, live terminals, the live agent-state pipeline, and the five live agent-sidebar
panels. The reconciliation doc's wave sequence (`roadmap/discovery/workbench-overhaul-reconciliation.md:125`)
puts Wave 5 = **permissions re-skin**: canon §13's dual-presentation approval UI over the **existing**
file-poll approval protocol.

The approval pipeline already exists end-to-end and Wave 5 must not reinvent it (ADR D1):
- **Main + IPC:** `approvalManager.ts` writes responses to `~/.ouroboros/approvals/{id}.response`; the renderer
  receives requests via `window.electronAPI.approval.onRequest` and resolves via `approval.respond` /
  `approval.alwaysAllow`.
- **Renderer context:** `ApprovalContext.tsx:14–20` provides `{ pendingCount, requests: ApprovalRequest[],
  approve(id), reject(id, reason?), alwaysAllow(id, sessionId, toolName) }`. The provider is mounted at
  `App.tsx:42`, above the shell branch, so the queue is live in the canon workbench too. Resolvers at
  `:100–134` clear the request from the queue and fire the IPC.
- **`ApprovalRequest` shape** (`src/renderer/types/electron-runtime-apis.d.ts:221–228`): `{ requestId,
  toolName, toolInput: Record<string, unknown>, sessionId, timestamp, permissionContext? }`.
- **Precedent UI:** `AgentMonitor/ApprovalDialog.tsx` (+ `ApprovalDialogCard.tsx`, `ApprovalDialogCardParts.tsx`)
  implements the action model, Y/A/N/Esc keyboard map, focus trap, and reject-reason flow. **It is currently
  orphaned — mounted nowhere** (`<ApprovalDialog` appears only in its own definition; `ApprovalProvider` at
  `ApprovalContext.tsx:136–145` renders only `{children}`, contradicting the stale `contexts/CLAUDE.md:30`).
  It is Wave 5's **reference**, not a dependency (ADR D4).

The canon `<Workbench>` shell has **no approval surface yet**. `useWorkbenchAgentData.ts:128–194` already reads
`permissionEvents` to derive the `awaiting` state (Globe + session dots show "awaiting permission"), but there
is no approve/reject UI inside the workbench. This wave adds it: the canon §13 terminal overlay + sidebar
NOW-panel takeover, both consuming `useApprovalContext()`.

This is **not a new architectural surface** — the protocol, queue, IPC, and a UI precedent all exist.
Renderer-only; no main-process, IPC-contract, or config-schema change.

## Goal

After Wave 5, flipping `layout.canonWorkbench` on and triggering a tool that needs approval in a live `claude`
session makes the canon workbench show the canon §13 approval UI: a glass, amber-bordered card slides up over
the terminal pane (~24px from its bottom) naming the tool + command + reason, with **Approve** (Y) /
**Always `<tool>`** (A) / **Deny** (N) actions; *simultaneously*, the agent sidebar's NOW panel becomes the
same permission card with the rest of the sidebar dimmed to 0.7. Pressing Y (once) approves and the agent
continues; A whitelists the tool for the session; N denies (with an optional reason). With the flag off, every
existing surface (legacy shells, the independent `WorkbenchApprovalPanel`/`AgentChatApprovalBanner`) renders
byte-identically to before, and no main-process/IPC/config code changes.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-5-workbench-permission-overlay/wave-5-decisions.md`.

1. **Consume the existing `useApprovalContext()` — no new protocol, no new adapter.** Reuse the live queue +
   `approve`/`reject`/`alwaysAllow` resolvers + IPC. RESOLVED.
2. **Both presentations render simultaneously, fed by one shared `PermissionCard` primitive** (terminal overlay
   + sidebar NOW-takeover). RESOLVED — carries the best-practice spectrum.
3. **Keyboard shortcuts (Y/A/N/Esc) bound exactly once** in `useWorkbenchApproval` (not per-presentation) to
   avoid double-fire when both surfaces render. RESOLVED.
4. **Do NOT remount AgentMonitor's `ApprovalDialog`/`ApprovalDialogCard`** — build canon-tokened
   Workbench-local components; the AgentMonitor dialog is the reference for the action model + keyboard map,
   not a dependency (inherits Wave-3 D1 / Wave-4 D7). RESOLVED.
5. **"Always for project" (canon §13 v2) is out of scope** — ship Approve-once + Always-for-tool + Deny (1:1
   with the existing resolvers). RESOLVED.
6. **Terminal overlay = absolutely-positioned child of the center/terminal region; sidebar takeover = NOW-panel
   slot replacement in `AgentSidebar`.** RESOLVED.
7. **Preserve the optional reject-reason flow** (Deny → reveal input → confirm with reason; resolver already
   supports `reject(id, reason?)`). RESOLVED.
8. **Gating behind `layout.canonWorkbench` only — no new flag.** RESOLVED.

## Scope

**In scope:**
- New `Workbench/Permission/` directory: a shared `PermissionCard` presentation primitive (canon-tokened
  header + command preview + reason + action row + optional reject-reason input) and a `useWorkbenchApproval`
  selector hook that wraps `useApprovalContext()` — selects `requests[0]` as the current request, computes
  elapsed time, binds the three resolvers to `(requestId, sessionId, toolName)`, and owns the single Y/A/N/Esc
  keyboard handler (D3).
- **Terminal overlay presentation** — an absolutely-positioned card over the center/terminal region
  (`Workbench.tsx` `CenterPane`, line 54), anchored ~24px from the bottom, glass (`--glass-overlay` +
  `--blur-strong`), 1px `--warning` border, slide-up animation. Renders only when a request is pending.
- **Sidebar NOW-panel takeover** — conditional swap of the `NowBlock` slot (`AgentSidebar.tsx:179`) for the
  permission card; panels 2–5 (Context/FilesTouched/LatestHunk/HookTimeline) dim to opacity 0.7 while pending.
- Both presentations fed by the one `useWorkbenchApproval` hook; keyboard owned once.
- Orchestrator-owned acceptance test for the card→context resolver contract (Phase 1).
- Render/integration tests per the table; canon-token compliance (zero new hardcoded hex).
- Update `Workbench/CLAUDE.md` (Wave 5: dual permission UI; consume `useApprovalContext`; single keyboard owner;
  Decisions 1–8). Fix the stale `contexts/CLAUDE.md:30` line (the provider does NOT render `ApprovalDialog`).

**Out of scope:**
- Any change to `approvalManager.ts`, the file-poll protocol, the `approval:*` IPC, or `ApprovalContext.tsx`'s
  resolvers/queue → D1 (consume, don't modify). If a resolver gap surfaces, file a follow-up.
- "Always for project" / project-scoped persistence / a revocation settings UI → D5 (next wave touching
  `approvalManager` + settings).
- Remounting or refactoring AgentMonitor's `ApprovalDialog`/`ApprovalDialogCard`/`ApprovalDialogCardParts` →
  D4 (reference only; deleted at Wave 7 cutover).
- Fixing the orphaned-`ApprovalDialog` / legacy-IDE-shell-has-no-approval-UI latent issue → out of scope; the
  legacy shells are deleted at Wave 7. Surfaced as a finding (see Risks); file a follow-up, do not fix here.
- Responsive collapse of the dual surfaces on small viewports → Wave 6 (themes + responsive).
- Theme treatment beyond Modern/Warp/Retro token compliance → Wave 6. Cutover / legacy-shell deletion → Wave 7.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR | orchestrator | Author `wave-5-decisions.md`, Decisions 1–8 (Decision 2 carries the best-practice spectrum per `~/.claude/rules/best-practice-spectrum.md`: single-modal vs dual-ambient vs teleported). Gate to 1. |
| 1 | Permission primitive + hook + **terminal overlay** (the working vertical slice) | sonnet-implementer | **Orchestrator authors the failing acceptance test FIRST** (the card→context resolver contract — see dispatch step 2). Build `Workbench/Permission/PermissionCard.tsx` (canon-tokened header + `toolInput` command preview + reason + Approve/Always/Deny row + optional reject-reason input, D7) and `useWorkbenchApproval.ts` (wraps `useApprovalContext()`, selects `requests[0]`, computes elapsed, binds resolvers to `(requestId, sessionId, toolName)`, owns Y/A/N/Esc once — D3). Mount the **terminal overlay** as an absolutely-positioned child of `CenterPane` (`Workbench.tsx:54`; make that region `position: relative`), glass + amber + slide-up, rendered only when `pendingCount > 0` (D6). Implement against the acceptance test (may not modify it). **Conceptually-risky phase** (resolver-binding correctness + single-keyboard-owner are where a wrong mental model hides) → `sonnet-phase-reviewer` pass. |
| 2 | **Sidebar NOW-panel takeover** + dim (second consumer of the shared card) | sonnet-implementer | Conditionally swap `AgentSidebar.tsx:179`'s `<NowBlock>` for `<PermissionCard>` (sidebar variant — full-width Approve, then Always/Deny row, per canon §13b) when `pendingCount > 0`; dim panels 2–5 to opacity 0.7 via a wrapper style on the panel-stack container below the NOW slot. Reuse the **same** `PermissionCard` + `useWorkbenchApproval` from Phase 1 — do NOT duplicate the action logic or bind a second keyboard handler (D3). **Conceptually-risky** (the NOW-slot swap + the no-second-keyboard-owner invariant) → `sonnet-phase-reviewer` pass. Render tests assert the swap + dim + that Approve/Deny still resolve through the single hook. |
| 3 | Wave wrap | orchestrator | `test:layout` + `test:renderer`, full lint + typecheck + prettier, orchestrator full-wave diff review, `/review` mechanical gap-check (Check 6 if stryker). Update `Workbench/CLAUDE.md` (Wave 5 line) + fix stale `contexts/CLAUDE.md:30`. Author `wave-5-result.md`. Append `CHANGELOG [2.26.0]`. `/ui-smoke 5` (UI-bearing; live smoke deferred per the Wave 0–4 posture — Cole not using the app until the remake is done — written + queued for next dev session). Local `git tag v2.26.0` (push per the 2026-05-19 bulletin — pushing safe, merges wait for CI minutes). HANDOFF flip. `/promote-vendor-lessons 5` (likely no-op — no vendor SDK). `/audit-followups wave-5-workbench-permission-overlay`. |

### Phase ordering

```
Phase 0 (ADR)
   |
   v
Phase 1 (primitive + hook + terminal overlay)  ← the complete working vertical slice; acceptance test gates it
   |
   v
Phase 2 (sidebar NOW-takeover + dim)           ← second consumer of the SAME card + hook; depends on Phase 1
   |
   v
Phase 3 (wave wrap)
```

Strictly sequential. Phase 1 establishes the shared `PermissionCard` + `useWorkbenchApproval` AND ships one
fully-working presentation (so the wave has a user-observable surface from the first feature phase). Phase 2
**depends on Phase 1** — it is a second consumer of the same primitive and hook; it must not re-author the
action logic or re-bind keys. Phase 3's wrap runs last.

## Risks

| Risk | Mitigation |
|---|---|
| Both presentations bind the Y/A/N keyboard handler → every keypress fires `approve`/`reject` twice | D3 + Phase 1/2 briefs: the handler is bound exactly once in `useWorkbenchApproval`; presentations are pure render. Phase-reviewer checks `Workbench/Permission/**` for exactly one `keydown` listener; render test asserts a single keypress resolves once. |
| Implementer imports AgentMonitor's `ApprovalDialog`/`Card` to "save time," dragging in the ~48-file subsystem coupling | D4 + Note + phase-reviewer: build Workbench-local components; reviewer flags any `AgentMonitor/**` import inside `Workbench/Permission/`. Data-shape probe greps for it. |
| Overlay mounted at stage root → "24px from the bottom of the terminal pane" is undefined / z-index fights | D6: mount as an absolutely-positioned child of `CenterPane` (made `position: relative`). Reviewer confirms the overlay's containing region. |
| Stale `contexts/CLAUDE.md:30` ("provider renders `<ApprovalDialog>`") misleads the implementer into thinking a dialog already mounts | Brief calls it out explicitly (the provider renders only `{children}`); Phase 3 fixes the doc line. |
| Multiple queued requests — only `requests[0]` shows; user loses sight of the queue | Reuse the existing `queuedCount` pattern (`ApprovalDialogCard` shows `requests.length - 1`): the card shows a "+N queued" badge. `useWorkbenchApproval` exposes `pendingCount`. |
| Sidebar takeover dims the NOW slot too (double-hides the card) | Phase 2 brief: the 0.7 dim applies to panels 2–5 only (the stack *below* the NOW slot); the NOW slot renders the card at full opacity. Render test asserts the card is not dimmed. |
| Flag-off regression — permission UI leaks into a legacy shell, or the independent `WorkbenchApprovalPanel`/`AgentChatApprovalBanner` surfaces double-fire | All edits inside `Workbench/**` (gated by `layout.canonWorkbench`); no edit to `ApprovalContext` or the legacy surfaces. Render test asserts flag-off renders the Wave-4 sidebar byte-unchanged and no overlay mounts. |
| The orphaned AgentMonitor `ApprovalDialog` means the legacy IDE shell may have no approval UI at all (latent bug) | **Out of scope** (D-scope) — surfaced as a finding. File `roadmap/follow-ups/{date}-orphaned-agentmonitor-approvaldialog.md` (the dialog is unmounted; legacy IDE shell approval coverage unverified). Legacy shells are deleted at Wave 7; don't fix mid-wave. |
| `toolInput` is `Record<string, unknown>` — rendering it raw could dump a huge/secret-bearing blob | Phase 1 brief: render a concise command preview (reuse the precedent's `ToolInputPreview` *approach*, not the component) — tool name + a truncated, single-line summary of the salient input field; never dump the whole object. No secrets in logs. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR is documentation. |
| 1 | `useWorkbenchApproval` selection (`requests[0]`), elapsed-time, resolver-arg binding (`approve(id)`, `alwaysAllow(id, sessionId, toolName)`, `reject(id, reason?)`); single keypress → single resolve. | **Orchestrator-owned acceptance test**: render `<Workbench>` (flag on) with a mocked `ApprovalContext` providing one `ApprovalRequest` → terminal overlay shows tool name + command preview + reason; click/press Approve → `approve(requestId)` called once + request clears; Deny → `reject`; Always → `alwaysAllow(requestId, sessionId, toolName)`. | Trophy (UI-heavy behind flag). `test:layout`/`test:renderer`. |
| 2 | Sidebar-variant card layout (full-width Approve + Always/Deny row); dim-target = panels 2–5 only. | Render: `pendingCount > 0` swaps `NowBlock` → `PermissionCard` in the sidebar AND dims panels 2–5; Approve in the sidebar resolves through the same hook (single keyboard owner intact — no double-fire with the overlay also mounted); flag-off renders the Wave-4 sidebar byte-unchanged. | Trophy. `test:layout`/`test:renderer`. |
| 3 | n/a | Scoped suites green; dead-export/lint clean; `/review` PASS/FLAG-addressed; `/ui-smoke 5` written. | Wrap. |

## Acceptance criteria

- [ ] `Workbench/Permission/useWorkbenchApproval.ts` wraps `useApprovalContext()` (no new context, no
  modification to `ApprovalContext.tsx`), selects `requests[0]`, exposes `{ current, pendingCount, queuedCount,
  elapsedSec, approve, deny, alwaysAllow }` bound to the current request, and owns the **only** Y/A/N/Esc
  keyboard handler in `Workbench/Permission/**`.
- [ ] `Workbench/Permission/PermissionCard.tsx` renders the current request's tool name + a concise (truncated,
  no full-object dump) command preview + reason + Approve(Y)/Always(A)/Deny(N) actions + the optional
  reject-reason input (D7); zero new hardcoded hex (canon tokens only).
- [ ] The terminal overlay renders as an absolutely-positioned child of the center/terminal region, anchored
  near the bottom, glass (`--glass-overlay` + `--blur-strong`) with a 1px `--warning` border, only when
  `pendingCount > 0`.
- [ ] The sidebar NOW slot (`AgentSidebar.tsx:179`) renders `<PermissionCard>` (sidebar variant) instead of
  `<NowBlock>` when `pendingCount > 0`, and panels 2–5 dim to opacity 0.7 (the NOW slot itself stays full opacity).
- [ ] Approve calls `approve(requestId)`; Always calls `alwaysAllow(requestId, sessionId, toolName)`; Deny calls
  `reject(requestId, reason?)` — each exactly once per action, clearing the request from the queue.
- [ ] A single Y/A/N keypress resolves the request exactly once even though both presentations are mounted (no
  double-fire).
- [ ] No `AgentMonitor/**` component is imported inside `Workbench/Permission/**` (D4).
- [ ] No change to `src/main/**`, the `approval:*` IPC, `ApprovalContext.tsx`, or any config schema (`git diff` empty on those).
- [ ] Flag-off leaves the Wave-4 sidebar byte-unchanged and mounts no overlay (render test); the legacy
  `WorkbenchApprovalPanel`/`AgentChatApprovalBanner` surfaces are untouched.
- [ ] The orchestrator-owned Phase 1 acceptance test passes against the implementation.
- [ ] `tsc` clean; `eslint src/` 0 errors; prettier clean.
- [ ] `Workbench/CLAUDE.md` updated (Wave 5 line); stale `contexts/CLAUDE.md:30` corrected; `wave-5-result.md`,
  `CHANGELOG [2.26.0]`, `/ui-smoke 5` report, local tag `v2.26.0`.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR is the orchestrator's planning artifact — Cole reviews it; nothing renders. |
| 1 | The glass permission card sliding up over the terminal pane in a live IDE (flag on) when a `claude` session hits a tool needing approval | a `claude` tool call → PreToolUse hook file-poll → main `approvalManager` → `approval:request` IPC → `ApprovalProvider` queue (`App.tsx:42`) → `useWorkbenchApproval` (`requests[0]`) → terminal overlay over `CenterPane` renders | Cole sees an amber-bordered glass card rise from the bottom of the terminal naming the tool the agent wants to run (e.g. "Bash — rm …") with Approve/Always/Deny; pressing **Y** approves once and the agent continues in the terminal; the card disappears. |
| 2 | The agent sidebar's NOW panel becoming the permission card (rest of the sidebar dimmed) simultaneously with the overlay (flag on) | same queue → `useWorkbenchApproval` → `AgentSidebar` NOW slot swap + panel-stack dim | Cole sees the top sidebar panel turn into the same permission card (full-width Approve, then Always/Deny) with panels 2–5 visibly dimmed; clicking **Always** in the sidebar whitelists the tool for the session and both the sidebar card and the terminal overlay clear together. |
| 3 | Internal — no observation point | n/a | Wrap phase — gates, doc fixes, brief, CHANGELOG, tag are build artifacts; the product surface is Phases 1–2, re-verified by `/ui-smoke 5`. |

### Data-shape probes

```bash
# Phase 1 — primitive + hook + terminal overlay
npx vitest run src/renderer/components/Workbench
#   No AgentMonitor import leaked into the permission components:
#   grep -rn "AgentMonitor" src/renderer/components/Workbench/Permission  → no matches
#   Exactly one keydown listener in the permission tree:
#   grep -rn "addEventListener('keydown'\|onKeyDown" src/renderer/components/Workbench/Permission  → single owner

# Phase 2 — sidebar takeover + dim
npx vitest run src/renderer/components/Workbench
#   No second keyboard binding introduced by the sidebar variant (still single owner):
#   grep -rn "addEventListener('keydown'" src/renderer/components/Workbench/Permission  → still one

# Wave-wide — no protocol/IPC/context drift
git diff --stat src/main src/renderer/contexts/ApprovalContext.tsx   # → empty
npm run lint && npm run typecheck
npx vitest run src/renderer/components/Workbench
```

## Files the next agent should read first

1. `roadmap/wave-5-workbench-permission-overlay/wave-5-decisions.md` — the ADR (Decisions 1–8). Read first.
2. `src/renderer/contexts/ApprovalContext.tsx` — the context this wave consumes: value shape (`:14–20`),
   resolvers `approve`/`reject`/`alwaysAllow` (`:100–134`), the queue + `onRequest`/`onResolved` wiring
   (`:60–79`). **Note:** the provider (`:136–145`) renders only `{children}` — it does NOT render a dialog
   (the `contexts/CLAUDE.md:30` claim is stale; Phase 3 fixes it).
3. `src/renderer/types/electron-runtime-apis.d.ts:221–228` — the `ApprovalRequest` shape the card reads
   (`requestId`, `toolName`, `toolInput`, `sessionId`, `timestamp`, `permissionContext?`).
4. `src/renderer/components/AgentMonitor/{ApprovalDialog,ApprovalDialogCard,ApprovalDialogCardParts}.tsx` — the
   **reference** for the action model, Y/A/N/Esc map, focus trap, reject-reason flow, and `ToolInputPreview`
   approach. Do NOT import these (D4); re-author against canon tokens.
5. `src/renderer/components/Workbench/Workbench.tsx` — the shell layout; the center/terminal region is
   `CenterPane` (line 54), where the terminal overlay mounts (make it `position: relative`).
6. `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.tsx` — the panel stack (`:179` `NowBlock` slot,
   `:181–187` panels 2–5) where the takeover swap + dim happen.
7. `src/renderer/components/Workbench/AgentSidebar/NowBlock.tsx` — the slot the takeover replaces; the
   sidebar-variant card sits in its place.
8. `src/renderer/components/Workbench/useWorkbenchAgentData.ts:128–194` — already reads `permissionEvents` to
   derive `awaiting`; context for how the workbench already knows a request is pending (the new UI is the
   missing piece, not the detection).
9. `design-system/canon.html:750–807` — canon §13: overlay geometry/tokens (§13a), sidebar takeover (§13b),
   the three v1 actions (§13c). The visual contract.
10. `src/renderer/styles/tokens.css` — canon alias block: `--glass-overlay`, `--blur-strong`, `--warning`,
    `--accent`/`--interactive-accent` (the overlay's glass/border/button tokens).
11. `src/renderer/components/Layout/ChatOnlyShell/WorkbenchApprovalPanel.tsx` — an existing live consumer of the
    approval queue (reference for a clean context-consumption pattern; do NOT modify — legacy shell).
12. `roadmap/wave-4-workbench-agent-sidebar-live/waveplan-4.md` — the prior wave's shape + the
    derive-don't-mutate / don't-remount-AgentMonitor posture this wave inherits.

## Note to the implementer

The spirit of this wave is **surface the existing approval flow in the canon workbench by re-skinning, not
rebuilding.** Every piece of the protocol already exists: the file-poll IPC, the `ApprovalProvider` queue
mounted above the shell (`App.tsx:42`), and the three resolvers on `useApprovalContext()`. You build two canon
presentations — a terminal overlay and a sidebar NOW-takeover — that *consume* that context. There is even a
reference UI (`AgentMonitor/ApprovalDialog`) for the action model and keyboard map. Resist five temptations:
(a) do NOT touch `approvalManager.ts`, the `approval:*` IPC, or `ApprovalContext.tsx`'s resolvers — consume,
don't modify (D1); (b) do NOT import the AgentMonitor `ApprovalDialog`/`Card` — re-author Workbench-local
components against canon tokens (D4); (c) do NOT bind the Y/A/N keyboard handler in each presentation — bind it
**once** in `useWorkbenchApproval`, or both surfaces will double-fire every keypress (D3); (d) do NOT add an
"Always for project" action — the renderer has no project-scoped resolver, v1 ships the three that map to the
existing resolvers (D5); (e) do NOT dump the raw `toolInput` object into the preview — render a concise,
truncated, single-line summary (no secrets). Two specific traps: the `contexts/CLAUDE.md:30` doc claims the
provider already renders a dialog — it does **not** (the provider renders only `{children}`); and the sidebar
dim applies to panels 2–5 only, never the NOW slot holding the card.

Before declaring a phase complete, restate the observation point from the Verification table in your own words
and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered
chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation.
Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

When a phase's gate is green and nothing Tier 3 surfaced, the orchestrator dispatches the next phase in the
same turn — it does not end the turn to summarize or ask. The turn ends between phases only for a Tier 3
discovery needing a user call, a genuine user-judgment decision, or wave-end. See the Phase-boundary protocol
in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-5-workbench-permission-overlay/wave-5-decisions.md` with Decisions
   1–8 (Decision 2 carrying the best-practice spectrum). Gate to Phase 1.
2. **Author the Phase 1 acceptance test first (orchestrator).** Per
   `~/.claude/rules/orchestrator-owned-acceptance-tests.md`: a failing test at
   `src/renderer/components/Workbench/Permission/permission-approval.acceptance.test.tsx` expressing the
   card→context resolver contract — render `<Workbench>` (flag on) with a mocked `ApprovalContext` providing one
   `ApprovalRequest`; assert the terminal overlay shows the tool name + command preview; fire Approve → assert
   `approve(requestId)` called once and the request clears; Deny → `reject(requestId, reason?)`; Always →
   `alwaysAllow(requestId, sessionId, toolName)`; assert a single Y keypress resolves exactly once. Confirm it
   FAILS before dispatch.
3. **Phase 1 — sonnet-implementer (conceptually-risky).** Brief: build `Workbench/Permission/PermissionCard.tsx`
   + `useWorkbenchApproval.ts` (single keyboard owner, D3) consuming `useApprovalContext()`; mount the terminal
   overlay as an absolutely-positioned child of `CenterPane` (D6), glass + amber + slide-up, only when
   `pendingCount > 0`; concise `toolInput` preview (no full dump). Implement against the acceptance test (may not
   modify it). Gate: acceptance test passes + `useWorkbenchApproval` unit tests green + `test:layout`/`test:renderer`
   green + lint/tsc clean + **`sonnet-phase-reviewer` pass** (resolver-binding + single-keyboard-owner risk) +
   manual: overlay shows the live tool and Y approves. Orchestrator cross-phase check: is the `PermissionCard`
   API shaped so Phase 2's sidebar variant is a prop/variant flip, not a fork?
4. **Phase 2 — sonnet-implementer (conceptually-risky).** Brief: swap `AgentSidebar.tsx:179` `NowBlock` →
   `PermissionCard` (sidebar variant) when `pendingCount > 0`; dim panels 2–5 to 0.7 (NOT the NOW slot); reuse the
   **same** card + hook — no second keyboard binding (D3). Gate: render tests (swap + dim + single-resolve with
   both surfaces mounted + flag-off byte-unchanged) green + `test:layout`/`test:renderer` green + lint/tsc clean +
   **`sonnet-phase-reviewer` pass** (NOW-slot swap + no-second-keyboard-owner invariant) + manual: sidebar NOW
   becomes the card, panels dim, Always resolves once.
5. **Phase 3 — wave wrap.** `npm run lint`, `npm run typecheck`, prettier, `npx vitest run
   src/renderer/components/Workbench` (+ full suite in background). Orchestrator full-wave diff review. `/review`
   mechanical gap-check (Check 6 if stryker). Update `Workbench/CLAUDE.md` (Wave 5: dual permission UI; consume
   `useApprovalContext`; single keyboard owner) + fix the stale `contexts/CLAUDE.md:30` line. Author
   `wave-5-result.md`. Append `CHANGELOG [2.26.0]`. Run `/ui-smoke 5` (UI-bearing; live smoke deferred per the
   Wave 0–4 posture — written + queued for next dev session). Local tag `v2.26.0` (push per the 2026-05-19
   bulletin — pushing safe, merges wait for CI minutes). Update `HANDOFF.md`. `/promote-vendor-lessons 5` (likely
   no-op — no vendor SDK). `/audit-followups wave-5-workbench-permission-overlay` — and file the
   orphaned-`ApprovalDialog` finding as a follow-up (see Risks).
