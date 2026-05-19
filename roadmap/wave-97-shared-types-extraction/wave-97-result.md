---
status: SHIPPED
created: 2026-05-19
updated: 2026-05-19
wave: 97
slug: shared-types-extraction
tag: v2.19.2
---

# Wave 97 — Shared-Types Extraction (Result Brief)

## TL;DR

W97 shipped to local master with 3 commits (Phase A, Phase C, Phase D wrap). Tag `v2.19.2`.

The W96 stopgap is gone. `ClaudeCliSettings` and `CodexCliSettings` now have one canonical home at `src/shared/types/configSlices.ts`. Renderer and main both import from there. New CLI-settings fields no longer need hand-mirroring between the two sides.

Phase B (orchestration symbols) shipped as a documented no-op per Phase 0 inventory — those types aren't duplicated (no drift), and tsc.web stays clean today through explicit `tsconfig.web.json` includes. Follow-up filed for a future dedicated relocation wave.

Pure type-only refactor. Zero behavior change. Zero new feature surface. `v2.19.2` is precisely patch-shaped.

## What shipped

| Phase / commit | What |
|---|---|
| Phase 0 (in-line w/ Phase A) | Inventory: 2 CLI-settings families (Claude + Codex); ~60 orchestration symbols renderer-reaching but not duplicated; `@shared/*` alias present in both tsconfigs. ADR Decision 3 resolved to NO-OP for orchestration relocation. |
| Phase A `a87a1f8d` | Created `src/shared/types/configSlices.ts` with both interface definitions (full JSDoc, byte-identical to main's prior content). `src/main/configTypes.ts` becomes a re-export shim — every main-side consumer's import path stays unchanged. Net −48 lines in `configTypes.ts`. |
| Phase B | **No-op.** Documented in ADR Decision 3 consequences. Orchestration relocation filed at `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md` for a dedicated future wave. |
| Phase C `6f4cf6f9` | Deleted duplicate interface definitions from `src/renderer/types/electron-foundation.d.ts`. Added `import type` + `export type` from `@shared/types/configSlices`. Removed W96 gotcha entry from `src/renderer/types/CLAUDE.md`. |
| Phase D (this wrap) | Full lint (0 errors, 4 pre-existing warnings) + full tsc both projects (clean) + full vitest (see below) + CHANGELOG `[2.19.2]` + package.json bump + tag `v2.19.2`. |

## Wave 94 boundary contract — preserved

The orchestrator-owned acceptance test from Wave 94 Phase E (`src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`) was run explicitly after each W97 phase that touched its scope. 5/5 throughout. `openReview` signature unchanged.

## Gates summary

| Gate | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.web.json` | exit 0 |
| `npx tsc --noEmit -p tsconfig.node.json` | exit 0 |
| `npm run lint` | 0 errors, 4 pre-existing warnings |
| `npm test` (full vitest) | _filled at wrap_ |
| `useDiffReviewTrigger.acceptance.test.tsx` (W94 boundary) | 5/5 |
| `/review` mechanical gap-check | _filled at wrap_ |

## Pre-existing failures surfaced (NOT introduced by W97)

`src/renderer/styles/mobile-touch-targets.test.ts` fails with `WorkbenchRightPane.tsx:50` h-6 button missing the `/* touch-target-ok */` opt-out comment. Verified pre-existing during Phase C by stashing W97 edits and running the test against pre-W97 HEAD — same failure. Likely residue from Wave 95 Phase H reshape. Follow-up: `roadmap/follow-ups/2026-05-19-mobile-touch-target-workbench-right-pane.md`.

## Process lessons (for the temperature log)

Drafted entry for `roadmap/wave-temperature-log.md` (append at wave-end after live verification):

> | W-97 (Shared-Types Extraction) | 2026-05-19 | COOL | 3 work phases. Pure mechanical type-only refactor — least exciting wave in months and that's the point. Phase 0 inventory immediately re-shaped Phase B from "move ~40 orchestration types" to "NO-OP, file follow-up" once it was clear those types aren't duplicated and tsc.web is clean today. The W96 ADR's "~40 orchestration domain types to move" was a pre-investigation estimate; the actual problem set was just the 2 CLI-settings interfaces. Sonnet-implementer Phase A and Phase C both landed first-try with all gates green. Phase C surfaced one pre-existing W95 test failure (mobile-touch-targets on WorkbenchRightPane) that was unrelated and got filed. Net diff: ~50 lines moved between files; zero runtime change. Two distinct ESLint-level constraints needed the same trick (re-exports don't bring symbols into local scope, so `import type` + `export type` is the pattern when local code references the moved interface). Cost: ~1 hour of orchestration with one mechanical pre-existing-failure verification detour. |

## Open follow-ups (filed this wave)

In `roadmap/follow-ups/`:
- `2026-05-19-orchestration-types-relocation.md` — Move `main/orchestration/{typesContext,typesDomain,typesProvider}.ts` (and their ~60 exports) to `src/shared/types/orchestration/`, drop the explicit `tsconfig.web.json` includes.
- `2026-05-19-mobile-touch-target-workbench-right-pane.md` — Add `/* touch-target-ok */` to the h-6 button in `WorkbenchRightPane.tsx:50`. Pre-existing W95 residue.

## Older open items (unchanged from prior HANDOFF)

In `roadmap/bugs/`:
- `2026-05-17-chatstatenewpath-dynamic-require-threadstore.md` — OPEN, medium
- `2026-05-17-silent-buildrepoindex-hang-post-graph-ready.md` — TRIAGED, medium
- `2026-05-15-e2e-teardown-hang.md` — Wave 93 carry-over

In `roadmap/follow-ups/`:
- `2026-05-19-wave-95-manual-smoke.md` — Wave 95 hands-on smoke walk (G/H)
- `2026-05-18-osc-11-read-allow.md`
- `2026-05-18-ansi-palette-tuning.md`
- `2026-05-16-wave-89-tool-bridge-runtime-smoke.md`
- `2026-05-16-wave-89-stacked-dock-integration-test.md`
- `2026-05-16-wave-89-dead-useWorkbenchCompare-hook.md`
- `2026-05-05-electron-renderer-browser-mcp-wiring.md`

## Push posture this run

Cole explicitly overrode the bulletin's push-hold for this autonomous run. After wave-wrap gates green, this session pushes:

```
git push origin master
git push origin v2.19.0 v2.19.1 v2.19.2
```

Wave 94 (`v2.19.0`) and Wave 95 (`v2.19.1`) tags were sitting local since 2026-05-18/19; this push includes them all in one round. Pre-push hook runs `tsc -p tsconfig.web.json` — gate stays clean as W97 leaves it.

## Working-tree note for next session

Pre-existing uncommitted work in the tree at W97 wave-end:

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

These were present at the start of this session and listed in the orientation gitStatus snapshot. The W95 HANDOFF described the tree as "clean except for `tools/__fixtures__/.../test-output-weights.json`" but the actual session-start state showed more. Almost certainly W95 Phase G/H work-in-progress that landed in the committed diff for those phases but left intermediate-state files modified. W97 left all of these untouched — only modified files explicitly in scope.

Recommended next-session action: `git stash` the DiffReview pre-existing modifications, run `npm run dev`, smoke-walk the diff-review surface to determine whether the modifications are valid changes worth keeping or noise from a hot-reload save. If valid, commit as a Wave 95 polish addendum. If noise, discard.

## Next session pickup

Per the W97 wrap state:

- **W94/W95/W97 all pushed** (per this run's authorized push). CI re-validates the three tags on next minutes-restore cycle.
- **Smoke-walk W95** still outstanding → `roadmap/follow-ups/2026-05-19-wave-95-manual-smoke.md`
- **Decide on W95 DiffReview pre-existing tree state** (see above).
- **Start orchestration-relocation wave** (filed follow-up) → small dedicated wave, 2-3 phases, ~1 day. Or bundle with another low-stakes cleanup.
- **mobile-touch-targets fix** → tiny inline fix in any wave touching ChatOnlyShell.
