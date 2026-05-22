# Session Handoff — 2026-05-22 (Workbench Wave 6 SHIPPED; themes + responsive; tag v2.27.0 pushed)

**Audience:** the next Claude Code session.

---

## 🔼 UPDATE 2026-05-22 (latest) — Workbench Wave 6 SHIPPED + PUSHED (themes + responsive collapse)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 + 4 + 5 + 6 all on `master`** — Wave 6 pushed to `origin/master` (`7c842dbc`, tag **`v2.27.0`** on origin). CI did not run (GH Actions minutes exhausted until 2026-06-01 — expected per bulletin; the wave-stack *merge* into a protected branch still waits for the minute restore).

- **Wave 6 — themes + responsive collapse: SHIPPED** (commits `398e41fc` P0+P1, `a74adae6` P2, `ec8d0a2d` P3, `7c842dbc` P4 wrap; tag `v2.27.0`; CHANGELOG `[2.27.0]`). Behind the same default-off `layout.canonWorkbench` flag. **Two tracks, renderer-only:**
  - **Per-theme canon treatment (Modern/Warp/Retro).** New per-theme path: `Theme.workbenchTokens?: Partial<Record<CanonWorkbenchToken, string>>` (types.ts) whose entries `applyComponentTokens` writes inline AFTER the material pass (theme overrides beat material wash/glows; absent → fallback stands — completes the deferred `tokens.css:254` promise, ADR D2). **Warp** = warm-amber wash/glows/accent + `terminalCanvasOpacity 0.86`; **Retro** = matte (`--blur-*: 'none'`, opaque `--material-panel` 0.85/0.92, green phosphor) + a CRT scanline overlay in `Workbench.tsx` (`useScanlines` reads `data-scanlines`); **Modern** = no override (canon-matched) BUT terminal well corrected **0.35→0.62** (D5, live-since-Wave-0 bug). cursor/kiro/light/high-contrast untreated (D4).
  - **Responsive collapse (canon §16, 3 tiers — HUD dropped per D3).** New `useWorkbenchBreakpoint` (max-width matchMedia at **1760** and **1440** — NOT 1440/1180; below 1440 is uniformly unified once HUD is dropped). full (≥1760): dual rails, sidebar 348. compact (1440–1759): dual rails, sidebar 300, Latest Hunk → one-line indicator (click expands). unified (<1440): `UnifiedRail` mounts (dual rails unmount), sidebar 300. `UnifiedRail` is now **mounted + live-wired** (`useWorkbenchProjects`/`useGitBranch`/`useWorkbenchAgentData`). Collapse-handle stubs wired to `forceUnified` (left-rail-only).
  - **Gates:** two frozen orchestrator-owned guards (`useTheme.tokens.preservation.test.ts` 2/2 byte-identity of the 4 untreated themes; `Workbench.responsive.acceptance.test.tsx` 5/5 tier contract — both authored before impl, untouched). `useWorkbenchBreakpoint.test.ts` 14/14. **Full suite 11684 passed / 8 skipped / 0 failed.** tsc clean, `eslint src/` 0 errors, prettier clean. 3 `sonnet-phase-reviewer` passes (P2: scanline `// hardcoded:` suppression fixed inline; P3: inert collapse toggle → now expands the real hunk). `/review` mechanical **PASS** (Checks 1–3 clean, 4/5 N/A, 6 deferred to pre-merge mutation task). Plan/ADR/result/mechanical-review/smoke/followup-audit in `roadmap/wave-6-workbench-themes-responsive/`.
