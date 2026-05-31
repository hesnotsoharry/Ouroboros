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
├── Overlays/                   — Wave 7: canon §06 TitleBar right-cluster affordances (live)
│   ├── WorkbenchSettingsOverlay.tsx — listens OPEN_SETTINGS_EVENT → shared SettingsModal (cog)
│   ├── WorkbenchCommandPalette.tsx — useCommandPalette + useCommandRegistry → CommandPalette (Ctrl-K pill)
│   ├── WorkbenchFilePicker.tsx  — Wave 8 P3: listens agent-ide:open-file-picker → shared FilePicker (quick-open)
│   └── WorkbenchFileViewerModal.tsx — Wave 8 P3: LAZY FileViewer in a modal (opened by the picker)
├── TitleBar/WorkbenchBell.tsx  — Wave 7: live notification bell → shared NotificationCenter (canon §06 dot)
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
- **Themes + responsive collapse — LIVE (Wave 6).** Modern/Warp/Retro get full canon §15 treatment
  via per-theme `Theme.workbenchTokens` maps driven through `applyComponentTokens` (warm-amber Warp
  wash/glows; matte Retro — opaque panels, `--blur-*: none`, green phosphor + CRT scanline overlay).
  cursor/kiro/light/high-contrast stay functional with no per-theme tuning (ADR D4). The shell
  collapses across three tiers via `useWorkbenchBreakpoint` (canon §16, HUD dropped — D3): full
  (≥1760) / compact (1440–1759, agent rail 348→300 + Latest Hunk one-line) / unified (<1440,
  `UnifiedRail` mounts, dual rails unmount). `UnifiedRail` is now **mounted + live-wired**
  (`useWorkbenchProjects`/`useGitBranch`/`useWorkbenchAgentData`).
- **InnerRail file tree — LIVE (Wave 8 Phase 2).** The dual-mode `InnerRail` "Files" section renders
  `Rails/WorkbenchFileTree.tsx` (canon §07: indent depth×12px+6 base, dir icon `--accent-hi`, file
  `--ink-3`) over `Rails/useWorkbenchFileTree.ts` → `useFileWatcher` + `window.electronAPI.files.readDir`
  (lazy dir expansion on click; reuses `FileNode` for rows). M/A status badges still deferred
  (`follow-ups/2026-05-21-workbench-live-git-diff-stats.md`). `MOCK_FILE_TREE` is dead — Wave 14
  Phase 5 replaced the `UnifiedRail.parts` accordion body with `<WorkbenchFileTree rootPath={project.id} />`.
- **Still static (→ later waves):** the terminal tab-bar labels (`MOCK_TERM_TABS_*`, single-tab
  affordance); `StatusBar` testsPassing;
  git +adds/−dels + per-project dirty (`roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md`).

Terminals reuse the existing `src/renderer/components/Terminal/TerminalInstance.tsx` mount
(only `ProjectContext` is needed — already above the Workbench branch). Do NOT pull in
`DockSlot`/`ProjectTerminalsContext` or build multi-tab management (ADR Wave-2 Decisions
1–3, 6). One plain shell pty per frame; Claude auto-launch is Wave 3.

## Token rules

- Author against canon token aliases: `--ink`, `--ink-2`, `--ink-3`, `--glass-panel`,
  `--stroke-inner`, `--r-md`, `--interactive-accent`, `--term-bg`, etc.
- Per-theme canon appearance goes in the theme's `Theme.workbenchTokens` map (Wave 6) — NOT inline in
  components. `applyComponentTokens` writes each present entry to its `--` var AFTER the material pass
  (theme overrides win); absent → fallback stands (preserves the four untreated themes).
