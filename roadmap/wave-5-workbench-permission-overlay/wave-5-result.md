---
status: SHIPPED
created: 2026-05-22
updated: 2026-05-22
wave: 5
slug: workbench-permission-overlay
---

# Wave 5 — Workbench Permission Overlay — Result Brief

## What shipped

The canon §13 **dual-presentation permission UI**, inside the canon workbench shell (behind the default-off
`layout.canonWorkbench` flag), built **over the existing approval pipeline** — no new protocol, no
main-process / IPC / config-schema change. Two surfaces render simultaneously when a tool needs approval:

1. **Terminal overlay** (`Permission/PermissionOverlay.tsx`, mounted in `Terminals/CenterPane`) — an
   absolutely-positioned glass card anchored near the bottom of the terminal pane (`--glass-overlay` +
   `--blur-strong` + 1px `--warning` border, slide-up), naming the tool + a truncated command preview,
   with Approve (Y) / Always `<tool>` (A) / Deny (N).
2. **Sidebar NOW-takeover** (`Permission/PermissionSidebarTakeover.tsx`, swapped into `AgentSidebar`'s NOW
   slot) — the same card in a tighter layout (full-width Approve, then Always + Deny); panels 2–5 dim to 0.7.

Both render the **same** `PermissionCard` primitive and resolve through the **same** `useApprovalContext()`
resolvers (`approve` / `reject` / `alwaysAllow`). Pressing Y/A/N once resolves the request and clears it.

## Phases

| Phase | What | Commit |
|---|---|---|
| 0 | ADR (8 decisions) | (in plan) |
| 1 | `useWorkbenchApproval` hook (single keyboard owner) + `PermissionCard` (+`.styles`) + `PermissionOverlay` + `CenterPane` mount | `6dc5ffa2` |
| 2 | `variant='sidebar'` layout + `PermissionSidebarTakeover` + `AgentSidebar` NOW-swap + panel dim | `e67c7341` |
| 3 | Wave wrap (this brief, CLAUDE.md updates, CHANGELOG, follow-ups, tag) | — |

## Key decisions (ADR `wave-5-decisions.md`)

- **D1** — consume `useApprovalContext()`; the protocol/queue/IPC are untouched.
- **D2** — both presentations render simultaneously, one shared `PermissionCard`.
- **D3** — the Y/A/N/Esc shortcut is a SINGLE `window`-level keydown handler owned by `useWorkbenchApproval`,
  called by exactly one mounted component (`PermissionOverlay`). The sidebar reads `useApprovalContext()`
  directly (clicks only) — calling `useWorkbenchApproval()` twice would register a duplicate handler.
- **D4** — no `AgentMonitor/**` imports; canon-tokened Workbench-local components (the AgentMonitor
  `ApprovalDialog` was reference only).
- **D5** — Approve / Always-for-tool / Deny only; "Always for project" (canon v2) deferred.
- **D6** — overlay anchored to the terminal region; sidebar takeover in the NOW slot.
- **D7** — optional two-stage reject-reason flow preserved.
- **D8** — gated behind `layout.canonWorkbench`; no new flag.

## Divergences from the plan (surfaced by the implementer, accepted)

- **Scoped sidebar testids** (`permission-sidebar-approve` / `-always` / `-deny`) instead of reusing the
  overlay's `permission-*` testids. Reason: the acceptance test renders the full `<Workbench/>` with both
  surfaces mounted; identical testids would make singular `getByTestId` throw. Sound — accepted.
- **`AgentSidebar` reads `useApprovalContext()` directly** (via a private `useSidebarApproval`) rather than
  `useWorkbenchApproval()`. This is the *correct* way to honor D3 — the single keyboard owner stays in the
  overlay's hook call; the sidebar binds only clicks. Slight divergence from D3's literal wording ("the hook
  owns the keyboard"), but it preserves the invariant (one global handler total). Accepted.

## Gates

- **Orchestrator-owned acceptance test** (`Permission/permission-approval.acceptance.test.tsx`, 8/8, frozen —
  the implementers could not modify it): overlay surfaces tool + command; Approve/Always/Deny each route to
  the correct resolver exactly once; Deny is the two-stage reason flow; **a single keypress resolves exactly
  once with both surfaces mounted** (the D3 proof); no overlay when idle.
- **Phase 2 render tests** (`AgentSidebar.permission.test.tsx`, 7/7): NOW-slot swap, dim target (panels 2–5
  only), single resolve, sidebar layout, idle byte-identity.
- **Workbench suite**: 190/190.
- **tsc** clean; **`eslint src/`** 0 errors (wave files 0 warnings); **prettier** clean.
- **Per-phase reviews**: Phase 1 `sonnet-phase-reviewer` FLAG (elapsedSec/variant inert) — resolved inline
  (elapsedSec rendered; variant wired in Phase 2). Phase 2 `sonnet-phase-reviewer` PASS (one non-blocking
  cosmetic FLAG — elapsed has no live ticker → follow-up).
- **Orchestrator full-wave diff review**: PASS.
- **Full suite + `/review`**: see "Wrap status" below.

## Follow-ups filed

- `roadmap/follow-ups/2026-05-22-orphaned-agentmonitor-approvaldialog.md` (MED) — the legacy
  `AgentMonitor/ApprovalDialog` is mounted nowhere; legacy IDE shell approval coverage unverified. Expected
  resolution = deletion at Wave 7 cutover, not repair.
- `roadmap/follow-ups/2026-05-22-permission-card-elapsed-no-ticker.md` (LOW) — the elapsed pill has no live
  ticker (cosmetic; pre-existing pattern; both surfaces).

## NOT done / deferred

- **Live UI smoke** (`/ui-smoke 5`) deferred per the Wave 0–4 posture (Cole isn't using the app until the
  remake is done). Written + queued at `wave-5-smoke-report.md`. **Next dev session:** enable
  Settings → Appearance → "Canon workbench", run a `claude` session, trigger a tool that needs approval
  (e.g. a Bash command outside the allowlist), and confirm: the glass overlay slides up over the terminal
  AND the sidebar NOW panel becomes the card (panels 2–5 dimmed); Y approves once and the agent continues;
  A whitelists; N opens the reason field then denies.
- **`/promote-vendor-lessons 5`** — no-op (no third-party SDK touched).

## Files of record

- Plan: `waveplan-5.md` · ADR: `wave-5-decisions.md` · this brief · `wave-5-smoke-report.md`
- Code: `src/renderer/components/Workbench/Permission/**`, `…/AgentSidebar/AgentSidebar.tsx`,
  `…/Terminals/CenterPane.tsx`
- Docs: `Workbench/CLAUDE.md` (Wave 5 line + keyboard-owner gotcha), `contexts/CLAUDE.md` (corrected the
  stale "provider renders ApprovalDialog" claim)
