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
├── Permission/                 — Wave 5: canon §13 dual-presentation approval UI
│   ├── useWorkbenchApproval.ts — selector over useApprovalContext(); SINGLE keydown owner (D3)
│   ├── PermissionCard.tsx      — shared card primitive (overlay|sidebar variant); .styles.ts sidecar
│   ├── usePermissionRejectFlow.ts — two-stage optional reject-reason flow
│   ├── PermissionOverlay.tsx   — terminal-pane glass overlay (canon §13a); owns the keydown via the hook
│   └── PermissionSidebarTakeover.tsx — sidebar NOW-slot takeover (canon §13b); pure props, no hook
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
- **The five AgentSidebar panel bodies — LIVE (Wave 4).** NowBlock/ContextBlock/FilesTouched/
  LatestHunk/HookTimeline now render live data through the **same** `useWorkbenchAgentData` adapter
  (no competing adapter — ADR D1). NOW/Context = adapter `now`/`context` (existing fields). Files
  Touched + Hook Timeline = pure derivations over `AgentSession.toolCalls` + `conversationTurns`
  (`deriveTouchedFiles`/`deriveTimeline`; `think` dropped — no wire source, D6). Latest Hunk +
  `+N/−N` badges = the Wave-94 diff pipeline: a panel-local effect (`useWorkbenchAgentData.diff.ts`)
  subscribes to the `diff_review_ready` agent event, fetches `git:diffReview`, and maps
  `FileDiff → MockDiffHunk`. Diff surfaces piggyback `enableTerminalDiffReview` and degrade to
  empty/badge-free when off (D5). The sidebar `MOCK_*` data constants were swept (only
  `MOCK_STATUS_BAR` + the `Mock*` types remain — D8).
- **Permission UI — LIVE (Wave 5).** `Permission/**` renders the canon §13 dual presentation
  over the EXISTING approval context (`useApprovalContext()` — no new protocol, no main/IPC change).
  Terminal overlay (`PermissionOverlay`, mounted in `Terminals/CenterPane`) + sidebar NOW-slot
  takeover (`PermissionSidebarTakeover`, swapped into `AgentSidebar`'s NOW slot when a request is
  pending; panels 2–5 dim to 0.7). Both render `<PermissionCard>` simultaneously. v1 actions =
  Approve / Always-for-tool / Deny (project-scope is canon v2, out of scope — D5).
- **Still static (→ later waves):** `UnifiedRail` (built,
  not mounted — still uses `MOCK_PROJECTS`/`MOCK_SESSIONS`/`MOCK_BRANCH`); the terminal tab-bar
  labels (`MOCK_TERM_TABS_*`, single-tab affordance); `StatusBar` testsPassing; git +adds/−dels
  + per-project dirty (`roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md`).

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
- **Latest Hunk is ephemeral hook state, NOT on `AgentSession` (Wave 4 D3).** The fetched
  `FileDiff[]` lives in `useState` inside `useWorkbenchAgentData.diff.ts` — lost on reload (correct
  for a "current activity" panel). Do NOT add a `latestHunk` field to `AgentSession`, touch the
  `useAgentEvents.helpers.ts` reducer, or add a SQLite migration for it (would ripple to ~48
  `AgentMonitor` consumers — D1).
- **`ToolCallEvent.input` is an 80-char-truncated path (Wave 4).** Files-Touched dedup keys on an
  ellipsis-tolerant suffix, not raw-string equality (`useAgentEvents.payload.ts:301` truncates the
  `file_path`). The `+N/−N` badge match currently uses **exact** `relativePath` equality, so a
  >80-char path renders badge-free (accepted degrade — `follow-ups/2026-05-22-workbench-files-touched-truncated-path-badges.md`).
  Do NOT add IPC to forward the full path — match defensively in the renderer.
- **Permission UI: ONE keydown owner across both surfaces (Wave 5 D3).** The Y/A/N/Esc shortcut is
  a single `window`-level listener registered by `useWorkbenchApproval` (`Permission/useWorkbenchApproval.ts`),
  which is called by exactly ONE mounted component — `PermissionOverlay`. The sidebar takeover
  (`PermissionSidebarTakeover`, fed by `AgentSidebar`'s private `useSidebarApproval`) reads
  `useApprovalContext()` **directly** and binds only click handlers — it must NOT call
  `useWorkbenchApproval()`, or a second keydown listener registers and every shortcut fires twice.
  If you add a third permission surface, follow the same rule: read the context directly for clicks;
  let the overlay keep the sole keyboard handler. The frozen acceptance test
  (`Permission/permission-approval.acceptance.test.tsx`) renders both surfaces and asserts a single
  keypress resolves once — it catches a duplicate handler.
- **`diff_review_ready` subscription gating (Wave 4 D5).** Subscribe to
  `window.electronAPI.hooks.onAgentEvent` unconditionally; guard on `enableTerminalDiffReview`
  *inside* the callback (mirrors `src/renderer/hooks/useDiffReviewTrigger.ts`). Flag off → no event
  fires (main-side gated) → Latest Hunk shows the `latest-hunk-empty` placeholder, rows drop badges.
  A missing/empty diff (60s stash-TTL eviction) is a normal empty state, not an error. The effect
  re-registers on flag toggle (matches the reference; refinement tracked in
  `follow-ups/2026-05-22-workbench-diff-subscription-latest-ref.md`).

## Wave sequence

- Wave 1: walking skeleton (this file + Workbench.tsx + mockData + Icon + flag + Settings toggle)
- Wave 2: ✅ live xterm in both terminal frames + draggable/persisted divider
- Wave 3: ✅ live hook data replaces workbenchMockData — Agent Globe + state machine, project chips/
  branch/clock, sessions list/sidebar header/context stats. Sidebar's 5 panel bodies left mock → Wave 4.
- Wave 4: ✅ the five AgentSidebar panel bodies live (NOW/Context/Files Touched/Latest Hunk/Hook
  Timeline) via the same adapter + the Wave-94 diff pipeline; sidebar `MOCK_*` data swept (types kept).
- Wave 5: ✅ canon §13 dual-presentation permission UI (terminal overlay + sidebar NOW-takeover)
  over the existing approval context. Single keyboard owner (D3). `Permission/**`.
- Wave 6: responsive collapse, themes
- Wave 7: cutover (remove old shells)
