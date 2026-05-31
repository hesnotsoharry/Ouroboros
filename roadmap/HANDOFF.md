---
project: agent-ide
updated: 2026-05-31
active-focus: SHIPPED — workbench bug stack + Start-Claude no-auto-spawn merged to master. NEXT — live-smoke the Start Claude button (npm run dev) + glance at the CI full-suite result on the master push.
last-wave: wave-101-telemetry-pipeline-removal
last-wave-status: SHIPPED
---

## Where we are (2026-05-31)

Everything is on **master** (`ea1546f1`) — local == origin, working tree clean, the
`freeze-fix-and-wave-101-scaffold` branch deleted (local + remote), no orphaned
worktrees. CI runs the full suite on this master push — glance at it (local 17-min
suite exceeds the agent tool cap; typecheck both layers + all touched scoped suites
were green pre-merge).

**Shipped in this one stack:**
- **wave-101** — telemetry SQLite pipeline removed (the freeze cause). Freeze is
  USER-VERIFIED fixed; no synchronous SQLite write remains on the main loop.
- **Machine-lockup fix** — launch-time session-restore spawn loop capped + dedup'd.
- **windowGroups** — per-window multi-root rail persistence (previously held; now shipped).
- **Workbench AgentSidebar 4-part fix** (all live-verified):
  - `2f35f27d` agent_end no longer un-owns the live session (silent-after-turn-1)
  - `9aea7ce9` interactive/terminal Claude+Codex **resume removed** — always fresh
  - `6ad5747f` **inferSessionId paneId guard** — the real project-switch misbinding fix
  - `1e2f9a70` trace cleanup
- **Start Claude button** `cc7d6ebd` — projects no longer auto-spawn Claude; centered
  "Start Claude" button in the upper terminal, click to spawn.

## Next steps

1. **Live-smoke the Start Claude button** (only piece not yet eyeballed): `npm run dev`
   → projects open with the button and NO auto-spawn; clicking it spawns; a started
   pane persists across project switch; the lower shell still auto-starts.
2. Glance at the CI full-suite result on the master push.
3. (Optional) chip at the residual follow-ups below.

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
