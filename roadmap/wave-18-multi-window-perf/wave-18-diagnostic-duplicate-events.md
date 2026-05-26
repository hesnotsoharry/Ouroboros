# Wave 18 Phase 1E — Duplicate Event Diagnostic Report

**Status:** DIAGNOSIS COMPLETE
**Date:** 2026-05-25
**Phase:** B1 — Root-cause investigation (read-only)

---

## TL;DR

The five duplicate-event categories observed in the 2026-05-25 23:02–23:03 trace have **three distinct root causes**, not one unified structural problem. The `[perf] startup:` triple-log and `markStartup` warnings are one mechanism (per-window IPC callers hitting a global handler that lacks a flush guard). The `[approval.wait]` doubles are a different mechanism (two independent named-pipe connections for the same requestId). The `mergeThreadCollection` × 5 and `[xterm-init]` × 12 are both React StrictMode dev double-invocations — production-irrelevant. The `contextLayer.buildRepoIndex` firing twice is not a duplicate at all; it is the intentional two-pass graph-ready design.

---

## Per-Duplicate Table

| Duplicate | Mechanism | File:Line | Scope | Why N times |
|---|---|---|---|---|
| `[perf] startup:` × 3 | `flushStartupLog()` runs on every `perf:mark('first-render')` call, not just the first | `src/main/ipc-handlers/perfHandlers.ts:52-56, 66` | Global IPC handler, called once per window renderer | 3 windows each send `perf:mark('first-render')` → 3 calls to `flushStartupLog()` |
| `markStartup: phase X already marked` × 6 | `markStartup()` duplicate-guard logs a warning and returns early | `src/main/perfMetrics.ts:36-38` | Global singleton `marks[]` array | Phases `renderer-bundle-loaded`, `react-root-created`, `first-render` each marked by 3 windows; 2nd and 3rd calls per phase each emit one warning (3 phases × 2 duplicates = 6) |
| `[approval.wait] waiting for <ID>` × 2 | Handler logs once per named-pipe connection; two independent connections arrive for the same requestId | `src/main/ideToolServerHandlers.ts:132-153` | Global named pipe server (per-connection handler closures) | Two separate hook-script processes each connect and call `approval.wait` with the same requestId |
| `[approval.wait] resolved <ID>` × 2 | Same per-connection handler; both connections await the same `requestId` via `waitForResolution` and both receive the resolved value | `src/main/ideToolServerHandlers.ts:144-145`; `src/main/approvalWaiterRegistry.ts` | Same per-connection scope | Both connections get notified by `notifyApprovalResolved` and log |
| `mergeThreadCollection` × 5 (existing: 0, incoming: 0) | `useReloadThreads` merges `resumeLatestThread` result into the `listThreads` array; when the latest thread is already in the listed set, the `existing` branch fires and logs the trace | `src/renderer/components/AgentChat/agentChatWorkspaceReducers.ts:54-65`; triggered from `agentChatWorkspaceSupport.ts:154-155` | Per-renderer-window, per-`AgentChatWorkspace` mount | 3 windows × React StrictMode dev double-effect (mount→cleanup→mount) ≈ 6; 5 observed (one window's cleanup cycle races to skip the second invocation) |
| `[trace:contextLayer.buildRepoIndex]` × 2 | Two distinct code paths: (a) `initialize()` cold-start at controller line 151; (b) `forceRebuild()` from graph-ready trigger | `src/main/contextLayer/contextLayerController.ts:143-147`; `src/main/mainStartupContextLayerTrigger.ts:16-36` | Global (one controller per workspace root) | Intentional two-phase design — first pass races ahead of graph; second runs after graph is populated to pick up real signatures. NOT a duplicate. |
| `[xterm-init] createTerminal` + `term.open()` × 12 | `useTerminalSetup` `useEffect([sessionId])` is double-invoked by React StrictMode in dev | `src/renderer/components/Terminal/useTerminalSetup.ts:35-40`; logs at `useTerminalSetup.lifecycle.ts:74, 196` | Per-renderer-window, per-session | 6 unique session IDs × 2 (StrictMode dev double-invoke) = 12. Dev-only. |

---

## Pattern Verdict

**Three independent issues, not one root cause.**

- **Issue A (perf summary/phases):** A per-window-caller × global-handler asymmetry. `flushStartupLog()` lacks the deduplication guard that `markStartup()` has. Hypothesis (a) from the brief — a handler registered globally but called by N callers. Root cause is different from Wave 16 P5 (that was cleanup-at-wrong-scope; this is log-flush-without-guard).

- **Issue B (approval.wait):** Two independent named-pipe connections, each with their own handler closure. Hypothesis (c) from the brief — broadcast pattern where multiple listeners log. The "broadcaster" here is `notifyApprovalResolved` which resolves all registered waiters for the requestId. Whether the dual-connection is by design (two separate hook scripts) or a client-side reconnect bug is still open — it requires runtime connId evidence to confirm.

- **Issue C (xterm, mergeThreadCollection):** React StrictMode dev-mode double-invoke. Hypothesis (b) from the brief's framing doesn't apply here (not a registration leak). These are expected in dev and disappear in production. `contextLayer.buildRepoIndex` × 2 is hypothesis (d) — two systems both fire the event — and is intentional design, not a bug.

---

## Risk Assessment

| Duplicate | BROKEN or Noise? | Severity |
|---|---|---|
| `[perf] startup:` × 3 | `appendStartupRecord` is called 3× per boot, writing the same timing data three times to `startup-timings.jsonl`. The timing data itself is correct (markStartup deduplicates the records). The JSONL history is inflated with duplicate boot entries. | LOW — no functional breakage; history inflated |
| `markStartup` warnings × 6 | Pure log noise | NONE |
| `[approval.wait]` × 2 per ID | Two `waitForResolution` promises are live for the same requestId. `notifyApprovalResolved` resolves both. If one connection is a retry/reconnect while the first is still alive, the first receives a valid response AND the retry connection also receives a response. If the hook script is not idempotent on double-resolve, it could write a duplicate response file or act on the approval twice. | MED — needs connId evidence to confirm whether this is expected or a bug |
| `mergeThreadCollection` × 5 | Dev-only. The function is a pure reducer; the second call produces the same state. | NONE in production |
| `contextLayer.buildRepoIndex` × 2 | By design. No bug. | NONE |
| `[xterm-init]` × 12 | Dev-only. StrictMode cleanup disposes the first terminal before the second mounts. In production, fires exactly once per session. | NONE in production |

---

## Proposed Fix Shapes (describe only)

### Fix 1: `[perf] startup:` triple-log and `appendStartupRecord` triple-write

**Root cause:** `flushStartupLog()` at `perfHandlers.ts:52-56` lacks a one-shot guard.

**Fix shape:** Add a module-level `let startupLogFlushed = false` boolean. Guard `flushStartupLog()` with an early return on subsequent calls. Reset the flag in any code path that calls `resetStartupTimings()` (to support test teardown). This mirrors the `handlersRegistered` guard at `ipc.ts:238-240`.

**Verification:** With 3 windows open, `[perf] startup:` appears exactly once per boot. `startup-timings.jsonl` gains exactly one entry per boot.

### Fix 2: `[approval.wait]` dual-connection

**Prerequisite investigation:** Add `connId` to both log lines at `ideToolServerHandlers.ts:138` and `145` before proposing any fix. Run a session that triggers approval and compare whether the two log entries carry the same or different `connId`.

- **If different connIds:** Two hook processes connecting is expected behavior. No fix needed in the IDE. Document the multi-hook topology in `approvalWaiterRegistry.ts` and note that double-resolve is harmless.
- **If same connId:** The hook script is reconnecting while the first connection is still alive. The fix belongs in the hook script — either add a reconnect guard or honor the existing connection.

### Fix 3: `mergeThreadCollection` dev noise

**Not a production bug.** If the log noise is disruptive during development, move the trace log behind a dev-only guard or add a ref guard to `useInitialThreadReload` to prevent the StrictMode second call from running if the first call's async result hasn't been discarded.

### Fix 4: `[xterm-init]` dev noise

**Not a production bug.** No fix needed. Dev log noise only.

### Fix 5: `contextLayer.buildRepoIndex` × 2

**Not a bug.** No fix needed.

---

## Phase 2+ Hand-off

**For Fix 1 (flush guard):**
- Touch only `src/main/ipc-handlers/perfHandlers.ts`
- Add the `startupLogFlushed` boolean and guard
- Update `perfHandlers.test.ts` with a second-window test case asserting exactly one log call and one `appendStartupRecord` call per boot

**For Fix 2 (approval.wait investigation):**
- Add `connId` to `src/main/ideToolServerHandlers.ts:138` and `145`
- Run a tool-approval session and capture the connId values
- File the diagnosis result as a follow-up note in `approvalWaiterRegistry.ts` comments
- If a fix is needed, it belongs in the hook script, not the IDE server

**No files need investigation-specific logging removal for the StrictMode cases.** The `[xterm-init]` and `mergeThreadCollection` logs are baseline structural logs — they stay.
