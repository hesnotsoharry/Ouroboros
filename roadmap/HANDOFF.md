# Session Handoff — 2026-05-20 (Wave 97 shipped + pushed; W94/W95/W97 all on origin)

**Audience:** the next Claude Code session.

---

## TL;DR

**Wave 97 (Shared-Types Extraction) shipped to master and PUSHED to origin** along with the previously-held Wave 94 (`v2.19.0`) and Wave 95 (`v2.19.1`) tags. 3 commits over 1 night (2026-05-19 overnight autonomous run), tagged `v2.19.2`.

Cole explicitly authorized the push during this autonomous run, overriding the standing 2026-05-19 bulletin's "agents should NOT initiate pushes" posture for this single execution. After this push, the bulletin posture stands again — future pushes wait for Cole.

CI runs on origin: pending workflow execution on/after 2026-06-01 when GH Actions minutes restore.

---

## Wave 97 — final shipped state

| Phase / commit | What |
|---|---|
| Phase 0 (in-line) | Inventory: 2 CLI-settings families to move (Claude + Codex); ~60 orchestration symbols renderer-reaching but NOT duplicated → Phase B no-op. ADR Decision 3 RESOLVED. |
| Phase A `a87a1f8d` | Created `src/shared/types/configSlices.ts` (canonical home for `ClaudeCliSettings` + `CodexCliSettings` w/ full JSDoc). `src/main/configTypes.ts` becomes re-export shim. Net −48 lines. |
| Phase B | NO-OP. Documented in ADR Decision 3 consequences. Follow-up filed for dedicated future wave. |
| Phase C `6f4cf6f9` | Deleted duplicate interface definitions from `src/renderer/types/electron-foundation.d.ts`; replaced with `import type` + `export type` from shared. Removed W96 gotcha entry from `src/renderer/types/CLAUDE.md`. |
| Phase D wrap | Result brief, CHANGELOG `[2.19.2]`, package.json bump, follow-ups filed, tag `v2.19.2`, push. |

**Push completed (2026-05-20 overnight):**

```
origin/master  — caught up
origin/v2.19.0 — Wave 94 + 96 tag
origin/v2.19.1 — Wave 95 tag
origin/v2.19.2 — Wave 97 tag
```

## Wave 94/95/96 status (carried forward, NOW PUSHED)

W94 + W96 shipped 2026-05-18 (tag `v2.19.0`).
W95 shipped 2026-05-19 (tag `v2.19.1`).
W97 shipped 2026-05-20 overnight (tag `v2.19.2`).

All three pushed in the W97 autonomous run. CI minutes-restore date: 2026-06-01 per the original bulletin.

## Boundary contract — preserved across W94/W95/W97

The Wave 94 Phase E orchestrator-owned acceptance test
(`src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`)
continued to PASS 5/5 throughout Wave 97, verified after Phase A and Phase C.
`openReview` signature unchanged across all three waves.

## Process lessons (for the temperature log)

Drafted entry for `roadmap/wave-temperature-log.md` (already appended by this wrap):

