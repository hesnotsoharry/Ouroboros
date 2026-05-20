# Session Handoff — 2026-05-20 (Wave 99 shipped local; v2.20.0 tag pending push)

**Audience:** the next Claude Code session.

---

## ⚠️ Concurrent work in the tree — read this first

This checkout currently holds **two independent efforts**:

1. **Wave 99 (Agent-Completion Rail Indicators) — committed** as `8c75e940`, tagged `v2.20.0` (local, not pushed). Renderer-only.
2. **Wave 100 (Chat-Surface Removal) — IN-PROGRESS, UNCOMMITTED.** ~31 files in the working tree: `src/main/**` (util extraction `getErrorMessage` → new `src/main/utils.ts`, ipc-handler import updates), new `src/main/configDefaults.ts` / `src/main/hooks/types.ts`, plus `roadmap/wave-100-chat-surface-removal/` and `roadmap/discovery/2026-05-19-de-chat-triage.md`. **This is another session's live work — do NOT commit, revert, or build on it without confirming with Cole.** Wave 99 was committed by explicit path specifically to leave Wave 100 untouched.

Two commits also landed during the Wave 99 session that predate it: `e1d34d3a` (terminal-dock fixes) and `b8666432` (graph cold-acquire). Those are committed already.

---

## Wave 99 — what shipped (commit `8c75e940`, tag `v2.20.0`)

Agent-completion indicators on the chat-workbench rail, for **interactive terminal `claude` sessions** (the post-chat-retirement usage pattern).

- **Outer project rail** dot (green=complete / red=error), cwd-based — the reliable signal.
- **Dock terminal tabs + inner-rail terminals list** — per-terminal `CompletionDot` keyed by `claudeSessionId`.
- **Revived the dead "Live" chip** for terminal sessions: `useWorkbenchAttention` gained an additive `AgentSession`-status source (ADR 6); the rail had been reading the retired chat-thread status, which is null for terminal sessions. That was the root cause of "no indicators anywhere."
- New `useAgentCompletionIndicators` hook + shared `AgentCompletionIndicatorsContext`; two independent viewed-watermarks (project-click clears only the outer dot, not the per-terminal dots).

Full story: `roadmap/wave-99-agent-completion-rail-indicators/wave-99-result.md`.

**Gates:** typecheck clean, `eslint src/` clean, ChatOnlyShell + hook suites green. Orchestrator-owned acceptance test (`useWorkbenchAttention.agentSource.acceptance.test.ts`) passes; Phase 3 passed a phase-reviewer pass.

### ⚠️ Wave 99 — NOT done

- **Live UI smoke deferred.** `/ui-smoke 99` was NOT run because the tree concurrently holds incomplete Wave 100 main-process work — a dev-server smoke wouldn't cleanly isolate Wave 99. **Next-session action once Wave 100 is resolved:** run a live smoke to confirm the three dot surfaces render and clear-on-view behaves. The per-phase observation points were verified at the unit/integration boundary only, not in a running IDE.
- **`/promote-vendor-lessons 99`** — no-op (no vendor SDK touched), skipped.
- **`/audit-followups`** — not run (no follow-ups created this wave; tree too mixed for a clean diff scan). Can run next session.

### Wave 99 known debt (in result brief)

- `useWorkbenchProjects` logic duplicated into `AgentCompletionIndicatorsContext` (drift risk) — candidate for shared extraction.
- Session-row chip wired into `InnerSidebarChats` but dormant behind the disabled `chats` tab (Wave-89 pivot).
- Per-terminal dots inherit the heuristic `useClaudeSessionCapture` binding (background-launched claude can mis-bind); outer dot is binding-free.

---

## Push backlog (held until 2026-06-01 GH Actions minutes restore)

Per the 2026-05-19 bulletin, agents do not initiate pushes; CI minutes are exhausted until 2026-06-01. Ahead of `origin/master`:

- The Wave 98 backlog (5 commits + tag `v2.19.3`) from the prior HANDOFF — still unpushed.
- Wave 99: commit `8c75e940` + tag `v2.20.0`.

Plus `e1d34d3a`, `b8666432` (landed this session).

---

## Open follow-ups carried forward

In `roadmap/follow-ups/`:
- `2026-05-19-wave-95-manual-smoke.md` — Wave 95 hands-on smoke walk for G/H (still outstanding)
- `2026-05-18-osc-11-read-allow.md`
- `2026-05-18-ansi-palette-tuning.md`
- `2026-05-16-wave-89-tool-bridge-runtime-smoke.md`
- `2026-05-16-wave-89-stacked-dock-integration-test.md`
- `2026-05-16-wave-89-dead-useWorkbenchCompare-hook.md`
- `2026-05-05-electron-renderer-browser-mcp-wiring.md`

In `roadmap/bugs/`:
- `2026-05-17-chatstatenewpath-dynamic-require-threadstore.md` — OPEN, medium
- `2026-05-17-silent-buildrepoindex-hang-post-graph-ready.md` — TRIAGED, medium
- `2026-05-15-e2e-teardown-hang.md` — Wave 93 carry-over

## Pre-existing uncommitted tree state (from W97/W98, still untouched)

```
M tools/__fixtures__/train-context/test-output-weights.json   (regenerated timestamps, no content change)
?? tools/__scratch__/sample.test.ts                            (scratch dir; needs .gitignore entry)
```

## Vendor patches in tree (unchanged)

`patches/addon-webgl-0.19.0.{original,patched}.{mjs,js}` — postinstall patcher for upstream PR #5883. Remove when `@xterm/addon-webgl >= 0.19.1` ships.

## Next session pickup

- **Coordinate Wave 100** — it's mid-flight uncommitted in the tree (chat-surface removal). Confirm with Cole before touching it.
- **Smoke Wave 99** once the tree is clean — confirm the dot surfaces render live.
- **Push backlog** when 2026-06-01 minutes restore (W98 5 commits + tag, W99 commit + tag, plus the two loose commits).
- Decide on the lingering pre-existing uncommitted fixture/scratch state.
