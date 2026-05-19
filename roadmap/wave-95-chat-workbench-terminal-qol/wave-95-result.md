---
status: SHIPPED
created: 2026-05-19
updated: 2026-05-19
wave: 95
slug: chat-workbench-terminal-qol
tag: v2.19.1
---

# Wave 95 — Chat-Workbench Terminal Quality-of-Life — Result Brief

## Summary

Fix-sweep wave shipped 2026-05-19. 7 of the originally-planned 8 work
phases shipped; Phase F dropped mid-wave because Phase H's pivot
removed the panel surface it was meant to polish. One pre-existing
Wave 89 dock-fill bug surfaced during Phase E live verification and
got bundled into the wave as a hardening. One Phase D extension
(`--terminal-canvas-opacity` CSS var) added for theme flexibility.

Net effect: terminal-first chat workbench now has tab rename, larger
scrollback, ghost-cursor-free TUI rendering, opaque-canvas TUI
correctness with future-proof theme tinting, secondary-slot hide-when-
empty + reveal affordance, AND a fully consolidated diff-review surface
(one full-screen overlay summoned by the status-bar button) with
multi-project state + cross-project grouping. The "pop-up every Claude
edit" pain Cole reported is gone.

## Phases shipped

| Phase | Commit | Topic |
|---|---|---|
| 0 (ADR) | `1464f8c7` | Locked Decisions 1, 2, 5; 3 + 4 PENDING for investigate-first phases |
| B | `11a76a17` | Terminal scrollback default 50000 + `terminal.scrollback` config key + plumb |
| A | `23f9d0a0` | Tab rename + PTY-titleChange suppression (`userRenamed` flag, Option-3 gating in SlotHandle wrapper) |
| C | `d46b78d5` + `94886eaf` | Vendored xtermjs PR #5883 webgl atlas-merge fix via postinstall patcher. Live-confirmed by Cole. |
| D | `335e6479` | Opaque xterm canvas via `--palette-term-bg` (Claude TUI fill cells render correctly). Live-confirmed. |
| D ext | `83ef0365` | `--terminal-canvas-opacity` CSS var for theme-driven canvas tinting |
| D follow-ups | `9f548410` | OSC 11 partial read-allow + ANSI palette tuning filed as deferred items |
| E | `1f61b316` | Secondary slot hidden when collapsed + empty; "▼ Show slot" affordance on primary slot header. Live-confirmed. |
| E hardening | `9ba0b938` | Distinct chevron icon + `useSectionHeight` ResizeObserver (fixed pre-existing Wave 89 dock-fill gap) |
| H | `68ef2c01` + `32bc43f7` | Diff-review surface consolidation. Removed `ChatWorkbenchArtifactPane` entirely + utility-drawer `review` tab. Single surface: `ChatOnlyDiffOverlay` triggered from status-bar `DiffButton`. |
| G | `d5f108a7` | Multi-project diff state + cross-project grouping in `FileListSidebar`. Reducer OPEN now merges (same project replaces, new project prepends). Wave 94 Phase E boundary contract preserved. |
| I | (this commit) | Wave wrap — result brief, CHANGELOG, tag, HANDOFF. |

## Phases dropped / reshaped

- **F (panel layout 80/20 inversion + splitter)** — DROPPED. Phase H consolidation removed the `DiffReviewPanel` mount points the polish was for. The surviving `ChatOnlyDiffOverlay` doesn't have the same layout inversion. F became moot.
- **H** — RESHAPED. Original spec: Lane B fix for "wrong edit shown" via discard guard. Cole pivoted 2026-05-18: "the diff review is a pain in the ass" / "remove artifact pane and the review tab from utility drawer." Phase H became architectural consolidation. The wrong-edit-shown root cause (`diffReviewReducer.OPEN` unconditional replace) was solved more thoroughly by Phase G's multi-project merge.
- **G** — RESHAPED. Original spec was visual project grouping on a single-project state. Per Phase H's surface map, single-project state made grouping meaningless (only one project's diffs alive at a time). Cole picked the structural multi-project state path; G became a meaningful reducer rewrite.

## ADR decisions

| # | Topic | Resolution |
|---|---|---|
| D1 | PTY titleChange vs user-rename precedence | **Permanent stick** (industry standard, matches VS Code / iTerm2 / Warp) |
| D2 | Default scrollback value | **50000 lines** (min 1000, max 100000) at `terminal.scrollback` config key |
| D3 | WebGL keep vs Canvas fallback | **Keep WebGL + vendor PR #5883 patch** via self-contained postinstall patcher (no new deps) |
| D4 | Opaque xterm canvas vs OSC 11 read-allow | **Read `--palette-term-bg` (opaque) in `buildXtermTheme`**. OSC 11 read-allow filed as follow-up (lower urgency once canvas is opaque). |
| D5 | Secondary slot collapsed-empty | **Option B (hide entirely) preceded by Lane B mini-investigation**. Cole confirmed earlier smoke showed 0px-hidden — real regression. |

## Bundled-in fixes / surprises

- **Phase E hardening — pre-existing dock-fill bug**. The secondary slot was previously gating on `sizes.terminal || 600` (IDE-shell terminal panel persist, not the chat-workbench section height). Result: dock-slots summed to ~604px, leaving ~196px empty section background. Phase E live verification surfaced it. Fixed with `useSectionHeight` ResizeObserver measuring the actual section height.
- **Phase H artifact pane removal**. The original Phase H removed only the diff-CONTENT branch. Cole reported pop-ups still happening with empty content. Bundled in: full removal of `ChatWorkbenchArtifactPane`, `useWorkbenchArtifacts`, `ArtifactOverlay` mount, related state. 1196 deletions vs 102 insertions.
- **Phase A inline-edit primitive lift**. `TabTitleInput` (DockSlotTabs) and `InlineRowEdit` (InnerSidebarTerminals.row) were near-duplicates. Lifted to shared `InlineTitleEdit.tsx` with consistent semantics (Enter/blur commits if non-empty AND differs; Escape always cancels).

