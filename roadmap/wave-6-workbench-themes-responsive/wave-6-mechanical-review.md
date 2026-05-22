# Wave 6 review — mechanical gap check

**Inputs resolved:**
- Plan: `roadmap/wave-6-workbench-themes-responsive/waveplan-6.md`
- Diff range: `398e41fc^..ec8d0a2d` (Phase 1 `398e41fc`, Phase 2 `a74adae6`, Phase 3 `ec8d0a2d`) + uncommitted Phase-4 wrap docs
- Graph: fallback (grep + import-following — findings marked accordingly)
- Run timestamp: 2026-05-22

## Check 1: Forward-trace
- Change sites traced: 9 new/changed symbols
- Paths reaching production consumer: 9
- Paths flagged as dead: 0

New symbols all reach a production consumer (the rendered canon shell / the theme bridge):
- `applyWorkbenchTokenOverrides` (`useTheme.tokens.ts:139`) → called in `applyThemeToDom` (`:301`) → writes CSS vars on `:root` → every glass/panel surface. (fallback trace)
- `Theme.workbenchTokens` field → read as `eff.workbenchTokens` → `applyWorkbenchTokenOverrides`; set by `warp.ts`/`retro.ts`. (fallback trace)
- `CanonWorkbenchToken` type → consumed by `types.ts` + `useTheme.tokens.ts`. 
- `useWorkbenchBreakpoint` (`useWorkbenchBreakpoint.ts`) → called in `Workbench.tsx:120` → drives conditional rail mount + `breakpointMode` prop to `AgentSidebar` (width + Latest Hunk collapse). (fallback trace)
- `WorkbenchBreakpointMode` type → `AgentSidebar` prop.
- `useScanlines` / scanline overlay (`Workbench.tsx`) → rendered when `data-scanlines==="true"`.
- `LatestHunkCollapsed` → rendered by `PanelStack` when `mode !== 'full'`.
- `adaptProject`/`adaptSession` (`UnifiedRail.tsx`) → consumed by the mounted UnifiedRail render.
- `onExpand`/`onCollapse` rail props → wired to `Workbench.tsx` `forceUnified` handlers + the collapse-handle buttons.

No threaded value drops silently; `breakpointMode` is consumed at every fork (Workbench → AgentSidebar → PanelStack `collapsed` → LatestHunkCollapsed).

## Check 2: Plan universal-quantifier cross-reference
- Universals found in plan: 3 ("four untreated themes byte-identical", "absent → fallback stands", "zero new hardcoded hex in renderer components")
- Universals where diff covers all instances: 3
- Universals flagged as narrowed: 0

The "four untreated themes byte-identical" universal is enforced by the frozen preservation guard (`useTheme.tokens.preservation.test.ts`, green). `workbenchTokens` was added ONLY to warp/retro (Modern intentionally none); the four untreated themes have none → fallback path → byte-identity holds. "Zero new hardcoded hex": the one scanline `rgba` carries the `// hardcoded:` pre-commit suppression (canon §15 Retro-only effect); theme-file hex is the sanctioned design-token location.

## Check 3: Export audit
- New exports added: 4 (`CanonWorkbenchToken`, `applyWorkbenchTokenOverrides`, `useWorkbenchBreakpoint`, `WorkbenchBreakpointMode`)
- Exports with production consumers: 4
- Exports flagged as dead: 0

All four are consumed in non-test production code (traced above). No dead exports.

## Check 4: Schema-removal migration safety
- Trigger: **skipped — no schema property removals in this wave's diff.** `git diff --stat 398e41fc^..ec8d0a2d -- src/main` is empty; the wave is renderer-only (ADR D7).

## Check 5: Boundary-phase orchestrator-owned acceptance test verification
- Trigger: **skipped — no cross-boundary phases declared in this wave plan.** All phases are renderer-only (theme bridge + Workbench shell); no IPC/sync/cross-package/external-API/persistent-storage boundary.
- Note (defense-in-depth, not required): the orchestrator nonetheless authored TWO frozen orchestrator-owned tests for the shared-infra risk — `useTheme.tokens.preservation.test.ts` (Phase 1, authored before impl, untouched, green) and `Workbench.responsive.acceptance.test.tsx` (Phase 3, authored failing before impl, untouched, now 5/5). Both predate their phase's implementation commit.

## Check 6: Test theater detection via mutation score
- Trigger: fired (stryker.config + `mutation:test` script exist) — but **deferred to the carried-forward pre-merge mutation task**, consistent with Waves 3/4/5.
- Rationale: per the HANDOFF, the Check-6 mutation gate for the workbench waves is batched into a single pre-merge task ("tighten adapter/derivation survivors before the 2026-06-01 merge"). Wave 6's adapter/derivation logic (`applyWorkbenchTokenOverrides`, `useWorkbenchBreakpoint` `computeMode`, the UnifiedRail live-data adapters) joins that task. The actual merge into protected `master` is blocked until 2026-06-01 (CI minutes), so the mutation gate runs before merge, not at wave-wrap. The wave will NOT be marked merged with a Check-6 FAIL unresolved.
- Status: DEFERRED (non-blocking for the commit-to-master step; blocking for the eventual merge).

## Verdict

**PASS**

Checks 1–3 ran clean against the real consumer graph (fallback trace): every new symbol/export reaches a production consumer, no narrowed universals, no dead exports. Check 4 N/A (renderer-only, no schema change). Check 5 N/A (no cross-boundary phases — and two orchestrator-owned guards exist anyway). Check 6 deferred to the established pre-merge mutation task (consistent with Waves 3/4/5; the merge is gated to 2026-06-01 regardless). No fatal or non-fatal flags at wave-wrap.
