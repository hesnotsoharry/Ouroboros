---
status: DRAFT
created: 2026-05-20
updated: 2026-05-20
wave: 98
slug: orchestration-types-relocation
---

# Wave 98 — Architecture Decisions

## Decision 1: Destination module for the moved interfaces

**Context:** ~10 interfaces currently in `src/main/orchestration/typesProvider.ts` (and classified there as "main-process-only" in that file's header comment) are actually consumed by the renderer through `src/renderer/types/electron-orchestration.d.ts`. They need a canonical home outside `src/main/`.

Two viable destinations:
- Extend the existing `src/shared/types/orchestration.ts` (its sibling cross-boundary types already live there).
- Create a peer file `src/shared/types/orchestrationApi.ts` (the OrchestrationAPI + event union are the IPC surface contract; arguably a distinct concern from raw domain types).

**Options considered:**
- *Industry standard:* one file per cohesive type family — separate IPC API + event-union from domain primitives. Mirrors how mature codebases split contract surface from data surface (e.g., tRPC's `router.ts` vs `types.ts`).
- *Emerging best practice:* extend the existing shared file; lean on tooling (ESLint `max-lines: 300`) to force a split only when the file genuinely outgrows itself.
- *Experimental:* full barrel-rebuild via a generated index file; overkill for a 10-interface move.

**Pick:** Extend `src/shared/types/orchestration.ts` (emerging best practice). If after the move the file exceeds the 300-line ESLint cap, Phase A splits at that point into `orchestration.ts` + `orchestrationApi.ts`.

**Rationale:** matches W97's pattern (`configSlices.ts` consolidated, not pre-split). Avoids premature segmentation. The orchestration domain types and the orchestration API share enough referenced symbols (`TaskRequest`, `TaskResult`, `ProviderSessionReference`) that splitting would force cross-file imports the consumers don't currently need.

**Consequences:** if Phase A surfaces the 300-line cap, the planner amends Decision 1 mid-wave to a split. The split (if needed) lives in this wave, not deferred.

**Locked interface list (Phase 0 inventory, 2026-05-20):** all 14 form a closed reference graph — moving any subset breaks `tsc`, so they move together.

- `ProviderCapabilities` (`typesProvider.ts:42`)
- `TokenUsage` (`typesProvider.ts:54`)
- `ProviderContentBlockDelta` (`typesProvider.ts:66`)
- `ProviderProgressEvent` (`typesProvider.ts:104`) — references `ProviderContentBlockDelta`, `TokenUsage`
- `VerificationStep` (`typesProvider.ts:121`)
- `VerificationProfile` (`typesProvider.ts:130`) — references `VerificationStep`
- `OrchestrationEventBase` (`typesProvider.ts:139`) — generic base for all 5 event variants
- `OrchestrationStateChangedEvent` (`typesProvider.ts:146`)
- `OrchestrationProviderProgressEvent` (`typesProvider.ts:150`) — references `ProviderProgressEvent`
- `OrchestrationVerificationUpdatedEvent` (`typesProvider.ts:154`)
- `OrchestrationSessionUpdatedEvent` (`typesProvider.ts:158`)
- `OrchestrationTaskResultEvent` (`typesProvider.ts:162`)
- `OrchestrationEvent` (`typesProvider.ts:166`, union) — references events 8-12 above
- `OrchestrationAPI` (`typesProvider.ts:173`) — references `ProviderProgressEvent`, `TaskRequest`, and many shared types via inline `import('@shared/types/orchestration')`

Renderer reaches 12 of 14 directly via `electron-orchestration.d.ts`. The remaining 2 (`OrchestrationEventBase`, `ProviderContentBlockDelta`, `TokenUsage`) are nested-reference only — they ride with the closure.

## Decision 2: Main-side import-path stability

**Context:** `typesProvider.ts` is currently imported by many main-side modules via barrel `from './types'` (which re-exports `from './typesProvider'`). After the move, those imports must keep resolving.

**Options considered:**
- *Industry standard:* turn `typesProvider.ts` into a pure re-export shim from `@shared/types/orchestration` (mirrors what `typesContext.ts` and `typesDomain.ts` already do).
- *Alternative:* delete `typesProvider.ts` outright and update every main-side consumer's import path.

**Pick:** Re-export shim (industry standard, matches the established pattern in the same directory).

**Rationale:** the two sibling files (`typesContext.ts`, `typesDomain.ts`) are already shims. Consistency with the established pattern. Future waves can flip main-side consumers off the shim opportunistically; this wave doesn't pay a cross-codebase rename cost for a type-only refactor. Same call as W97 Decision 2.

**Consequences:** the directory keeps three re-export shims (now consistent across all three). A future wave can collapse them when there's a behavioral reason.

**Phase 0 deep-import check (2026-05-20):** `haiku-explorer` swept `src/main/orchestration/providers/` (70 files) plus `src/main/orchestration/` (1 level, non-recursive) for any direct imports from `./typesProvider`, `./typesContext`, or `./typesDomain` bypassing the `./types` barrel. **Zero matches.** Every main-side consumer goes through the barrel, so the shim approach preserves every existing import path with zero consumer renames.

## Decision 3: Renderer re-pointing — exact target

**Context:** `electron-orchestration.d.ts` currently imports/re-exports from `'../../main/orchestration/types'`. After Phase A, the canonical home is `@shared/types/orchestration`.

**Options considered:**
- Re-point to `@shared/types/orchestration` directly (the canonical path).
- Route through the renderer-side `electron.d.ts` barrel if that's the project convention.

**Pick:** Re-point directly to `@shared/types/orchestration`.

**Rationale:** `src/renderer/types/CLAUDE.md` says "Import from `electron.d.ts` only — never import directly from sub-files in renderer code." But that rule applies to **renderer code** consuming the types — `electron-orchestration.d.ts` IS one of those sub-files; it's a producer, not a consumer. Producers reach into `@shared` directly. Matches what `electron-agent-chat.d.ts` does today (also pulls from a cross-boundary canonical path).

**Consequences:** none. `@shared/*` path alias is already configured in `tsconfig.web.json:18-21`.

## Decision 4: `tsconfig.web.json` cleanup timing

**Context:** Lines 30-33 of `tsconfig.web.json` explicitly `include` four files from `src/main/orchestration/`. They exist because the renderer's `electron-orchestration.d.ts` imports from `../../main/orchestration/types`. Once the renderer reaches `@shared/types/orchestration` instead, those `include`s become dead.

**Options considered:**
- Drop the 4 lines in Phase C (this wave).
- Drop them in a follow-on cleanup wave.

**Pick:** Drop in Phase C (this wave). That's the architectural payoff of the wave — the whole point.

**Rationale:** leaving the workaround behind defeats the purpose of moving the types. `tsc.web` clean WITHOUT the `include`s is the wave's acceptance test.

**Consequences:** if for any reason `tsc.web` regresses after the include removal, the wave fails its primary acceptance and the orchestrator investigates rather than restoring the `include`s as a workaround.

## Decision 5: Semver bump

**Context:** Type-only refactor, no runtime behavior change, no public API rename.

**Pick:** Patch — `v2.19.3`.

**Rationale:** matches W96/W97 precedent for type-only correctness waves.

**Consequences:** no consumer impact; CHANGELOG entry is concise.
