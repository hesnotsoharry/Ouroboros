---
status: OPEN
created: 2026-05-27
updated: 2026-05-27
source: Wave 22 post-wrap diagnostic (orchestrator + Cole 2026-05-27)
severity: MEDIUM
scope: src/main/internalMcp + src/main/orchestration/providers + src/main/ipc-handlers/agentChat*
phase_target: Wave 23 cleanup OR fold into Wave 100 (chat-surface-removal)
---

# Vestigial chat-orchestration chain — catalog for cleanup

## Why this exists

During Wave 22 Phase 5, the diagnostic via `haiku-explorer` established that the IDE's chat-orchestration code is **behaviorally vestigial in Cole's workflow**: imports exist, IPC handlers register, files compile — but nothing Cole does (terminal-only Claude Code usage) triggers the code paths. Cole chose **Path A (stay scoped)** at Phase 5 to avoid absorbing Wave 100's full chat-removal into Wave 22.

Wave 22 then npm-published `@hesnotsoharry/codebase-graph-mcp` and a meta agent added global access via `~/.claude.json mcpServers.ouroboros`. With those in place, the IDE-side `internalMcp/` auto-injection that Wave 22 carefully rewired is **strictly redundant** — it writes per-project `.mcp.json` entries that duplicate the meta-level global config.

The 2026-05-27 post-wrap trace surfaced the full vestigial chain:

```
src/main/internalMcp/internalMcpScope.ts
  ↑
  ├── src/main/orchestration/providers/scopedMcpConfig.ts (resolveMcpConfigPathForLaunch)
  │     ↑
  │     └── src/main/orchestration/providers/claudeCodeLaunchInputs.ts (builds MCP config path)
  │           ↑
  │           └── src/main/orchestration/providers/claudeCodeLaunch.ts (launchClaude function)
  │                 ↑
  │                 └── src/main/orchestration/providers/claudeCodeAdapter.ts
  │                       ↑
  │                       └── src/main/ipc-handlers/agentChatOrchestration.ts (chat IPC handler)
  │
  └── src/main/orchestration/providers/internalMcpRoutingPolicy.ts
        ↑
        └── src/main/orchestration/providers/claudeCodeMode.ts
              ↑
              └── (same chain via claudeCodeLaunch.ts)
```

The terminal point is `ipc-handlers/agentChatOrchestration.ts` — a chat IPC handler. Cole's pty terminals do NOT go through this chain (they spawn `claude` via `node-pty` directly). The chain only runs when the IDE manages a chat session through the agentChat IPC surface — which Cole doesn't use.

## Cleanup options

Three paths, listed from minimum-risk to maximum-cleanup. The choice depends on whether you want to absorb Wave 100's chat-infrastructure removal alongside this work.

### Option A — Minimum cleanup (`internalMcpAutoInject` only)

Delete the auto-injection writer + its call sites. Leave the rest of the vestigial chain alone.

Files to delete:
- `src/main/internalMcp/internalMcpAutoInject.ts`
- `src/main/internalMcp/internalMcpAutoInject.test.ts`

Files to update:
- `src/main/main.ts` — remove the `import { buildInjectOptions, injectIntoProjectSettings } from './internalMcp'` line and the call to `injectStandaloneMcpEntry` in startup.
- `src/main/internalMcp/index.ts` — remove the now-unused `buildInjectOptions`, `injectIntoProjectSettings`, `removeFromProjectSettings`, `resolvePackageEntry` exports. Keep the barrel for `InternalMcpScope` re-export if external consumers depend on it; otherwise delete the file too.
- `src/main/mainShutdown.ts` — verify no `removeFromProjectSettings` call survives there.

**What stays vestigial:** `internalMcpScope`, `scopedMcpConfig`, `claudeCodeLaunch`, `claudeCodeAdapter`, `agentChatOrchestration` and the rest of the orchestration providers. They compile, they import each other, but no renderer call triggers them.

**Pros:** Smallest blast radius. Solves the specific complaint ("why is internalMcp still injecting?").
**Cons:** Leaves the rest of the dead chain in tree. Same complaint will resurface next time anyone reads `scopedMcpConfig.ts` and wonders what it's for.

### Option B — Full vestigial chain deletion (effectively starts Wave 100)

Delete every file in the chain above. Pulls Wave 100's scope into this cleanup.

Files to delete (~10+):
- All of `src/main/internalMcp/` (5 files).
- `src/main/orchestration/providers/scopedMcpConfig.ts` + test.
- `src/main/orchestration/providers/internalMcpRoutingPolicy.ts` + test.
- `src/main/orchestration/providers/claudeCodeLaunchInputs.ts` + tests.
- `src/main/orchestration/providers/claudeCodeLaunch.ts` + tests.
- `src/main/orchestration/providers/claudeCodeAdapter.ts` + tests.
- `src/main/orchestration/providers/claudeCodeMode.ts` + tests.
- `src/main/orchestration/providers/mcpSpawnCostTelemetry.ts` + test.
- `src/main/ipc-handlers/agentChatOrchestration.ts` + tests + its registration in `ipc.ts`.

Plus the renderer-side chat-IPC callers (anything calling `window.electronAPI.agentChat.*` related to orchestration).

**Pros:** Tree is honest. No more "this looks alive but isn't" surprises.
**Cons:** Multi-day work. Effectively Wave 100. Cross-checks against Wave 100's existing branch (paused per the prior HANDOFF) to avoid divergence.

### Option C — Status quo

Leave it. Cosmetic redundancy. The auto-injection writes a `.mcp.json` entry duplicate of what the meta-level config provides; Claude Code sees one server (not duplicates) because both entries have the same map key (`ouroboros`).

**Pros:** Zero effort.
**Cons:** The next time anyone wonders "why does this exist," they have to re-do this diagnostic.

## Recommendation

**Option A** for the immediate cleanup (matches Wave 22's locked Path A decision, addresses Cole's specific concern, single-session work). Then **Option B** as Wave 100's scope when chat-removal happens for real. If Wave 100 happens soon, you can skip Option A and just do Option B once.

## Files to touch in Option A (the recommended path)

Single dispatch to `sonnet-implementer` with this brief:
1. Read this catalog file.
2. Verify no surprising consumers of `injectIntoProjectSettings` / `buildInjectOptions` by grepping `src/`.
3. Delete the 2 file/test pair under `internalMcp/`.
4. Update `main.ts` to drop the import + call site.
5. Update `internalMcp/index.ts` barrel to drop the now-orphaned exports.
6. Verify `npm run build` clean + `npx tsc --noEmit` clean + `test:main` no regressions.
7. Commit `chore: remove redundant internalMcp auto-injection (npm + meta-global covers it)`.

Estimated: 30 min.

## Related follow-ups

- `2026-05-27-internalmcp-asar-packaging.md` — becomes moot if Option B lands; partly resolved by Option A (less code that needs the asar handling).
- Wave 100 branch (paused per prior HANDOFF) — Option B effectively starts it; coordinate to avoid conflict.
