---
status: OPEN
created: 2026-05-22
severity: MED
area: Workbench / cutover
target: wave-8-cutover
---

# Wave 8 teardown — two prep discoveries beyond the reconciliation doc's deletion list

The Wave 7 parity audit (`wave-7-parity-audit.md`) mapped the full Wave 8 deletion scope. Two findings
surfaced that the original reconciliation doc didn't anticipate — capture them so Wave 8 handles them
deliberately, not by surprise:

## 1. `AgentChat/` becomes runtime-dead after cutover (~40 files)

`src/renderer/components/AgentChat/` (AgentChatWorkspace, AgentChatComposer, lexicalComposer, mentions,
slash menu, etc.) is mounted ONLY by the two doomed shells (`InnerAppLayout.agent.tsx` mounts
`AgentChatWorkspace`; ChatOnlyShell is being deleted). The canon Workbench does not render any AgentChat
component (chat surface retired — canon §18). After Wave 8 deletes both shells, all of `AgentChat/`
compiles but is **runtime-dead**.

- **One compile-breaking dependency to sever in Wave 8:** `AgentChat/AgentChatComposer.tsx:10` imports
  `ChatStatusChipRow` from `ChatOnlyShell/`. When ChatOnlyShell is deleted, this breaks the build. Fix:
  delete the `variant === 'chat-only'` branch + the import from `AgentChatComposer` (no surviving caller
  passes `variant='chat-only'`), OR relocate `ChatStatusChipRow`. The former is cleaner.
- **Recommendation:** Wave 8 should sever the compile dependency but NOT delete all of `AgentChat/` in the
  same wave (it's a large, entangled subsystem — `useAgentChatWorkspaceHooks` also holds the "Explain
  error" listener; lexicalComposer has its own test surface). Retire `AgentChat/` in its own dedicated
  wave after cutover proves stable. Leaving it compile-live-but-runtime-dead for one wave is acceptable.

## 2. `?mode=chat` pop-out window machinery becomes unreachable after cutover

The chat pop-out window (`?mode=chat&sessionId=`) is opened by `src/main/windowManagerChatWindow.ts` via
the `sessionCrud:openChatWindow` IPC. The only renderer trigger is `AgentChat/AgentChatTabBarParts.extra.tsx:111`
— which becomes runtime-dead with AgentChat (see #1). `useChatWindowMode` (renderer) reads the param only
to feed the `isImmersive` branch that Wave 8 deletes.

- After cutover, a `?mode=chat` window simply renders the canon Workbench (harmless, not broken).
- **Main-process machinery left orphaned:** `windowManagerChatWindow.ts`, `sessionCrud:openChatWindow`
  handler, the preload bridge, and `useChatWindowMode` become dead. These are NOT in the reconciliation
  doc's deletion list (it was renderer-shell-focused).
- **Recommendation:** retire this chat-popout machinery as part of the AgentChat retirement wave (#1), not
  Wave 8 — it's chat-surface cleanup, adjacent to but distinct from the shell teardown. Filing here so it
  isn't forgotten.
