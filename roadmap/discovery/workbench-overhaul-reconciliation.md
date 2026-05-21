---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
type: discovery
slug: workbench-overhaul-reconciliation
---

# Workbench Overhaul — Canon ↔ Codebase Reconciliation

> **Purpose.** The design canon (`design-system/canon.html` + `workbench-tokens.css` + the `workbench-*.jsx` mockup) describes a terminal-first glass workbench. This doc reconciles that spec against what the renderer actually is today, so we can slice the overhaul into waves with eyes open. It is **discovery, not a plan** — it surfaces decisions; it does not make them.
>
> Source of canon: `design-system/canon.html` (18 sections, the written contract) + `workbench-tokens.css` (the real token values the app should adopt) + 8 mockup files. Source of reality: three read-only codebase investigations (tokens/themes, shell/components, hook pipeline), 2026-05-21.

---

## TL;DR — the three things that change the project's shape

1. **The glass baseline already exists.** Wave 45's "Material" system already runs the app glass-first: the theme bridge force-overrides `--surface-base/-panel` to transparent and `--term-bg` to `rgba(0,0,0,0)`. The canon's glass story is *largely already shipped infrastructure* — the overhaul is mostly **re-composing the shell on top of it**, not inventing the material layer. **But** the canon's "tinted well" terminal (`--term-bg: rgba(6,8,16,0.62)`, `--terminal-canvas-opacity: 0.86`) **directly conflicts** with the current force-transparent override and the un-wired canvas-opacity token — that's a real, specific change, not a repaint.

2. **The canon's hook schema is idealized and does not match the wire.** The canon (§11/§12) assumes `useHookSubscription`, a `{hook_event_name, session_id, transcript_path}` envelope, a `decision: "request"` permission path, a structured `tool_response.diff`, and a `fresh→thinking→running→awaiting→errored→done` state machine. **None of those names are real.** What's real: `useAgentEvents` + `AgentEventsContext`, a `{type, sessionId, timestamp}` envelope (no `transcript_path`), a **file-poll approval protocol** (`~/.ouroboros/approvals/{id}.response`, `approve|reject`), an `output: Record<string,unknown>` catch-all, and a 4-value status enum (`idle|running|complete|error`). The good news: a **full pipeline + approval UI already exists** (`approvalManager`, `ApprovalContext`, `ApprovalDialog`). The hook work is **mapping the canon's idealized model onto the real wire + extending the state enum**, not building from zero.

3. **There are already TWO shells, and the canon implies a THIRD (or a replacement).** Today `App.helpers.tsx` picks exclusively between the **IDE shell** (`InnerAppLayout → AppLayout`) and the **chat/workbench shell** (`ChatOnlyShell`, incl. the Wave 89 terminal-first `ChatWorkbenchShell`) via an `isImmersive` flag. The canon's workbench (titlebar + dual rails + stacked terminals + agent sidebar + statusbar) is closest to the **Wave 89 terminal-first workbench variant** — so the canon most likely **supersedes that variant**. Whether it also replaces the full IDE shell is the single biggest open decision (see Decision 1).

---

## Decisions — RESOLVED 2026-05-21

