---
status: SHIPPED-PENDING-SMOKE
created: 2026-05-26
updated: 2026-05-26
wave: 18
---

# Wave 18 — Multi-Window Perf — Result Brief

## TL;DR

Wave 18 addressed Cole's "I functionally can't use the app or my computer while the 3 windows are open" — a SHOWSTOPPER perf cascade triggered by 3-window concurrency. Diagnose-first decomposed 5 trace symptoms into 9 distinct findings; 6 got fixes, 1 was filed as follow-up (needs runtime data), 2 were dev-mode-only noise (not bugs).

**The user-felt killer was W3:** the cold-start indexer ran `getAllFileHashes()` synchronously on the main thread during `systemTwoRegistry.acquire() → watcher.initWithLaunchDiff()`. Routed through the existing worker thread via a new `launchDiff` message protocol. The 13.3s freeze should be gone from cold-start.

Other fixes: W1 clamps `npm run dev` to 1 window automatically; W2 adds shared `session.partition` so multi-window doesn't fight Vite; W4 coalesces concurrent `acquireContextLayer` per-root (3 windows × same root = 1 git subprocess chain, not 3); W5 silences 22x rulesWatcher noise; W6 dedups perf log flush.

## What shipped

8 commits on `wave-18-multi-window-perf` branch (will merge to master at wrap):

| Commit | Description |
|---|---|
| `bce3fce8` | docs(wave-18): lock Option C — full wave scope (on master, pre-wave) |
| `4f719046` | docs(wave-17): fold 4 follow-ups (pre-wave master commit, Wave 17) |
| `1752f9c6` | perf(wave-18): W1 single-window dev clamp |
| `f5d0c509` | perf(wave-18): W3 cold-start indexer worker offload |
| `524b7fa2` | perf(wave-18): W2 shared session partition for BrowserWindows |
| `dafcde03` | perf(wave-18): W4 coalesce concurrent acquireContextLayer per root |
| `9d23ceb0` | perf(wave-18): W5 + W6 polish — rulesWatcher + perf flush guards |
| (wrap commit pending) | |

## Findings → fixes mapping

| Finding | Severity | Fix shape | Phase | Commit |
|---|---|---|---|---|
| W1 — Unconditional N-window restore | HIGH | Detect dev via `npm_lifecycle_event`; clamp to 1 unless override | 3 | `1752f9c6` |
| W2 — No shared HTTP partition (27s bundle) | HIGH | `partition: 'persist:shared'` on webPreferences | 5 | `524b7fa2` |
| W3 — Main-thread SQLite jank (13.3s) | CRITICAL | New `launchDiff` worker message; `getAllFileHashes` moves to worker | 4 | `f5d0c509` |
| W4 — 12 concurrent git subprocesses | MEDIUM | Promise-dedup map on `acquireContextLayer` per root | 6 | `dafcde03` |
| W5 — rulesWatcher 22x Invalid handle | LOW | Catch filter accepts Windows error + activeRoot idempotency | 7 | `9d23ceb0` |
| W6 — Perf log flush x3 | LOW | `startupLogFlushed` one-shot guard | 7 | `9d23ceb0` |
| W7 — approval.wait x2 per ID | INVESTIGATE | Filed as follow-up (needs `connId` instrumentation to disambiguate) | n/a | new follow-up |
| W8 — mergeThreadCollection x5, xterm-init x12 | NONE | React StrictMode dev-mode double-invoke; absent in production | n/a | documented |
| W9 — buildRepoIndex x2 | NONE | Intentional two-pass design | n/a | documented |

## Phase outcomes

