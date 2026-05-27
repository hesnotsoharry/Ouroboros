---
status: DRAFT
created: 2026-05-20
updated: 2026-05-20
wave: 98
slug: orchestration-types-relocation
tag: v2.19.3
---

# Wave 98 — Orchestration Types Relocation: Sever the Last Renderer→Main Type Reach

## Context

Wave 97 (`v2.19.2`, SHIPPED 2026-05-20) eliminated `ClaudeCliSettings` + `CodexCliSettings` duplication by extracting them to `src/shared/types/configSlices.ts`. Phase 0 inventory of that wave flagged a second renderer→main type-reach surface — the orchestration domain types under `src/main/orchestration/` — and filed `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md` for a dedicated future wave.

Grounding for this wave revised the follow-up's scope estimate. The follow-up assumed ~60 types still owned by main. Today's HEAD shows:

- `src/main/orchestration/typesContext.ts` (`src/main/orchestration/typesContext.ts:1-25`) — already a **pure re-export shim** from `@shared/types/orchestration`. Done.
- `src/main/orchestration/typesDomain.ts` (`src/main/orchestration/typesDomain.ts:1-46`) — already a pure re-export shim. Done.
- `src/main/orchestration/typesProvider.ts` (`src/main/orchestration/typesProvider.ts:1-220`) — **partial**. Cross-boundary types lines 18-38 are re-exported from shared; lines 40-219 retain ~10 interfaces (`OrchestrationAPI`, `OrchestrationEvent` union + 5 event variants + `OrchestrationEventBase`, `ProviderCapabilities`, `ProviderProgressEvent`, `ProviderContentBlockDelta`, `TokenUsage`, `VerificationStep`, `VerificationProfile`) classified by that file's header comment as "main-process-only."

The classification was wrong. `src/renderer/types/electron-orchestration.d.ts:1-5` imports `OrchestrationAPI`, `OrchestrationEvent`, `TaskResult` from `'../../main/orchestration/types'`, and the bulk re-export at `electron-orchestration.d.ts:7-66` pulls 9 of the ~10 supposedly main-only interfaces through that same barrel. They are cross-boundary in practice. This is the renderer's last load-bearing reach into `src/main/`.

The workaround keeping it compiling is `tsconfig.web.json:30-33`:

```json
"src/main/orchestration/types.ts",
"src/main/orchestration/typesContext.ts",
"src/main/orchestration/typesDomain.ts",
"src/main/orchestration/typesProvider.ts"
```

Four explicit `include` lines that exist solely so the renderer's TypeScript program sees those files. Dropping them is the wave's architectural payoff.

This is pure type relocation with re-export wiring — zero runtime change. Mirrors W97's shape: Phase 0 inventory, single-file extraction, renderer re-point, wrap.

## Goal

After Wave 98, the renderer imports the orchestration API + event types from `@shared/types/orchestration` (canonical home) rather than `../../main/orchestration/types` (load-bearing reach). `src/main/orchestration/typesProvider.ts` becomes a pure re-export shim like its two siblings. `tsconfig.web.json` no longer needs the four explicit `include` lines pointing into `src/main/orchestration/`. The W94 Phase E orchestrator-owned acceptance test (`useDiffReviewTrigger.acceptance.test.tsx`) continues to pass 5/5. No semantic API change, no runtime behavior change.

## Locked decisions (Phase 0 — ADR)

ADR file: `roadmap/wave-98-orchestration-types-relocation/wave-98-decisions.md`.

1. **Destination module.** Extend `src/shared/types/orchestration.ts`. If after move the file exceeds the 300-line ESLint cap, Phase A splits at that point into `orchestration.ts` + `orchestrationApi.ts`. RESOLVED.
2. **Main-side import-path stability.** `typesProvider.ts` becomes a pure re-export shim from `@shared/types/orchestration` (mirrors `typesContext.ts` and `typesDomain.ts`). No main-side consumer rename. RESOLVED.
3. **Renderer re-pointing target.** `electron-orchestration.d.ts` re-points directly to `@shared/types/orchestration`. RESOLVED.
4. **`tsconfig.web.json` cleanup timing.** Drop the 4 `include` lines in Phase C — the architectural payoff of the wave. RESOLVED.
5. **Semver bump.** Patch — `v2.19.3`. RESOLVED.

