---
status: SHIPPED
created: 2026-05-20
updated: 2026-05-20
wave: 99
slug: agent-completion-rail-indicators
tag: v2.20.0
---

# Wave 99 — Agent-Completion Rail Indicators — Result

## What shipped

Agent-completion indicators on the chat-workbench rail, surfacing when a Claude
Code agent finishes (green = `complete`, red = `error`) for **interactive
terminal sessions** — the actual usage pattern after the chat-surface retirement.

| Phase | What | Status |
|---|---|---|
| 0 | ADR — 6 decisions locked | ✅ |
| 1 | `useAgentCompletionIndicators` hook (project + session derivation, viewed watermarks) | ✅ |
| 1-rev | Split viewed watermark into project-level + session-level | ✅ |
| 2 | Outer-rail project dot + clear-on-select | ✅ |
| 3 | Inner-rail attention rewire — `AgentSession` source, Live revival, threadless-quirk fix | ✅ |
| 4 | Shared `AgentCompletionIndicatorsContext` + `CompletionDot` on dock tabs + inner terminals list | ✅ |
| 5 | Wrap (this) | ✅ |

## The diagnosis that reshaped the wave

A `sonnet-diagnostician` pass before implementation found the root cause of "no
indicators anywhere": the completion **signal** is alive and chat-agnostic
(hooks installed globally fire for terminal `claude`; `AgentSession.status`
reaches `complete`/`error`), but the workbench rail's attention system derived
`live`/`completed-unseen`/`failed` from `AgentChatThreadRecord.status` — the
**retired in-IDE chat** thread status — which is null for terminal sessions. The
rail read one store; the live signal lived in another; they were never joined.
So this wave is as much a **repair** (reviving the dead "Live" chip) as a feature.

## Surfaces delivered

- **Outer project rail** (`OuterProjectRail` / `OuterProjectRail.dot.tsx`) —
  cwd-based dot, independent of the terminal binding. **Reliable signal.**
- **Dock terminal tabs** (`DockSlotTabs` + shared `CompletionDot`) — per-terminal
  dot keyed by `claudeSessionId`.
- **Inner-rail terminals list** (`InnerSidebarTerminals` + `CompletionDot`) —
  same per-terminal dot.
- **Session-row chip** (`InnerSidebarChats` via `useWorkbenchAttention`) — wired
  and contract-tested, but **dormant**: it renders behind the `chats` tab that
  the Wave-89 terminal-first pivot disabled (`InnerSidebar.tsx`). Kept for when
  chats return. (User decision 2026-05-20: deliver the visible inner indicator on
  the terminals surfaces, not by re-enabling the chats tab.)

## Decisions of note

- **Two viewed-watermarks, not one.** Surfaced mid-wave: a single watermark made
  `markProjectViewed` (project click) wipe the per-terminal dots before the user
  could see which terminal finished. Split into `lastProjectViewedAt` (outer dot)
  + `lastSessionViewedAt` (per-terminal). Public hook signatures unchanged.
- **Single shared context.** `AgentCompletionIndicatorsContext` at
  `ChatWorkbenchBody` mounts the hook once so all three surfaces share one
  viewed-state (per-surface mounts would diverge).
- **Additive attention source (ADR 6).** New `agentStatusBySessionRecordId` input
  to `useWorkbenchAttention`; legacy chat-thread path kept as fallback.

## Verification

- **Gates:** `npm run typecheck` clean; `npm run lint` (eslint src/) clean;
  `useAgentCompletionIndicators.test.ts` + full `ChatOnlyShell` suite green
  (738 passed / 3 pre-existing skips at wrap; phase runs reported 92 + 1090 layout).
- **Orchestrator-owned acceptance test:** `useWorkbenchAttention.agentSource.acceptance.test.ts`
  (7 cases) — authored before Phase 3 dispatch, confirmed failing for the right
  reason, passes post-implementation. Phase 3 also passed a `sonnet-phase-reviewer`
  pass (all four axes PROCEED; reviewer surfaced the dormant-chats-tab finding).
- **Per-phase experiential observation — NOT live-verified.** The plan's
  observation points (dots/chips rendering in a running IDE) were verified at the
  unit/integration boundary only. **Live UI smoke was NOT run** — the working tree
  concurrently contains in-progress Wave 100 (chat-surface removal) main-process
  work, so a dev-server smoke would not be a clean test of Wave 99 in isolation.
  `/ui-smoke 99` deferred. **Recommended next-session action:** once the Wave 100
  tree state is resolved/committed separately, run a live smoke to confirm the
  three dot surfaces render and clear-on-view behaves.

## Follow-ups / debt

- **DRY:** `useWorkbenchProjects` logic was duplicated into
  `AgentCompletionIndicatorsContext` (the implementer avoided exporting from
  `ChatWorkbenchBody.rails.tsx`). Drift risk if project-derivation changes —
  candidate for a shared extraction in a cleanup pass.
- **Dormant session-row chip** behind the disabled `chats` tab — revisit if/when
  the chats surface returns.
- **Heuristic terminal binding** (`useClaudeSessionCapture`) — per-terminal dots
  can mis-attach for background-launched `claude`; pre-existing, out of scope.
- **Live smoke** (above) — deferred due to the shared tree.
- **Persisted "unread across restart"** — explicitly punted (ADR 5); file a
  follow-up if wanted.

## Ship state

- Version bumped `2.19.3` → `2.20.0`; `CHANGELOG.md [2.20.0]` entry added.
- Committed locally as one `feat(wave-99)` commit, **Wave 99 files only** (the
  concurrent Wave 100 `src/main/**` + `roadmap/wave-100` work was left untouched
  per user direction).
- Local tag `v2.20.0`. **Not pushed** (per 2026-05-19 bulletin — GH Actions
  minutes exhausted until 2026-06-01; agents do not initiate pushes).