| # | Decision | Resolution |
|---|---|---|
| **1** | **Shell strategy** | **Replace everything.** The canon workbench becomes the single shell; the IDE shell (`AppLayout`/`InnerAppLayout`) AND the Wave-89 workbench variant are deleted at end state. **Migration discipline:** the old shell stays selectable until the new workbench reaches parity, then we cut over and delete in one wave — "replace everything" is the destination, not a big-bang first commit. |
| **2** | **Themes fate** | **Keep all 7 registered; full glass-workbench treatment for Modern/Warp/Retro in v1.** cursor/kiro/light/high-contrast stay and get ported opportunistically. Light/high-contrast preserved as accessibility surfaces. |
| **3** | **Token naming** | **Add canon names as a thin Tier-2 alias block** (reuse the existing compat-alias pattern). Components author against canon names; aliases resolve to real semantic tokens. |
| **4** | **"Explain error" / CommandBlockOverlayBody** | **Remove "Explain error."** Delete the `readTerminalLines`-backed scrollback action (the only scrollback read in the file) per the canon's "no terminal scraping" principle. Rich-UI signal comes from hooks. |
| **5** | **DispatchScreen** | **Delete.** Remove `Dispatch/` (12 files) + the sidebar tab + the `dispatchEnabled` gate. (Confirm mobile-access dispatch queue isn't separately depended on during the delete wave.) |
| **6** | **`assets/hooks/*.mjs` provenance** | **RESOLVED — no issue.** Spike (2026-05-21) confirmed all 21 hook scripts are present and git-tracked under `assets/hooks/` (incl. `pre_tool_use.mjs`, `post_tool_use.mjs`, `agent_start/end`, `session_start/stop`, `generic_hook`, `lib/`). The earlier "could not find" was a false negative from the explorer's Glob. No missing-artifact bug; dropped from Wave 0. |

---

## Section-by-section reconciliation

### §03 Tokens — *mostly aligned, two real gaps*

- **Aligned:** Modern is already `defaultThemeId`. Accent `#818cf8`, ink ramp, status colors, radii scale (`--r-xs..--r-pill`), shadows, blurs — the canon's values **match or near-match** existing palette/material tokens. The canon was clearly authored against this app.
- **Tiering exists for real.** `tokens.css` has explicit `/* Tier 1/2/3 */` headers. Tier 1 = `--palette-*`, Tier 2 = semantic (`--surface/text/border/interactive/status/diff`) + **Material tokens** (`--material-panel`, `--stroke-inner`, `--shadow-*`, `--bg-wash`, `--bg-glows`), Tier 3 = component (`--term-*`, `--tab-*`, etc.).
- **Gap A — terminal "tinted well" conflicts with the live glass override.** `applyComponentTokens()` unconditionally sets `--term-bg: rgba(0,0,0,0)`. Canon wants `rgba(6,8,16,0.62)`. And `--terminal-canvas-opacity` (default `1`) has **no theme-bridge wiring** — there's no `Theme` field and no `setProperty` for it. Canon wants `0.86`. **Both require bridge changes** (`useTheme.tokens.ts`), not just CSS.
- **Gap B — naming mismatch** (Decision 3). Canon vars ≠ app semantic names. Needs an alias layer or component-by-component translation.
- **Note:** `--text-muted`/`--text-faint` are currently *hardcoded* in `applySemanticTokens()` (ignore theme values). If the canon relies on per-theme muted ramps, that override has to go.

### §04 Typography — *aligned.* Inter + Geist Mono + JetBrains Mono are already imported and tokenized (`--font-ui/-mono/-term`). Fonts in `fonts.css`. No conflict.

### §05 Radii/shadows/blurs — *aligned.* All canon tokens have real counterparts in the Material layer.

### §06 Title bar — *rewrite; one net-new piece.*
- Today: `TitleBar.tsx` (237 lines) + sub-modules (`.navbar/.mobile/.controls/.usage`). Has logo, NavbarMenus, PanelToggleBar, action buttons, NotificationBell, WindowControls.
- Canon adds the **Agent Globe** (live session state pill, center) — **net-new, no analog today.** It's the headline change and depends on the session state machine (§12).
- **Watch:** `TitleBar.tsx` mutates `e.currentTarget.style` directly for hover (lines ~120) — a token-system break that won't theme. Rewrite should fix this.
- Window controls already exist and already use Windows `#e81123` close-hover — canon-compliant.

### §07 Rails — *mostly net-new.*
- Canon: dual mode (project rail 56px + inner rail 256px) and unified mode (272px accordion). Cross-project "Running" session list + Files tree + branch footer.
- Today: left `Sidebar.tsx` (thin container) + FileTree; Wave 89 introduced `WorkbenchRail`. **No dual/unified rail concept, no cross-project running-session list.** This is the largest net-new UI surface.

### §08 Terminals — *partial analog; canon picks the vertical stack.*
- Canon: vertical split, upper CC (~62%) + lower shell (~38%), each with a 30px tab bar, "tinted well" body.
- Today: **two** unrelated split systems — `TerminalManagerSplitPane` (horizontal, IDE shell) and `ChatWorkbenchTerminalDock` (vertical stacked, Wave 89 workbench). The canon's stacked layout maps to **`ChatWorkbenchTerminalDock`** — evolve that, don't build new.
- "Sealed-box TUI" principle (no scrollback parsing, overlays as siblings not children) is consistent with how xterm is mounted today.

### §09 Agent sidebar — *rich analog exists; re-layout, don't rebuild.*
- Canon: 5 stacked panels (NOW / Context / Files Touched / Latest Hunk / Hook Timeline) + adaptive cards.
- Today: `AgentMonitor/**` (48 files) is the rich analog — `ToolCallFeed`, `ToolCallTimeline`, `AgentCard`, `CostDashboard`, `SubagentPanel`, `ApprovalDialog`, `CompactionIndicator`. Fed by `useAgentEventsContext`. **Fully `React.memo`-wrapped (load-bearing perf).**
- Mapping: NOW ≈ live `AgentCard` head; Context ≈ cost/token aggregation; Files Touched ≈ new but data exists in PostToolUse; Latest Hunk ≈ new diff card (needs structured diff — see hooks gap); Hook Timeline ≈ `ToolCallTimeline`/`AgentEventLog`. **High reuse; the work is layout + the NOW/Hunk cards, not the data layer.**

### §10 Status bar — *rewrite, and un-stub git.*
- Today: `StatusBar.tsx` (193 lines). `gitBranch` is plumbed but **dead** ("Wave 82.1 — not yet rendered"). Canon's slot 1 wants exactly that branch + adds/dels. Rewrite renders the dead prop.

### §11 Hook schemas — *biggest divergence; see TL;DR #2.* Full table below.
### §12 State machine — *extend the 4-value enum.* Real `AgentStatus = idle|running|complete|error`. Canon needs `thinking`, `awaiting`, `errored`, `done`, `fresh`. `running` currently absorbs `thinking`. Extending the enum + reducer in `useAgentEvents.helpers.ts` is the work.
### §13 Permission prompt — *UI exists, protocol differs.* `ApprovalContext` + `ApprovalDialog` already do Y/N/A. Canon's terminal-overlay + sidebar-takeover presentation is a re-skin; the **gating mechanism is file-poll, not `decision:"request"`** — keep the real protocol, restyle the surface.

### Hook schema: canon vs reality

| Canon assumption | Reality | Action |
|---|---|---|
| `useHookSubscription` hook | `useAgentEvents` + `AgentEventsContext` + preload `onAgentEvent` | Use real names; canon naming is fiction |
| Envelope `{hook_event_name, session_id, cwd, transcript_path, timestamp}` | `{type, sessionId, cwd?, timestamp:ms}` — **no `transcript_path`** | Map field names; decide if `transcript_path` is worth forwarding (Open Q) |
| 6 events | 28 wire types (the 6 exist; wire names differ: `agent_start/agent_end/session_stop` vs `SubagentStart/SubagentStop/Stop`) | Map canon names → wire types |
| `decision: "request"` gates the call | File-poll: `~/.ouroboros/approvals/{id}.response`, `approve\|reject` | Keep real protocol; restyle UI only |
| `tool_response: {success, error, duration_ms, diff, ...}` | `output: Record<string,unknown>` + `error` + `durationMs`; no structured diff consumed | **Latest Hunk needs a structured diff source** — derive from git delta or extend PostToolUse handling |
| States `fresh→…→done` | `idle\|running\|complete\|error` | Extend enum + reducer |

---

## Keep / Rewrite / New / Delete classification

| Surface | Verdict | Notes |
|---|---|---|
| Material/glass token layer (Wave 45) | **Keep** | Already the glass baseline; canon builds on it |
| `--term-bg` force-transparent override | **Rewrite** | Conflicts with tinted-well; make it theme-driven |
| `--terminal-canvas-opacity` bridge wiring | **New** | Token exists, no bridge path; canon needs `0.86` |
| Canon-name alias block | **New** | Decision 3 |
| 7 themes | **Keep** (Decision 2) | Only Modern/Warp/Retro get full v1 treatment |
| `useAgentEvents` / `AgentEventsContext` pipeline | **Keep + extend** | State enum, field mapping |
| `approvalManager` / `ApprovalContext` / `ApprovalDialog` | **Keep + restyle** | Protocol stays; surface re-skins |
| `AgentMonitor/**` | **Re-layout** (high reuse) | New NOW + Latest Hunk cards; rest maps |
| `ChatWorkbenchTerminalDock` | **Evolve** | Canon's stacked terminals |
| `TitleBar.tsx` + `StatusBar.tsx` | **Rewrite** | Add Agent Globe; render dead git prop |
| Dual/unified rails | **New** | Largest net-new surface |
| `DispatchScreen` + `Dispatch/` (12 files) | **Delete** (Wave 7) | 1 real import (`InnerAppLayout.agent.tsx`); gated by config flag |
| `CommandBlockOverlayBody` "Explain error" scrollback read | **Delete** (Wave 7) | The only scrollback read; removed per no-scraping principle |
| IDE shell (`AppLayout`/`InnerAppLayout`) + Wave-89 workbench variant | **Delete at parity** (Wave 7) | Single-shell end state; old shells stay until cutover |
| `assets/hooks/*.mjs` | **Investigate** (Wave 0) | Possible missing-from-source artifact |

---

## Proposed wave sequence (decisions applied)

Dependency-ordered; foundation first, live data last, cutover + deletion last (per Decision 1's parity-then-delete discipline). The new workbench is built behind a flag and only becomes the sole shell once it reaches parity.

- **Wave 0 — Token foundations.** Add the canon-name alias block (Decision 3); wire `--terminal-canvas-opacity` into the theme bridge + make `--term-bg` theme-driven so the canon's "tinted well" is achievable (Gap A). Pure token/theme-bridge infra, no shell change. _(`assets/hooks` provenance dropped — Decision 6 resolved, no issue.)_
- **Wave 1 — Static workbench shell.** New single-shell composition (titlebar + Agent Globe placeholder + dual/unified rails + stacked terminal frame + agent-sidebar frame + statusbar) with mock data, behind a flag, alongside the existing shells. No live hooks yet.
- **Wave 2 — Terminal integration.** Mount real xterm into the stacked dock (evolve `ChatWorkbenchTerminalDock`); tinted-well treatment; sealed-box rules.
- **Wave 3 — Hook pipeline mapping + state machine.** Map canon model → real wire; extend `AgentStatus` (`thinking/awaiting/errored/done/fresh`); drive the Agent Globe.
- **Wave 4 — Agent sidebar live.** Re-layout `AgentMonitor` into the 5 canon panels; NOW + Latest Hunk cards (Latest Hunk diff-source TBD: git delta vs. extended PostToolUse).
- **Wave 5 — Permissions re-skin.** Terminal overlay + sidebar takeover over the existing file-poll approval protocol.
- **Wave 6 — Themes + responsive.** Modern/Warp/Retro full treatment; opportunistic port of the other 4; responsive collapse (§16).
- **Wave 7 — Cutover & teardown.** Make the workbench the sole shell; **delete** `AppLayout`/`InnerAppLayout`, the Wave-89 workbench variant + `ChatOnlyShell/` remnants, `Dispatch/` (Decision 5), and the "Explain error" scrollback action (Decision 4). Single big deletion wave, after parity is proven.

---

## Open questions remaining (technical — can be decided at wave time)

1. **`transcript_path`** — the canon assumes it; the app never forwards it. Worth plumbing for the Hook Timeline's "view transcript," or skip? (Resolve in Wave 3.)
2. **Latest Hunk diff source** — no structured `tool_response.diff` exists today. Derive from git status delta, or extend PostToolUse to carry the Edit diff payload? (Resolve in Wave 4.)
3. **Mobile-access dispatch** — confirm the dispatch queue isn't separately depended on via `mobileAccess.enabled` before deleting `Dispatch/` in Wave 7.

_Shell strategy, themes, "Explain error", and DispatchScreen deletion are RESOLVED above._

---

## Appendix — canonical sources

- Canon spec: `design-system/canon.html` (§01–18)
- Real token values: `design-system/workbench-tokens.css`
- Mockup: `design-system/workbench-{hero,variants,states,data,app}.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx`, `workbench.html`
- Live tokens: `src/renderer/styles/tokens.css`, `src/renderer/themes/{types,index,modern,warp,retro,...}.ts`, `src/renderer/hooks/useTheme.tokens.ts`
- Shell: `src/renderer/components/Layout/{AppLayout,InnerAppLayout,TitleBar,StatusBar}.tsx`, `Layout/ChatOnlyShell/**`
- Hooks: `src/main/{hooksNet,hooks,hooksLifecycleHandlers,approvalManager}.ts`, `src/renderer/hooks/useAgentEvents*.ts`, `src/renderer/contexts/{AgentEventsContext,ApprovalContext}.tsx`
