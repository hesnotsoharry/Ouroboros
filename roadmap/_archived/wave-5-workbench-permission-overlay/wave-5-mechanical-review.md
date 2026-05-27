# Wave 5 review — mechanical gap check

**Inputs resolved:**
- Plan: `roadmap/wave-5-workbench-permission-overlay/waveplan-5.md`
- Diff range: `80bbe16d..HEAD` (commits `6dc5ffa2` Phase 1, `e67c7341` Phase 2)
- Graph: fallback (grep + import-following; codemode graph tools deferred this run — Check 1/3 findings marked accordingly)
- Run timestamp: 2026-05-22

## Check 1: Forward-trace
- Change sites traced: 6 symbols + 1 mount edit (`CenterPane`)
- Paths reaching production consumer: 6
- Paths flagged as dead: 0

Traces (fallback):
- `PermissionOverlay` → imported by `Terminals/CenterPane.tsx` (rendered in the workbench centre region) → PRODUCTION (UI render).
- `PermissionSidebarTakeover` → imported by `AgentSidebar/AgentSidebar.tsx` (NOW-slot swap) → PRODUCTION (UI render).
- `useWorkbenchApproval` → called by `PermissionOverlay` → PRODUCTION.
- `PermissionCard` (+ `PermissionCardProps`) → rendered by `PermissionOverlay` + `PermissionSidebarTakeover` → PRODUCTION.
- `usePermissionRejectFlow` (+ `RejectFlow`) → called by `PermissionCard` → PRODUCTION.
- `PermissionCard.styles` consts (incl. `ELAPSED_STYLE`, all `SIDEBAR_*`) → imported by `PermissionCard.tsx`; eslint `no-unused-vars` clean confirms none orphaned.
- Threaded value `elapsedSec`: produced in `useWorkbenchApproval`/`useSidebarApproval` → passed to `PermissionCard` → consumed in `CardHeader` (rendered). No silent drop (the Phase-1 reviewer's "threaded but dropped" flag was resolved — now consumed).

## Check 2: Plan universal-quantifier cross-reference
- Universals found in plan: 3 ("exactly once" per action; "single keyboard owner"; "both presentations render simultaneously")
- Universals where diff covers all instances: 3
- Universals flagged as narrowed: 0

The single-keyboard-owner universal is the load-bearing one; verified there is exactly one `window.addEventListener('keydown', …)` across the permission subsystem (`useWorkbenchApproval.ts:61`), and the frozen acceptance test asserts a single keypress resolves once with both surfaces mounted.

## Check 3: Export audit
- New exports added: ~30 (mostly style consts in `PermissionCard.styles.ts`)
- Exports with production consumers: all
- Exports flagged as dead: 0

All style consts are imported by `PermissionCard.tsx` (lint-clean — no unused). Component/hook/type exports consumed as traced in Check 1. No `DEFERRED-CONSUMER` markers needed.

## Check 4: Schema-removal migration safety
- Trigger: skipped — no schema property removals in this wave's diff (`git diff` on `configSchema*`/`configAppTypes.ts` is empty; the wave is renderer-only).

## Check 5: Boundary-phase orchestrator-owned acceptance test verification
- Trigger: skipped — no cross-boundary phases declared in this wave plan. The wave consumes an existing in-renderer context (`useApprovalContext`); the `approval:*` IPC and `approvalManager` are untouched, so no new protocol contract was crossed.
- Note (exceeds requirement): the orchestrator nonetheless authored a frozen acceptance test (`Permission/permission-approval.acceptance.test.tsx`) before Phase 1 dispatch (added in `6dc5ffa2` alongside impl, but orchestrator-authored and implementer-frozen by instruction); it asserts the card→context resolver contract and the single-keypress-resolves-once invariant (8/8).

## Check 6: Test theater detection via mutation score
- Trigger: fired — `stryker.config.mjs` present at root.
- Status: **DEFERRED to the carried-forward pre-merge mutation task** (not run this session).
- Rationale: (a) merges into `master` are blocked until 2026-06-01 (GH Actions minutes) and the HANDOFF already carries an open pre-merge mutation task covering Wave 3/4 adapter survivors — Wave 5 joins it; (b) this is a UI-heavy (trophy) wave whose survivors are expected to skew to inline-style/JSX constructs, acceptable per the Wave 3/4 posture; (c) the wave's behavioral logic surface — `useWorkbenchApproval` resolver binding + the single-keyboard-owner invariant — is covered by the frozen acceptance test's exact-arg / exactly-once assertions, which are mutation-resistant by construction; (d) running Stryker now would contend with the in-flight full vitest suite.
- Pre-merge action: before the 2026-06-01 merge, run `npm run mutation:test` and tighten any survivor in the **adapter/derivation logic** of `Permission/**` (UI-style/JSX survivors acceptable).

## Verdict

**FLAG (non-fatal)**

Checks 1–3 pass clean (every new export reaches a production consumer; the single-keyboard-owner universal holds). Checks 4 and 5 are correctly skipped (renderer-only, no schema removal, no declared cross-boundary phase). The only flag is Check 6: the mutation run is **deferred** to the existing carried-forward pre-2026-06-01 merge task, consistent with the Wave 3/4 UI-wave posture — non-fatal, and the merge gate enforces it before the wave can land on `master`. No structurally fatal findings; the wave proceeds to tag/push (merge waits on the mutation task + CI-minute restore).