> | W-97 (Shared-Types Extraction) | 2026-05-20 | COOL | 3 work phases. Pure mechanical type-only refactor — least exciting wave in months and that's the point. Phase 0 inventory immediately re-shaped Phase B from "move ~40 orchestration types" to "NO-OP, file follow-up" once it was clear those types aren't duplicated and tsc.web is clean today. Sonnet-implementer landed Phase A and Phase C both first-try, all gates green. Phase C surfaced one pre-existing W95 test failure (mobile-touch-targets on WorkbenchRightPane) that was unrelated and got filed. Net diff: ~50 lines moved between files; zero runtime change. Two distinct ESLint-level constraints needed the same trick (re-exports don't bring symbols into local scope, so `import type` + `export type` is the pattern when local code references the moved interface). Cost: ~1 hour overnight orchestration with one mechanical pre-existing-failure verification detour. |

## Open follow-ups (filed this wave)

In `roadmap/follow-ups/`:
- `2026-05-19-orchestration-types-relocation.md` — Move `main/orchestration/{typesContext,typesDomain,typesProvider}.ts` (~60 exports) to `src/shared/types/orchestration/`. Pure mechanical, 1 day estimated.
- `2026-05-19-mobile-touch-target-workbench-right-pane.md` — `WorkbenchRightPane.tsx:50` h-6 button missing `/* touch-target-ok */`. Pre-existing W95 Phase H residue. Single-line inline fix.

## Older open items (unchanged from prior HANDOFF)

In `roadmap/bugs/`:
- `2026-05-17-chatstatenewpath-dynamic-require-threadstore.md` — OPEN, medium
- `2026-05-17-silent-buildrepoindex-hang-post-graph-ready.md` — TRIAGED, medium
- `2026-05-15-e2e-teardown-hang.md` — Wave 93 carry-over

In `roadmap/follow-ups/`:
- `2026-05-19-wave-95-manual-smoke.md` — Wave 95 hands-on smoke walk for G/H (still outstanding)
- `2026-05-18-osc-11-read-allow.md`
- `2026-05-18-ansi-palette-tuning.md`
- `2026-05-16-wave-89-tool-bridge-runtime-smoke.md`
- `2026-05-16-wave-89-stacked-dock-integration-test.md`
- `2026-05-16-wave-89-dead-useWorkbenchCompare-hook.md`
- `2026-05-05-electron-renderer-browser-mcp-wiring.md`

## Pre-existing uncommitted work in the tree (untouched by W97)

The working tree at W97 wave-end has pre-existing modifications from Wave 95 NOT addressed by the W95 wrap commit:

```
M src/renderer/components/DiffReview/DiffReviewPanel.tsx
M src/renderer/components/DiffReview/FileListSidebar.tsx
M src/renderer/components/DiffReview/diffReviewState.ts
M tools/__fixtures__/train-context/test-output-weights.json
?? src/renderer/components/DiffReview/DiffReviewHeaderStats.tsx
?? src/renderer/components/DiffReview/FileListSidebarGroups.tsx
?? src/renderer/components/DiffReview/diffReviewState.helpers.ts
?? tools/__scratch__/
```

These were present at the start of the W97 session (visible in the orientation gitStatus snapshot) and W97 left them all untouched. The W95 HANDOFF said the tree was "clean except for `tools/__fixtures__/.../test-output-weights.json`" — actual state showed more. Likely W95 Phase G/H work-in-progress fragments that didn't end up in the W95 commit but are still on disk.

**Recommended next-session action:** review the diff, decide whether they're valid follow-ups (e.g., a Phase H residue worth committing as Wave 95 polish) or noise (`git checkout HEAD --`). Don't push them without reviewing first.

## Pre-push hook follow-up (informal, from Wave 96)

`assets/hooks/pre_push_full_check.mjs` still runs `tsc -p tsconfig.web.json` full-project on every push. Wave 96 fixed the renderer→main type cascade; Wave 97 cleaned up the W96 stopgap. The pre-push hook stayed green throughout W97 and on the actual push. Incremental-diff tsc redesign still on the informal-not-blocking list.

## Vendor patches in tree (unchanged)

`patches/addon-webgl-0.19.0.{original,patched}.{mjs,js}` — snapshot-based postinstall patcher for upstream PR #5883. Remove when `@xterm/addon-webgl >= 0.19.1` ships. Flow at `patches/README.md`.

## Next session pickup

If Cole wants to:
- **Smoke-walk Wave 95 (still outstanding)** → `roadmap/follow-ups/2026-05-19-wave-95-manual-smoke.md`
- **Decide on W95 DiffReview pre-existing tree state** — read the modifications, decide commit-or-discard
- **Start the orchestration-relocation wave** → `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md` — small, mechanical, ~1 day. Ideal for shaking the rust off after the W97 type-correctness streak.
- **Inline fix mobile-touch-target follow-up** — Tier 1 single-line edit in any wave touching ChatOnlyShell.
- **Verify CI** when 2026-06-01 minutes restore — three tags + master to verify.
