---
status: IN-PROGRESS
created: 2026-05-25
updated: 2026-05-25
type: fix-sweep
---

# Wave 16 — IPC Handler Perf Fix Sweep

## Status

IN-PROGRESS. Phase 1 implementing this session; Phases 2–5 queued for follow-up sessions.

## Context

Cole's boot trace (3-window restore, 2026-05-25 18:33–18:34) showed the main-process event loop blocked or near-blocked for cumulative tens of seconds. Quantified offenders from `[ipc-perf] slow handler` log lines:

| Handler | Calls | Cumulative ms | Per-call worst |
|---|---|---|---|
| `git:isRepo` | 8 | ~20,500 | 3,783 ms |
| `extensionStore:getThemeContributions` | 6 | ~5,800 | 1,753 ms |
| `shellHistory:read` | 4 | ~2,300 | 606 ms |
| `usage:getUsageWindowSnapshot` | 4 | ~10,700 | 3,423 ms |
| `extensionStore:getProductIconThemeContributions` | 1 | 1,709 | 1,709 ms |
| Window close (single event) | 1 | ~5,100 | 5,091 ms |

Each handler runs zero-cache. Multi-window sessions multiply the fan-out: 3 windows × per-root × per-refresh = 8 git shellouts where 1 would do.

## Goal

Eliminate the dominant cumulative cost of repeated handler invocations through caching with correctness-preserving invalidation. Reduce 3-window boot lag from "noticeably bad" to "barely perceptible." Target: cumulative slow-handler time at boot from ~40s → <5s.

## Locked decisions

See `wave-16-decisions.md` (sidecar ADR).

Headline picks:
- **git:isRepo:** positive ∞ (session-lifetime), negative 30s TTL. Once a dir is a repo it stays a repo; non-repos get 30s slack so `git init` is picked up reasonably fast.
- **extensionStore:** per-session cache, invalidated on extension install/uninstall events.
- **shellHistory:** per-session cache, invalidated on explicit refresh trigger.
- **usage poll:** Promise dedup for concurrent calls + result cache for the poll interval.
- **window close:** investigate but DO NOT touch in this wave; structural change; defer to wave 17+ if measurement justifies it after P1-P4.

## Scope

**In:**
- Module-scoped caches in 3 handler files (gitOperations, extensionStore, shellHistoryHandlers).
- Promise dedup in usage poller.
- Test coverage on cache hit/miss/invalidate paths.

**Out:**
- The 3-window restore behavior itself (working as designed; Cole confirmed this isn't a bug).
- Window-close async dispose chain (P5 is investigative; structural fix moves to a separate wave).
- Cross-window IPC dedup at the windowManager level (would help but architecturally larger; defer).
- React renderer perf (these are all main-process handlers).

## Phases

| # | Phase | Files | Verification |
|---|---|---|---|
| 1 | git:isRepo session cache | `src/main/ipc-handlers/gitOperations.ts` + test | Cole reruns `npm run dev` with 3 windows; `[ipc-perf]` lines for `git:isRepo` drop to ≤1 per root |
| 2 | extensionStore session cache | `src/main/ipc-handlers/extensionStore.ts` + test | `[ipc-perf]` lines for `extensionStore:getThemeContributions` drop to ≤1 per session |
| 3 | shellHistory session cache | `src/main/ipc-handlers/shellHistoryHandlers.ts` + test | `[ipc-perf]` lines for `shellHistory:read` drop to ≤1 per session |
| 4 | usage poll Promise dedup | `src/main/usage*` (TBD location) | `[ipc-perf]` `usage:getUsageWindowSnapshot` calls drop from 4 → 1 per 300s window |
| 5 | Window close dispose investigation | Read-only spike — produces a findings doc | Decide: fix in this wave (if quick) or punt to Wave 17 |

## Phase ordering

Strict 1 → 2 → 3 → 4 → 5. Each phase is one commit. Phase 1 ships in this session for immediate relief; Cole verifies with `npm run dev`; subsequent phases land in follow-up sessions after each is validated.

## Test coverage by phase

| Phase | Test shape | Key assertions |
|---|---|---|
| 1 | Pyramid (pure cache logic) | Hit returns cached value without shelling out; positive TTL ∞; negative TTL 30s; per-root keying |
| 2 | Pyramid | Hit returns cached; invalidate on extension event clears cache |
| 3 | Pyramid | Hit returns cached; invalidate on explicit refresh clears cache |
| 4 | Pyramid + light integration | Concurrent calls share one in-flight Promise; result cached for poll interval |
| 5 | Investigative — no tests | Spike findings only |

## Acceptance criteria

A new `npm run dev` boot with the user's normal 3-window session restore shows cumulative `[ipc-perf] slow handler` time at boot ≤ 5,000ms (down from ~40,000ms). `git:isRepo`, `extensionStore:getThemeContributions`, `shellHistory:read` each appear in the log at most once per session per root.

## Verification — per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 1 | Cole's terminal output of `npm run dev` with 3 windows restored | `gitIsRepo` callsite → cache → respond() → IPC → main-process log line | At most one `[ipc-perf] git:isRepo` log line per unique workspace root in the boot trace |
| 2 | Same | extensionStore.getThemeContributions callsite → cache → IPC → log | At most one `[ipc-perf] extensionStore:getThemeContributions` line in boot trace |
| 3 | Same | shellHistory.read callsite → cache → IPC → log | At most one `[ipc-perf] shellHistory:read` per session |
| 4 | Same | usage poller dispatcher → Promise dedup → claude CLI spawn → result cache → IPC → log | First boot: one `usage:getUsageWindowSnapshot` log line; subsequent 5 minutes: zero |
| 5 | Findings doc + repeat boot trace | Window-close handler chain → measured per-step dispose times | Either: a P5 fix lands and window-close blocks <500ms, OR: doc says "punt to Wave 17, here's why" |

## Risks

- **Cache invalidation correctness.** If a positive `git:isRepo` is cached forever and someone manually deletes `.git/` mid-session, we'd return a stale `true`. Acceptable — that's a rare developer-only scenario.
- **Extension theme cache invalidation.** Need to find the extension install/uninstall event channel and wire the cache to it. If we miss the wiring, theme changes wouldn't surface until reboot.
- **Usage poller dedup.** The poller spawns the `claude` CLI; if we cache too aggressively, the user's `/usage` indicator could lag. The poll interval is 300s, so this is bounded.

## Files the next agent should read first

- `src/main/ipc-handlers/gitOperations.ts` (Phase 1 target)
- `src/main/ipc-handlers/extensionStore.ts` (Phase 2)
- `src/main/ipc-handlers/shellHistoryHandlers.ts` (Phase 3)
- `src/main/ipc.ts` (the `patchIpcMainHandle` wrapper that emits the perf logs)

## Note to the implementer

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no boot trace — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient; the user's boot lag is the actual gate.

## Orchestrator dispatch checklist

- Phase 1 (this session): inline self-fix — single-file, well-bounded, context already in window, passes the four-part self-fix test.
- Phases 2–4: dispatch `sonnet-implementer` per phase (cross-subsystem judgment on cache key + invalidation event).
- Phase 5: dispatch `sonnet-diagnostician` for the window-close investigation; structural fix decision after findings.
