---
status: DRAFT
created: 2026-05-19
updated: 2026-05-19
wave: 97
slug: shared-types-extraction
tag: v2.19.2
---

# Wave 97 — Shared-Types Extraction: Eliminate the Renderer/Main Type-Coupling Drift

## Context

Wave 96 (`v2.19.0`, SHIPPED 2026-05-18) unblocked the pre-push
`tsc -p tsconfig.web.json` gate by syncing the renderer's local
`ClaudeCliSettings` in `src/renderer/types/electron-foundation.d.ts` and
redirecting orchestration channel imports to `@shared/ipc/orchestrationChannels`.
The W96 ADR explicitly punted the structural fix forward:

> Pick: Sync in place (Option 1). Defer full shared-types extraction to
> Wave 97. Rationale: this wave's sole goal is unblocking the push.
> Wave 97 will move config slices to `src/shared/types/configSlices.ts`
> to eliminate drift permanently — larger blast radius (touches
> `main/configTypes.ts` and all consumers), doesn't fit on an unblock wave.

The duplication is real and documented at
`src/renderer/types/CLAUDE.md` as a known gotcha to be removed by W97:
two copies of `ClaudeCliSettings` (28 fields in renderer, 30 in main)
that must be hand-mirrored on every new CLI setting. This wave deletes
that gotcha by moving the canonical definition to `src/shared/types/`
and making both sides import from there.

Confirmed from the codebase:
- `src/shared/types/` already exists with 24 type modules (auth, layout,
  orchestration domain, etc.) — there's an established convention for
  shared types. `configSlices.ts` does not yet exist; that's this wave's
  net-new module.
- `src/shared/types/orchestrationDomain.ts` already exists. Some
  orchestration types are already shared. The W96 ADR's "~40
  orchestration domain types" likely overstates remaining main-side
  scope; Phase B starts with a survey to inventory what's actually still
  in `src/main/orchestration/types.ts` (13 lines today) and
  `src/main/orchestration/events.ts` (29 lines today) vs already-shared.
- `src/main/configTypes.ts` is 344 lines (consumer surface is 30+ call
  sites across main+renderer) — large but mechanical to redirect with
  re-exports preserving import paths.
- `src/main/configAppTypes.ts` (241 lines) is what `configTypes.ts`
  re-exports — its CLI-settings interfaces are the extraction targets.

This is the canonical type-only refactor: zero behavior change, zero new
features, success defined entirely by clean tsc + green tests + a single
canonical source for each settings shape.

## Goal

