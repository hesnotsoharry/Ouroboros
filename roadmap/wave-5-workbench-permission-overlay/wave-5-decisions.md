---
status: DRAFT
created: 2026-05-22
updated: 2026-05-22
wave: 5
slug: workbench-permission-overlay
---

# Wave 5 — Architecture Decisions

Canon §13 (`design-system/canon.html:750–807`) specifies a dual-presentation approval UI: a glass
terminal overlay AND a sidebar NOW-panel takeover, both offering Approve-once / Always-for-tool / Deny.
The approval **pipeline already exists end-to-end** — the file-poll protocol (`approvalManager.ts` →
`approval:request` IPC → `ApprovalProvider` queue), the resolvers (`approve`/`reject`/`alwaysAllow` at
`ApprovalContext.tsx:100–134`), and a precedent UI (`AgentMonitor/ApprovalDialog.tsx`, currently orphaned).
The canon `<Workbench>` shell has no approval surface yet. These decisions commit Wave 5 to a
presentation-only build over the existing context.

---

## Decision 1: Consume the existing `useApprovalContext()` — no new protocol, no new adapter

**Context:** Reconciliation §13 ruled "keep the real protocol, restyle the surface." The renderer-side
contract is already complete: `ApprovalContext.tsx:14–20` provides `{ pendingCount, requests,
approve(id), reject(id, reason?), alwaysAllow(id, sessionId, toolName) }`, fed by
`window.electronAPI.approval.onRequest/onResolved` (`:60–79`) and resolved via `approval.respond` /
`approval.alwaysAllow` IPC. Wave 5 must not reinvent any of this.

**Pick:** Reuse `useApprovalContext()` directly from the new Workbench permission components. — *industry standard (consume existing context)*

**Rationale:** The protocol, queue, IPC, and resolvers are live and battle-tested by two other surfaces
(`WorkbenchApprovalPanel`, `AgentChatApprovalBanner`). Building a parallel path would duplicate the queue
and risk divergent resolve semantics.

**Consequences:** Wave 5 is renderer-only and presentation-only — no main-process, IPC-contract, config-schema,
or `approvalManager` change. Latent issues in the protocol (e.g. the orphaned AgentMonitor `ApprovalDialog`)
are out of scope and left for Wave 7 cutover.

---

## Decision 2: Both presentations render simultaneously, fed by one shared `PermissionCard` primitive

**Context:** Canon describes two surfaces — a 460px glass overlay over the terminal pane (§13a) and a
NOW-block takeover in the sidebar with the rest dimmed to 0.7 (§13b). The architectural question: render
both at once, render one with a user toggle, or render a single stage-root modal. The feature was
commissioned explicitly as "dual-presentation … (terminal overlay + sidebar NOW-panel takeover)."

**Options considered:**
- *Industry standard:* one modal/overlay surface (a single focal prompt) — VS Code, Cursor approval prompts.
- *Emerging best practice:* dual ambient surfaces — a focal overlay where the user's eye is (the terminal) PLUS a persistent secondary indicator in the agent sidebar, both reflecting the same state. Matches the canon's "glass workbench" attention model.
- *Experimental:* a single component teleported between two slots by state.

**Pick:** Dual surfaces, simultaneous, one shared `PermissionCard` primitive driving both. — *emerging best practice*

**Rationale:** The canon and the feature commission both call for dual presentation; a shared primitive keeps
the action model (buttons, command preview, header) in one place so the two surfaces cannot drift. The overlay
grabs attention where the user is looking; the sidebar takeover is the persistent at-a-glance state.

**Consequences:** Commits to a shared `PermissionCard` + a `useWorkbenchApproval` selector hook feeding two
thin presentation wrappers. Requires Decision 3 (single keyboard owner) to avoid double-fire. Punts any
"collapse to one surface on small viewports" responsive behavior to Wave 6.

---

## Decision 3: Keyboard shortcuts (Y / A / N / Esc) bound exactly once

**Context:** With two presentations live simultaneously, naively binding the `keydown` handler inside each
presentation would fire `approve`/`reject` twice per keypress. The existing `ApprovalDialog.tsx:47–62` binds
the handler once because it's a single component; the dual-surface design breaks that assumption.

**Pick:** Bind the Y/A/N/Esc handler once in the `useWorkbenchApproval` hook (or a single Workbench-level
effect), not per-presentation. — *industry standard (single source of truth for global keys)*

**Rationale:** A single owner is the only way to keep the two visual surfaces decoupled from input handling.
The presentations become pure render; the hook owns selection (`requests[0]`), elapsed-time, resolver
binding, and keys.

**Consequences:** Both presentation components are visually independent and click-capable, but neither
binds global keys. The wave-end review verifies subscribe/unsubscribe symmetry and that no second `keydown`
listener exists in `Workbench/Permission/**`.

---