- **Next action:** **Wave 7 — cutover & teardown** (make the canon workbench the sole shell; delete `AppLayout`/`InnerAppLayout`, the Wave-89 variant + `ChatOnlyShell` remnants, `Dispatch/`, the "Explain error" scrollback action, AND the orphaned `AgentMonitor/ApprovalDialog`). Sequence: `roadmap/discovery/workbench-overhaul-reconciliation.md`. **Wave 7 is the final workbench wave.**
- **Wave 6 NOT done / deferrals:** `/ui-smoke 6` live smoke deferred (Cole not using the app until the remake is done — per Wave 0–5 posture; checklist written + queued at `wave-6-smoke-report.md`). **Next dev session:** enable the flag, switch Modern/Warp/Retro (deeper indigo well; warm amber wash; matte green + scanlines + no blur), and drag-resize across ~1760/~1440 to watch the agent rail narrow + Latest Hunk collapse, then the rails merge into the unified rail. One new LOW follow-up: `2026-05-22-workbench-forceunified-no-autoclear.md` (manual collapse doesn't auto-clear on widen). `/promote-vendor-lessons 6` = no-op (no vendor SDK). `/audit-followups wave-6` = 24 OPEN, 0 closed (none touch this wave's surface — inbox is growing, worth a `/triage-sweep` soon).
- **Carried-forward:** the **Check-6 mutation pre-merge task** (run `npm run mutation:test`, tighten adapter/derivation survivors before the 2026-06-01 merge) now also covers Wave 6's `workbenchTokens`/`useWorkbenchBreakpoint`/UnifiedRail-adapter logic — joins the Wave-3/4/5 batch. The `UnifiedRail.parts`/`InnerRail` file-tree body is still `MOCK_FILE_TREE`; git +adds/−dels still deferred (existing follow-up).

---

## 🔼 UPDATE 2026-05-22 — Workbench Wave 5 SHIPPED (canon §13 permission UI)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 + 4 + 5 all on `master`** (5 committed + tagged `v2.26.0` local; push per the bulletin — merge of the wave-stack waits for the 2026-06-01 CI-minute restore).

- **Wave 5 — permission UI re-skin: SHIPPED** (commits `6dc5ffa2` P1, `e67c7341` P2, `4d3cf3c1` wrap; tag `v2.26.0`; CHANGELOG `[2.26.0]`). Behind the same default-off `layout.canonWorkbench` flag, the canon workbench now renders the **canon §13 dual-presentation approval UI over the EXISTING file-poll approval pipeline** — no new protocol, no main-process/IPC/config change (ADR D1). When a `claude` session hits a tool needing approval: a glass amber **terminal overlay** slides up over the terminal pane (`Permission/PermissionOverlay.tsx`, mounted in `Terminals/CenterPane`), AND **simultaneously** the agent sidebar's **NOW panel becomes the same permission card** with panels 2–5 dimmed to 0.7 (`Permission/PermissionSidebarTakeover.tsx`, swapped in `AgentSidebar`). Both render the shared `PermissionCard` and resolve through `useApprovalContext()` (Approve / Always-for-tool / Deny — the three existing resolvers; "Always for project" is canon v2, out of scope D5). **The Y/A/N/Esc shortcut is a SINGLE window keydown owner** (`useWorkbenchApproval`, called only by the overlay; the sidebar reads `useApprovalContext()` directly to avoid a 2nd handler — D3). All under `src/renderer/components/Workbench/Permission/`. Plan/ADR/result/mechanical-review/smoke in `roadmap/wave-5-workbench-permission-overlay/`. **Gates:** orchestrator-owned acceptance test 8/8 (frozen; each action → correct resolver once + single-keypress-resolves-once with both surfaces mounted), Phase-2 render tests 7/7, **full suite 11637 passed / 8 skipped / 0 failed**, tsc clean, `eslint src/` 0 errors, prettier clean. Phases 1+2 each got a `sonnet-phase-reviewer` pass (P1 FLAG resolved inline — elapsedSec rendered; P2 PASS + 1 cosmetic FLAG → follow-up). `/review` mechanical = **FLAG non-fatal** (checks 1–5 clean; Check 6 mutation deferred to the pre-merge task).
- **Next action:** **Wave 6 — themes + responsive collapse** (full glass treatment for Modern/Warp/Retro; opportunistic port of cursor/kiro/light/high-contrast; responsive collapse of the dual permission surfaces + rails per canon §16). Then **Wave 7 — cutover & teardown** (make the canon workbench the sole shell; delete `AppLayout`/`InnerAppLayout`, the Wave-89 variant + `ChatOnlyShell` remnants, `Dispatch/`, the "Explain error" scrollback action, AND the orphaned `AgentMonitor/ApprovalDialog`). Sequence: `roadmap/discovery/workbench-overhaul-reconciliation.md`.
- **Wave 5 NOT done / deferrals:** `/ui-smoke 5` live smoke deferred (Cole not using the app until the remake is done — per Wave 0–4 posture; checklist written + queued at `wave-5-smoke-report.md`). **Next dev session:** enable Settings → Appearance → "Canon workbench", run a `claude` session, trigger a gated tool, confirm the overlay + dimmed-sidebar takeover render simultaneously and Y/A/N resolve once. Two new follow-ups: `2026-05-22-orphaned-agentmonitor-approvaldialog.md` (MED — the legacy dialog is mounted nowhere; → Wave 7 deletion) + `2026-05-22-permission-card-elapsed-no-ticker.md` (LOW — cosmetic, no live ticker). `/promote-vendor-lessons 5` = no-op (no vendor SDK). `/audit-followups wave-5` pending (the 2 new follow-ups are intentionally OPEN/deferred).
- **Carried-forward:** the **Check-6 mutation pre-merge task** (tighten tests for any Wave-3/4 *adapter/derivation* mutation survivor before the 2026-06-01 merge) now also covers Wave 5's `Permission/**` adapter logic — run `npm run mutation:test`, tighten adapter/derivation survivors (UI-style/JSX acceptable). See `wave-5-mechanical-review.md` Check 6.

