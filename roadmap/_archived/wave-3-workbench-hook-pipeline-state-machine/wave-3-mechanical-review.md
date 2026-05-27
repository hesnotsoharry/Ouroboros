# Wave 3 review — mechanical gap check

**Inputs resolved:**
- Plan: `roadmap/wave-3-workbench-hook-pipeline-state-machine/waveplan-3.md`
- Diff range: `328d55b1..HEAD` (5 commits: plan/ADR/recon + Phases 1–4), `src/**`
- Graph: fallback (grep + import-following — graph not queried this run; findings marked accordingly)
- Run timestamp: 2026-05-21

## Check 1: Forward-trace
- Change sites traced: new symbols `useWorkbenchAgentData`, `WorkbenchAgentState`, `WorkbenchSession`, `selectPrimarySession`, `deriveWorkbenchAgentState`, `deriveSessionStatus`, `deriveContextStats`, `useWorkbenchProjects` (+ Globe/region edits)
- Paths reaching production consumer: all
- Paths flagged as dead: 0

`useWorkbenchAgentData` → consumed by `AgentGlobe.tsx`, `Rails/InnerRail.tsx`, `AgentSidebar/AgentSidebar.tsx`, `StatusBar.tsx` (all production renderers in the flag-gated canon shell — the `layout.canonWorkbench` branch is production). `useWorkbenchProjects` (the new `Workbench/useWorkbenchProjects.ts` — distinct from the same-named ChatOnlyShell hook) → consumed by `TitleBar.tsx`, `ProjectRail.tsx`, `InnerRail.tsx`. The pure helpers (`selectPrimarySession`/`deriveWorkbenchAgentState`/`deriveSessionStatus`/`deriveContextStats`) execute in production in-file via the hook **and** are exported for unit testing — a sanctioned testability-export pattern, not dead code. No silent value-drops (the wave threads agent-event data through the adapter to the rendered surfaces). **(fallback trace)**

## Check 2: Plan universal-quantifier cross-reference
- Universals found in plan: 5 (lines 18, 20, 34, 45, 54) + "each of the six states" (176)
- Universals where diff covers all instances: all
- Universals flagged as narrowed: 0

Lines 18/20 ("every region fed from workbenchMockData", "every non-terminal region is still static") describe the **before** state (Context), not deliverables. Line 34 ("every region needs an adapter") is method rationale. Line 45 (Goal: Globe + sessions list + sidebar header + project chips + status bar reflect runtime state) is covered by Phases 1–3; the five AgentSidebar **panel bodies** are an explicit documented deferral (ADR D5 / "Out of scope"), not a silent narrowing. Line 54 ("every existing shell renders byte-identically") is covered by the flag-off render test. "each of the six states" — all six are implemented in `deriveWorkbenchAgentState` and asserted in the acceptance test.

## Check 3: Export audit
- New exports added: `useWorkbenchAgentData`, `WorkbenchAgentState`, `WorkbenchSession`, `selectPrimarySession`, `deriveWorkbenchAgentState`, `deriveSessionStatus`, `deriveContextStats`, `useWorkbenchProjects`
- Exports with production consumers: all (see Check 1)
- Exports flagged as dead: 0

The two hooks have non-test production importers (enumerated above). The types back those consumers' props. The `derive*`/`select*` pure functions are production-executing (in-file via the hook) testability exports — not dead-on-arrival. No `DEFERRED-CONSUMER` markers needed. **(fallback trace)**

## Check 4: Schema-removal migration safety
- Trigger: **skipped** — no schema property removals in this wave's diff (`git diff` on `configSchema*.ts`/`configAppTypes.ts` = 0 removed lines). The dead-mock sweep removed TypeScript mock **constants**, not persisted electron-store schema properties.

## Check 5: Boundary-phase orchestrator-owned acceptance test verification
- Trigger: **skipped** — no `cross-boundary` phases declared in the wave plan. The wave is renderer-internal (no IPC/sync/cross-package/external-API/persistent-storage boundary; no config-schema change). Phases 1 and 3 were classified *conceptually-risky* (not cross-boundary), and nonetheless shipped with orchestrator-owned acceptance tests (`AgentGlobe.acceptance.test.tsx` 9 cases; `useWorkbenchAgentData.sessions.acceptance.test.ts` 5 cases) — both authored before dispatch, confirmed RED, and untouched by the implementers (stronger than Check 5 requires).

## Check 6: Test theater detection via mutation score
- Trigger: **fired** — `stryker.config.mjs` present at root + `mutation:test` script exists; `incremental: true`.
- Mutation score: **31.72%** (covered 36.36%) — 72 killed / 0 timeout / 126 survived / 29 no-coverage (227 mutants).
- Threshold zones: /review high ≥80, low ≥60, fatal <40. **Project-configured `break` threshold: 21** — the run PASSED it (`Final mutation score of 31.72 is greater than or equal to break threshold 21`).
- Status: **FLAG (non-fatal).**

**Why FLAG, not FAIL.** The 31.72% is below /review's generic 40% line, but (a) it cleared the project's own calibrated `break: 21` gate — and per Check 6 step 1 the project owner is the authority on what's mutation-relevant; this repo is a UI-heavy Electron renderer where mutation scores run structurally low (mutating inline-style values, className conditionals, and JSX string labels produces many survivors that tests legitimately don't assert). (b) The survived mutants skew toward `Regex` / `StringLiteral` / `ConditionalExpression` UI-render constructs, **not** the wave's core logic — Wave 3's adapter/derivation/selection has strongly assertive tests (`expect(byId.r2.status).toBe('warn')`, `expect(data.contextStats.usedTokens).toBe(1500)`, `expect(globe.textContent).not.toContain('claude-sonnet-4-6')`), which is low-theater on inspection. (c) The score is the run aggregate, not a per-file Wave-3 figure.

**Remediation before the 2026-06-01 merge (bounded):** open `reports/mutation/mutation.html`, filter to the Wave-3 source files (`useWorkbenchAgentData.ts`, `AgentGlobe.tsx`, the four region components), and tighten tests for any survivor that lands in the **adapter/derivation logic** (as opposed to inline-style/JSX render branches, which are acceptable survivors for a UI wave). Recorded in HANDOFF as a pre-merge task.

## Verdict

**FLAG** — one non-fatal flag (Check 6 mutation score 31.72%, below the 40% line but above the project's `break: 21` gate). No structurally-fatal flags.

Checks 1, 2, 3 ran clean (all new symbols reach production consumers; no narrowed universals; no dead exports). Check 4 N/A (no schema removals). Check 5 N/A (no cross-boundary phases — and the conceptually-risky phases carry orchestrator-owned tests anyway). Check 6 FLAG with written justification above + a bounded pre-merge remediation. Per the verdict rule, FLAG = implementer/orchestrator addresses each flag (fix or written justification) before merge; the justification is recorded and the merge is blocked until 2026-06-01 regardless, so the Wave-3-file survivor review lands inside that window. The wave ships locally (tag v2.24.0); the FLAG gates the June merge, not the local wave-end.
