---
status: OPEN
created: 2026-05-19
updated: 2026-05-19
source: wave-97-shared-types-extraction Phase 0 inventory
---

# Orchestration domain types still owned by main/

## Context

Wave 97's goal was to eliminate cross-process type-coupling drift. Phase 0 inventory found two distinct surfaces:

1. **`ClaudeCliSettings` + `CodexCliSettings`** — duplicated between renderer and main (W96's stopgap). Real drift problem. **Resolved in Wave 97.**
2. **~60 orchestration domain types** (`OrchestrationAPI`, `TaskRequest`, `ContextPacket`, `ProviderCapabilities`, `VerificationSummary`, etc.) — owned by `src/main/orchestration/{typesContext,typesDomain,typesProvider}.ts`, imported by `src/renderer/types/electron-orchestration.d.ts` via the barrel at `src/main/orchestration/types.ts`. **NOT duplicated.** Single owner, single source of truth.

The Wave 97 inventory cap (≤10 renderer-reaching symbols) was exceeded (~60). Per ADR Decision 3, this wave deferred (b/c no drift; tsc.web clean today thanks to explicit `tsconfig.web.json` includes of the 4 type-only files).

## Why this is still worth doing eventually

Architectural cleanliness rule: renderer shouldn't reach into `src/main/`. Today it works because:
- `tsconfig.web.json:30-33` explicitly `include`s `src/main/orchestration/types.ts`, `typesContext.ts`, `typesDomain.ts`, `typesProvider.ts`.
- These four files are pure `interface` / `type` declarations — no runtime values, no main-only dep imports.

That's a load-bearing workaround. The cleaner shape:

```
src/shared/types/orchestration/  (or extend src/shared/types/orchestrationDomain.ts)
  ├── context.ts       (was main/orchestration/typesContext.ts)
  ├── domain.ts        (was main/orchestration/typesDomain.ts)
  └── provider.ts      (was main/orchestration/typesProvider.ts)

src/main/orchestration/types.ts   (becomes pure re-export barrel from @shared/types/orchestration)
```

After the move, the explicit `tsconfig.web.json` `include` lines for `src/main/orchestration/*.ts` can be dropped.

## Scope

- **Estimated files to move:** 3 (`typesContext.ts`, `typesDomain.ts`, `typesProvider.ts`).
- **Symbol count:** ~60 exports across the three.
- **Main-side consumer surface:** grep `from './types'` AND `from './typesDomain'|typesContext|typesProvider` across `src/main/orchestration/` — the barrel pattern means most consumers shouldn't need changes.
- **Renderer-side consumer:** `electron-orchestration.d.ts` — switches imports from `../../main/orchestration/types` → `@shared/types/orchestration` (or the barrel).
- **tsconfig.web.json cleanup:** remove the 4 explicit `include` lines.

## Constraints

- Each of the 3 files must remain pure types (no value imports, no main-only deps) for the move to be cheap. Phase 0 of any future wave that picks this up should verify by reading each file's import block.
- The boundary contract — `useDiffReviewTrigger.acceptance.test.tsx` from Wave 94 Phase E — must still pass 5/5.

## Recommended approach

A small dedicated wave (likely 2-3 phases, ~1 day) focused exclusively on this relocation. Pattern matches Wave 97's mechanical-refactor shape: read-only Phase 0 inventory, single sonnet-implementer dispatch for the move, wrap.