---

## 🔼 UPDATE 2026-05-22 — Workbench Wave 4 SHIPPED (agent sidebar 5 panel bodies live)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 + 4 all on `master`.**

- **Wave 4 — agent sidebar live: SHIPPED + pushed** (`origin/master` @ `3ede163f`, tag `v2.25.0` on origin, CHANGELOG `[2.25.0]`). CI did not run (GH Actions minutes exhausted until 2026-06-01 — no red-X, no minutes burned; expected per bulletin). Behind the same default-off `layout.canonWorkbench` flag, the five agent-sidebar **panel bodies** now render real runtime data via the **same** `useWorkbenchAgentData` adapter (no competing adapter — D1): **NOW** (active tool/target/elapsed) + **Context** (live tokens/cost/model) wired from existing Wave-3 fields; **Files Touched** (list from `AgentSession.toolCalls`, ellipsis-tolerant dedup) + **Hook Timeline** (merged `toolCalls`+`conversationTurns`, `think` dropped — D6) as pure derivations; **Latest Hunk** + **`+N/−N` badges** from the Wave-94 diff pipeline (`diff_review_ready` → `git:diffReview` → `FileDiff → MockDiffHunk`) via a panel-local subscription in new `useWorkbenchAgentData.diff.ts`, diff held as **ephemeral hook state** (no `AgentSession`/reducer/SQLite change — D3). Diff surfaces piggyback `enableTerminalDiffReview` + degrade to empty/badge-free when off (D5). Renderer-only; `AgentMonitor/types.ts` untouched. Sidebar `MOCK_*` data swept (only `MOCK_STATUS_BAR` + `Mock*` types remain — D8). Plan/ADR/recon/result/smoke in `roadmap/wave-4-workbench-agent-sidebar-live/`. **Gates:** Workbench suite **175/175** (incl. the Phase-3 orchestrator-owned acceptance test + 2 derivation unit-test files), full renderer suite green, tsc clean, `eslint src/` 0 errors, prettier clean. Phases 2 + 3 each got a `sonnet-phase-reviewer` pass (Phase 2: 3 FLAG fixes folded in; Phase 3: PASS + one non-blocking FLAG accepted for codebase consistency → follow-up).
- **Next action:** **Wave 5 — permission overlay / sidebar takeover** (the canon permission-prompt UI inside the workbench; the approval pipeline already exists — `approvalManager`/`ApprovalContext`/`ApprovalDialog`, file-poll protocol). Then 6 (themes + responsive collapse), 7 (cutover — remove legacy shells).
- **Wave 4 NOT done / deferrals:** `/ui-smoke 4` live smoke deferred (Cole not using the app until the remake is done — per Wave 0–3 posture; written + queued at `wave-4-smoke-report.md`). **Next dev session:** enable Settings → Appearance → "Canon workbench", run a `claude` session, confirm NOW/Context/Files Touched/Hook Timeline reflect the live session and (with `enableTerminalDiffReview` on) Latest Hunk + badges show the real diff; toggle the diff setting off → graceful degrade. Two new LOW follow-ups: `2026-05-22-workbench-diff-subscription-latest-ref.md` (subscribe-once latest-ref refinement, both hooks) + `2026-05-22-workbench-files-touched-truncated-path-badges.md` (ellipsis-tolerant badge match for >80-char paths). `/promote-vendor-lessons 4` = no-op (no vendor SDK). `/audit-followups wave-4` pending (run next).
- **Carried-forward from Wave 3:** the **Check-6 mutation pre-merge task** (tighten tests for any Wave-3 *adapter/derivation* mutation survivor before the 2026-06-01 merge — UI-style/JSX survivors acceptable; see `wave-3-mechanical-review.md`) is still open and now joined by Wave 4's adapter logic.

