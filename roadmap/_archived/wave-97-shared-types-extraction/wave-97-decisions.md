---
status: DRAFT
created: 2026-05-19
updated: 2026-05-19
wave: 97
slug: shared-types-extraction
---

# Wave 97 — Architecture Decisions

## Decision 1: Module location for extracted CLI settings

**Context:** Wave 96 deferred a structural fix for the renderer/main
`ClaudeCliSettings` drift by syncing the duplicate definition in place.
W97 needs a canonical home for CLI-settings interfaces. The candidates
are: one file per CLI integration (`claudeCli.ts`, `codexCli.ts`, …), or
one consolidated `configSlices.ts`.

**Options considered:**
- *Industry standard:* one file per slice family — common in monorepo
  shared-types packages (e.g., `@redux/toolkit/src/types/`). Clean
  per-domain ownership.
- *Emerging best practice:* one file per public type, barrel re-export
  (TypeScript "isolatedDeclarations" era pattern). Good for very large
  type libraries.
- *Project convention:* one file per slice family, scoped by domain —
  `src/shared/types/agentChat.ts`, `layout.ts`, `auth.ts`. Each file
  holds multiple closely-related interfaces. Files stay under the
  300-line ESLint limit and split when they grow.

**Pick:** Project convention — single `src/shared/types/configSlices.ts`.
*Tier: industry-aligned, matches in-repo precedent.*

**Rationale:** The existing `src/shared/types/` directory has 24 files
following a "slice family per file" convention. Adding a new file
`configSlices.ts` matches the precedent. The total CLI-settings surface
is small (≤ 6 interfaces, probably < 200 lines) — a one-file-per-CLI
split would be premature partitioning with no payoff.

**Consequences:**
- Future waves adding new CLI integrations (e.g., a hypothetical `geminiCli`)
  add their interface to `configSlices.ts`.
- If `configSlices.ts` exceeds 300 lines, split per-CLI as a follow-up
  refactor wave. The ESLint limit is the natural trigger.

---

## Decision 2: Import-path stability for main-side consumers

**Context:** `src/main/configAppTypes.ts` (re-exported by
`src/main/configTypes.ts`) is imported from 30+ call sites across
`src/main/`. Moving the interface definitions to `src/shared/` could be
done two ways: (a) hard rename — all consumers update to
`from '@shared/types/configSlices'`; (b) re-export from
`configAppTypes.ts` — consumers keep working unchanged.

**Options considered:**
- *Industry standard:* big-bang rename — single commit flips every
  consumer to the new path. Clear final state, larger blast radius.
- *Emerging best practice:* re-export shim during transition, sweep
  consumers in follow-up waves. Smaller per-wave blast radius.

**Pick:** Re-export shim. *Tier: emerging best practice for monorepo
type migrations.*

**Rationale:** This wave's success is defined by tsc-clean and zero
behavior change. A 30-file consumer sweep would dominate the wave's
diff and add review burden with no functional payoff. Re-exports are
type-only and zero-cost at runtime. Future waves can opportunistically
flip individual consumers to the shared path as they're touched for
other reasons.

**Consequences:**
- `src/main/configAppTypes.ts` becomes a re-export barrel for the moved
  interfaces. Its line count drops slightly (the interface bodies move
  out) but its role as the main-side import surface is preserved.
- The renderer's `electron-foundation.d.ts` imports directly from
  `@shared/types/configSlices` (not via main) — clean separation.
- Future cleanup: a "flip main consumers to shared paths" follow-up
  could land in a quiet wave. Not scheduled.

---

## Decision 3: Orchestration symbol scope — inventory-gated

**Status:** RESOLVED 2026-05-19 (Phase 0 inventory).

**Context:** The W96 ADR estimated "~40 orchestration domain types"
needing relocation. The codebase already has
`src/shared/types/orchestrationDomain.ts` and
`src/shared/ipc/orchestrationChannels.ts`, so some relocation has
already happened. The actual W97 scope is "whatever's still in
`src/main/orchestration/{types,events.ts}` that the renderer
transitively imports."

**Options considered:**
- *Move everything:* All exports of `src/main/orchestration/types.ts`
  and `events.ts` relocate. Largest blast radius; risks moving
  server-only internals that have no business being in shared.
- *Move only what's needed:* Inventory which symbols the renderer
  imports. Move only those. Minimal blast radius, surgically targeted.
- *Move nothing this wave:* If inventory shows zero renderer-reaching
  symbols still in main (W96 may have already routed them through
  `@shared/ipc/orchestrationChannels`), Phase B becomes a documentation
  update only.

**Pick:** Move only what's needed (inventory-gated). *Tier: industry
standard for scoped type migrations.*

**Rationale:** A type extraction's blast radius should match the
coupling problem it solves. The W96 ADR named "~40 types" but the W96
fix was narrow (3 channel types via direct shared-import). The actual
remaining renderer-reaching surface is probably smaller than 40.
Phase 0 inventory determines exact scope. If the count is zero, Phase B
is a no-op and that's a clean outcome.

