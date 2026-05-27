# Wave 8 review — mechanical gap check

**Inputs resolved:**
- Plan: `roadmap/wave-8-workbench-canon-parity-2/waveplan-8.md`
- Diff range: `52a4ed45..HEAD` (commits `5707f0aa` P1, `6e9cf3ec` P2, `acfeba98` P3, `05cbaec1` format; bundled held `57b750b1`)
- Graph: healthy (Agent IDE indexed)
- Run timestamp: 2026-05-22

## Check 1: Forward-trace
- Change sites traced: all new/modified symbols across P1–P3
- Paths reaching production consumer: all
- Paths flagged as dead: 0

`useWorkbenchClaudeCapture` → `useWorkbenchTerminals` → `CenterPane` → `Workbench` (rendered). `claudeSessionId` param + `resolvePrimary`/`isCwdInProject` → `useWorkbenchAgentData` → `AgentSidebar`/`SidebarHeader` (rendered). `WorkbenchFileTree`/`useWorkbenchFileTree` → `InnerRail` (rendered). `WorkbenchFilePicker`/`WorkbenchFileViewerModal` → `Workbench.tsx` (rendered). All terminate at a production render in the canon Workbench shell (behind `layout.canonWorkbench`, which is a production consumer). No silent drops at the threading forks.

## Check 2: Plan universal-quantifier cross-reference
- Universals found in plan: "both `AgentSidebar` call sites", "every panel must reflect the selected terminal/project"
- Universals where diff covers all instances: all
- Universals flagged as narrowed: 0

Both `useWorkbenchAgentData(...)` call sites (`AgentSidebar` root + `SidebarHeader`) pass `claudeSessionId` (verified Phase 1 review). The 5 sidebar panels all read the scoped adapter output.

## Check 3: Export audit
- New exports added: WorkbenchFileTree, useWorkbenchFileTree, compareEntries, useRootDir, LiveFileNode(+type), WorkbenchFilePicker, OPEN_FILE_PICKER_EVENT, WorkbenchFileViewerModal(+Props)
- Exports with production consumers: WorkbenchFileTree (InnerRail), useWorkbenchFileTree (WorkbenchFileTree), WorkbenchFilePicker + WorkbenchFileViewerModal (Workbench.tsx), LiveFileNode (used as type)
- Exports flagged as dead: 3 (all non-fatal)

- **`compareEntries`** at `Rails/useWorkbenchFileTree.ts`
  - Consumer count: only-tests (WorkbenchFileTree.test.tsx)
  - Reason: pure sort helper exported for unit testing. Accepted — test-only export of a pure helper is a sanctioned pattern; alternatively de-export and test via the hook. Non-fatal.
- **`useRootDir`** at `Rails/useWorkbenchFileTree.ts`
  - Consumer count: 0 external (used internally by `useWorkbenchFileTree` in the same file; the `export` is superfluous)
  - Reason: over-export; intended for future multi-root composition. Remediation: drop `export` until a second consumer exists. Non-fatal.
- **`OPEN_FILE_PICKER_EVENT`** at `Overlays/WorkbenchFilePicker.tsx`
  - Consumer count: 0 external — `InnerRail` and `commandRegistry.builders.ts` both dispatch the **literal** `'agent-ide:open-file-picker'` rather than importing this constant
  - Reason: drift risk — if the constant's value ever changes, the dispatchers won't follow, silently breaking the wiring. Remediation: consolidate the event name into a single shared constant referenced by the picker (listener) + InnerRail + the command builder (dispatchers). Non-fatal (current literals match; the wiring works today). Recommend a small follow-up rather than a wave-wrap churn (the right home is a shared `appEventNames` entry, which touches the shared command builder — out of a clean inline fix).

## Check 4: Schema-removal migration safety
- Trigger: skipped — no schema property removals in this wave's diff (renderer-only; `configSchema*.ts` / `configAppTypes.ts` untouched).

## Check 5: Boundary-phase orchestrator-owned acceptance test verification
- Trigger: fired — Phase 1 declared "Conceptually-risky + boundary (session-identity match)"
- Cross-boundary phases declared: 1 (Phase 1)
- Phases with valid orchestrator-owned acceptance test: 1 (substantively); 0 (by the strict commit-ordering proxy) → **non-fatal FLAG** (justified)

- **Phase 1** (`agent sidebar session scoping`)
  - Boundary classification: cross-boundary (session-identity match across two ID sources)
  - Acceptance file: `useWorkbenchAgentData.scoping.acceptance.test.ts`
  - First-commit: `5707f0aa` — SAME commit as the Phase 1 implementation (the mechanical proxy's FAIL trigger)
  - **Substantive authorship (the proxy's intent):** the test was authored by the ORCHESTRATOR and run RED (`3 failed | 2 passed`) BEFORE the implementer was dispatched — recorded in the session transcript. The implementer's report confirms it did not modify the test; `git log` shows exactly 1 commit touching the file (no post-creation modification). The orchestrator independently re-ran it 5/5 green before commit.
  - **Why FLAG not FAIL:** Check 5's intent — "subagent owns both implementation and test, both inherit the wrong mental model" — did NOT occur. The orchestrator owned the test; the subagent bent to it. The proxy fires only because test+impl were bundled in one commit per the "one commit = one phase" convention.
  - **Remediation (git-hygiene lesson):** for future boundary phases, commit the orchestrator-authored failing test in a SEPARATE commit before dispatch so the authorship ordering is visible in git history and the mechanical proxy passes.
  - ADR justification: the orchestrator-owned-acceptance-test discipline is recorded in the waveplan Phase 1 row + this report.

## Check 6: Test theater detection via mutation score
- Trigger: fired (stryker.config present) — **deferred to the batched pre-merge mutation task** per the established Wave 3–7 posture (HANDOFF: mutation runs once before the 2026-06-01 protected-branch merge, covering the Wave 3–8 adapter/derivation logic together). Not run at this wrap to avoid a 5–60min run per wave; the wave does not merge before that task runs.

## Verdict

**FLAG (non-fatal)**

Checks 1, 2, 4 clean. Check 5 fires only on the commit-ordering proxy — the substantive orchestrator-owned-acceptance-test constraint held (orchestrator authored + ran RED pre-dispatch; implementer did not modify; verified 5/5 green); recorded as a git-hygiene lesson, not a structural failure. Check 3 flags three over-exports (`compareEntries` test-only, `useRootDir` superfluous, `OPEN_FILE_PICKER_EVENT` drift risk) — all non-fatal, with the event-name consolidation worth a small follow-up. Check 6 deferred to the batched pre-merge mutation task. No structurally fatal findings → does not block the wave; FLAGs justified in writing above.