- No hardcoded hex except sanctioned exceptions:
  - Windows close button hover: `#e81123` (platform color — Phase 2)
  - Project chip colors in `workbenchMockData.ts`: these are user-assigned project identity
    colors imported from mock data, not authored inline
  - CRT scanline stripe `rgba(57,255,90,0.03)` in `Workbench.tsx` (Wave 6) — canon §15 Retro-only
    effect color, carries the `// hardcoded:` pre-commit suppression

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
- **`diff_review_ready` subscription gating (Wave 4 D5).** Subscribe to
  `window.electronAPI.hooks.onAgentEvent` unconditionally; guard on `enableTerminalDiffReview`
  *inside* the callback (mirrors `src/renderer/hooks/useDiffReviewTrigger.ts`). Flag off → no event
  fires (main-side gated) → Latest Hunk shows the `latest-hunk-empty` placeholder, rows drop badges.
  A missing/empty diff (60s stash-TTL eviction) is a normal empty state, not an error. The effect
  re-registers on flag toggle (matches the reference; refinement tracked in
  `follow-ups/2026-05-22-workbench-diff-subscription-latest-ref.md`).
- **`useWorkbenchBreakpoint` MUST use max-width queries (Wave 6).** The hook reads
  `matchMedia('(max-width: 1439px)')` (unified) and `'(max-width: 1759px)'` (compact) — max-width, NOT
  min-width. Reason: tests render `<Workbench/>` without a viewport, getting the jsdom default
  `matchMedia` that returns `matches:false` for everything; max-width phrasing makes all-false resolve
  to `full`, preserving the existing suite. Switch to min-width and every no-viewport render flips to
  `unified`, breaking ~93 Workbench tests. Two boundaries only (1760, 1440) — the canon §16 1180 line
  is moot once the HUD is dropped (D3): below 1440 is uniformly unified.
- **`forceUnified` is left-rail-only and does not auto-clear (Wave 6).** The rail collapse-handles set
  a `forceUnified` flag in `Workbench.tsx` that forces the unified rail regardless of width; it affects
  ONLY left-rail mounting, not the agent sidebar (which tracks window width directly). It clears only
  via `UnifiedRail`'s expand button, NOT on window-widen (tracked: `follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md`).
- **Sidebar paneId binding is deterministic via OUROBOROS_PANE_ID round-trip (Wave 13 Phase 2).** `AgentSidebar` no longer receives a `claudeSessionId` prop. Instead it owns `useActivePaneId()` which calls `useActiveWorkbenchFrame()` → `useWorkbenchTabsContext(activeFrame)` → `activeTab.id`. That `id` is the `OUROBOROS_PANE_ID` injected at pty spawn time (`spawnTab` in `WorkbenchTabsProvider.tsx`), inherited by claude's process env, forwarded by the hook scripts into the `HookPayload.paneId` field, and ultimately available on renderer events. `useWorkbenchAgentData(paneId?)` takes this value. When no paneId-tagged session matches (including when no paneId is set), the hook returns the empty data shape and the sidebar renders the D4 empty state ("No active claude session in this pane"). The heuristic `useWorkbenchClaudeCapture` + `claudeSessionId` state chain is deleted (ADR D5). Reason: the old heuristic could be hijacked by any external `claude` session (including the IDE-runs-in-itself outer session) firing a binding-class event — it was the root cause bug this wave closes. See `roadmap/wave-13-agentsidebar-pane-id-binding/`.
- **Tab state is a SINGLETON owned by `WorkbenchTabsProvider`; `useWorkbenchTabs` is now a thin wrapper over `useWorkbenchTabsContext(frame)` (2026-05-30 bug fix).** Reason: `useWorkbenchTabs` used to own a per-call `useState` tab collection AND spawn a claude on mount, so calling it from BOTH `TerminalShell` (line ~84) and `AgentSidebar`'s `useActivePaneId` created two independent collections + two spawns — the sidebar bound to its own idle copy's `activeTabId` (never the tab the user typed in), and the workbench startup-double-spawned claude. The provider (mounted in `Workbench.tsx` under `key={projectKey}`, above both `CenterPane` and `AgentSidebar`) holds ONE collection per frame + ONE shared `spawnedTabsRef` so a tab spawns at most once. Do NOT re-introduce a second `useState`-backed instance of the tab machine — any new consumer reads `useWorkbenchTabsContext(frame)`. Root cause + fix plan: `roadmap/bugs/2026-05-30-workbench-tab-state-instance-split.md`. (Known pre-existing follow-ups surfaced during this fix, NOT addressed here: `session_stop` un-owns sessions in `src/main/hooks.ts` → multi-turn tool events dropped; project-switch remount respawns + orphans the live session; AgentGlobe `selectPrimarySession` is pane-unaware.)
- **File quick-open → FileViewer modal (Wave 8 Phase 3).** The InnerRail "Search files" button + the
  `file:open-file` command (Ctrl-K) both dispatch `agent-ide:open-file-picker`. `Overlays/WorkbenchFilePicker`
  listens for it and renders the shared `CommandPalette/FilePicker`; on select it lifts `openFilePath` into
  `Workbench.tsx` state, which mounts `Overlays/WorkbenchFileViewerModal`. The modal mounts `FileViewer`
  **directly** (NOT `FileViewerManager` — a second manager instance would double-register the global
  `agent-ide:open-file`/`save-active-file`/`close-active-tab` listeners and collide with the still-mounted
  legacy shell during Wave 8). Post-Wave-9 teardown it can upgrade to the full manager. Dirty-on-close uses a
  `window.confirm` guard (v1).