## Scope

**In scope:**
- Move ~10 interfaces from `src/main/orchestration/typesProvider.ts` to `src/shared/types/orchestration.ts`: `OrchestrationAPI`, `OrchestrationEventBase`, `OrchestrationStateChangedEvent`, `OrchestrationProviderProgressEvent`, `OrchestrationVerificationUpdatedEvent`, `OrchestrationSessionUpdatedEvent`, `OrchestrationTaskResultEvent`, `OrchestrationEvent` (union), `ProviderCapabilities`, `ProviderProgressEvent`, `ProviderContentBlockDelta`, `TokenUsage`, `VerificationStep`, `VerificationProfile`.
- Turn `typesProvider.ts` into a pure re-export shim from `@shared/types/orchestration`. Drop all `import('./typesDomain')` and `import('./typesContext')` inline references — pull them from shared instead.
- Re-point `src/renderer/types/electron-orchestration.d.ts` imports (both the named import at lines 1-5 AND the bulk re-export list at lines 7-66) from `'../../main/orchestration/types'` to `'@shared/types/orchestration'`.
- Remove the four `include` lines from `tsconfig.web.json:30-33`.
- Verify `tsc -p tsconfig.web.json` is 0 errors after the includes are dropped. Verify `tsc -p tsconfig.node.json` is unchanged. Verify the W94 Phase E acceptance test passes 5/5.
- Update Phase 0 inventory in the ADR if grounding surfaces a discrepancy (e.g., an interface I missed).
- CHANGELOG `[2.19.3]`, package.json bump, local tag `v2.19.3`. No push (per bulletin).

**Out of scope:**
- Renaming any orchestration interfaces — pure relocation, no shape change.
- Reshaping `OrchestrationAPI` or the event union — defer to a future wave with a behavioral justification.
- Touching `src/main/orchestration/typesContext.ts` or `typesDomain.ts` — already done in a prior wave; no work required.
- Flipping main-side consumers off the `./typesProvider` shim — opportunistic, not this wave.
- Pre-push hook redesign (incremental-diff tsc) — informal follow-up since W96; separate wave.
- Push. Held until 2026-06-01 per the GH Actions bulletin. Local commit + tag only.
- Touching the W94 Phase E orchestrator-owned acceptance test (`useDiffReviewTrigger.acceptance.test.tsx`). Must continue to pass 5/5 with zero modification.

## Phases