## Vendor patch (Phase C)

Local postinstall patcher for upstream `@xterm/addon-webgl 0.19.0`:
- Issue: `xtermjs/xterm.js#5847` (OPEN 2026-04-27) — ghost cursors on
  `allowTransparency: true` + heavy streaming. Exact symptom match.
- Fix: `xtermjs/xterm.js#5883` (OPEN 2026-05-17, NOT MERGED) — atlas
  page-merge corrections.
- Approach: self-contained `tools/apply-patches.mjs` (no new deps,
  avoids lockfile-sync). SHA-256 idempotency guard. Original + patched
  bundle snapshots at `patches/addon-webgl-0.19.0.{original,patched}.{mjs,js}`.
- Repair: first patch insertion was syntactically broken (retry-loop
  injected mid-ternary). IIFE injection fixed it.
- Removal flow: bump dep to `^0.19.1` once upstream ships, delete
  `patches/` + the postinstall line.

## Boundary preservation

The Wave 94 Phase E orchestrator-owned acceptance test
(`src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`) passed
5/5 at every commit boundary throughout the wave, including after the
Phase G multi-project reducer rewrite. `openReview` signature
preserved.

`sonnet-phase-reviewer` PASS verdicts on both boundary-adjacent phases:
- Phase H consolidation: PASS, high confidence
- Phase G multi-project state: PASS, high confidence (6 specific risks all resolved)

## Test discipline

- Wave 94 Phase E acceptance: 5/5 PASS at every phase boundary
- DiffReview scoped suite (Phase G): 106/106 PASS
- Layout scoped suite: 1068/1068 PASS + 3 pre-existing skipped (test:layout)
- `npm run build`: PASS at every Phase boundary (the hard gate Phase C
  taught us — vitest mocks the addon, so build is the only catch for
  bundle-level errors)
- Net new tests added: ~30 across DiffReview, terminal tab rename,
  inline-title-edit, scrollback config, surface policy, dock fill.

## Follow-ups filed

| Date | Path | Topic | Source phase |
|---|---|---|---|
| 2026-05-18 | `follow-ups/2026-05-18-osc-11-read-allow.md` | OSC 11 partial read-allow for Claude TUI dark/light detection | D |
| 2026-05-18 | `follow-ups/2026-05-18-ansi-palette-tuning.md` | ANSI slot tuning vs Windows Terminal Campbell defaults | D |
| 2026-05-19 | `follow-ups/2026-05-19-wave-95-manual-smoke.md` | Manual smoke walk for phases C/D/E/G/H live verification | I (wrap) |

## Process lessons (for the wave-temperature-log)

Wave 95 was sweep-wave shaped but ran HOT in spots:

1. **Phase A — sonnet implementer cut-off cycle.** Sonnet-implementer dispatches twice cut off mid-trim wrestling with prettier-vs-ESLint conflicts. The composite edit pattern (one targeted change after runtime evidence) worked first try. Pattern: when prettier reformats existing code, line caps can blow; extract to shared sibling rather than ping-pong.

2. **Phase C — minified-bundle patching is fragile.** The diagnostician's "vendor the patch" recommendation under-estimated the difficulty: npm ships only minified bundles (no source). PR diff has to be mapped to minified symbols. First insertion broke the bundle syntax (statement injected mid-ternary). Verification gap: vitest mocks the addon, so build is the only catch — make `npm run build` the hard gate for build-artifact changes.

3. **Phase H — Cole pivot mid-wave.** Original Lane B "wrong-edit-shown discard guard" spec was superseded by structural realization: three surfaces all rendered the same state; two of them auto-popped. The architectural cleanup (-1094 net lines across the H + continuation commits) solved both the wrong-edit clobber AND the pop-up pain in one move. Lesson: when the user describes a symptom in functional terms, ask whether the architecture is what's pinching, not just the specific code path.

4. **Phase G — boundary contract preserved through reducer rewrite.** Multi-project state required changing what `openReview` DOES internally without changing its signature. Wave 94 Phase E acceptance test stayed green throughout. Lesson: well-designed boundary contracts (signature + null-state semantics) survive significant internal refactors.

5. **Dispatch reflex.** The edit-loop and executor-drift hooks fired at exactly the right moments during prettier-vs-ESLint cycles. Composite-edit-after-runtime-evidence saved a third loop in Phase E's hardening pass.

## What didn't ship in Wave 95

- **Full manual smoke walk** — deferred to `follow-ups/2026-05-19-wave-95-manual-smoke.md` (30-45 min hands-on, best done with 2 active project checkouts).
- **Phase F panel layout polish** — surface gone, item moot.
- **OSC 11 read-allow** — deferred to its own follow-up; needs live OSC capture from Cole first.
- **ANSI palette tuning** — deferred as a UX call (touches all terminal content, not just TUI).
- **Push to remote / CI / tag publish** — held local per the 2026-05-18
  bulletin (GH Actions minutes exhausted until 2026-06-01).

## Tag

`v2.19.1` created locally. Push held per bulletin.

## Next session pickup

Read `roadmap/HANDOFF.md`.
