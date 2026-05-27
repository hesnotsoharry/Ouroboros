---
project: agent-ide
updated: 2026-05-27
last-wave: wave-14-rails-ui-fix-sweep
last-wave-status: SHIPPED-PENDING-MANUAL-SMOKE
next-wave: wave-15 (cleanup: pre-existing test failures + Wave 22 GraphPanel + Wave 100 UsageDashboard collateral)
---

## Current state

- Branch: master · Latest commit: `bcb0f73f` · Tag: `v2.36.0` on origin
- Last wave: Wave 14 SHIPPED 2026-05-27 — 4 rails/dock UI defects fixed (project-remove UX, inner-rail fake sessions, top dock terminal cwd, UnifiedRail real file tree + collapse)
- Active wave: none — between waves
- Outstanding: Wave 14 manual smoke checklist at `roadmap/_archived/wave-14-rails-ui-fix-sweep/wave-14-smoke-report.md` — walk once at next launch, flip PASS-MANUAL or FLAGGED
- Product state: terminal workbench shell only (chat surface fully removed in Wave 100 / v2.35.0); ChatOnlyShell retained as live shell variant

## Next 3 steps

1. Run Wave 14 manual smoke (`wave-14-smoke-report.md` in `_archived/`) — PASS closes the gate; any FAIL → dispatch `sonnet-diagnostician`.
2. Plan Wave 15 cleanup bundle: `2026-05-27-pre-existing-test-failures-surfaced-wave-14.md` + `2026-05-27-workbench-projectswitch-wave10-test-timeout.md` + `2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md` are the seed items.
3. After Wave 15: standalone codebase-graph-mcp (`C:\Web App\codebase-graph-mcp\`) may need asar packaging update — see `follow-ups/2026-05-27-internalmcp-asar-packaging.md`.

## Active work

- Wave in flight: none
- Open follow-ups: [inbox](follow-ups/) — top items: `2026-05-27-pre-existing-test-failures-surfaced-wave-14.md`, `2026-05-27-workbench-projectswitch-wave10-test-timeout.md`, `2026-05-27-vestigial-chat-orchestration-cleanup.md`, `2026-05-27-internalmcp-asar-packaging.md`, `2026-05-26-channel-catalog-missing-persist-shared-and-crash-log-count.md`
- Open bugs: [bugs/](bugs/) — `2026-05-17-chatstatenewpath-dynamic-require-threadstore.md` (OPEN), `2026-05-17-silent-buildrepoindex-hang-post-graph-ready.md` (TRIAGED), `2026-05-15-e2e-teardown-hang.md`
- Pre-existing uncommitted tree state: `tools/__fixtures__/train-context/test-output-weights.json` (M, timestamps only), `tools/__scratch__/sample.test.ts` (??, scratch dir)

## Reference index

- Project conventions: [`../CLAUDE.md`](../CLAUDE.md)
- Wave history: [`_index-history.md`](_index-history.md)
- Archived wave folders: [`_archived/`](_archived/) — all waves through Wave 14 + Wave 100 + Wave 60-99 series
- Durable decisions (6): [`decisions/`](decisions/) — mcp-server-registration-target · mcp-transport-sdk-adoption · chat-state-ownership-boundary · composer-editor-engine · graph-tool-handler-conventions · hook-policy-enforcement-semantics
- Last shipped wave stub: [`wave-14-rails-ui-fix-sweep.md`](wave-14-rails-ui-fix-sweep.md)
- Vendor-gotchas: [`.claude/vendor-gotchas/`](../.claude/vendor-gotchas/) (better-sqlite3, tree-sitter, npm-lockfile)
- Standalone graph package: `C:\Web App\codebase-graph-mcp\` (npm: @hesnotsoharry/codebase-graph-mcp) — sibling repo, not subdir
- Stryker floor: 21% (current score 31.72% — above floor; next wave must not regress below 21%)
- lockfile: `npm run lockfile:sync` (WSL2) only — do NOT run plain `npm install` before committing
