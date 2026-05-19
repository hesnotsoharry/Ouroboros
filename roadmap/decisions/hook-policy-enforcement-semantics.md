---
status: ACTIVE
decided: 2026-04-28
decided-in: wave-50
type: ADR
---

# ADR: Hook policy enforcement semantics — deny, not approval-gated

## Context

Wave 50 migrated several project rules (block secret writes, block lockfile edits, block minified-file operations) from CLAUDE.md text into PreToolUse hooks. The question was how hooks should signal a policy violation: route through the IDE's existing approval UI (which implies the user can override), or emit an immediate deny without approval routing.

The same pattern applies to all subsequent enforcement hooks (`warnFullTestSuite`, `fix_cycle_detector`, `agent_catalog_enforce`, `executor_drift_nudge`). Wave 50 established the canonical semantic.

## Options considered

- *Route through approval UI:* Displays a permission dialog; user can approve or deny. Implies policy violations are user-confirmable. Industry pattern for permission-gated operations.
- *Immediate deny (bypass approval flow):* Hook emits `{ decision: 'reject', reason: '...' }` immediately. No user dialog. Policy-as-code pattern — violation equals rejection, period.
- *IDE-log-only (advisory):* Hook logs to the IDE's internal log; agent sees `approve` (proceed). Agent doesn't see the warning; only human reading logs does.

## Pick

**Unconditional policy violations → immediate deny.** Hooks emit `{ decision: 'reject', reason: '...' }` directly, bypassing the approval UI.

**Advisory signals** (e.g., `warnFullTestSuite` — "you're running the full test suite without a path argument") → IDE-log-only via `log.info('[hook-enforce] warn', ...)`. Harness sees `approve`. Agent doesn't see the advisory; it goes to operator logs only.

## Rationale

Policy-as-code engines (OPA, Cedar, AWS Evaluation Logic) short-circuit on violations — approval routing implies the violation can be legitimized by user consent, which is the wrong semantic for unconditional rules like "never write to `.env` files" or "never edit lockfiles manually." Routing those through an approval dialog would imply user override is expected, which it isn't.

Advisory signals are different: they're guidance ("this action is usually suboptimal"), not prohibitions. Blocking the agent for an advisory would add friction without preventing anything the policy requires. Log-to-ops, don't interrupt user flow — standard for advisory hooks.

## Consequences

- Users can disable individual hooks via `hooks.enforcedRules` config. The deny is deterministic and auditable; circumvention requires explicit config change, not just clicking "approve" in a dialog.
- Policy violation reason surfaces in agent output (the `reason` field in the deny response). Agent sees why it was blocked and can adapt.
- Advisory hook signals (e.g., full-test-suite warns) are invisible to the agent. Telemetry can measure correlation between advisory-trigger events and outcomes; if the signal warrants upgrading to a deny, a future wave graduates it.
- **Any new enforcement hook must choose one of these two tiers explicitly:** deny (unconditional policy) or IDE-log advisory (guidance). A hook that sometimes denies and sometimes advises must have a clear rule for which path it takes and when.
- The `graph-first` routing compliance hook (wave 50, Decision 3) was measured at 93.9% adherence and stayed at IDE-log-only. Its config key (`hooks.enforceGraphFirst`) is reserved for future promotion to deny tier if adherence drops below 70%.
