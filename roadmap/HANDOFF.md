# Session Handoff — 2026-05-19 (Wave 95 shipped local; push held; smoke deferred)

**Audience:** the next Claude Code session.

---

## TL;DR

**Wave 95 (Chat-Workbench Terminal Quality-of-Life) shipped to local
master.** 17 commits over 2 days (2026-05-18 → 2026-05-19), tagged
`v2.19.1` locally. 7 of 8 work phases shipped; F dropped (panel surface
deleted by H's reshape); H + G both went through significant pivots
mid-wave that simplified rather than expanded the surface.

**Push held local** per the 2026-05-18 bulletin: GH Actions minutes
exhausted until 2026-06-01. When ready to push:

```
git push origin master
git push origin v2.19.1
```

(Or batch with held PRs from Waves 94/96.)

**Manual smoke walk deferred.** Phases C and D and E were live-confirmed
by Cole in-session; G and H (the diff-review overhaul) need ~30-45 min
of hands-on testing with 2 active project checkouts. Filed at
`roadmap/follow-ups/2026-05-19-wave-95-manual-smoke.md`.

---

## Wave 95 — final shipped state

| Phase / commit | What |
|---|---|
| Phase 0 (ADR) `1464f8c7` | Locked D1/D2/D5; D3+D4 PENDING for investigate-first phases |
| B `11a76a17` | Scrollback default 50000 + `terminal.scrollback` config key + plumb |
| A `23f9d0a0` | Tab rename + PTY-title suppression + shared `InlineTitleEdit` primitive |
| C `d46b78d5` + `94886eaf` | xtermjs PR #5883 vendor patch (postinstall patcher, no new deps). Live-confirmed. |
| D `335e6479` | Opaque xterm canvas (`--palette-term-bg`). Live-confirmed. |
| D follow-ups `9f548410` | OSC 11 read-allow + ANSI palette tuning filed |
| D ext `83ef0365` | `--terminal-canvas-opacity` CSS var for theme-driven tinting |
| E `1f61b316` | Hide secondary slot when collapsed && empty + "▼ Show slot" affordance |
| E hardening `9ba0b938` | Pre-existing Wave 89 dock-fill bug fix via `useSectionHeight` ResizeObserver |
| H `68ef2c01` | Diff-review surface consolidation start (drop artifact-pane diff + utility-drawer review tab) |
| H continuation `32bc43f7` | Full `ChatWorkbenchArtifactPane` removal (-1094 net lines) |
| G `d5f108a7` | Multi-project diff state + cross-project grouping (reducer rewrite, boundary contract preserved) |
| I (this wrap) | Result brief, CHANGELOG `[2.19.1]`, package.json bump, smoke follow-up, tag `v2.19.1` |

## Wave 94 status (carried over)

Wave 94 + Wave 96 shipped 2026-05-18 (tag `v2.19.0`). Their push +
CI verification is ALSO held per the bulletin. Push them together with
Wave 95's `v2.19.1` tag on/after 2026-06-01.

CI for the Wave 94/96 commits (`82eca66d` → `a88d6b1f`) was in-flight
when those waves wrapped — last known run `26067523618`. Re-check status
before pushing the next round.

## Boundary contract — preserved across waves

The Wave 94 Phase E orchestrator-owned acceptance test
(`src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`)
continued to PASS 5/5 throughout Wave 95, including after Phase G's
multi-project reducer rewrite. `openReview` signature unchanged across
the wave.

## Process lessons (for the temperature log)

Drafted entry for `roadmap/wave-temperature-log.md` (append at wave-end
after live verification):

> | W-95 (Chat-Workbench Terminal QoL fix-sweep) | 2026-05-19 | HOT | 8 phases planned, 7 shipped, F dropped mid-wave because Phase H's pivot deleted the surface it would have polished. Major mid-wave reshapes: H pivoted from "Lane B discard guard" to "remove the 2 auto-popping subordinate diff-review surfaces" after Cole flagged "constantly experiencing pop ups while testing"; the cleanup landed -1094 net lines and made the Phase G plan feasible. G then pivoted from "visual grouping on single-project state" to "multi-project state with grouping" — reducer rewrite that preserved the Wave 94 Phase E boundary contract throughout. Phase C: minified-bundle patching via postinstall patcher worked but the first insertion broke the bundle (statement injected mid-ternary in the minified renderRows arrow body) — IIFE injection wrap fixed it; lesson: `npm run build` is the hard gate for build-artifact changes (vitest mocks the addon). Phase A: prettier-vs-ESLint cycle bit twice — composite-edit-after-runtime-evidence broke the loop. Phase E hardening: pre-existing Wave 89 dock-fill bug surfaced during live verification — `sizes.terminal || FALLBACK_PARENT_EXTENT=600` was the wrong source for the chat-workbench section height; `useSectionHeight` ResizeObserver replaces. Cole's mid-wave pivot direction was the right call both times — when a user reports a symptom in functional terms, the architecture is often what's pinching. Cost: ~2 days of multi-phase orchestration with phase-reviewer passes on the two boundary-adjacent phases (H + G), both PASS high confidence. |

Append the row above to `wave-temperature-log.md` once the smoke
follow-up completes and Phase G/H are live-confirmed.

## Open follow-ups (filed this wave)

In `roadmap/follow-ups/`:
- `2026-05-18-osc-11-read-allow.md` — Capture Claude's OSC sequences via the new `[trace:osc]` logs, then decide partial read-allow
- `2026-05-18-ansi-palette-tuning.md` — UX call about palette consistency vs Windows Terminal Campbell
- `2026-05-19-wave-95-manual-smoke.md` — Hands-on smoke walk for G/H live verification

## Older open items (unchanged from prior HANDOFF)

In `roadmap/bugs/`:
- `2026-05-17-chatstatenewpath-dynamic-require-threadstore.md` — OPEN, medium
- `2026-05-17-silent-buildrepoindex-hang-post-graph-ready.md` — TRIAGED, medium
- `2026-05-15-e2e-teardown-hang.md` — Wave 93 carry-over

In `roadmap/follow-ups/`:
- `2026-05-16-wave-89-tool-bridge-runtime-smoke.md`
- `2026-05-16-wave-89-stacked-dock-integration-test.md`
- `2026-05-16-wave-89-dead-useWorkbenchCompare-hook.md`
- `2026-05-05-electron-renderer-browser-mcp-wiring.md`

## Pre-push hook follow-up (informal, from Wave 96)

`assets/hooks/pre_push_full_check.mjs` runs `tsc -p tsconfig.web.json`
full-project on every push. Wave 96 fixed the renderer→main type
cascade for now, but the design is fragile. Consider switching to
incremental-diff-only tsc check (industry standard 2026 pattern).
Filed informally — not blocking.

## Working tree at wave-wrap

Clean except for the long-standing modification:

```
M tools/__fixtures__/train-context/test-output-weights.json
```

Carried through Waves 94/95/96 without modification. Same line same
file. Likely fixture auto-regeneration.

## Vendor patches in tree

`patches/addon-webgl-0.19.0.{original,patched}.{mjs,js}` —
snapshot-based postinstall patcher for upstream PR #5883. Remove when
`@xterm/addon-webgl >= 0.19.1` ships. Flow documented at
`patches/README.md`.

## Next session pickup

If Cole wants to:
- **Smoke-walk Wave 95** → `roadmap/follow-ups/2026-05-19-wave-95-manual-smoke.md`
- **Push the held commits + tags** → `git push origin master && git push origin v2.19.0 v2.19.1` (verify GH Actions minutes restored first)
- **Start the next wave** → triage `roadmap/follow-ups/` + `roadmap/bugs/` for candidates; the older Wave-89 follow-ups are reasonable bundle starters
- **Move on to Wave 97** (full shared-types extraction, deferred from Wave 96) → blueprint in Wave 96's ADR
