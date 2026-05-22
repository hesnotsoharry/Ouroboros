# Session Handoff — 2026-05-20 (Wave 99 shipped local; v2.20.0 tag pending push)

**Audience:** the next Claude Code session.

---

## 🔼 UPDATE 2026-05-21 (latest) — Workbench Wave 2 SHIPPED (live terminals + divider)

Workbench overhaul: **Waves 0 + 1 + 2 all on `master`.**

- **Wave 2 — terminal integration: SHIPPED** (local tag `v2.23.0`). Behind the same default-off `layout.canonWorkbench` flag, the canon workbench's two terminal frames are now **real live xterm terminals** bound to workbench-owned ptys (behind the tinted-well glass), and the divider between them is **draggable + persisted** (`layout.workbenchTerminalSplit`, default 0.62). New `Terminals/useWorkbenchTerminals.ts` (thin spawn/kill hook, StrictMode-safe) + `useVerticalSplitResize.ts`; `TerminalShell` now mounts the existing `<TerminalInstance>`; static mock bodies removed. Renderer-only + one config key. Plan/ADR/recon/result in `roadmap/wave-2-workbench-terminal-integration/`. Gates: acceptance 6/6, Workbench 102, `test:main` 6444, tsc + full lint + prettier clean. Two orchestrator review-fixes folded in (StrictMode net-kill; async restore never reaching the UI — both with regression tests).
- **Next action:** **Wave 3 — hook pipeline mapping + state machine** (map canon's idealized hook schema → the real `useAgentEvents`/`AgentEventsContext` wire; extend `AgentStatus` with `thinking/awaiting/errored/done/fresh`; drive the Agent Globe; swap `workbenchMockData` → live data for TitleBar/Rails/AgentSidebar/StatusBar). Then 4 sidebar live, 5 permissions, 6 themes+responsive, 7 cutover.
  - **Wave 3 grounding — read before planning** (so you don't re-derive it): the canon §11/§12 hook schema is **idealized/fiction** — `useHookSubscription`, `transcript_path`, `decision:"request"`, structured `tool_response.diff` do NOT exist. The real wire: `useAgentEvents` + `AgentEventsContext`, `{type, sessionId, timestamp}` envelope, **file-poll approval** (`~/.ouroboros/approvals/{id}.response`, `approve|reject`), `AgentStatus = idle|running|complete|error`. The approval UI already exists (`approvalManager`/`ApprovalContext`/`ApprovalDialog`). The hook work is **mapping + extending the enum/reducer** (`useAgentEvents.helpers.ts`), not building from zero. Full table: `roadmap/discovery/workbench-overhaul-reconciliation.md` §11/§12 + the "Hook schema: canon vs reality" table. Open Qs to resolve at Wave-3 plan time: `transcript_path` forwarding (skip vs plumb), and whether `workbenchMockData` regions swap source-not-shape (they were typed to canon §11 for exactly this).
  - **Wave 2 left a clean seam for live data:** terminals are already live (not mock) — Wave 3 does NOT touch `Terminals/`; it swaps mock→live for the other four regions. The `workbenchMockData` terminal-line constants are now dead (`roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md`) — sweep them as part of Wave 3's mock rework.
- **Wave 2 NOT done / deferrals:** `/ui-smoke 2` live smoke deferred (Cole not using the app until the remake is done; the Phase-1 runtime FLAG — zero-height-well initial column wrap, mitigated by xterm's `isReadyRef` + ResizeObserver — is unconfirmed in a live IDE; confirm next dev session: enable the flag, type in both frames, drag divider, reload). Follow-up `roadmap/follow-ups/2026-05-21-wave-2-dead-terminal-line-mocks.md` (dead mock constants for Wave 3 to sweep). Tab `+`/split/maximize buttons remain non-functional; Claude auto-launch + multi-tab → Wave 3.

---

## 🔼 UPDATE 2026-05-21 — Workbench Wave 1 SHIPPED (static shell); terminal glass fixed

Workbench overhaul progress: **Wave 0 + Wave 1 + the terminal-glass fix all on `master`.**

- **Wave 1 — static workbench shell: SHIPPED** (tag `v2.22.0`). Behind the default-off `layout.canonWorkbench` flag (**Settings → Appearance → "Canon workbench (experimental)"**), a third `InnerApp` branch renders the full canon shell as a static layout with mock data: title bar (app mark, project/branch chips, Agent Globe, Windows controls), project + inner rails (UnifiedRail built but not mounted), centre terminal frame (62/38, tinted-well, **no xterm yet**), agent sidebar (5 panels), status bar. All under `src/renderer/components/Workbench/` (canon §17 tree) + `shared/Icon.tsx` + `workbenchMockData.*`. 82 tests; tsc + full lint clean. Plan/ADR/result in `roadmap/wave-1-workbench-static-shell/`. Cole reviewed the shape live (approved; height + flag-reachability bugs caught and fixed mid-build).
- **Terminal glass fix — SHIPPED** (tag `v2.21.1`). Wave 0's tinted well wasn't rendering (xterm WebGL composites opaque, #1004) → switched all terminals to the **DOM renderer**, drove canvas bg from `--term-canvas-bg` (well themes tint, others unchanged), Modern well alpha tuned to 0.35. WebGL dependency-removal follow-up: `roadmap/follow-ups/2026-05-21-remove-xterm-webgl-dependency.md`.
- **Next action:** **Wave 2 — terminal integration** (mount real xterm into `Terminals/TerminalShell.tsx`, replacing the static mock body; wire the divider resize). Then Wave 3 (hook pipeline + live data swaps `workbenchMockData`), 4 (agent sidebar live), 5 (permissions), 6 (themes+responsive), 7 (cutover+teardown). Sequence in `roadmap/discovery/workbench-overhaul-reconciliation.md`.
- **Wave 1 deferrals:** window-control IPC (no-op stubs — not in preload bridge), dual/unified toggle wiring, AgentGlobe awaiting/errored states (Wave 3), per-component animation keyframes (consolidate Wave 3). `/ui-smoke 1` + `/review` not run formally (Cole was live reviewer; per-phase gated + flag-isolated).

---

## 🔼 UPDATE 2026-05-21 — Workbench overhaul kicked off; Wave 0 SHIPPED to master

The **workbench overhaul** is the new active initiative. Design canon lives in-repo at `design-system/` (`canon.html` = 18-section written spec; `workbench-tokens.css` = real token values; `workbench-*.jsx` = rendered mockup). Canon-vs-codebase reconciliation: `roadmap/discovery/workbench-overhaul-reconciliation.md` (decisions resolved: **replace everything** → single canon shell at end state; keep all 7 themes, full treatment Modern/Warp/Retro; delete DispatchScreen + "Explain error" at cutover). 8-wave sequence (0→7) in that doc.

- **Wave 0 — token foundations: SHIPPED** to `master` (commits `b4fbc855` docs + `c253cb2e` impl), tag **`v2.21.0`** pushed. Renderer-only. (1) Canon-name alias block in `tokens.css` (29 net-new names; divergences marked). (2) Opt-in theme-driven terminal "tinted well" — new `Theme.terminalWell`/`terminalCanvasOpacity`, wired in `useTheme.tokens.ts`; Modern terminal now translucent; default-preserving for the 4 untouched themes. 6 bridge tests incl. a default-preservation regression guard; phase-reviewer PASS. Plan/ADR/result in `roadmap/wave-0-workbench-token-foundations/`.
- **Wave 0 NOT done:** rendered tinted-well terminal **not visually smoke-verified** — `/ui-smoke 0` skipped; Cole verifies on next `npm run dev` (Modern terminal should read as a translucent indigo well, not opaque black). `/audit-followups` + `/promote-vendor-lessons` skipped (no follow-ups, no vendor).
- **Next action:** Wave 1 — static workbench shell (titlebar + Agent Globe placeholder + dual/unified rails + stacked terminal frame + agent-sidebar frame + statusbar) with mock data, behind a flag. See the reconciliation doc's wave sequence.
- **Branch note:** Wave 0 landed directly on `master` per Cole's call. The `fix/crash-log-settings-freeze` branch (PR #10) is **untouched and intact** — its 2 commits are preserved; return to it for the PR-#10 merge on 2026-06-01.

---

## 🔼 UPDATE 2026-05-21 — backlog pushed; freeze fix in PR #10; Wave 100 parked

Most of this HANDOFF below is now historical. Current state:

- **Master backlog pushed.** `origin/master` is now fully synced (Wave 98, Wave 99 `8c75e940`, terminal-dock `e1d34d3a`, graph cold-acquire `b8666432`, ghost-cursor `fd929b3b`). Tag `v2.20.0` pushed. The "Push backlog held until 2026-06-01" section below is **resolved** — the current bulletin sanctions pushing; only PR *merges* into protected branches wait for CI minutes.
- **Crash-log freeze fix → PR #10** (https://github.com/hesnotsoharry/Ouroboros/pull/10). Branch `fix/crash-log-settings-freeze`. Decoupled from Wave 100 by redirecting `getErrorMessage` imports (`crashHandlers.ts` + test) from `../utils` → `../agentChat/utils`. Pre-push gate green. **Merge waits until 2026-06-01** (branch protection / CI minutes).
- **Wave 100 (chat-surface removal) parked** on branch `wave-100-chat-surface-removal`: parking commit `dec0d793` + `stash@{0}` (Phase A relocation incl. `src/main/utils.ts`). Still PAUSED, 1/11 phases, needs re-scope per the SCOPE CORRECTION in `waveplan-100.md`. The tree no longer holds mixed uncommitted Wave 100 work.
- **Still open:** Wave 99 live UI smoke (`/ui-smoke 99`) — deferrable now that the tree is clean. PR #10 merge on 2026-06-01.

The "Concurrent work in the tree" warning below is **historical** — the tree is clean on master.

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
