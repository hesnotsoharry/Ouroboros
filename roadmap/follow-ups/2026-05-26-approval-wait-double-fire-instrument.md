---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
priority: LOW
wave: 18
finding: W7
---

# `approval.wait` log fires 2x per requestId — needs `connId` to disambiguate

## Context

Wave 18 Phase 1E diagnostician (`wave-18-diagnostic-duplicate-events.md`) audited duplicate event firing. Most duplicates resolved to one of three causes (per-window handler, React StrictMode, or intentional two-pass). The `approval.wait` case is the one that couldn't be code-cited without runtime data.

Pattern: `[approval.wait] waiting for <ID>` and `[approval.wait] resolved <ID>` BOTH fire 2x per request — never just once, never 3x. Suggests exactly two named-pipe connections are arriving for the same requestId.

## Two hypotheses (couldn't disambiguate from code)

1. **Two independent hook script invocations** for the same approval request. Expected behavior; the double-resolve in `approvalWaiterRegistry` is harmless. No bug.

2. **Client-side reconnect** while the first connection is still alive. A real bug — could mean the hook script is racing or the pipe is being reused incorrectly.

## Investigation shape

Add `connId` to the log lines in `src/main/ipc-handlers/ideToolServerHandlers.ts:138` and `:145`:

```typescript
log.info(`[approval.wait] waiting for ${requestId} (connId=${connId})`);
// ... later ...
log.info(`[approval.wait] resolved ${requestId} (connId=${connId})`);
```

Where `connId` is the per-connection ID assigned at named-pipe accept time. If the two log lines for the same requestId show DIFFERENT `connId` values → hypothesis 1 (two scripts). If SAME `connId` → hypothesis 2 (reconnect = bug).

User runs a trace; report back the connId pattern; orchestrator decides whether to file a fix follow-up.

## Why deferred from Wave 18

LOW priority — pure log noise either way, no behavioral impact. Wave 18 had higher-priority surfaces (W1, W2, W3, W4) — deferred this one to avoid scope creep. The instrumentation is tiny (~5 LOC) and the next time someone touches `ideToolServerHandlers.ts` is the right time to add it.

## Files

- `src/main/ipc-handlers/ideToolServerHandlers.ts` (lines 138, 145)
- `src/main/ipc-handlers/ideToolServer.ts` (where connId is assigned, if it isn't already)
