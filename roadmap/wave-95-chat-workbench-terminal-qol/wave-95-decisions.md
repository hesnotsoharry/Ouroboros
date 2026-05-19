---
status: DRAFT
created: 2026-05-18
updated: 2026-05-18
wave: 95
---

# Wave 95 — Architecture Decisions

All five decisions are PENDING resolution at Phase 0. Decisions 1, 2,
and 5 should be RESOLVED before A/B/E dispatch. Decisions 3 and 4 are
investigation-gated — they resolve after Phase C and Phase D
diagnosticians return their briefs.

---

## Decision 1: PTY `titleChange` vs user-rename precedence (Phase A)

**Context:** Phase A adds inline rename for terminal tabs (dock-slot and
inner rail). Without a flag, the next OSC 0/1/2 sequence the shell
fires (e.g., when the prompt updates) will clobber the user-rename via
the existing `useTerminalSessions.sync.ts` titleChange handler. We need
to decide whether a user-rename "sticks" permanently (until the session
is closed) or only until the next restart.

**Options considered:**
- *Industry standard:* Permanent stick — once user renames a tab, OSC
  title events for that tab are suppressed for the lifetime of the
  session AND persisted across restarts. VS Code Terminal, iTerm2,
  Warp all behave this way. Implementation: `userRenamed: boolean` on
  `SessionTabRef`, persisted via projectTerminalsSchema.
- *Emerging best practice:* Same as standard — no meaningful divergence
  in modern terminals.
- *Experimental:* Time-bounded stick — user rename suppresses OSC for
  N minutes, then OSC takes over again. Rejected — no production
  terminal does this; surprising UX.

**Pick:** RESOLVED 2026-05-18 — **permanent stick** (industry standard).

**Rationale:** Matches user expectation set by every mainstream
terminal. The `userRenamed` flag is one boolean per SessionTabRef,
additive schema change with default `false`, no migration risk.

**Consequences:** Commits to persisting `userRenamed` in
`projectTerminalsSchema`. Commits to a per-handler check in
`useTerminalSessions.sync.ts` that reads the flag before applying
OSC titles. Punts to no-op — there is no follow-up wave that would
re-touch this.

---

## Decision 2: Default scrollback value and upper cap (Phase B)

**Context:** Phase B bumps xterm.js scrollback default from the current
1000 (xterm.js library default) and exposes a Settings key. Long Claude
TUI runs (MultiEdit streams, status panels) blow past 1000 quickly.
Memory note from the follow-up: ~50 MB per terminal at worst-case
80-col rows at 50000 lines.

**Options considered:**
- *Industry standard:* VS Code default `terminal.integrated.scrollback`
  is 1000 (configurable, no hard cap documented). JetBrains terminal
  default is 1000. iTerm2 default is 10000.
- *Emerging best practice:* 10000 — matches iTerm2 and Warp defaults,
  which are the more modern terminal apps. Common config among power
  users to bump to 50000+.
- *Experimental:* Unbounded with smart eviction (drop old chunks under
  memory pressure). Rejected — xterm.js doesn't support this; would
  require a custom buffer.

**Pick:** RESOLVED 2026-05-18 — **default 50000**, max 100000, min 1000.
User-chosen (the higher of the two leans surfaced in the follow-up
recommended range of 10000–50000).

**Rationale:** Covers very long Claude TUI sessions — MultiEdit streams,
status panels, long agent runs — without scroll-back loss. Memory
footprint at 50000 lines worst-case ~50 MB per terminal; ~200 MB at 4
concurrent sessions, acceptable on modern dev machines. User can dial
down via the Settings key if low-RAM workflows surface.

**Consequences:** Adds `terminal.scrollback: number`
(min 1000, max 100000, default 50000) to `configSchemaTail*.ts`. Wires
`TerminalSession.tsx` to read it. Documents the memory footprint note
in `Terminal/CLAUDE.md` (per-terminal ~50 MB at max). Punts to no-op.

---

## Decision 3: WebGL vs Canvas fallback (Phase C)

**Context:** Phase C investigates the ghost cursor regression. The
existing rule in `Terminal/CLAUDE.md` says WebGL addon must load BEFORE
`term.open()`. If the audit reveals the load order is correct but ghost
cursor persists, OR the current `@xterm/addon-webgl` version has a
known cursor bug, we need to decide: keep WebGL with a workaround,
or fall back to Canvas renderer.

**Options considered:**
- *Industry standard:* Keep WebGL — significantly better render
  performance, especially under high-throughput tool output streams.
  All modern terminal apps default to WebGL or platform GPU rendering.
- *Emerging best practice:* Conditional — WebGL with documented
  workaround, with a runtime flag to fall back to Canvas if cursor
  artifacts are detected (or platform-specific: Canvas on
  problematic shells like Windows PowerShell, WebGL elsewhere).
- *Experimental:* Custom cursor rendering layer outside xterm. Rejected
  — out of scope.

**Pick:** RESOLVED 2026-05-18 — **keep WebGL, vendor PR #5883 patch via
local postinstall script** (no new deps).