---

## 🔼 UPDATE 2026-05-21 — Workbench Wave 3 SHIPPED (live agent state + hook pipeline)

Workbench overhaul: **Waves 0 + 1 + 2 + 3 all on `master`.**

- **Wave 3 — hook pipeline + live agent state: SHIPPED** (local tag `v2.24.0`). Behind the same default-off `layout.canonWorkbench` flag, the canon workbench's **non-terminal regions now react to real agent activity** instead of `workbenchMockData`. New `useWorkbenchAgentData` adapter derives a six-state presentation status (`fresh/thinking/running/awaiting/errored/done`) from the live `AgentEventsContext` **without mutating the canonical 4-value `AgentStatus`** (~48 AgentMonitor consumers — ADR D1). Live now: the **Agent Globe** (real model/tool/idle), the inner-rail **session list** (status dots: live/warn/idle), the **agent-sidebar header**, **project chips** (+ deterministic per-path color), **git branch name**, **clock**, and **status-bar context stats**. New `useWorkbenchProjects` (workbench-local). Renderer-only, no IPC/schema change. Plan/ADR/recon/result/review/audit in `roadmap/wave-3-workbench-hook-pipeline-state-machine/`. Gates: orchestrator-owned acceptance tests 9/9 (Globe) + 5/5 (sessions), unit 20, Workbench suite 134, tsc + full `eslint src/` (0 err) + prettier clean. One phase-reviewer fix folded in (two-tier `selectPrimarySession` + ADR D4 correction); one orchestrator self-fix (Workbench.test.tsx provider mock).
  - **`/review` verdict: FLAG (non-fatal).** Checks 1–3 clean, 4/5 N/A. **Check 6 mutation score = 31.72%** — below /review's 40% line but **above the project's `break: 21` gate (passed)**; survivors skew toward UI-render constructs (Regex/StringLiteral/Conditional in inline-style/JSX), not the wave's core logic. **PRE-MERGE TASK (before 2026-06-01 merge):** open `reports/mutation/mutation.html`, filter to the Wave-3 source files, and tighten tests for any survivor in the **adapter/derivation logic** (UI-style/JSX survivors are acceptable for a UI wave). See `wave-3-mechanical-review.md`.
- **Next action:** **Wave 4 — Agent sidebar live** (re-layout `AgentMonitor` into the 5 canon panels + make the panel BODIES live: NOW / Context / Files Touched / Latest Hunk / Hook Timeline). Wave 3 deliberately left the 5 panel bodies on mock (ADR D5). Extend the **same** `useWorkbenchAgentData` adapter (D3 — don't add a competing adapter) with the panel data. Two known hard sub-problems carried forward: **Files Touched** has no live backing (derive by scanning `AgentSession.toolCalls` for Edit/Write/Read), and **Latest Hunk** has no structured diff source (reconciliation Open Q2 — decide git-delta vs extended PostToolUse at Wave-4 plan time). Then 5 permissions, 6 themes+responsive, 7 cutover.
- **Wave 3 NOT done / deferrals:** `/ui-smoke 3` live smoke deferred (Cole not using the app until the remake is done; per Wave 0/1/2 posture) — **next dev session:** enable Settings → Appearance → "Canon workbench", run a `claude` session in a terminal, confirm the Globe lights up with real model/tool + returns to idle, the inner rail lists running sessions with green/amber dots, and the title/status bars show the real project/branch/clock/tokens. New follow-up `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (OPEN — git +adds/−dels + per-project dirty need a new main-process git op; deferred, not faked). `2026-05-21-wave-2-dead-terminal-line-mocks.md` **RESOLVED** by Phase 4's sweep (archived). `/promote-vendor-lessons 3` = no-op (no third-party SDK touched).

---

## 🔼 UPDATE 2026-05-21 — Workbench Wave 2 SHIPPED (live terminals + divider)

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
