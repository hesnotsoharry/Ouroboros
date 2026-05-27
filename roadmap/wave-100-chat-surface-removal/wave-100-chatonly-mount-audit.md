---
status: COMPLETE
created: 2026-05-27
wave: 100
slug: chat-surface-removal
---

# ChatOnlyShell Live Mount Audit (Wave 100 Phase B grounding)

Generated 2026-05-27 from worktree HEAD (commit `8f9444d3`) by `sonnet-explorer`.

## Summary
- Total `.ts(x)` source files in ChatOnlyShell/ (excluding test files): **84**
- MOUNTED: **66**
- NOT-MOUNTED: **16**
- MOUNTED-BUT-DEAD-BRANCH: **1** (`ChatOnlyHeaderControls.tsx`)
- BARREL/INFRASTRUCTURE (not a render mount): **1** (`index.ts`)

## Live mount tree

```
App.helpers.tsx:263
  └─ ChatOnlyShellWrapper.tsx
       └─ ChatOnlyShell.tsx  [AgentChatStoreContext.Provider wraps everything below]
            └─ ChatWorkbenchShell.tsx
                 ├─ ChatOnlyTerminalToolBridge.tsx
                 ├─ ChatOnlyTitleBar.tsx
                 │    ├─ [WorkbenchModelChips → ChatOnlyHeaderControls] ← DEAD BRANCH (comment line 131)
                 │    ├─ TitleBarWindowControls.tsx
                 │    ├─ WorkbenchMenuBar.tsx (+ .parts/.state/.styles)
                 │    ├─ WorkbenchRailToggle.tsx
                 │    └─ WorkbenchPanelToggleStrip.tsx
                 ├─ ChatWorkbenchBody.tsx  [AgentCompletionIndicatorsProvider wraps body]
                 │    ├─ AgentCompletionIndicatorsContext.tsx
                 │    ├─ ChatWorkbenchBody.model.ts
                 │    │    ├─ useWorkbenchCompare.ts
                 │    │    ├─ useWorkbenchSessionActivation.ts
                 │    │    ├─ useWorkbenchSessions.ts → useWorkbenchSessions.helpers.ts
                 │    │    └─ useWorkbenchSurfacePolicy.ts
                 │    ├─ ChatWorkbenchBody.parts.tsx [WorkbenchMainColumn]
                 │    │    ├─ WorkbenchApprovalPrompt.tsx
                 │    │    ├─ ChatWorkbenchTerminalDock.tsx  ← React.lazy
                 │    │    │    ├─ useDockSlotHeights.ts
                 │    │    │    └─ DockSlot.tsx (×2: primary + secondary)
                 │    │    │         ├─ DockSlotTabs.tsx → DockSlotTabs.header.tsx
                 │    │    │         │    ├─ DockSlotTabs.parts.tsx → InlineTitleEdit.tsx
                 │    │    │         │    ├─ DockSlotTabMenu.tsx
                 │    │    │         │    └─ CompletionDot.tsx
                 │    │    │         └─ TerminalManager (external)
                 │    │    └─ ChatWorkbenchOverlays.tsx  ← direct (NOT lazy)
                 │    │         ├─ OverlayDrawer.tsx
                 │    │         └─ ChatWorkbenchUtilityDrawer.tsx
                 │    │              ├─ WorkbenchApprovalPanel.tsx
                 │    │              ├─ WorkbenchTimelinePanel.tsx
                 │    │              │    └─ useWorkbenchTimeline.ts (+ .entries / .helpers)
                 │    │              ├─ AgentMonitorManager (external)
                 │    │              └─ RulesTab (external — AgentChat)
                 │    ├─ ChatWorkbenchBody.rails.tsx [TwoTierRailSurface]
                 │    │    ├─ OuterProjectRail.tsx → OuterProjectRail.dot.tsx
                 │    │    ├─ InnerSidebar.tsx
                 │    │    ├─ InnerSidebarChats.tsx  ← chats tab HIDDEN (InnerSidebar:42) but hooks run
                 │    │    │    ├─ useWorkbenchAttention.ts (+ .helpers / .agentSource)
                 │    │    │    ├─ useWorkbenchRailActions.ts
                 │    │    │    ├─ useWorkbenchRecentChats.ts
                 │    │    │    ├─ WorkbenchRailContextMenu.tsx
                 │    │    │    └─ WorkbenchSessionRow.tsx
                 │    │    ├─ InnerSidebarTerminals.tsx → InnerSidebarTerminals.row.tsx
                 │    │    └─ InnerSidebarCode.tsx
                 │    └─ WorkbenchRightPane.tsx  ← mobile-only path (useIsMobile() → false on desktop)
                 │         └─ ChatWorkbenchUtilityDrawer.tsx (same instance as above)
                 ├─ ChatOnlyStatusBar.tsx
                 ├─ ChatOnlyDiffOverlay.tsx
                 ├─ ChatOnlySettingsOverlay.tsx
                 ├─ KeyboardShortcutCheatSheet.tsx
                 ├─ CommandPalette (external)
                 ├─ MultiSessionLauncher (external, conditional on launcherOpen)
                 └─ ChatSearchOverlay.tsx  ← conditional (searchOpen &&)
                      └─ ChatSearchOverlay.parts.tsx
```

## NOT-MOUNTED files (executor's delete-list candidates)