| Phase | Topic | Implementer | Notes |
|---|---|---|---|
| 0 | ADR lock + inventory confirmation | `orchestrator` | Re-read `typesProvider.ts` lines 40-219 and `electron-orchestration.d.ts` end-to-end. Enumerate the exact interface list to move. Confirm no main-only impl file imports any of these interfaces via a path that doesn't go through the barrel (a grep across `src/main/orchestration/providers/` would catch deep imports). Update ADR Decision 1 with the final interface list (≤ 14 names). **No code.** |
| A | Move ~10 interfaces from `typesProvider.ts` to `src/shared/types/orchestration.ts`. Turn `typesProvider.ts` into a pure re-export shim. | `sonnet-implementer` | Refactor. Test shape: **pyramid** (logic-free, types only). Boundary contract: the orchestration API + event types are the IPC surface — flagged conceptually-risky. `sonnet-phase-reviewer` pass on the diff against this brief + ADR Decision 1/2 BEFORE the gate is green. Acceptance: `tsc.web` exits 0 (still with `include` lines in place) AND `tsc.node` exits 0 AND `npm run test:main` passes scoped AND `npm run test:orchestration` passes scoped AND `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx` passes 5/5. |
| B | Re-point `electron-orchestration.d.ts` from `'../../main/orchestration/types'` to `'@shared/types/orchestration'`. Both the named import (lines 1-5) and the bulk re-export (lines 7-66). | `sonnet-implementer` | Renderer-side single-file edit. Test shape: **pyramid**. Acceptance: `tsc.web` still exits 0 (with `include` lines still in place — confirms the renderer's type resolution works through shared) AND `npm run test:renderer` passes scoped AND acceptance test 5/5. |
| C | Drop `tsconfig.web.json:30-33` (the 4 `src/main/orchestration/*.ts` include lines). | `sonnet-implementer` | This is the architectural payoff: `tsc.web` must still exit 0 WITHOUT the include lines — confirms the renderer no longer needs `src/main/` in its TypeScript program. Test shape: **pyramid**. Acceptance: `tsc.web` exits 0 with the lines dropped AND `npm run test:renderer` passes scoped AND `tsc.node` unchanged AND acceptance test 5/5. |
| D | Wave wrap — full lint + full tsc (both projects) + full vitest + `/review` mechanical gap-check + CHANGELOG `[2.19.3]` + version bump + local tag `v2.19.3`. No push (bulletin). | `orchestrator` | Per `~/.claude/notes/wave-process.md` § Wave's final phase. Run `/promote-vendor-lessons 98` (no-op — no vendors touched) and `/audit-followups wave-98-orchestration-types-relocation`. The audit should mark the source follow-up RESOLVED. |

## Phase ordering

```
Phase 0 (ADR + inventory)
   │
   ▼
Phase A (move interfaces; typesProvider becomes shim)
   │
   ▼
Phase B (renderer re-points to @shared)
   │
   ▼
Phase C (drop tsconfig.web.json includes)
   │
   ▼
Phase D (wrap)
```

Phases A → B → C are strictly sequential. B can't precede A (it needs the canonical home in shared). C can't precede B (it relies on the renderer no longer reaching into main). No parallelism this wave.

**Phase 0 gates the wave** — if the inventory in Decision 1 surfaces unexpected scope (e.g., a `src/main/orchestration/providers/` file deep-imports `OrchestrationAPI` via a path the barrel doesn't cover), the orchestrator surfaces it as a user-judgment moment before Phase A dispatch.

## Risks

| Risk | Mitigation |
|---|---|
| `OrchestrationAPI` references `ProviderProgressEvent` via direct type reference (`onProviderEvent: (callback: (event: ProviderProgressEvent) => void) => () => void`). If `ProviderProgressEvent` doesn't move in the same commit, the move splits the type graph and `tsc` breaks. | Phase A moves all referenced types together — `OrchestrationAPI` + every type its surface mentions (`ProviderProgressEvent`, `TokenUsage`, `VerificationStep`, `VerificationProfile`). Phase 0 inventory enumerates the full reference closure before Phase A dispatch. |
| `src/main/orchestration/providers/*` modules deep-import from `./typesProvider` (bypassing the barrel) and rely on a type that's now only re-exported. | The re-export shim preserves every named export. Phase A acceptance includes `tsc.node` clean, which catches any consumer breakage. |
| The renderer's `electron-orchestration.d.ts` bulk re-export at lines 7-66 references types that don't exist in `@shared/types/orchestration` yet because Phase A missed one. | Phase B's acceptance is `tsc.web` clean — if a name doesn't resolve, tsc surfaces it. Phase B's first action is a dry-run tsc; if it fails, return to Phase A for the missing interface. |
| Dropping the `include` lines (Phase C) reveals a third `src/main/orchestration/*.ts` file the renderer reaches through that wasn't in the original 4-include workaround. | Phase C's acceptance is `tsc.web` clean WITH the lines dropped. If a file disappears from the program and a referenced type doesn't resolve, tsc surfaces it. Fix is in-bounds for Phase C (add the missing path to `src/shared/types/orchestration.ts` if cross-boundary, or to `tsconfig.web.json` if genuinely needed). |
| W94 Phase E acceptance test (`useDiffReviewTrigger.acceptance.test.tsx`) starts failing. | Phases A, B, C each end with explicit `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx` — boundary check from the wave's constraints, runs in seconds. |
| Phase A's move pushes `src/shared/types/orchestration.ts` past the 300-line ESLint cap. | ADR Decision 1 contemplates this: the planner amends the decision mid-Phase-A to split into `orchestration.ts` + `orchestrationApi.ts`. The split is in-wave, not deferred. Phase A's lint check catches it. |

## Test coverage by phase

| Phase | Unit | Integration | Notes |
|---|---|---|---|
| 0 | n/a | n/a | ADR + inventory only. No code. |
| A | n/a | n/a | Pure type relocation + re-export. Coverage = `tsc.node` + `tsc.web` (with includes still in place) + `npm run test:main` scoped + `npm run test:orchestration` scoped + W94 acceptance test. No new unit tests. |
| B | n/a | n/a | Renderer single-file edit. Coverage = `tsc.web` + `npm run test:renderer` scoped + W94 acceptance test. |
| C | n/a | n/a | tsconfig edit. Coverage = `tsc.web` WITHOUT the include lines + `tsc.node` + `npm run test:renderer` scoped + W94 acceptance test. The "test" for this phase is the absence of TypeScript errors when the includes are gone. |
| D | full vitest | full vitest | Standard wave-wrap full suite. |

Test shape rationale: **pyramid**. Pure type-only refactor, no behavior change, no new logic. Honeycomb would be overkill — the boundary IS the type system, and tsc is the boundary-level "test" for type code. The wave does NOT touch a new architectural surface — walking-skeleton rule does not fire. No orchestrator-authored failing acceptance test required (no behavioral boundary changes — `OrchestrationAPI`'s shape doesn't change, only its file location).

## Acceptance criteria

- [ ] `src/shared/types/orchestration.ts` exports `OrchestrationAPI`, `OrchestrationEvent`, `OrchestrationEventBase`, `OrchestrationStateChangedEvent`, `OrchestrationProviderProgressEvent`, `OrchestrationVerificationUpdatedEvent`, `OrchestrationSessionUpdatedEvent`, `OrchestrationTaskResultEvent`, `ProviderCapabilities`, `ProviderProgressEvent`, `ProviderContentBlockDelta`, `TokenUsage`, `VerificationStep`, `VerificationProfile`.
- [ ] `src/main/orchestration/typesProvider.ts` contains ZERO `export interface` or `export type {...}` of its own definitions — it is a pure re-export shim from `@shared/types/orchestration`, matching the shape of `typesContext.ts` and `typesDomain.ts`. (Local `import type` statements are fine if used internally; the file just doesn't *define* anything new.)
- [ ] `src/renderer/types/electron-orchestration.d.ts` line 1-5 imports from `'@shared/types/orchestration'`, not `'../../main/orchestration/types'`. `grep -n "main/orchestration/types" src/renderer/types/electron-orchestration.d.ts` returns 0 matches.
- [ ] `tsconfig.web.json` `include` array contains NO `src/main/orchestration/*` entries. `grep -n "main/orchestration" tsconfig.web.json` returns 0 matches.
- [ ] `npx tsc --noEmit -p tsconfig.web.json` exits 0 with the include lines dropped.
- [ ] `npx tsc --noEmit -p tsconfig.node.json` exits 0.
- [ ] `npm test` (full vitest suite) exits 0 at wave wrap.
- [ ] `npm run lint` exits 0 at wave wrap.
- [ ] `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx` passes 5/5 at every phase boundary AND at wave wrap.
- [ ] CHANGELOG has a `[2.19.3]` entry summarizing the wave.
- [ ] `package.json` version is `2.19.3`.
- [ ] Local tag `v2.19.3` exists at the wave's tip commit. (Not pushed.)
- [ ] `/review` returns PASS (or FLAG with all flags addressed) for the wave's aggregate diff.
- [ ] `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md` is marked RESOLVED and moved to `roadmap/_archived/follow-ups/` by the `/audit-followups` step.

## Verification

### Per-phase experiential observation

| Phase | Observation point | Path to it | What "working" looks like there |
|---|---|---|---|
| 0 | Internal — no observation point | n/a | ADR file updated with concrete interface list (≤14 names) and `providers/` deep-import check result. No runtime impact. |
| A | Agent task panel in a running dev IDE → click "Start Task" on any task | `electron-vite dev` → main loads `typesProvider.ts` (now shim re-exporting from shared) → `orchestrationAPI.startTask` invoked via IPC → preload bridges → renderer's `useOrchestrationAPI` consumes the same `OrchestrationAPI` shape (now resolved from `@shared`) → task panel updates with `OrchestrationStateChangedEvent` → first state transition visible in panel | Task starts, panel transitions from `idle` → `preparing_context` → `executing` → `completed` (or the wave's normal lifecycle). No "undefined" callback errors. The provider progress events stream into the panel as before. The user can't tell which side owns the type — that's the point. |
| B | Same observation point as Phase A | `electron-vite dev` → renderer's `electron-orchestration.d.ts` now resolves `OrchestrationAPI` from `@shared/types/orchestration` (one less hop through main's barrel) → `useOrchestrationAPI` typechecks → task panel renders | Identical user-perceivable behavior to Phase A. The renderer's type graph no longer reaches into `src/main/`. |
| C | Pre-push hook on a `git push --dry-run` (or, equivalently, manual run of `scripts/hooks/pre_push_full_check.mjs`) | local commits → pre-push hook runs `tsc -p tsconfig.web.json` full-project → exits 0 → hook permits push | The pre-push hook stays green and silent. The 4 `src/main/orchestration/*` lines are absent from `tsconfig.web.json` and tsc still resolves every renderer-side reference. Cole can push (when minutes restore) without `--no-verify`. |
| D | Internal — wave wrap | n/a | All gates green; HANDOFF reflects new state; result brief lives at `roadmap/wave-98-orchestration-types-relocation/wave-98-result.md`. |

### Data-shape probes

```bash
# Probe 1: shared module exports the canonical interfaces
grep -nE "^export (interface|type) (OrchestrationAPI|OrchestrationEvent|ProviderCapabilities|ProviderProgressEvent|VerificationProfile)" src/shared/types/orchestration.ts
# expect: at least 5 matches (one per name)

# Probe 2: typesProvider.ts is a pure re-export shim — no local definitions
grep -nE "^export (interface|type [A-Z][a-zA-Z]+ = (?!\{))" src/main/orchestration/typesProvider.ts
# expect: zero matches (no local interface defs, no local non-aliased type defs)
# (Re-export lines `export type { ... } from '@shared/...'` are fine — they're not local definitions)

# Probe 3: renderer no longer reaches into main for orchestration types
grep -n "main/orchestration/types" src/renderer/types/electron-orchestration.d.ts
# expect: zero matches

# Probe 4: tsconfig.web.json no longer includes src/main/orchestration/*
grep -n "main/orchestration" tsconfig.web.json
# expect: zero matches

# Probe 5: full-project tsc clean (both)
npx tsc --noEmit -p tsconfig.web.json && echo "WEB-OK"
npx tsc --noEmit -p tsconfig.node.json && echo "NODE-OK"
# expect: both OK

# Probe 6: W94 boundary acceptance test
npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx
# expect: 5/5 pass

# Probe 7: Phase 0 inventory captured (gate check before Phase A dispatch)
grep -A 20 "^## Decision 1" roadmap/wave-98-orchestration-types-relocation/wave-98-decisions.md | grep -c "^- \`"
# expect: ≥10 (the moved interface list materialized in the ADR before Phase A)
```

## Files the next agent should read first

1. `roadmap/wave-98-orchestration-types-relocation/wave-98-decisions.md` — this wave's ADR with the 5 locked decisions.
2. `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md` — original follow-up that filed this wave. Note: its scope estimate (~60 types) was wrong; this plan's Context section explains why.
3. `src/main/orchestration/typesProvider.ts` (220 lines) — primary extraction source. The ~10 main-side interface definitions live at lines 40-219.
4. `src/main/orchestration/typesContext.ts` (25 lines) and `typesDomain.ts` (46 lines) — already pure re-export shims. **Reference shape** for what `typesProvider.ts` becomes after Phase A.
5. `src/renderer/types/electron-orchestration.d.ts` (78 lines) — primary renderer re-point site (Phase B). Lines 1-5 are the named import; lines 7-66 the bulk re-export list.
6. `src/shared/types/orchestration.ts` — destination file. Phase A extends it. If it exceeds 300 lines after extension, Phase A splits per ADR Decision 1.
7. `tsconfig.web.json` lines 30-33 — the 4 `include` lines Phase C drops.
8. `roadmap/wave-97-shared-types-extraction/waveplan-97.md` — reference shape. This wave mirrors W97's structure (Phase 0 inventory → single sonnet-implementer dispatch → renderer re-point → wrap).
9. `roadmap/wave-97-shared-types-extraction/wave-97-result.md` — W97's wrap brief. Quote the "process lessons" section for what worked.
10. `~/.claude/notes/wave-process.md` — wave structure + per-phase gate discipline reference.

## Note to the implementer

This is a type-only refactor with zero behavior change. The wave's spirit is "sever the renderer's last reach into `src/main/`"; everything else is in service of that. Don't expand scope to rename interfaces, reshape `OrchestrationAPI`, or simplify the event union. The `typesProvider.ts` header comment classified these as "main-process-only" — that classification was wrong, but correcting the classification doesn't license redesigning the surface itself.

Temptations to resist:

- "While we're moving `OrchestrationAPI`, let's also flatten the `OrchestrationEvent` union into a single shape." No. Shape preservation is the wave's core constraint.
- "Phase 0 inventory found 14 interfaces; let's also move the few that the renderer *doesn't* reach, for consistency." No. Server-only types stay in main. Only renderer-reaching ones move.
- "Let's collapse the three shim files (`typesContext.ts`, `typesDomain.ts`, `typesProvider.ts`) into one." No. The barrel structure is load-bearing for main-side import paths. Future wave with a behavioral reason.
- "Phase B is just a one-line edit; let me bundle it with Phase A." No. Each phase is a commit; the bisect surface stays clean. Separate commits even when adjacent.
- "Phase C is just removing 4 lines; bundle with Phase B." Same answer. The architectural payoff (renderer no longer reaches main) is its own observable commit.

If Phase 0's inventory surfaces something unexpected — a `src/main/orchestration/providers/*` file deep-imports an interface this wave moves via a path the barrel doesn't cover, or `src/shared/types/orchestration.ts` already has a clashing name — file a Tier 3 follow-up and stop. Don't reshape the wave mid-flight.

Before declaring a phase complete, restate the observation point from the Verification table in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Orchestrator dispatch checklist

> A green gate with nothing Tier 3 means the orchestrator dispatches the next phase in the same turn. The turn ends between phases ONLY for: a Tier 3 discovery that needs a user call, a genuine user-judgment decision the plan doesn't determine, or wave-end. See the Phase-boundary protocol in `~/.claude/notes/wave-process.md`.

1. **Verify ADR exists** at `roadmap/wave-98-orchestration-types-relocation/wave-98-decisions.md` with Decisions 1-5 RESOLVED. If Decision 1's interface list is a stub placeholder, Phase 0 runs to populate it.

2. **Phase 0** — `orchestrator` runs the grounding survey:
   - Re-read `src/main/orchestration/typesProvider.ts` lines 40-219. Enumerate every `export interface` and `export type X =` declaration. Materialize the list in ADR Decision 1.
   - Read `src/renderer/types/electron-orchestration.d.ts` lines 1-66. Identify every name pulled from `'../../main/orchestration/types'`. Cross-reference with the ADR Decision 1 list — every renderer-reaching name must be in the list.
   - Dispatch `haiku-explorer` (quick) to grep `src/main/orchestration/providers/` for any file deep-importing from `./typesProvider` (bypassing the `./types` barrel). If any are found, append them to ADR Decision 2 consequences — they'll need to keep working through the shim.
   - **Gate to advance:** ADR Decision 1 list materialized AND list size ≤14 AND providers deep-import check complete. If list size > 14, end turn for user judgment on scope.

3. **Phase A** — dispatch `sonnet-implementer` with brief:
   > Move the interfaces enumerated in ADR Decision 1 from `src/main/orchestration/typesProvider.ts` to `src/shared/types/orchestration.ts`. Each interface preserves its exact field shape, JSDoc, and inline comments. Update `typesProvider.ts` to import + re-export each from `@shared/types/orchestration` under the same name (matching `typesContext.ts`/`typesDomain.ts` shim shape). Run `npx tsc --noEmit -p tsconfig.node.json` AND `npx tsc --noEmit -p tsconfig.web.json` AND `npm run test:main` AND `npm run test:orchestration` AND `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`; all must exit 0. If `src/shared/types/orchestration.ts` exceeds the 300-line ESLint cap after move, split into `orchestration.ts` + `orchestrationApi.ts` per ADR Decision 1. Report DONE with command results.
   - **Gate to advance:** Both tsc projects exit 0 AND test:main passes AND test:orchestration passes AND W94 acceptance test 5/5 AND orchestrator diff review fine AND `sonnet-phase-reviewer` pass on the diff against this brief + ADR Decision 1/2 returns no blocking findings (Phase A is flagged conceptually-risky — the orchestration API + event types are the IPC surface contract).

4. **Phase B** — dispatch `sonnet-implementer` with brief:
   > In `src/renderer/types/electron-orchestration.d.ts`, change the imports at lines 1-5 and the bulk re-export at lines 7-66 from `'../../main/orchestration/types'` to `'@shared/types/orchestration'`. Make ZERO other changes to the file — same imported names, same re-exported names, same `OrchestrationAPI extends MainOrchestrationAPI` extension at lines 68-71 (just sourcing `MainOrchestrationAPI` from `@shared` now). Run `npx tsc --noEmit -p tsconfig.web.json` AND `npm run test:renderer` AND `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`; all must exit 0. Report DONE.
   - **Gate to advance:** tsc.web exits 0 (with `include` lines still in place) AND test:renderer passes AND acceptance test 5/5 AND orchestrator diff review fine.

5. **Phase C** — dispatch `sonnet-implementer` with brief:
   > In `tsconfig.web.json`, remove the 4 lines at `include` array positions referencing `src/main/orchestration/types.ts`, `typesContext.ts`, `typesDomain.ts`, `typesProvider.ts`. Make ZERO other changes to the file. Run `npx tsc --noEmit -p tsconfig.web.json` AND `npx tsc --noEmit -p tsconfig.node.json` AND `npm run test:renderer` AND `npx vitest run src/renderer/hooks/useDiffReviewTrigger.acceptance.test.tsx`; all must exit 0. If `tsc.web` reports any new errors, STOP and report — do not restore the lines as a workaround. Report DONE.
   - **Gate to advance:** Both tsc projects exit 0 AND test:renderer passes AND acceptance test 5/5 AND orchestrator diff review fine.

6. **Phase D (wrap)** — orchestrator runs:
   - `npm run lint` (full) — exit 0.
   - `npx tsc --noEmit -p tsconfig.web.json && npx tsc --noEmit -p tsconfig.node.json` — both exit 0.
   - `npm test` (full vitest) — exit 0. (~17 min Windows-local; run in background.)
   - `/review` mechanical gap-check. PASS or FLAG-with-flags-addressed.
   - Write `roadmap/wave-98-orchestration-types-relocation/wave-98-result.md`.
   - Update `CHANGELOG.md` with `[2.19.3] - 2026-MM-DD` entry.
   - Bump `package.json` version to `2.19.3`.
   - Commit wave wrap. `git tag v2.19.3`.
   - Run `/promote-vendor-lessons 98` (no-op — no vendor SDK touched).
   - Run `/audit-followups wave-98-orchestration-types-relocation`. The audit should mark `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md` as RESOLVED and move it to `roadmap/_archived/follow-ups/`.
   - Update `roadmap/HANDOFF.md` and append a row to `roadmap/wave-temperature-log.md`.
   - **Do NOT push.** Bulletin: GH Actions minutes held until 2026-06-01. Cole pushes manually when minutes restore.
   - **Gate to close wave:** all gates green AND HANDOFF reflects new state.

UI smoke gate does NOT fire — no `src/renderer/components/Layout/**` changes in this wave. (Phases B touches `src/renderer/types/` only; not UI surface.)
