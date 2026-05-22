# Wave history index

One line per shipped or in-progress wave. Newest at top. Link points to the wave folder; the `wave-{N}-result.md` inside is the durable record where present. Folders pre-Wave-60 are archived (see [_archived/index.md](_archived/index.md)).

Shipped date and squash commit are filled in at wave-end going forward. Historical rows (pre-2026-05-13) are best-effort — refer to `git log` for authoritative shipped dates.

| Wave | Topic | Shipped | Squash | Link |
|---|---|---|---|---|
| WB6 | Workbench overhaul — themes (Modern/Warp/Retro canon) + responsive collapse | 2026-05-22 | v2.27.0 `7c842dbc` | [wave-6-workbench-themes-responsive/](wave-6-workbench-themes-responsive/) |
| WB5 | Workbench overhaul — canon §13 permission UI (overlay + sidebar takeover) | 2026-05-22 | v2.26.0 | [wave-5-workbench-permission-overlay/](wave-5-workbench-permission-overlay/) |
| WB4 | Workbench overhaul — agent sidebar 5 panel bodies live | 2026-05-22 | v2.25.0 `3ede163f` | [wave-4-workbench-agent-sidebar-live/](wave-4-workbench-agent-sidebar-live/) |
| WB3 | Workbench overhaul — hook pipeline + live agent state machine | 2026-05-21 | v2.24.0 | [wave-3-workbench-hook-pipeline-state-machine/](wave-3-workbench-hook-pipeline-state-machine/) |
| WB2 | Workbench overhaul — live terminals + draggable divider | 2026-05-21 | v2.23.0 | [wave-2-workbench-terminal-integration/](wave-2-workbench-terminal-integration/) |
| WB1 | Workbench overhaul — static canon shell (flagged) | 2026-05-21 | v2.22.0 | [wave-1-workbench-static-shell/](wave-1-workbench-static-shell/) |
| WB0 | Workbench overhaul — token foundations (canon aliases + tinted well) | 2026-05-21 | v2.21.0 `c253cb2e` | [wave-0-workbench-token-foundations/](wave-0-workbench-token-foundations/) |
| M5 | Documentation framework migration | 2026-05-13 | _pending_ | [wave-M5-doc-migration/](wave-M5-doc-migration/) |
| W87 | Chat orchestration activation | in-progress | — | [wave-87-chat-orchestration-activation/](wave-87-chat-orchestration-activation/) |
| W86 | Chat orchestration state-architecture overhaul | pending push | — | [wave-86-chat-orchestration-overhaul/](wave-86-chat-orchestration-overhaul/) |
| W85 | Flow tracer | pending push | — | [wave-85-flow-tracer/](wave-85-flow-tracer/) |
| W84 | Chat lifecycle bug-fix bundle | 2026-05 | — | [wave-84-chat-lifecycle-bug-fix-bundle/](wave-84-chat-lifecycle-bug-fix-bundle/) |
| W83 | Electron renderer browser-mcp wiring | 2026-05 | — | [wave-83-electron-renderer-browser-mcp-wiring/](wave-83-electron-renderer-browser-mcp-wiring/) |
| W82.1 | Chat project binding | 2026-05 | — | [wave-82.1-chat-project-binding/](wave-82.1-chat-project-binding/) |
| W82 | Chat-only polish bundle | 2026-05 | — | [wave-82-chat-only-polish-bundle/](wave-82-chat-only-polish-bundle/) |
| W81 | Composer engine migration | 2026-05 | — | [wave-81-composer-engine-migration/](wave-81-composer-engine-migration/) |
| W80 | Edge confidence | 2026-05 | — | [wave-80-edge-confidence/](wave-80-edge-confidence/) |
| W79 | Config cleanup | 2026-05 | — | [wave-79-config-cleanup/](wave-79-config-cleanup/) |
| W78 | Settings wiring | 2026-05 | — | [wave-78-settings-wiring/](wave-78-settings-wiring/) |
| W77 | Cypher wave A | 2026-05 | — | [wave-77-cypher-wave-a/](wave-77-cypher-wave-a/) |
| W76 | Warn hooks | 2026-05 | — | [wave-76-warn-hooks/](wave-76-warn-hooks/) |
| W75 | Memory curation | 2026-05 | — | [wave-75-memory-curation/](wave-75-memory-curation/) |
| W74 | Registrars decomp | 2026-05 | — | [wave-74-registrars-decomp/](wave-74-registrars-decomp/) |
| W73 | Skill executions persistence | 2026-05 | — | [wave-73-skill-executions-persistence/](wave-73-skill-executions-persistence/) |
| W72 | Swipe nav | 2026-05 | — | [wave-72-swipe-nav/](wave-72-swipe-nav/) |
| W71 | Disabled-files mentions send path | 2026-05 | — | [wave-71-disabled-files-mentions-send-path/](wave-71-disabled-files-mentions-send-path/) |
| W70 | Completion batch | 2026-05 | — | [wave-70-completion-batch/](wave-70-completion-batch/) |
| W69 | Context-layer graph integration | 2026-05 | — | [wave-69-context-layer-graph-integration/](wave-69-context-layer-graph-integration/) |
| W68 | Cypher engine quality | 2026-05 | — | [wave-68-cypher-engine-quality/](wave-68-cypher-engine-quality/) |
| W67 | Indexer coverage repair | 2026-05 | — | [wave-67-indexer-coverage-repair/](wave-67-indexer-coverage-repair/) |
| W66 | Graph MCP fixes | 2026-05 | — | [wave-66-graph-mcp-fixes/](wave-66-graph-mcp-fixes/) |
| W64 | Chat session lifecycle | 2026-05 | — | [wave-64-chat-session-lifecycle/](wave-64-chat-session-lifecycle/) |
| W63 | Popover tab coverage | 2026-05 | — | [wave-63-popover-tab-coverage/](wave-63-popover-tab-coverage/) |
| W62 | Rule toggles | 2026-05 | — | [wave-62-rule-toggles/](wave-62-rule-toggles/) |
| W61 | Delegation coach | 2026-04 | — | [wave-61-delegation-coach/](wave-61-delegation-coach/) |
| W60 | Standalone Ouroboros | 2026-04 | — | [wave-60-standalone-ouroboros/](wave-60-standalone-ouroboros/) |

## Archived (Waves 15–59)

Waves 15 through 59 (plus topic-named pre-Wave-15 baselines) live in `_archived/`. See [_archived/index.md](_archived/index.md) for the per-row table.

## How to read this

Newest waves at top. One row per shipped wave. The result brief inside each wave folder is the durable record (decisions, files changed, lessons learned); this index is the discovery layer. Pre-2026-05-13 rows have empty squash columns — `git log --oneline -- roadmap/wave-N-*/` recovers authoritative SHAs.