**Phase 0 inventory (2026-05-19):**
- **CLI-settings interface families to move (cap ≤ 6): 2.** `ClaudeCliSettings`
  (15 fields, `src/main/configTypes.ts:97-126`) and `CodexCliSettings`
  (9 fields, `src/main/configTypes.ts:128-147`). No other `*CliSettings`
  interfaces exist in the main config tree. `NotificationSettings`,
  `RouterSettings`, etc. are different-domain config slices, out of
  scope for this wave.
- **Renderer-reaching orchestration symbols still in main (cap ≤ 10):
  ~60. Exceeds cap.** `src/renderer/types/electron-orchestration.d.ts`
  re-exports ~60 types from `../../main/orchestration/types` (which is
  itself a barrel re-exporting `typesContext.ts` + `typesDomain.ts` +
  `typesProvider.ts`). However, these are NOT duplicated — there is no
  drift problem (unlike `ClaudeCliSettings`, which had two definitions).
  `tsconfig.web.json` already explicitly includes the 4
  `src/main/orchestration/*.ts` type-only files (lines 30-33), so the
  renderer's type imports resolve cleanly under DOM lib today. `tsc -p
  tsconfig.web.json` is currently 0 errors.
- **Phase B verdict: NO-OP.** Per the plan's explicit allowance ("the
  renderer is allowed to keep importing from main even if that file
  re-exports from main; the wave's success criterion is `tsc -p
  tsconfig.web.json` clean, not 'every orchestration type lives in
  shared'") and Cole's autonomous-run authorization, orchestration
  relocation defers to a dedicated future wave focused on architectural
  cleanliness (renderer-shouldn't-reach-into-main rule) with budget for
  the ~60-symbol blast radius. Filed as follow-up
  `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md`
  during Phase D wrap.
- **`@shared/*` alias verification: PRESENT in both tsconfigs.**
  `tsconfig.web.json:20` and `tsconfig.node.json:20`. No alias addition
  required in Phase A.

**Consequences:**
- Server-only orchestration internals stay in `src/main/orchestration/`.
  This is correct — shared types should be the renderer/main interface
  surface, not the union of every typed value in the system.
- The renderer's `electron-orchestration.d.ts` continues to import from
  `../../main/orchestration/types` after this wave. The 4-file explicit
  `include` in `tsconfig.web.json` stays.
- Phase B becomes documentation-only: ADR consequences captured here,
  follow-up filed at wave wrap. No code change in Phase B.
- Wave 97 ships the actual W96-blocker fix (single canonical
  `ClaudeCliSettings`) and leaves orchestration cleanup as a
  surgically-scoped future wave.

---

## Decision 4: Renderer-local `ClaudeCliSettings` — delete outright

**Context:** W96 added a standalone `interface ClaudeCliSettings` block
to `src/renderer/types/electron-foundation.d.ts` as a "drift-prone
stopgap until W97" (its words). W97 has two options for cleanup:
deprecate-then-delete (leave the block, mark deprecated, sweep
consumers, delete in a future wave) or delete outright.

**Options considered:**
- *Deprecate-then-delete:* Standard pattern for public-API removal.
  Two-wave rollout: mark `@deprecated`, sweep consumers, delete next
  wave.
- *Delete outright:* The renderer-local definition is internal — no
  external consumer. The "consumer" is `useClaudeCliSettings.ts`,
  updated in this same wave's Phase C.

**Pick:** Delete outright. *Tier: industry standard for internal-only
type removal.*

**Rationale:** Deprecate-then-delete is the right pattern when external
consumers might depend on the surface. Here the surface is
internal — a single renderer-side type alias with one importing hook.
Phase C updates both in the same commit. Parallel definitions add
confusion (which `ClaudeCliSettings` does this file import?) with zero
migration value.

**Consequences:**
- The W96 gotcha entry in `src/renderer/types/CLAUDE.md` is removed in
  the same Phase C commit. No "dangling" gotcha references after wave
  wrap.
- If anything outside this wave's scope happens to import the
  renderer-local definition (unlikely — the file is `.d.ts` so it would
  be type-only and tsc would catch it), tsc fails the gate and the
  failure is in-bounds for Phase C to fix.

---

## Decision 5: Semver tier — patch

**Context:** Wave-final release tag needs a version. Choices: patch
(`v2.19.2`), minor (`v2.20.0`), major (`v3.0.0`).

**Options considered:**
- *Patch:* bug fixes / internal refactors / pure type correctness.
- *Minor:* new features, new public API surface.
- *Major:* breaking changes.

**Pick:** Patch — `v2.19.2`. *Tier: industry standard semver.*

**Rationale:** W97 is pure type-only refactor. Zero runtime behavior
change, zero public API rename, zero new feature surface. Patch tier
precisely matches the change category.

**Consequences:**
- CHANGELOG entry under `[2.19.2]` headed "Internal type-coupling
  cleanup — no user-visible change."
- Push held until 2026-06-01 (bulletin). Local commit + tag only this
  wave. When push restores, `v2.19.0`, `v2.19.1`, `v2.19.2` go together.