**Rationale:** Phase C diagnosis (high confidence) identified the root
cause as upstream `@xterm/addon-webgl 0.19.0` atlas-merge corruption,
documented in xtermjs/xterm.js#5847 (OPEN, 2026-04-27), with fix in
PR #5883 (OPEN, 2026-05-17, NOT YET MERGED). Same library version,
same `allowTransparency: true` flag, same streaming workload as our
Claude TUI use case. Canvas fallback would eliminate the bug but
introduces visible stutter on heavy streams (the exact workload Claude
TUI generates). Vendoring the patch preserves WebGL performance while
upstream catches up. Self-contained Node postinstall script avoids
adding `patch-package` dep + the per-repo lockfile-sync dance.

**Consequences:** Adds `patches/addon-webgl-0.19.0.patch` (unified diff
against `node_modules/@xterm/addon-webgl/lib/addon-webgl.mjs` mapping
PR #5883's 3 TS changes to their minified-bundle equivalents). Adds
`tools/apply-patches.mjs` invoked via postinstall script. Patches/README
documents the removal flow: when `@xterm/addon-webgl >= 0.19.1` ships
with PR #5883 merged, bump the dep and delete `patches/` +
`tools/apply-patches.mjs` invocation. Terminal/CLAUDE.md gets a gotcha
entry pointing to the patch. Cole's live verification required at
implementer report-back: "ghost cursor gone during Claude TUI streaming."

---

## Decision 4: OSC 11 (background color read) policy (Phase D)

**Context:** The Terminal CLAUDE.md documents that OSC 10/11/12 are
blocked via `term.parser.registerOscHandler` "to prevent theme color
override." Phase D investigates why Claude CLI TUI renders with wrong
colors in dock-slot terminal. One candidate root cause from the
follow-up: Claude probes background color via OSC 11 *read query*, and
the IDE's blanket OSC blocker prevents the response, so Claude falls
back to a wrong palette assumption.

**Options considered:**
- *Industry standard:* Allow OSC 10/11/12 *read queries* (response
  only) and block *write* sequences. This is what VS Code does and
  what most modern terminals do — TUI apps need to probe the theme
  but shouldn't be able to override it.
- *Emerging best practice:* Same as standard. The "block-all" posture
  in the current code is more conservative than industry norm.
- *Experimental:* Allow writes too, let TUIs override theme. Rejected
  — explicitly contradicts the design intent documented in CLAUDE.md.

**Pick:** PENDING — investigation-gated.

**Rationale:** Cannot decide without Phase D narrowing the root cause.
If OSC 11 is confirmed as the failure mode, the standard answer
(read-allow / write-block) is the pick. If the root cause is theme
palette ANSI slot mismatch instead, OSC handler is unchanged and the
fix is in the theme.

**Consequences:** TBD after Phase D investigation. If OSC handler
changes: re-read of `Terminal/CLAUDE.md` rule and update of the
"prevents theme color override" doc text to clarify read-vs-write.

---

## Decision 5: Secondary slot collapsed-empty chrome (Phase E)

**Context:** Wave 94 polish commit `1ae44fda` changed the secondary
dock slot's empty-state chrome (removed the `Primary`/`Shell` label,
moved `+ New` left). Cole flagged "the bar under the bottom terminal
is now back for some reason" at smoke walk. Unclear whether this is
visual unfamiliarity vs regression. Three design options in the
follow-up:

**Options considered:**
- *Option A (current Wave 94 behavior — industry standard):* 28px
  chrome with `+ New` left + expand button right. Always-visible
  affordance. Pro: discoverable. Con: 28px chrome consumed always.
- *Option B (emerging):* Hide secondary slot entirely when collapsed
  AND empty. Reclaims 28px. Requires a "show secondary slot" entry
  point on primary slot's header or title bar.
- *Option C (experimental):* Thin 12–16px tab affordance — clickable
  to expand, no `+ New`. Compact discovery.

**Pick:** RESOLVED 2026-05-18 — **Option B (hide when collapsed && empty)**
preceded by a Lane B mini-investigation. Cole confirmed the comparison
point was an earlier smoke state where the slot rendered at height 0px
— meaning there's a real regression to root-cause first, then the fix
shape aligns with Option B.

**Rationale:** A real regression exists somewhere in the secondary slot
render gating (likely `ChatWorkbenchTerminalDock.tsx` or
`useDockSlotHeights`); a Lane B diagnostician trace identifies the
gating condition that changed. Once root-caused, the resolved end-state
is Option B: secondary slot hidden entirely when `collapsed && empty`,
with an expand affordance on the primary slot's header (or title bar)
to surface the slot when wanted. This reclaims 28px when not in use
while preserving discoverability via the explicit "show secondary
slot" entry point.

**Consequences:** Phase E re-shapes from "clarify-then-maybe-change"
to "Lane B diagnose → implement Option B." Touches
`ChatWorkbenchTerminalDock.tsx` (render gating), `DockSlot.tsx`
(SlotHeader empty-state branch — likely removed), and the primary
slot's header (`SlotHeader` or `WorkbenchControls`) which gains a
"show secondary slot" affordance. Persistence of expand-state stays
in existing per-window layout state. Punts to no follow-up wave.
