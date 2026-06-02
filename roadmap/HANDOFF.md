---
project: agent-ide
updated: 2026-06-02
active-focus: SHIPPED — workbench context-gauge + rail/globe status stack merged to master. Start Claude button USER-VERIFIED working. NEXT — glance at CI full-suite on the master push; optionally chip at residual follow-ups.
last-wave: workbench-context-gauge-rail-status (fix-sweep, merged 2026-06-02)
last-wave-status: SHIPPED
---

## Where we are (2026-06-02)

Everything is on **master** (`2892a829`) — local == origin, working tree clean, all
feature branches deleted (`chore/cbmignore-vendored-exclusions`,
`fix-sweep-titlebar-innerrail-cleanup`), no orphaned worktrees. Merge gate before
push: typecheck (both layers) + lint (0 errors) + build all green. CI runs the full
suite on this push — glance at it (local 17-min suite exceeds the agent tool cap).

**Shipped in this fix-sweep (merged 2026-06-02):**
- **Live context gauge** wired from the Claude Code statusline (`23836137`); routes
  by cwd, not pane id — the statusline lacks a pane id (`7ef186c8`, `30359f86`).
- **"Agent Ready" turn-end state** across globe, NOW, timeline (`9f397a30`).
- **Cross-project agent status on the outer rail** (`3d1c7f55`); rail/globe "working"
  set = union of active + cached project collections (`eb07dbd9`, `82157fb4`).
- **Inner-rail cleanup** — removed running-session list (`5d33dc75`); trace-log strip.
- **`.cbmignore`** — vendored source excluded from the codebase graph (`5d358484`).
- **Start Claude button** — USER-VERIFIED working (2026-06-02): button present, no
  auto-spawn, click spawns. Closes the last open smoke item from the prior stack.

**Prior stack (still on master, wave-101 era):** telemetry SQLite pipeline removed
(freeze fix, USER-VERIFIED), launch-time spawn-loop cap, windowGroups per-window rail
persistence, Workbench AgentSidebar 4-part fix.

## Next steps

1. Glance at the CI full-suite result on the master push.
2. (Optional) chip at the residual follow-ups below.

## Critical context / decisions (2026-05-31)

- **No session resume on the interactive/terminal path — ever. Always fresh.** Resume
  survives ONLY in the agentChat chat-bridge (live multi-turn memory). Codified in
  `src/main/CLAUDE.md` + `Workbench/CLAUDE.md` gotchas. Why: stale-session resume rebound
  panes (the misbinding) and billed expired prompt caches. Cole decision.
- **CC tabs do NOT auto-spawn** — gated behind the Start Claude button; `spawnedTabIds`
  drives visibility. Shell tabs still auto-start (free). Cole decision.

## Open follow-ups / bugs (none blocking)

- `bugs/2026-05-31-commandblockoverlay-disposablestore-leak.md` (LOW) — xterm `onScroll`
  registers against an already-disposed DisposableStore on project switch. Filed, separate.
- `handlesessionend-fires-per-turn` — `session_stop` still fires `handleSessionEnd`
  per-turn (out of scope of the sidebar fix; tracked).
- Prior LOW carve-outs: globe idle-heuristic · unbounded project cache (LRU cap) ·
  `test-layout-misscoped-workbench-ungated` · `appconfig-schema-type-drift-sweep` ·
  `mcp-json-amplifier-cleanup` · stale `researchSettings` ref at `roadmap/docs/data-model.md:237`.

## Reference

- Conventions: [`../CLAUDE.md`](../CLAUDE.md) · Decisions: [`decisions/`](decisions/) · Vendor-gotchas: [`../.claude/vendor-gotchas/`](../.claude/vendor-gotchas/)
- Resolved: [`bugs/2026-05-31-agentsidebar-quiet-agent-end-unowns-session.md`](bugs/2026-05-31-agentsidebar-quiet-agent-end-unowns-session.md)
- Wave history: [`_index-history.md`](_index-history.md) · Archived: [`_archived/`](_archived/)