After Wave 97, every CLI-settings interface (`ClaudeCliSettings`,
`CodexCliSettings`, and any peer slices identified in Phase 0 grounding)
lives in `src/shared/types/configSlices.ts` and is imported from there
by both `src/main/configAppTypes.ts` AND
`src/renderer/types/electron-foundation.d.ts`. The renderer-side
`ClaudeCliSettings` standalone definition is deleted. The W96 gotcha
entry in `src/renderer/types/CLAUDE.md` is removed. Any main-side
orchestration domain types still in `src/main/orchestration/{types,events}.ts`
that the renderer transitively imports are moved to `src/shared/types/`
or routed through `@shared/ipc/orchestrationChannels`. The pre-push
`tsc -p tsconfig.web.json` gate stays clean. No behavior change.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-97-shared-types-extraction/wave-97-decisions.md`.

1. **Module location for extracted CLI settings.** Settings slices land
   at `src/shared/types/configSlices.ts` (single file). Rationale: matches
   the existing convention in `src/shared/types/` (one slice family per
   file: `agentChat.ts`, `layout.ts`, etc.); splitting per-CLI is
   premature until the file exceeds the 300-line ESLint limit. RESOLVED.
2. **Import-path stability.** `src/main/configAppTypes.ts` re-exports
   each moved interface so existing main-side consumers keep working
   without a sweeping rename. The renderer's `electron-foundation.d.ts`
   imports directly from `@shared/types/configSlices`. Rationale:
   minimizes blast radius; future waves can flip main-side consumers to
   the shared path opportunistically. RESOLVED.
3. **Orchestration scope discipline.** Phase B starts with a `tsc -p
   tsconfig.web.json` baseline (must be 0 errors after W96) plus a
   survey of `src/main/orchestration/{types,events}.ts` to enumerate
   what still requires sharing vs what's already routed. Only types the
   renderer transitively imports get moved this wave. Server-only
   orchestration internals stay in `src/main/orchestration/`. RESOLVED.
4. **Deletion of the renderer-local `ClaudeCliSettings` definition.**
   Delete outright in Phase C (not deprecate-then-delete). The shape is
   structurally compatible after Phase A re-export wiring; a parallel
   definition adds confusion with zero migration value. RESOLVED.
5. **No semver-major.** Tag `v2.19.2` — patch release. Pure type
   correctness, no runtime behavior change, no public API rename.
   RESOLVED.

## Scope

**In scope:**
- Create `src/shared/types/configSlices.ts` with `ClaudeCliSettings`,
  `CodexCliSettings`, and other CLI-settings slices identified in Phase 0
  grounding (target: ≤ 6 interface families).
- Wire `src/main/configAppTypes.ts` to import + re-export from
  `@shared/types/configSlices`. All main-side import paths stay stable.
- Delete `ClaudeCliSettings` standalone definition from
  `src/renderer/types/electron-foundation.d.ts`. Re-add via re-export
  from `@shared/types/configSlices` (or import directly per the
  renderer's barrel convention).
- Remove the "until W97" gotcha entry from `src/renderer/types/CLAUDE.md`.
- Survey + move any `src/main/orchestration/{types,events}.ts` symbols
  the renderer transitively imports into `src/shared/types/` or
  `@shared/ipc/orchestrationChannels`.
- Verify `tsc -p tsconfig.web.json` is 0 errors. Verify
  `tsc -p tsconfig.node.json` is unchanged. Verify scoped vitest runs
  pass.

**Out of scope:**
- Renaming any settings interfaces — pure relocation, no shape change.
  Defer to a future wave with a behavioral justification.
- Refactoring `src/main/configTypes.ts` → `configAppTypes.ts` split. The
  existing 2-file split is load-bearing for the 300-line ESLint limit
  per `src/main/CLAUDE.md`'s Key Patterns. Don't touch.
- Pre-push hook redesign (incremental-diff tsc) — informal follow-up
  noted in W95 HANDOFF; separate wave.
- Moving any orchestration internals the renderer does NOT import.
  Server-only types belong in `src/main/`.
- Touching the W94 Phase E orchestrator-owned acceptance test
  (`src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`). It
  must continue to pass 5/5 with zero modification.
- Push. Held until 2026-06-01 per the GH Actions bulletin. Local commit + tag only.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR lock + grounding survey (which interfaces move; orchestration inventory) | `orchestrator` | Read `src/main/configAppTypes.ts` end-to-end, enumerate CLI-settings interface families. Read `src/main/orchestration/{types,events}.ts` end-to-end, list every symbol the renderer transitively imports. Update ADR Decision 3 with the concrete list. **No code.** |
| A | Create `src/shared/types/configSlices.ts` with `ClaudeCliSettings` (30 fields from main) + `CodexCliSettings` + peers identified in Phase 0. Wire `configAppTypes.ts` to import + re-export. | `sonnet-implementer` | Refactor — preserves all main-side import paths via re-export. Test shape: **pyramid** (logic-free, types only). Acceptance: `npx tsc --noEmit -p tsconfig.node.json` exits 0 with no new errors; `npm run test:main` passes scoped. |
| B | Survey + relocate any orchestration symbols the renderer transitively imports out of `src/main/orchestration/`. | `sonnet-implementer` | Cross-boundary (renderer ↔ main type surface). Test shape: **pyramid**. Likely a no-op or near-no-op after Phase 0 inventory — if inventory shows zero renderer-reaching symbols still in main, Phase B is documentation-only. Otherwise: move into `src/shared/types/orchestrationDomain.ts` (existing) or new file per inventory. **Flag in ADR Decision 3 outcome.** |
| C | Delete renderer-local `ClaudeCliSettings` definition; update `useClaudeCliSettings.ts` and `electron-foundation.d.ts` to import from `@shared/types/configSlices`. Remove W96 gotcha entry from `src/renderer/types/CLAUDE.md`. | `sonnet-implementer` | Renderer-side cleanup. Test shape: **pyramid**. Acceptance: `npx tsc --noEmit -p tsconfig.web.json` exits 0; `npm run test:renderer` passes scoped; renderer-local `ClaudeCliSettings` interface block is gone (grep returns 0 matches in `electron-foundation.d.ts`). |
| D | Wave wrap — full lint + full tsc (both projects) + full vitest + `/review` mechanical gap-check + CHANGELOG `[2.19.2]` + version bump + local tag `v2.19.2`. No push (bulletin). | `orchestrator` | Per `~/.claude/notes/wave-process.md` § Wave's final phase. Run `/promote-vendor-lessons 97` (likely no-op — no vendors touched) and `/audit-followups wave-97-shared-types-extraction`. |

## Phase ordering

```
Phase 0 (ADR + inventory)
   │
   ▼