## Decision 4: Do NOT remount AgentMonitor's `ApprovalDialog` / `ApprovalDialogCard`

**Context:** `AgentMonitor/ApprovalDialog.tsx` (+ `ApprovalDialogCard.tsx`, `ApprovalDialogCardParts.tsx`)
already implements the action model, keyboard map, focus trap, and reject-reason flow. Tempting to import
it. But it sits in the ~48-file `AgentMonitor/**` subsystem whose coupling Waves 3 and 4 deliberately kept
out of `Workbench/` (Wave-3 D1, Wave-4 D7).

**Pick:** Build canon-tokened Workbench-local permission components; treat the AgentMonitor dialog as a
**reference** for the action model + keyboard map, not a dependency. — *consistent with Wave 3/4 posture*

**Rationale:** Importing the AgentMonitor dialog drags in `React.memo` perf assumptions and the broader
subsystem coupling, defeating the Workbench's clean-shell goal. The action model is ~3 buttons + a preview —
cheap to re-author against canon tokens.

**Consequences:** New components under `Workbench/Permission/`. The orphaned AgentMonitor `ApprovalDialog`
stays orphaned until Wave 7 deletes the legacy shells; not Wave 5's job to clean up.

---

## Decision 5: "Always for project" (canon §13 v2) is out of scope; ship the three v1 actions

**Context:** Canon §13 lists four actions: Approve-once, Always-for-tool (session), **Always-for-project (v2)**,
Deny. The renderer context exposes exactly three resolvers — `approve`, `alwaysAllow(id, sessionId, toolName)`
(session-scoped), `reject` — with no project-scoped path.

**Pick:** Ship Approve-once + Always-for-tool + Deny (1:1 with the existing resolvers). Defer Always-for-project. — *scope discipline*

**Rationale:** The canon itself tags project-scope as v2. The renderer has no project-scoped resolver and
adding one would require a main-process `approvalManager` + persistence change — out of this renderer-only wave.

**Consequences:** The action row matches the existing `ApprovalDialog` exactly. Always-for-project, if wanted,
is a future wave touching `approvalManager` + settings (revocation UI). File a follow-up only if Cole asks for it.

---

## Decision 6: Terminal overlay = child of the center/terminal region; sidebar takeover = NOW-panel slot

**Context:** Canon anchors the overlay "24px from the bottom of the terminal pane" (§13a) and "NOW block
becomes the permission card" (§13b). If the overlay mounts at the stage root, "bottom of the terminal pane"
is undefined relative to the rails/sidebar.

**Pick:** Mount the terminal overlay as an absolutely-positioned child of the center/terminal region
(`Workbench.tsx` `CenterPane`, line 54); mount the sidebar takeover as a conditional swap of the `NowBlock`
slot inside `AgentSidebar` (`AgentSidebar.tsx:179`). — *positioning correctness*

**Rationale:** Anchoring each surface to its real region makes the canon's measurements well-defined and avoids
z-index stacking-context fights. No portal needed.

**Consequences:** The overlay's containing region must be `position: relative`. The sidebar container conditionally
renders the permission card in place of `NowBlock` and dims panels 2–5; off-state renders byte-identically to Wave 4.

---

## Decision 7: Preserve the optional reject-reason flow

**Context:** `reject(id, reason?)` accepts an optional reason; `ApprovalDialogCardParts.tsx:172–200` exposes a
reject-reason input toggled by the Deny button.

**Pick:** Reproduce the optional reject-reason input in the Workbench `PermissionCard` (Deny → reveal input →
confirm with reason). — *parity with existing behavior*

**Rationale:** The resolver already supports it and the precedent UI has it; dropping it would be a silent
regression in approval expressiveness. Cheap to re-author.

**Consequences:** The shared card owns the reject-reason input state. Keyboard: Esc/N reveals or confirms reject
per the existing semantics; the single keyboard owner (D3) handles the focus-vs-global-key interaction.

---

## Decision 8: Gating behind `layout.canonWorkbench` only — no new flag

**Context:** Every prior workbench wave gated behind the default-off `layout.canonWorkbench` flag
(`useCanonWorkbenchFlag.ts`; branch at `App.helpers.tsx:261`). The legacy approval surfaces
(`WorkbenchApprovalPanel`, `AgentChatApprovalBanner`) are independent of this flag.

**Pick:** Gate all Wave 5 UI behind `layout.canonWorkbench`; add no new flag. — *consistent with Waves 0–4*

**Rationale:** The whole `<Workbench>` shell already only renders when the flag is on. New permission UI lives
inside `Workbench/`, so it inherits the gate for free. The legacy surfaces stay untouched.

**Consequences:** Flag-off behaviour is unchanged (existing approval surfaces still work in their shells).
Flag-on adds the dual canon presentation. No coupling between the approval feature and the diff/terminal flags.
