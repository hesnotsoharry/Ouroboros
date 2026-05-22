---
status: OPEN
created: 2026-05-22
updated: 2026-05-22
type: follow-up
slug: orphaned-agentmonitor-approvaldialog
severity: MED
surfaced-by: wave-5-workbench-permission-overlay
---

# `AgentMonitor/ApprovalDialog` is mounted nowhere (orphaned)

## What

During Wave 5 grounding it was confirmed that `src/renderer/components/AgentMonitor/ApprovalDialog.tsx`
(+ `ApprovalDialogCard.tsx`, `ApprovalDialogCardParts.tsx`) is **mounted nowhere** — `<ApprovalDialog`
appears only inside its own definition file; no JSX usage exists across `src/renderer/`. The
`ApprovalProvider` (`contexts/ApprovalContext.tsx:136–145`) renders only `{children}` — it does NOT
render the dialog (the `contexts/CLAUDE.md` claim that it did was stale and was corrected in Wave 5).

The approval **context** (queue + `approve`/`reject`/`alwaysAllow`) is live and is consumed by:
- `Layout/ChatOnlyShell/WorkbenchApprovalPanel.tsx` (the Wave-89 chat-workbench shell)
- `AgentChat/AgentChatApprovalBanner.tsx` (the chat surface)
- `Workbench/Permission/**` (the canon workbench, as of Wave 5)

## Why it matters

The **legacy IDE shell** (`AppLayout`/`InnerAppLayout`) appears to rely on the orphaned `ApprovalDialog`
for its approval surface. If so, the legacy IDE shell currently has **no working approval UI** — a latent
gap. Not confirmed in a live run.

## Why deferred (not fixed in Wave 5)

- Wave 5 is renderer-only and scoped to the canon workbench; touching the legacy IDE shell is out of scope.
- The legacy shells (`AppLayout`/`InnerAppLayout` + the Wave-89 variant) are slated for **deletion at
  Wave 7 cutover** — fixing approval wiring in code that's about to be deleted is wasted effort.
- Active usage is terminal `claude` sessions, which prompt for permission inline in the terminal, not via
  the IDE approval queue — so the practical impact today is low.

## Recommended resolution

At Wave 7 cutover, delete `AgentMonitor/ApprovalDialog*.tsx` along with the legacy shells. If the legacy
IDE shell must remain usable before Wave 7 for any reason, mount `ApprovalDialog` (or the new
`Workbench/Permission` surface) in it — but the expected path is deletion, not repair.

## Pointers

- `src/renderer/contexts/ApprovalContext.tsx` — the live context
- `src/renderer/components/AgentMonitor/ApprovalDialog.tsx` — the orphaned component
- `roadmap/discovery/workbench-overhaul-reconciliation.md` — Decision 1 (shell strategy: delete at parity)
