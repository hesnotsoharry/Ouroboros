---
project: agent-ide
updated: 2026-05-29
active-focus: wave-101 telemetry-pipeline-removal (scaffolded, ready to execute)
last-wave: wave-14-rails-ui-fix-sweep
last-wave-status: SHIPPED-PENDING-MANUAL-SMOKE
---

## Current state

- Branch: **`freeze-fix-and-wave-101-scaffold`** off master. Track A committed (`c2bfa902`). **Nothing pushed this session.**
- **The freeze is SOLVED and stopgapped.** Root cause: the **telemetry SQLite store** — a 100 ms `flushEvents` synchronous `better-sqlite3` write + a forced WAL checkpoint against a **689 MB `telemetry.db`** blocked the main thread up to **193 s** (whole machine froze). It was NOT the watcher fan-out (prior session's lead was wrong) and NOT the deferred purge. Note: the prior static pass *ruled telemetry out* as O(1); the live launch proved it was the cause — runtime data beat static analysis here.
- **Stopgap applied:** `telemetry.db` (+`-wal`/`-shm`) moved to `AppData/Roaming/ouroboros/telemetry/_stopgap-backup-20260529-165653/`. Confirmed by relaunch — worst event-loop block **193 s → 2 s**, `services-ready` **6.4 s → 3.2 s**. Freeze gone; the fresh DB regrows slowly until wave-101 deletes the writers.
- **Telemetry pipeline confirmed fully orphaned** (two explorer passes, verified against code): feeds only removed consumers — router (gone), chat (Wave 100), the never-mounted `Observability/OrchestrationInspector` panel; graph went standalone-MCP, auto-inject removed (Wave 22). **The live workbench `AgentSidebar` uses the live `hooks.ts`→renderer stream, NOT the SQLite store** — this is the load-bearing constraint for the removal.
- HELD: `66369791` (Thing 3, windowGroups multi-root persistence), still not pushed. Instrumentation (`main.ts`, `migrateStaleRoots.ts` `[trace:startup]`) intentionally **uncommitted** — still useful (it confirmed the stopgap). Product: terminal workbench shell only (chat removed Wave 100 / v2.35.0).

## Next steps

1. **Execute wave-101** — `roadmap/wave-101-telemetry-pipeline-removal.md` (PLANNED, 7 phases, ~80–100 files). Wholesale deletion of the telemetry persistence/analytics layer. **CRITICAL:** Phase 1 (read-only) maps the `hooks.ts` seam — live renderer-emission (KEEP) vs persistence calls `store.record`/`tapEditProvenance`/`tapGraphUsage` (REMOVE) — before any deletion. AgentSidebar is the live canary checked at every phase. Do NOT `rm -rf src/main/telemetry` and chase compile errors.
2. Commit the wave-101 scaffold + this HANDOFF (currently pending in the working tree, this branch).
3. After wave-101 ships: clean `~/.ouroboros/telemetry/` (queue/processed/jsonl + the stopgap backup); decide on the held instrumentation + Thing 3 (`66369791`).

## Track A — residual micro-lag (committed `c2bfa902`, separate root cause)

Uncached `git:status`/`git:statusDetailed` + undebounced `useGitStatusDetailed` fired one `git status` subprocess per `files:change` per root (3 roots × N inner Claude Code sessions) → subprocess storm, repeated sub-2 s jank, `git:branch` 4–26 s under load. Fix: new `gitStatusCache.ts` (5 s TTL + dogpile coalescing, mirrors `gitBranchCache`) on both channels; 150 ms debounce + in-flight guard on the detailed hook; poll 3 s→8 s. Deferred (noted in commit): `directoryWatchRegistry` listener-multiplexer consolidation, subprocess concurrency cap.

## Deferred — UI (untouched)

- Right-click menu z-index (renders behind rail) · inner rail showing only "Running" with no sessions · globe re-scope to project.
- Wave 14 manual smoke: `_archived/wave-14-rails-ui-fix-sweep/wave-14-smoke-report.md`.

## Backlog

- Wave 15 cleanup seeds: pre-existing-test-failures, workbench-projectswitch-timeout, channel-catalog-persist.
- Follow-ups: internalmcp-asar-packaging. (`vestigial-chat-orchestration-cleanup` is now subsumed by wave-101's `src/main/research/` deletion; telemetry-retention LATENT bug is moot once wave-101 deletes the store.) Bugs: chatstatenewpath-dynamic-require, silent-buildrepoindex-hang, e2e-teardown-hang.

## Reference index

- Conventions: [`../CLAUDE.md`](../CLAUDE.md) · Decisions (6): [`decisions/`](decisions/) · Vendor-gotchas: [`../.claude/vendor-gotchas/`](../.claude/vendor-gotchas/)
- Wave history: [`_index-history.md`](_index-history.md) · Archived: [`_archived/`](_archived/)
- Stryker floor 21% (current 31.72%) · lockfile: `npm run lockfile:sync` (WSL2) only.