Phase A (configSlices.ts + re-export wiring)
   │
   ├─────────────┐
   ▼             ▼
Phase B        Phase C
(orchestration) (renderer-local delete)
   │             │
   └─────┬───────┘
         ▼
      Phase D (wrap)
```

**Phase A must complete before Phase C** — Phase C imports from
`@shared/types/configSlices`, which Phase A creates.

**Phase B is independent of Phase A** — different files, different
interfaces. Can run in parallel with Phase C after Phase A lands.

**Phase 0 gates the wave** — if the inventory in Decision 3 shows
unexpected scope (e.g., > 10 renderer-reaching orchestration symbols),
the orchestrator surfaces it as a user-judgment moment before Phase A
dispatch.

## Risks

| Risk | Mitigation |
|---|---|
| Phase A re-export breaks a main-side consumer with a non-obvious import path (e.g., a deep import from `configAppTypes.ts` rather than `configTypes.ts`). | Phase 0 inventory grep `from '.*configAppTypes'` AND `from '.*configTypes'` across `src/main/`. Phase A acceptance includes `npm run test:main` scoped run. |
| `electron-foundation.d.ts` is a `.d.ts` file; importing from `@shared/types/configSlices` requires the import to resolve under both the renderer's `tsconfig.web.json` (DOM lib, includes `src/shared`) AND the preload's `tsconfig.node.json`. | Verify `paths` for `@shared/*` is present in both `tsconfig.web.json` and `tsconfig.node.json` during Phase 0. If only one has it, Phase A adds it to the other (small ADR amendment, not a re-plan). |
| Phase B inventory surfaces an orchestration symbol the renderer reaches via a runtime `import type` chain we can't move cheaply (e.g., a type that names a value from a main-only module). | Phase B's scope is bounded by Decision 3 — if a symbol can't be cleanly relocated, document the constraint in the ADR consequences and leave it; the renderer is allowed to keep importing from `@shared/ipc/orchestrationChannels` even if that file re-exports from main. The wave's success criterion is `tsc -p tsconfig.web.json` clean, not "every orchestration type lives in shared." |
| Deleting the renderer-local `ClaudeCliSettings` block in Phase C removes a comment or non-obvious field structure the renderer depends on. | Phase C diff includes a side-by-side compare (30-field shared vs 28-field local, plus the two W96-added fields). If any field-level shape difference exists, surface as Tier 3 — do not silently reconcile. |
| Pre-push hook tsc gate flakes on the new `@shared/types/configSlices.ts` resolution. | Phase A re-runs the full `tsc -p tsconfig.web.json` immediately after writing the new file. Phase D re-runs both projects. If the gate fails at wave wrap, fix is in-bounds for Phase D inline. |
| W94 Phase E acceptance test (`useDiffReviewTrigger.acceptance.test.tsx`) starts failing. | Phase A and Phase C each end with `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx` — explicit boundary check from the wave's constraints. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR + inventory only. No code. |
| A | n/a | n/a | Pure type relocation + re-export. Coverage = `tsc --noEmit` on both project tsconfigs + `npm run test:main` scoped (regression on touched area). No new unit tests. |
| B | n/a | n/a | Same shape as Phase A. Coverage = `tsc --noEmit` on both + scoped vitest on `src/main/orchestration` if any file moves. If Phase B is documentation-only (zero symbols to move), skip. |
| C | n/a | n/a | Coverage = `tsc --noEmit -p tsconfig.web.json` + `npm run test:renderer` scoped + explicit `vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`. |
| D | full vitest | full vitest | Standard wave-wrap full suite. |

Test shape rationale: pyramid is correct for this wave — pure
type-only refactor, no behavior change, no new logic. Honeycomb would
be overkill (no new boundary; the existing boundary is type-only and
checked by tsc, which is the boundary-level "test" for type code).
The wave does NOT touch a new architectural surface — walking-skeleton
rule does not fire. No orchestrator-authored failing acceptance test
required (no behavioral boundary changes).

## Acceptance criteria

- [ ] `src/shared/types/configSlices.ts` exists and exports
      `ClaudeCliSettings` with all 30 fields currently in `src/main/configAppTypes.ts`'s definition (including the W96-added
      `useWarmProcess` and `enableTerminalDiffReview`).
- [ ] `src/shared/types/configSlices.ts` exports `CodexCliSettings`
      and any other CLI-settings interface families identified in
      Phase 0 grounding.
- [ ] `src/main/configAppTypes.ts` imports each moved interface from
      `@shared/types/configSlices` and re-exports it under the same
      name — all existing main-side import paths
      (`from '../configTypes'`, `from '../configAppTypes'`) continue to
      resolve to the same type.
- [ ] `src/renderer/types/electron-foundation.d.ts` no longer contains
      a standalone `interface ClaudeCliSettings { ... }` block. `grep -n
      "interface ClaudeCliSettings" src/renderer/types/electron-foundation.d.ts`
      returns 0 matches.
- [ ] `src/renderer/hooks/useClaudeCliSettings.ts` imports
      `ClaudeCliSettings` from a `@shared/types/configSlices` path (direct
      or via renderer barrel).
- [ ] `src/renderer/types/CLAUDE.md` no longer contains the "until W97"
      / "drift-prone stopgap" gotcha entry for `ClaudeCliSettings`.
- [ ] `npx tsc --noEmit -p tsconfig.web.json` exits with status 0.
- [ ] `npx tsc --noEmit -p tsconfig.node.json` exits with status 0.
- [ ] `npm test` (full vitest suite) exits with status 0 at wave wrap.
- [ ] `npm run lint` exits with status 0 at wave wrap.
- [ ] `src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`
      passes 5/5 throughout the wave (W94 Phase E boundary contract).
- [ ] CHANGELOG has a `[2.19.2]` entry with the wave summary.
- [ ] `package.json` version is `2.19.2`.
- [ ] Local tag `v2.19.2` exists at the wave's tip commit. (Not pushed.)
- [ ] `/review` returns PASS (or FLAG with all flags addressed) for the
      wave's aggregate diff.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR file updated with concrete interface list and orchestration inventory; no runtime impact. |
| A | Settings → Claude CLI panel in a running dev IDE | `electron-vite dev` → main loads `configAppTypes.ts` (now re-exporting from shared) → IPC `config:get` returns `ClaudeCliSettings` → preload bridges → `useClaudeCliSettings` consumes → Settings panel renders all 30 fields | All Claude CLI settings render in the panel with the same labels and values as before the wave. No field disappears; no field's persisted value resets. Toggling `useWarmProcess` and `enableTerminalDiffReview` (the W94-added fields) survives a reload. |
| B | Internal — no observation point | n/a | Pure type relocation. If documentation-only, even more so. (If a symbol moves, downstream behavior is unchanged — tsc clean is the only signal.) |
| C | Settings → Claude CLI panel in a running dev IDE | `electron-vite dev` → renderer's `electron-foundation.d.ts` now resolves `ClaudeCliSettings` from `@shared/types/configSlices` → `useClaudeCliSettings` typechecks → Settings panel renders | Identical to Phase A observation — the user can't tell which side owns the type. That's the point. |
| D | Pre-push hook on a `git push --dry-run` | local commits → `scripts/hooks/pre-push` runs `tsc -p tsconfig.web.json` full-project → exits 0 → hook permits push | The pre-push hook stays green and silent. No TS6307 cascade returns. Cole can push (when minutes restore) without `--no-verify`. |

### Data-shape probes

```bash
# Probe 1: shared module exists and exports the canonical interface
grep -n "^export interface ClaudeCliSettings" src/shared/types/configSlices.ts
# expect: one match

# Probe 2: renderer no longer declares its own
grep -n "^interface ClaudeCliSettings\|^export interface ClaudeCliSettings" \
  src/renderer/types/electron-foundation.d.ts
# expect: zero matches

# Probe 3: main re-exports from shared
grep -n "ClaudeCliSettings" src/main/configAppTypes.ts
# expect: at least one import-from-shared line + at least one re-export line

# Probe 4: full-project tsc clean
npx tsc --noEmit -p tsconfig.web.json && echo "WEB-OK"
npx tsc --noEmit -p tsconfig.node.json && echo "NODE-OK"
# expect: both OK

# Probe 5: gotcha entry removed
grep -n "until W97\|until Wave 97\|drift-prone stopgap" src/renderer/types/CLAUDE.md
# expect: zero matches

# Probe 6: W94 boundary acceptance test
npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx
# expect: 5/5 pass
```

## Files the next agent should read first

1. `roadmap/wave-97-shared-types-extraction/wave-97-decisions.md` — this
   wave's ADR with the 5 locked decisions.
2. `roadmap/wave-96-shared-types-extraction/waveplan-96.md` — the W96
   plan, especially the ADR rationale punting structural extraction to
   this wave and the §"Wave 97 follow-up" section at the bottom.
3. `src/main/configAppTypes.ts` (241 lines) — primary extraction source.
   The full `ClaudeCliSettings` (30 fields), `CodexCliSettings`, and
   peer CLI settings interfaces live here.
4. `src/renderer/types/electron-foundation.d.ts` — primary deletion
   site (the duplicate `ClaudeCliSettings` block) and one of the two
   re-import sites.
5. `src/renderer/hooks/useClaudeCliSettings.ts` — the W96-redirected
   consumer; Phase C re-redirects to `@shared`.
6. `src/renderer/types/CLAUDE.md` — contains the W96 gotcha entry to
   remove.
7. `src/shared/types/` (directory) — the destination + structural
   exemplar. `agentChat.ts` (~150 lines, multiple interfaces, one
   barrel-friendly file) is the closest shape to what `configSlices.ts`
   will look like.
8. `src/main/orchestration/{types.ts,events.ts}` — Phase B inventory
   sources.
9. `tsconfig.web.json` AND `tsconfig.node.json` — verify the `@shared/*`
   path alias resolution in both during Phase 0.
10. `~/.claude/notes/wave-process.md` — wave structure + per-phase gate
    discipline reference.

## Note to the implementer

This is a type-only refactor with zero behavior change. The wave's
spirit is "stop hand-mirroring `ClaudeCliSettings`"; everything else is
in service of that. Don't expand scope to rename interfaces, restructure
the main/configTypes split, or introduce semantic improvements to the
config schema. The 300-line ESLint limit on main config files is
load-bearing (per `src/main/CLAUDE.md` Key Patterns) — splits that exist
exist for a reason.

Temptations to resist:
- "While we're here, let's also extract the orchestration types we don't
  strictly need to move." No. Phase B is bounded by the Decision 3
  inventory — only renderer-reaching symbols move.
- "Let's rename `ClaudeCliSettings` to `ClaudeAgentSettings` for clarity."
  No. Rename is a behavior change to import paths across 30+ call
  sites; not this wave.
- "Let's deprecate the main-side re-exports and flip all consumers." No.
  Decision 2 explicitly says re-exports stay; future waves can flip
  opportunistically.
- "Phase B inventory found 40 things; let's move them all." Only if
  they're renderer-reaching. Server-only orchestration internals stay in
  main.

If Phase 0's inventory surfaces something unexpected — a CLI-settings
interface family with a runtime-value dependency the renderer can't
reach, or an orchestration symbol whose move would require touching
> 5 consumer files — file a Tier 3 follow-up and stop. Don't reshape
the wave mid-flight.

Before declaring a phase complete, restate the observation point from
the Verification table in your own words and describe what you actually
observed there. If you could not observe it directly — no live IDE, no
triggered chat session, no rendered panel — say so explicitly. Do not
substitute "tests pass" for runtime observation. Tests passing at the
unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

> A green gate with nothing Tier 3 means the orchestrator dispatches
> the next phase in the same turn. The turn ends between phases ONLY
> for: a Tier 3 discovery that needs a user call, a genuine
> user-judgment decision the plan doesn't determine, or wave-end. See
> the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at
   `roadmap/wave-97-shared-types-extraction/wave-97-decisions.md` with
   Decisions 1, 2, 4, 5 RESOLVED and Decision 3 marked PENDING (inventory
   gated). If Decision 3 is already RESOLVED with a concrete interface
   list and orchestration symbol list, Phase 0 is shortened to
   "confirm grounding still matches current HEAD."
2. **Phase 0** — `orchestrator` runs the grounding survey:
   - Read `src/main/configAppTypes.ts` end-to-end. Enumerate every
     interface whose name ends in `CliSettings` or which represents a
     CLI integration setting family. Update ADR Decision 3 with the
     concrete list (target: ≤ 6 interface families).
   - Read `src/main/orchestration/types.ts` and `events.ts`. For each
     exported symbol, grep `src/renderer/` and `src/preload/` for
     imports — produce a "renderer-reaching symbols" list. Update ADR
     Decision 3.
   - Verify `@shared/*` path alias in both `tsconfig.web.json` and
     `tsconfig.node.json`. If missing in one, append to ADR consequences
     and flag for Phase A to add.
   - **Gate to advance:** ADR Decision 3 updated; inventory ≤ 6 CLI
     interface families AND ≤ 10 orchestration symbols. If inventory
     exceeds these soft caps, end turn for user judgment on scope.
3. **Phase A** — dispatch `sonnet-implementer` with brief:
   > Create `src/shared/types/configSlices.ts` housing the CLI-settings
   > interfaces enumerated in ADR Decision 3. Each interface preserves
   > its field shape, JSDoc, and field-level comments exactly as in
   > `src/main/configAppTypes.ts`. Update `configAppTypes.ts` to import
   > each from `@shared/types/configSlices` and re-export it under the
   > same name. Run `npx tsc --noEmit -p tsconfig.node.json` AND
   > `npx tsc --noEmit -p tsconfig.web.json` AND `npm run test:main`;
   > all three must exit 0. Report DONE with all three command results.
   - **Gate to advance:** Both tsc projects exit 0 AND test:main passes
     AND `useDiffReviewTrigger.acceptance.test.tsx` 5/5 AND orchestrator
     diff review fine.
4. **Phase B** — dispatch `sonnet-implementer` with brief:
   > Move the orchestration symbols enumerated in ADR Decision 3 from
   > `src/main/orchestration/{types,events}.ts` to
   > `src/shared/types/orchestrationDomain.ts` (existing file) or a new
   > file if Decision 3 names one. Preserve every consumer's import path
   > via re-export from `src/main/orchestration/events.ts`. If Decision
   > 3 names zero renderer-reaching symbols, Phase B is a no-op — report
   > "Phase B no-op per Decision 3 inventory" and exit. Otherwise run
   > `npx tsc --noEmit -p tsconfig.web.json` AND `npx tsc --noEmit -p
   > tsconfig.node.json` AND `npm run test:orchestration`; all must exit
   > 0. Report DONE.
   - **Gate to advance:** Both tsc projects exit 0 AND test:orchestration
     passes (or N/A if no-op) AND orchestrator diff review fine. Phase B
     is flagged as conceptually-risky (renderer-reaching type surface)
     → `sonnet-phase-reviewer` pass on the phase diff against this
     plan's Decision 3 + Phase B brief before the gate is green.
5. **Phase C** — dispatch `sonnet-implementer` with brief (can run in
   parallel with Phase B in a separate worktree if desired, but
   sequential is fine):
   > In `src/renderer/types/electron-foundation.d.ts`, delete the
   > standalone `ClaudeCliSettings` interface block (the entire interface
   > definition added in W96). Replace with a single line:
   > `export type { ClaudeCliSettings } from '@shared/types/configSlices';`
   > or wire through the renderer's `electron.d.ts` barrel if that's the
   > project's convention (check `src/renderer/types/CLAUDE.md`'s
   > "Import from electron.d.ts only" note). Update
   > `src/renderer/hooks/useClaudeCliSettings.ts` to import from the
   > resolved path. Remove the W96 gotcha entry for `ClaudeCliSettings`
   > from `src/renderer/types/CLAUDE.md`. Run
   > `npx tsc --noEmit -p tsconfig.web.json` AND
   > `npm run test:renderer` AND
   > `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`;
   > all must exit 0. Report DONE.
   - **Gate to advance:** tsc.web exits 0 AND test:renderer passes AND
     acceptance test 5/5 AND orchestrator diff review fine.
6. **Phase D (wrap)** — orchestrator runs:
   - `npm run lint` (full) — exit 0.
   - `npx tsc --noEmit -p tsconfig.web.json && npx tsc --noEmit -p tsconfig.node.json` — both exit 0.
   - `npm test` (full vitest) — exit 0. (~17 min; run in background.)
   - `/review` mechanical gap-check. PASS or FLAG-with-flags-addressed.
   - Write `roadmap/wave-97-shared-types-extraction/wave-97-result.md`.
   - Update `CHANGELOG.md` with `[2.19.2] - 2026-MM-DD` entry.
   - Bump `package.json` version to `2.19.2`.
   - Commit wave wrap. `git tag v2.19.2`.
   - Run `/promote-vendor-lessons 97` (no-op likely — no vendor SDK touched).
   - Run `/audit-followups wave-97-shared-types-extraction`.
   - Update `roadmap/HANDOFF.md` and append a row to
     `roadmap/wave-temperature-log.md`.
   - **Do NOT push.** Bulletin: GH Actions minutes held until 2026-06-01.
     Cole pushes manually when minutes restore.
   - **Gate to close wave:** all gates green AND HANDOFF reflects new state.

UI smoke gate does NOT fire — no `src/renderer/components/Layout/**`
changes in this wave. (Phase C touches `src/renderer/types/` and a
single hook; not UI surface.)
