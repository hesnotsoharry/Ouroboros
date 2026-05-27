---
status: OPEN
created: 2026-05-27
updated: 2026-05-27
wave: 100
phase: F
---

# Wave 100 Phase F: Shared Orchestration Types — Deferred Deletion

## Context

Phase F attempted to delete `@shared/types/orchestration*.ts` and `@shared/ipc/orchestrationChannels.ts` per the plan. Investigation revealed live non-chat consumers that block full deletion.

## Unexpected live consumers found

1. **`src/main/configDefaults.ts:24`** — imports `OrchestrationProvider`, `VerificationProfileName` from `@shared/types/orchestrationDomain`. Used as `satisfies` constraints on default arrays (lines 63, 69). Both types are simple string-union aliases (`'claude-code' | 'codex' | 'anthropic-api'` and `'fast' | 'default' | 'full'`).

2. **`src/main/rulesAndSkills/rulesReader.ts:3`** — imports `OrchestrationProvider` from `@shared/types/orchestrationDomain`. Used as parameter type on `applyRulesToProvider` function (line 69).

3. **`src/main/ptyOutputBuffer.ts:17`** — imports `TerminalSessionSnapshot` from `./orchestration/types` (local barrel). That barrel re-exports from `@shared/types/orchestration`. The original definition is in `configTypes.ts`.

4. **`src/renderer/components/ContextBuilder/`** — uses `ContextPacket`, `RankedContextFile`, `OmittedContextCandidate`, `TaskRequestContextSelection`, `ContextBudgetSummary` from `electron-orchestration.d.ts`. `ContextBuilder` is live-mounted in `CentrePaneConnected.parts.tsx:14`.

## What was done in Phase F

- `electron-orchestration.d.ts` was kept but stripped to type-only re-exports (no `OrchestrationAPI` interface, no `orchestration` property on `ElectronAPI`).
- `@shared/ipc/orchestrationChannels.ts` was deleted (its only consumers were the deleted `electron-orchestration.d.ts:77` and `preloadSupplementalApis.ts:1`).
- `src/main/orchestration/types.ts` barrel + `typesContext.ts` / `typesDomain.ts` / `typesProvider.ts` were NOT deleted.
- `@shared/types/orchestration*.ts` files were NOT deleted.

## Proposed resolution (Phase H or dedicated cleanup)

1. **For `configDefaults.ts` + `rulesReader.ts`**: inline `OrchestrationProvider = 'claude-code' | 'codex' | 'anthropic-api'` and `VerificationProfileName = 'fast' | 'default' | 'full'` directly, then delete `orchestrationDomain.ts`.

2. **For `ptyOutputBuffer.ts`**: change import from `./orchestration/types` to `../../configTypes` (where `TerminalSessionSnapshot` is originally defined), then delete the `orchestration/types*.ts` barrel chain.

3. **For `ContextBuilder/`**: either delete the entire `ContextBuilder/` component (it renders chat context UI — fully dead without chat IPC), or if it serves a surviving use case, keep `electron-orchestration.d.ts` as type-only re-exports.

4. After (1-3): delete `@shared/types/orchestration.ts` barrel, `orchestrationApi.ts`, `orchestrationContext.ts`, `orchestrationProvider.ts`; delete `orchestration/types.ts` + `typesContext.ts` + `typesDomain.ts` + `typesProvider.ts`.

## Files to delete when resolved

- `src/shared/types/orchestration.ts`
- `src/shared/types/orchestrationApi.ts`
- `src/shared/types/orchestrationContext.ts`
- `src/shared/types/orchestrationDomain.ts`
- `src/shared/types/orchestrationProvider.ts`
- `src/main/orchestration/types.ts`
- `src/main/orchestration/typesContext.ts`
- `src/main/orchestration/typesDomain.ts`
- `src/main/orchestration/typesProvider.ts`
- `src/renderer/types/electron-orchestration.d.ts` (after ContextBuilder is removed)
