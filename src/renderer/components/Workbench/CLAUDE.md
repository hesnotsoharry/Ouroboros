# Workbench — Canon Shell (Wave 1+)

Six-region layout shell behind the `layout.canonWorkbench` config flag (default `false`).
Enabled via Settings → Appearance → "Canon workbench (experimental)".

## Region Map (canon §17)

| Region | Component (target) | Placeholder test-id | Canon dim |
|---|---|---|---|
| Title bar | `TitleBar/TitleBar.tsx` | `workbench-titlebar` | 40px height |
| Project rail | `Rails/ProjectRail.tsx` | `workbench-projectrail` | 56px width |
| Inner rail | `Rails/InnerRail.tsx` | `workbench-innerrail` | 256px width |
| Centre pane | `Terminals/CenterPane.tsx` | `workbench-terminals` | flex 1 |
| Agent sidebar | `AgentSidebar/AgentSidebar.tsx` | `workbench-agentsidebar` | 348px width |
| Status bar | `StatusBar.tsx` | `workbench-statusbar` | 24px height |

## File Structure (canon §17)

```
Workbench/
├── Workbench.tsx               — grid assembly (this wave: placeholder regions)
├── workbenchMockData.ts        — static mock data (Wave 3 swaps source, not shape)
├── CLAUDE.md                   — this file
├── TitleBar/
│   ├── TitleBar.tsx            — Phase 2
│   ├── TitleChip.tsx           — Phase 2
│   ├── AgentGlobe.tsx          — Phase 2 (running + idle; awaiting/errored Wave 3)
│   └── WindowControls.tsx      — Phase 2 (Win min/max/close; #e81123 close hover = sanctioned)
├── Rails/
│   ├── ProjectRail.tsx         — Phase 3
│   ├── InnerRail.tsx           — Phase 3
│   ├── UnifiedRail.tsx         — Phase 3 (built but dual is default, Decision 3)
│   └── FileNode.tsx            — Phase 3
├── Terminals/
│   ├── CenterPane.tsx          — owns sessions + divider; flex driven by persisted ratio (Wave 2)
│   ├── TerminalShell.tsx       — LIVE xterm via <TerminalInstance> in the tinted well (Wave 2)
│   ├── useWorkbenchTerminals.ts — spawns/kills the two workbench-owned ptys (Wave 2)
│   └── useVerticalSplitResize.ts — vertical row-resize for the divider (Wave 2)
├── AgentSidebar/
│   ├── AgentSidebar.tsx        — Phase 5
│   ├── NowBlock.tsx            — Phase 5
│   ├── ContextBlock.tsx        — Phase 5
│   ├── FilesTouched.tsx        — Phase 5
│   ├── LatestHunk.tsx          — Phase 5
│   └── HookTimeline.tsx        — Phase 5
└── StatusBar.tsx               — Phase 6
```

## Static-mock constraint (relaxing per wave)

Wave 1 shipped static-only. The constraint is being lifted region by region:

- **Terminals — LIVE (Wave 2).** `Terminals/**` mounts the real `<TerminalInstance>`
  (xterm) bound to workbench-owned ptys via `useWorkbenchTerminals` + the
  `layout.workbenchTerminalSplit` config key. The terminal-line mock data
  (`MOCK_CC_TUI_LINES`/`MOCK_SHELL_LINES`/…) was **deleted** in Wave 3's dead-mock sweep.
- **Agent Globe + project chips + branch + clock + sessions list + sidebar header + context
  stats — LIVE (Wave 3).** Driven by `useWorkbenchAgentData` (the agent presentation-state
  machine + adapter over `AgentEventsContext`), `useWorkbenchProjects` (project chips),
  `useGitBranch` (branch name), and a local live clock. See the Gotchas section.
- **Still static (→ later waves):** the five AgentSidebar **panel bodies**
  (NowBlock/ContextBlock/FilesTouched/LatestHunk/HookTimeline) → Wave 4; `UnifiedRail` (built,
  not mounted — still uses `MOCK_PROJECTS`/`MOCK_SESSIONS`/`MOCK_BRANCH`); the terminal tab-bar
  labels (`MOCK_TERM_TABS_*`, single-tab affordance); `StatusBar` testsPassing; git +adds/−dels
  + per-project dirty (`roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md`).
  Permission overlay → Wave 5. These must NOT import permission/approval components until Wave 5.

Terminals reuse the existing `src/renderer/components/Terminal/TerminalInstance.tsx` mount
(only `ProjectContext` is needed — already above the Workbench branch). Do NOT pull in
`DockSlot`/`ProjectTerminalsContext` or build multi-tab management (ADR Wave-2 Decisions
1–3, 6). One plain shell pty per frame; Claude auto-launch is Wave 3.

## Token rules

- Author against canon token aliases: `--ink`, `--ink-2`, `--ink-3`, `--glass-panel`,
  `--stroke-inner`, `--r-md`, `--interactive-accent`, `--term-bg`, etc.
- No hardcoded hex except sanctioned exceptions:
  - Windows close button hover: `#e81123` (platform color — Phase 2)
  - Project chip colors in `workbenchMockData.ts`: these are user-assigned project identity
    colors imported from mock data, not authored inline

## Gotchas

- **AgentGlobe consumes `useAgentEventsContext` (Wave 3+).** `TitleBar/AgentGlobe.tsx` reads
  `useWorkbenchAgentData()` → `useAgentEventsContext()`, which **throws** outside an
  `AgentEventsProvider`. Any test that renders `<Workbench />` (or `<TitleBar />`) must mock
  `../../contexts/AgentEventsContext` (`vi.mock(... useAgentEventsContext: vi.fn())` + a
  default `mockReturnValue` in `beforeEach`) or wrap in the real provider. See
  `Workbench.test.tsx` for the pattern. Reason: the Globe became a live, context-driven widget
  in Wave 3 — it is no longer a pure prop-driven component.
- **Workbench agent state is a workbench-local presentation type, NOT the domain enum.**
  `useWorkbenchAgentData.ts` defines `WorkbenchAgentState` (`fresh|thinking|running|awaiting|errored|done`)
  derived from the canonical 4-value `AgentStatus` (`AgentMonitor/types.ts`). Do NOT extend
  `AgentStatus` to add canon states — it has ~48 consumers (ADR Wave-3 D1). `thinking` is a
  best-effort heuristic (running with no pending tool call); the wire has no thinking signal.

## Wave sequence

- Wave 1: walking skeleton (this file + Workbench.tsx + mockData + Icon + flag + Settings toggle)
- Wave 2: ✅ live xterm in both terminal frames + draggable/persisted divider
- Wave 3: ⏳ live hook data replaces workbenchMockData — Phase 1 ✅ (Agent Globe + state machine);
  Phase 2 (project chips/branch/clock), Phase 3 (sessions list/sidebar header/context stats) next.
  Sidebar's 5 panel bodies stay mock → Wave 4 (ADR D5); Claude auto-launch decoupled → later (D6).
- Wave 5: permission overlay
- Wave 6: responsive collapse, themes
- Wave 7: cutover (remove old shells)
