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
│   ├── CenterPane.tsx          — Phase 4
│   └── TerminalShell.tsx       — Phase 4 (static tinted-well, NO xterm — Decision 6)
├── AgentSidebar/
│   ├── AgentSidebar.tsx        — Phase 5
│   ├── NowBlock.tsx            — Phase 5
│   ├── ContextBlock.tsx        — Phase 5
│   ├── FilesTouched.tsx        — Phase 5
│   ├── LatestHunk.tsx          — Phase 5
│   └── HookTimeline.tsx        — Phase 5
└── StatusBar.tsx               — Phase 6
```

## Static-mock constraint

Wave 1 is **static only**. No component in this tree may import:
- `useAgentEvents` or any hook that calls IPC for live data
- `xterm` or any terminal emulator
- Permission/approval components

All data comes from `workbenchMockData.ts`. Wave 3 replaces the mock with live hook data.

## Token rules

- Author against canon token aliases: `--ink`, `--ink-2`, `--ink-3`, `--glass-panel`,
  `--stroke-inner`, `--r-md`, `--interactive-accent`, `--term-bg`, etc.
- No hardcoded hex except sanctioned exceptions:
  - Windows close button hover: `#e81123` (platform color — Phase 2)
  - Project chip colors in `workbenchMockData.ts`: these are user-assigned project identity
    colors imported from mock data, not authored inline

## Wave sequence

- Wave 1: walking skeleton (this file + Workbench.tsx + mockData + Icon + flag + Settings toggle)
- Wave 2: xterm mount inside TerminalShell
- Wave 3: live hook data replaces workbenchMockData
- Wave 5: permission overlay
- Wave 6: responsive collapse, themes
- Wave 7: cutover (remove old shells)