| # | Phase | Status | Output |
|---|---|---|---|
| 0 | Wave plan + ADR | DONE | `waveplan-18.md` |
| 1 | Parallel diagnose (5 + research) | DONE | 5 diagnostic markdowns + 1 research extract |
| 2 | Synthesize | DONE | Plan revision section "Synthesis — 9 findings" |
| 3 | W1 implementer | DONE | `1752f9c6` |
| 4 | W3 architect + implementer | DONE | architect plan + `f5d0c509` |
| 5 | W2 implementer | DONE | `524b7fa2` |
| 6 | W4 implementer | DONE | `dafcde03` |
| 7 | W5+W6 implementer | DONE | `9d23ceb0` |
| 8 | Smoke + wrap | IN-PROGRESS | This doc + smoke checklist (pending Cole's live trace) |

## Gates at wrap

- `tsc --noEmit`: PASS (full)
- `tsc -p tsconfig.web.json`: not re-run (no renderer-side type changes touched)
- `npx eslint src/...`: PASS on all 7 touched files (0 errors, 0 warnings)
- `test:codebasegraph`: 696 passed / 3 skipped (was 693 pre-wave; +3 from W3)
- `test:main`: PASS (broad scope covering all 7 touched files)
- prettier: applied at commit time
- Full `npm test`: DEFERRED (per scoped-script discipline; runs at push/CI)

## Critical orchestrator self-fixes during the wave

Three mid-wave course corrections worth flagging:

1. **W1 implementer's cross-env dep would have triggered the WSL2 lockfile-sync constraint.** Orchestrator dropped cross-env entirely and switched to `npm_lifecycle_event` detection — same outcome, no new dep, no lockfile drift. Self-fix criteria all held (diagnosed, tiny, in-context, no second bug).

2. **1B diagnostic citation was partially wrong.** The 1B agent named `IndexingPipeline.runPass()` as the main-thread blocker, but the W3 architect re-verified and found `runPass()` only executes in the worker — the actual stall is `autoSync.ts:361` `getAllFileHashes()`. The architect's correction was load-bearing; implementer would have refactored the wrong function without it.

3. **haiku-implementer for W5+W6 wrote to MAIN checkout instead of worktree** (same pattern as Wave 17's haiku-followup-auditor). Orchestrator manually moved files main→worktree and restored main checkout. The W5+W6 changes did land correctly in the wave-18 branch after this fix.

## Lessons (carry forward to Wave 19+)

1. **Wave 16 Lesson 2 / Wave 17 Lesson 1 keeps recurring.** `patchIpcMainHandle` timer-artifact pattern was the leading false-positive perf signal AGAIN in Wave 18 — for `files:saveFile` (12.9s artifact, ~5ms real) AND `config:set` (1-4s artifact, ~8-15ms real) AND was the same shape for the 13.3s jank-from-getAllFileHashes. **Treat slow-handler lines that fire ALONGSIDE jank events as suspect until the handler body is read.** The real signal is the jank event itself.

2. **Parallel diagnosis on disjoint surfaces works at N=5.** 5 sonnet-diagnosticians + 1 haiku-research-extractor returned in ~5 min total wall-clock (one was longer; majority returned by 5 min). Synthesis took ~10 min. Compared to sequential: ~30-45 min saved. Worth repeating when surfaces are clearly orthogonal.

3. **Architect catches diagnostic citation errors.** The W3 architect's first action was verifying the 1B diagnostic's claim against current code — and found it partially wrong. The diagnose → architect → implement pipeline catches diagnostic precision errors before they become implementer waste. Worth keeping the architect step for non-trivial fixes.

4. **Haiku agents writing to wrong filesystem location is recurring.** Wave 17 had the followup-auditor; Wave 18 had the W5+W6 implementer. The brief specified the worktree path; the agent wrote to main checkout anyway. Worth a meta follow-up: either tighten the prompt convention OR document that orchestrator must verify file location after every haiku write that targets a specific path.

5. **Promise-dedup is THE pattern for cross-window resource coalescing.** Wave 16 P7 (cache dogpile), Wave 18 W4 (acquireContextLayer). Same shape both times. Worth promoting to a project-wide pattern.

## Follow-ups generated by this wave

| File | Pri | Why |
|---|---|---|
| `roadmap/follow-ups/2026-05-26-approval-wait-double-fire-instrument.md` | LOW | W7: approval.wait fires 2x per requestId; could be two hook scripts or client reconnect. Add `connId` instrumentation; user runs trace; confirm or pivot. Filed as deferred. |
| `meta/roadmap/follow-ups/2026-05-26-haiku-implementer-wrong-checkout-target.md` | MED | Meta: haiku implementer wrote to MAIN checkout despite brief specifying worktree path. Same root-cause family as the 2026-05-25 haiku-research-extractor-missing-write-tool follow-up. Worth a unified fix at the catalog level. |

## NOT done / deferrals

1. **Live smoke trace — DEFERRED to Cole.** Smoke checklist at `wave-18-smoke-report.md`. The wave's acceptance signals (no 27s bundle load, no 13.3s jank, clean trace logs) need a real IDE session to verify.
2. **Full `npm test` — DEFERRED.** Scoped runs covered. Full suite runs at push/CI.
3. **Stryker mutation (Check 6) — DEFERRED.** Standing pre-merge task.
4. **Push to remote — STANDING AUTONOMY.** Will push after merge to master.
5. **Tag + CHANGELOG bump — PENDING Cole's call.** Current version 2.20.0; this is a perf wave with arguably user-facing impact (the IDE goes from unusable to usable at multi-window). Could be 2.20.1 (patch) or 2.21.0 (minor — "1-window dev default is new behavior").

## Wave temperature

**COOL.** 9 findings, 6 fixes, 1 deferred-investigate, 2 not-bugs. Diagnose-first discipline held. Parallel dispatch saved ~30 min. Three orchestrator course-corrections (cross-env drop, 1B citation, haiku-wrong-checkout) — each caught at the right layer. No fights with the test suite (one trivial mock-update for the new logger import). The pre-commit hook caught the comma-in-scope thing twice (annoying but not a bug). Worktree merge-to-master + close pending; aligned with Cole's standing directive.