| File | Evidence |
|---|---|
| `ChatHistorySidebar.tsx` | No import from any MOUNTED file; only consumers are its own test files. Explicitly listed in CLAUDE.md Wave 89 Phase 4b removal list. |
| `ChatHistoryList.tsx` | Only imported by `ChatHistorySidebar.tsx` (NOT-MOUNTED). |
| `ChatHistoryRow.tsx` | Only imported by `ChatHistoryList.tsx` (NOT-MOUNTED). |
| `ChatHistoryStatusDot.tsx` | Only imported by `ChatHistoryRow.tsx` (NOT-MOUNTED). |
| `ArtifactHistoryList.tsx` | Only imported by its own test; consuming component `ChatWorkbenchArtifactPane` was deleted in Wave 95 Phase H continuation. |
| `ChatWorkbenchComparePane.tsx` | Only imported by its own test; removed from mount tree Wave 89 Phase 4b. |
| `ChatStatusChipRow.tsx` | Only imported by its own test; removed from mount tree Wave 89 Phase 4b per CLAUDE.md. |
| `ChatOnlySessionDrawer.tsx` | Only imported by its own test and re-exported from `index.ts` (barrel, not a render mount). |
| `ChatOnlyUserMenu.tsx` | Only imported by `ChatHistorySidebar.tsx` (NOT-MOUNTED) and `WorkbenchRail.tsx` (NOT-MOUNTED). |
| `WorkbenchRail.tsx` | Replaced by `TwoTierRailSurface` in Wave 59 Phase B. Not imported by any MOUNTED file. |
| `WorkbenchRailSections.tsx` | Only imported by `WorkbenchRail.tsx` (NOT-MOUNTED). |
| `InnerSidebarTerminals.helpers.tsx` | Zero importers anywhere in the directory. Genuine orphan. |
| `chatHistorySidebarCompletions.ts` | Only imported by `ChatHistorySidebar.tsx` (NOT-MOUNTED). |
| `useArtifactHistoryStack.ts` | Only imported by `ArtifactHistoryList.tsx` (NOT-MOUNTED) and its test file. |
| `useScopedWorkbenchWorkspace.ts` | Only imported by `ChatWorkbenchComparePane.tsx` (NOT-MOUNTED). |
| `ChatOnlyHeaderControls.tsx` | MOUNTED-BUT-DEAD-BRANCH — `WorkbenchModelChips()` defined but never placed in JSX. |

## MOUNTED-BUT-CHAT-COUPLED files (need rewire/audit before delete)

| File | AgentChat imports | Role |
|---|---|---|
| `ChatOnlyShell.tsx` | `AgentChatStoreContext`, `createAgentChatStore` from `agentChatStore` | Lifts AgentChat Zustand store above the workbench (line 172 Provider wrap) |
| `ChatWorkbenchBody.model.ts` | `useAgentChatStoreContext` from `agentChatStore` | Reads `threads`, `onSelectThread`, `reloadThreads` |
| `ChatWorkbenchBody.tsx` | `useAgentChatStoreContext` from `agentChatStore` | `selectThread`, `reloadThreads` passed into `useWorkbenchHandlers` |
| `ChatWorkbenchUtilityDrawer.tsx` | `RulesTab` from `RulesTab` | Renders "Rules" utility drawer tab |
| `WorkbenchApprovalPrompt.tsx` | `getApprovalRequestKey`, `getApprovalRequestPreview` from `approvalRequestPreview` | Generates preview strings for approval cards |
| `ChatOnlyHeaderControls.tsx` *(dead branch)* | 6 AgentChat imports (chips/actions/model/permission) | Compile-time deps despite never rendering |

## Caveats / surprises

1. **`InnerSidebarChats.tsx` is mounted with its hooks running, but the chats tab is permanently hidden.** `InnerSidebar.tsx:42-44` defines `TABS` as only `['terminals', 'code']` with the comment "Chats tab hidden post-Wave-89 terminal-first pivot." Its hooks (`useWorkbenchAttention`, `useWorkbenchRecentChats`, `useWorkbenchRailActions`) execute on every render. The entire `InnerSidebarChats` subtree (6 hooks + 2 components) can be removed if the terminal-first pivot is permanent.

2. **`ChatOnlyHeaderControls.tsx` is a dead-branch compile-time AgentChat import site.** Clean delete: remove `WorkbenchModelChips` function and the `ChatOnlyHeaderControls` import from `ChatOnlyTitleBar.tsx:20`.

3. **`ChatWorkbenchTerminalDock.tsx` is loaded via `React.lazy()`.** Async bundle chunk; doesn't block initial render.

4. **`WorkbenchRightPane.tsx` is desktop-dead.** Only reached on mobile via `useIsMobile()` branch at `ChatWorkbenchBody.tsx:147`. On Electron desktop the branch never fires.

5. **`useWorkbenchCompare.ts` and `ChatWorkbenchComparePane.tsx` are already split.** Hook is MOUNTED (via `ChatWorkbenchBody.model.ts:14`); the component is NOT-MOUNTED. Hook's compare state is passed through `TwoTierRailSurface` but the compare pane UI was removed in Wave 89 Phase 4b. Deleting the pane is safe; deleting the hook requires first removing its use from the model.

6. **`InnerSidebarTerminals.helpers.tsx` is a true orphan.** Zero imports anywhere. Safe to delete immediately.

7. **`ArtifactPaneToggleButton` inside `WorkbenchPanelToggleStrip.tsx` is dead code but the file is MOUNTED.** Three other button exports from this file are live. The `ArtifactPaneToggleButton` export is unused (artifact pane removed Wave 95 Phase H continuation). File stays; unused export is harmless dead code.
