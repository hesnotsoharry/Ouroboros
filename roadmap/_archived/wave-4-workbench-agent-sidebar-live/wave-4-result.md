---
status: SHIPPED
created: 2026-05-22
updated: 2026-05-22
wave: 4
slug: workbench-agent-sidebar-live
version: 2.25.0
---

# Wave 4 — Agent Sidebar Live: Result Brief

## What shipped

The five canon-workbench agent-sidebar **panel bodies** now render real runtime data, extending the
**same** `useWorkbenchAgentData` adapter Wave 3 built (no competing adapter — ADR D1). Behind the
default-off `layout.canonWorkbench` flag. Renderer-only; no main-process, IPC-contract,
config-schema, or SQLite change. `AgentStatus` / `AgentSession` (`AgentMonitor/types.ts`) untouched.

| Panel | Live source |
|---|---|
| **NOW** | adapter `now` (`activeTool` / `target` / `elapsedSec`) — existing Wave-3 fields, wired |
| **Context** | adapter `context` (`contextStats` + `elapsedSec`) — live since Wave 3, wired |
| **Files Touched** | `deriveTouchedFiles` over `AgentSession.toolCalls` (Edit/Write/Read → status), ellipsis-tolerant dedup; `+N/−N` badges from the diff pipeline |
| **Latest Hunk** | `diff_review_ready` → `git:diffReview` → `FileDiff → MockDiffHunk`, ephemeral hook state |
| **Hook Timeline** | `deriveTimeline` merging `toolCalls` + `conversationTurns` by timestamp; `think` dropped (D6) |

## Phases (one commit each)

| Phase | Commit | Content |
|---|---|---|
| 1 | `3850e8ce` | NOW + Context wired from existing adapter fields (no new derivation/IPC). |
| 2 | `a71bff1a` | Files Touched **list** + Hook Timeline derivations; `think` dropped; stable timeline IDs. Phase-reviewer FLAG (3 fixes) resolved. |
| 3 | `6fdc6cd6` | Latest Hunk + Files Touched **badges** (boundary). `useWorkbenchAgentData.diff.ts` subscription + `FileDiff → MockDiffHunk` map + badge enrichment; ephemeral ref. Orchestrator-owned acceptance test. |
| 4 | (this commit) | Mock sweep + CLAUDE.md + CHANGELOG [2.25.0] + result brief + tag + handoff. |

## ADR compliance (Decisions 1–8)

- **D1** — same adapter extended; `AgentMonitor/types.ts` `git diff` empty. ✓
- **D2** — reused the Wave-94 diff pipeline; no new git op, no PostToolUse extension. ✓
- **D3** — Latest Hunk is ephemeral `useState` in `useWorkbenchAgentData.diff.ts`; no `AgentSession`/reducer/SQLite change. ✓
- **D4** — primary-session selection inherited from Wave 3. ✓
- **D5** — diff surfaces piggyback `enableTerminalDiffReview`; degrade to empty/badge-free when off (Cole-locked). ✓
- **D6** — `think` variant dropped from the live timeline type (no wire source). ✓
- **D7** — no `AgentMonitor/**` component imported inside `Workbench/AgentSidebar/**`; Wave-1 shells wired, not remounted. ✓
- **D8** — `Mock*` types kept as the adapter output contract; only `MOCK_*` data constants swept (`MOCK_STATUS_BAR` kept — still live in StatusBar). ✓

## Boundary phase (Phase 3) — orchestrator-owned acceptance test

Per `~/.claude/rules/orchestrator-owned-acceptance-tests.md`: the orchestrator authored
`AgentSidebar/AgentSidebar.phase3.acceptance.test.tsx` (event→fetch→`FileDiff`→render contract +
flag-off + no-snapshot degrade paths), confirmed it failed 5/5 ("adapter must subscribe via
electronAPI.hooks.onAgentEvent" — not-yet-implemented, not setup-broken), then dispatched the
implementer with "may not modify it." Implementer made it pass; the orchestrator re-ran it and
verified the file's strict assertions were intact. The implementer's 5 `Workbench.test.tsx` edits
were verified as legitimate contract-tracking (placeholder behavior; they now positively assert the
static mock no longer leaks).

## Gates

- `npx vitest run src/renderer/components/Workbench` — **175/175** green (incl. the acceptance suite + the two derivation unit-test files).
- `npm run typecheck` — clean (validated the mock sweep left no dangling references).
- `npm run lint` — **0 errors** (4 pre-existing warnings, all outside Workbench).
- Full renderer suite (`src/renderer`) — run at wave-end.
- Phase-2 + Phase-3 each got a `sonnet-phase-reviewer` pass (Phase 3: PASS on scope/integrity/runtime; one non-blocking FLAG accepted for codebase consistency → follow-up).

## Follow-ups filed

- `follow-ups/2026-05-22-workbench-diff-subscription-latest-ref.md` (LOW) — convert the diff-event subscription in both `useWorkbenchAgentData.diff.ts` and `useDiffReviewTrigger.ts` to the latest-ref pattern (eliminates the teardown/re-subscribe-on-flag-toggle window). Accepted as-is this wave for consistency with the existing reference pattern.
- `follow-ups/2026-05-22-workbench-files-touched-truncated-path-badges.md` (LOW) — make the `+N/−N` badge match ellipsis-tolerant for >80-char paths (currently exact `relativePath` match → badge-free on deep paths; an accepted graceful degrade).
- Pre-existing, still open: `follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (status-bar git +adds/−dels + per-project dirty — needs a new main-process git op).

## Observation

Verified at the test boundary only (no live IDE run — Cole is not using the app until the workbench
remake is complete, per the Wave 0–3 posture). The acceptance test exercises the full Phase-3 path
(synthetic `diff_review_ready` → subscription callback → `git:diffReview` fetch → `FileDiff[]` →
`MockDiffHunk` → `LatestHunk` renders the parsed lines + `FilesTouched` `+N/−N` badges), plus both
degrade paths. `/ui-smoke 4` written + queued for the next dev session.

## Not in scope (later waves)

Permission overlay / sidebar takeover → Wave 5. Theme treatment / responsive collapse → Wave 6.
Cutover / deleting legacy shells → Wave 7. Status-bar git stats → the open follow-up above.
