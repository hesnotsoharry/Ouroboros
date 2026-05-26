---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
priority: LOW
source: wave-20-phase-c
---

# `GraphControllerLike.manageAdr(action, id?)` — verify `id?` is not a parallel orphan

## Context

Wave 20 Phase C dropped the unused `id` parameter from the `manage_adr` MCP tool's input schema (`mcpToolHandlers.ts:138`) per Decision 4 (Option B). The handler `handleManageAdr` at `mcpToolHandlerHelpers.ts:271` never consumed `args.id`.

The internal consumer API — `GraphControllerLike.manageAdr(action: 'list' | 'get' | 'create' | 'update' | 'delete', id?: string): unknown` at `src/main/codebaseGraph/graphControllerSupport.ts:48` — still advertises an `id?` parameter. This is a SEPARATE surface from the MCP tool: it's the in-process API consumed by main-process code (graph handlers, etc.), not the agent-facing MCP tool.

**Question:** is `id?` actually consumed somewhere in the chain from `GraphControllerLike.manageAdr` → `GraphControllerCompat` → `mcpToolHandlerHelpers.handleManageAdr`? Or is it a parallel orphan, analogous to the MCP schema one Wave 20 just removed?

## Investigation needed

1. Find the implementation of `manageAdr` on `GraphControllerCompat` (likely in `graphControllerCompatQueries.ts` or `graphControllerCompat.ts`).
2. Trace whether `id?` is threaded through to ANY downstream consumer — DB CRUD, handler dispatch, etc.
3. If yes, where; if no, the same drift Wave 20 closed exists at this layer too.

## Likely outcomes

- **Outcome A — `id?` is genuinely consumed somewhere.** Then `GraphControllerLike` is fine as-is and the doc is accurate. Close as WONTFIX.
- **Outcome B — `id?` is also an orphan.** Then drop `id?` from the `GraphControllerLike` interface signature, update `src/main/codebaseGraph/CLAUDE.md`'s consumer-API table row, and update any pass-through call sites. Effort: S.

## Effort

~30 min investigation (grep + read 2-3 files). Implementation if Outcome B: another ~30 min. Total ≤ 1 hour.

## Priority

LOW. The current state has been stable for a long time without anyone hitting it; this is a janitorial cleanup, not a bug. Worth doing during the standalone-MCP extraction wave (Wave 22, blocked on Wave 87) when the consumer API surface is being re-examined for portability anyway.