- **The FileViewer modal MUST stay lazy (`React.lazy`) — load-bearing (Wave 8 Phase 3).**
  `Overlays/WorkbenchFileViewerModal` imports `FileViewer` via `React.lazy(() => import('../../FileViewer/FileViewer'))`,
  rendered under `<Suspense>` and only when `openFilePath` is non-null. **Do NOT convert this to a static
  import.** `FileViewer` statically pulls Monaco + pdfjs, whose module-init touches browser APIs jsdom lacks
  (`document.queryCommandSupported`, `DOMMatrix`, `CSS.escape`). A static import would land Monaco/pdfjs in the
  Workbench shell's module graph, crashing EVERY test that renders `<Workbench/>` at import time (0 tests
  collected) — and bloat the main renderer chunk. Lazy keeps the heavy deps out of the shell's static graph
  and out of the initial bundle. (Phase 3 regressed exactly this, then fixed it.)
- **Scanlines render via a Workbench-local overlay (Wave 6).** `useScanlines()` in `Workbench.tsx`
  reads `document.documentElement.dataset.scanlines` (written by the theme bridge for Retro) and
  re-reads on `agent-ide:theme-applied`; the overlay is a `pointer-events:none` absolute div. Retro-only.

## Wave sequence

- Wave 1: walking skeleton (this file + Workbench.tsx + mockData + Icon + flag + Settings toggle)
- Wave 2: ✅ live xterm in both terminal frames + draggable/persisted divider
- Wave 3: ✅ live hook data replaces workbenchMockData — Agent Globe + state machine, project chips/
  branch/clock, sessions list/sidebar header/context stats. Sidebar's 5 panel bodies left mock → Wave 4.
- Wave 4: ✅ the five AgentSidebar panel bodies live (NOW/Context/Files Touched/Latest Hunk/Hook
  Timeline) via the same adapter + the Wave-94 diff pipeline; sidebar `MOCK_*` data swept (types kept).
- Wave 6: ✅ themes (Modern/Warp/Retro full canon §15 via per-theme `workbenchTokens`; matte Retro +
  scanlines) + responsive collapse (`useWorkbenchBreakpoint`, 3 tiers, canon §16 minus HUD — D3);
  `UnifiedRail` mounted + live-wired.
- Wave 7: ✅ parity completion — canon §06 TitleBar right cluster live (Settings cog → SettingsModal;
  Ctrl-K pill → CommandPalette; Bell → NotificationCenter). All in `Overlays/` + `TitleBar/WorkbenchBell.tsx`,
  reusing existing components, behind the flag. **NOTE: the original "Wave 7 = cutover" was deferred** — a
  parity audit found the canon shell was not at functional parity (Settings was unreachable, palette/bell
  stubbed, FileTree mock). Cutover & teardown is now **Wave 8** (gated on full parity). See
  `roadmap/wave-7-workbench-parity-completion/`.
- Wave 8: cutover & teardown (remove old shells) — blocked until parity gaps close: live FileTree
  (`follow-ups/2026-05-22-workbench-live-filetree.md`) + 3 product decisions
  (`follow-ups/2026-05-22-workbench-canon-product-decisions.md`).
