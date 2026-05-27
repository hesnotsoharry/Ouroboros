---
status: SHIPPED
created: 2026-05-24
updated: 2026-05-24
---

# Wave 11 — Architecture Decisions

> **SHIPPED 2026-05-24.** All 6 ADR decisions honored. See `wave-11-result.md` § "ADRs honored" for per-decision outcome notes.

## Decision 1: File-tree click → modal open via prop-chain callback, NOT a new DOM CustomEvent

**Context:** Wave 8 P3 shipped two paths into `WorkbenchFileViewerModal`: (a) `WorkbenchFilePicker` (Ctrl-K / "Search files" button) listens for `agent-ide:open-file-picker`, opens, and calls its `onSelectFile` prop; (b) `Workbench.tsx` lifts the `openFilePath` state and threads `setOpenFilePath` as `onSelectFile` to the picker. Wave 11 wires file-tree row clicks to the same end-state (`openFilePath` non-null → modal opens). Two implementations: extend the prop chain (`WorkbenchFileTree` accepts `onSelectFile`, `InnerRail`'s `FilesSection` threads it, `Workbench.tsx` passes `setOpenFilePath`), OR introduce a new DOM CustomEvent (`agent-ide:open-file`) that a listener mounted near the modal consumes, with the tree dispatching it.

**Options considered:**
- *Industry standard:* Prop-chain callback. React idiom for child→parent communication; type-safe; visible in the component tree; matches the existing `WorkbenchFilePicker` pattern (Wave 8 P3 chose this for the picker).
- *Emerging best practice:* Same. The React community has consistently moved away from imperative event-bus patterns for in-tree communication unless cross-tree (different React subtrees, different windows) is genuinely required.
- *Experimental / cutting-edge:* Context-driven open dispatcher (`useFileViewerOpen()` hook returning `openFile(path)`). Useful only if multiple non-adjacent surfaces need to open the modal. Premature for two consumers.

**Pick:** Industry standard — prop-chain callback. Tier: standard.

**Rationale:** Wave 8 P3 already set the precedent with the picker. Mixing prop-callbacks (picker) and DOM events (tree) for the same "open the modal" action would be incoherent. The prop-chain is short (`Workbench.tsx` → `MiddleRow` → `LeftRails` → `InnerRail` → `FilesSection` → `WorkbenchFileTree` → file row), 4-5 hops, all already mounted in production code. DOM events are the right tool for the renderer-wide signals catalogued in CLAUDE.md (`agent-ide:set-theme`, `agent-ide:command-palette`, `agent-ide:open-file-picker`), not for sibling-region communication where a callback is direct.

**Consequences:** `WorkbenchFileTree` gains an optional `onSelectFile: (path: string) => void` prop. `FilesSection` (in `InnerRail`) accepts the callback as prop and threads it. `InnerRail` accepts the callback. `Workbench.tsx` passes `setOpenFilePath` down. File rows in `WorkbenchFileTree` (currently display-only — only directory rows toggle expand/collapse) gain an `onClick` that calls `props.onSelectFile?.(node.path)`. The modal opens via the existing `WorkbenchFileViewerModal` mount at `Workbench.tsx:167-170`. No new IPC, no new context, no new event.

## Decision 2: Defer keyboard navigation, expand-all/collapse-all, M/A git badges — explicit out-of-scope

**Context:** The grounding pass surfaced multiple file-tree UX gaps the canon FileTree doesn't have: no keyboard navigation (up/down arrows, Enter/Space to expand), no expand-all / collapse-all affordance, no M/A git-status badges, no row-hover preview, no context menu. Wave 11's HANDOFF brief is "fix scroll/collapse interactions" — Cole's complaint is binary-broken behavior, not missing polish.

**Options considered:**
- *Industry standard:* Ship the click-to-open + bug-fix slice; defer enhancement work to a polish wave.
- *Emerging best practice:* Same — incremental enhancement after canon parity is locked in.
- *Experimental / cutting-edge:* Bundle keyboard nav + badges into Wave 11 to reduce per-feature wave overhead. Risk: scope creep + harder review.

**Pick:** Industry standard — defer. Tier: standard.

**Rationale:** Wave 11's job is to close Cole's two specific 2026-05-23 complaints (file click doesn't open modal; rail open/collapsed render bugs). Enhancement work without a complaint behind it is invented scope. The Wave 10–14 sequencing is explicitly "wire the missing functionality"; Wave 12 is terminal CRUD, Wave 13 is right-panel binding, Wave 14 is status bar. There is no scheduled "file tree polish" wave, but adding keyboard nav + badges in Wave 11 risks an over-scoped wave that ships none of it cleanly. M/A badges are already tracked at `roadmap/follow-ups/2026-05-21-workbench-live-git-diff-stats.md` (deferred — needs a new main-process git op for per-project dirty status).

**Consequences:** Wave 11 ships click-to-open + scroll/collapse fix only. Keyboard nav, expand-all/collapse-all, M/A badges remain as open follow-ups. If Phase 2's diagnosis surfaces a keyboard-affordance gap as the actual cause of "broken when collapsed" (e.g., the unified rail removes the only click target), revisit at Phase 2 dispatch time as a Tier 2 in-line addition with an explicit Cole call. Otherwise — out of scope.

## Decision 3: Phase 2 dispatches `sonnet-diagnostician` BEFORE `sonnet-implementer`

**Context:** Cole's complaint "file tree partial when rail open / broken when collapsed" is vaguely-specified. At least three possible failure modes (and likely more): (a) CSS issue — `overflowY: auto` not working because of a missing `minHeight: 0` upstream in the flexbox chain (already present on `FilesSection` per grounding, but downstream parents or Wave 10's new dropdown header may break it); (b) state issue — `useWorkbenchFileTree`'s `expandedDirs` map gets lost when the rail transitions between the dual-rail `InnerRail` and the unified `UnifiedRail` (different parent component, different React identity); (c) layout issue — the file tree's `flex: 1` parent isn't getting its share of vertical space when neighbors (the new Wave 10 dropdown header) take more height than expected. None of these is obvious from the symptom alone; guessing wrong at the cause produces a fix that pattern-matches the wrong root.

**Options considered:**
- *Industry standard:* Diagnostician-first for any vaguely-specified bug. Per `~/.claude/rules/development-pipeline.md` Lane B B1 (mandatory hypothesis enumeration) and the dispatch reflex (catalog routing rule).
- *Emerging best practice:* Same. The 2026 multi-agent dispatch literature (anti-test-theater work + Anthropic agent SDK doctrine) is explicit: implementer dispatches without diagnostic grounding produce fixes that pattern-match the wrong cause.
- *Experimental / cutting-edge:* Self-investigation by `sonnet-implementer` (let the implementer do its own diagnosis). Plausible for clear-shape bugs; risky for layout/state interactions where the implementer's first hypothesis tends to be a fix attempt rather than a diagnosis.

**Pick:** Industry standard — diagnostician first. Tier: standard / pipeline-mandated.

**Rationale:** Cole's complaint contains the symptom but not the cause. The orchestrator pre-dispatch can't tell whether the fix is CSS, state, or layout without observation. Per `~/.claude/rules/development-pipeline.md` § Scope-creep tiers, the default for "non-trivial friction where the cause isn't obvious from the error / surface alone" is dispatch `sonnet-diagnostician` first. That returns cause + proposed fix + scope estimate. Then orchestrator dispatches `sonnet-implementer` with the diagnosis as the brief.

**Consequences:** Phase 2 is a two-step phase: (i) orchestrator dispatches `sonnet-diagnostician` with the live reproduction context (Wave 10 just shipped; smoke was deferred; ground-truth is what shows up in `npm run dev` with `layout.canonWorkbench` on, with both rail-open and rail-collapsed states reproduced); diagnostician returns 1-2 root causes + proposed fix shapes. (ii) Orchestrator dispatches `sonnet-implementer` with the diagnosis as the brief and an orchestrator-owned failing test for the fix (test shape determined by diagnosis — CSS regression vs state-reset vs layout). Phase 2 carries a built-in 2-step rhythm; the wave plan reflects that.

## Decision 4: `forceUnified` auto-clear is OUT of Wave 11 scope unless Phase 2 diagnosis shows shared root cause

**Context:** A pre-existing LOW follow-up (`roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md`) names a real bug: the rail collapse-handle sets `forceUnified` in `Workbench.tsx` and never auto-clears on window-widen. Wave 11's "fix scroll/collapse interactions" phrasing could plausibly include this. But Cole's specific 2026-05-23 complaint was about "file tree broken when collapsed" — not "the rail collapse persistence is wrong." Different bug, different surface, different fix.

**Options considered:**
- *Industry standard:* Strict scope discipline. Wave 11 closes Cole's complaint; the forceUnified bug is tracked separately and gets scheduled on its own merit (likely Wave 15+ or a polish sweep).
- *Emerging best practice:* Same — strict scope is a wave-process invariant.
- *Experimental / cutting-edge:* Opportunistic bundling: if the implementer is in `InnerRail`/`UnifiedRail` for the file-tree fix, addressing the adjacent forceUnified bug "is free." Risk: not actually free — the bug has its own diagnosis + test surface; bundling muddies the review.

**Pick:** Industry standard — strict scope. Tier: standard.

**Rationale:** Per `~/.claude/CLAUDE.md` § Scope-creep check, "a bug fix doesn't justify unrelated refactors." The forceUnified bug is unrelated by symptom (rail persistence vs file-tree render); the fact that both live in `Workbench.tsx`/`UnifiedRail.tsx` is locational, not causal. Bundling unrelated bugs makes the review surface larger without justification.

**Consequences:** Wave 11 leaves `2026-05-22-workbench-forceunified-no-autoclear.md` open. EXCEPTION: if Phase 2's diagnosis surfaces "file tree broken when collapsed" as caused by the same forceUnified state-management bug (e.g., the collapsed unified-rail mount discards file-tree state that wouldn't be lost if the rail auto-cleared on widen), the fix is in scope (same root cause). The diagnosis-first approach (D3) is how this conditional resolves — the orchestrator reads the diagnostician's verdict before committing scope.

## Decision 5: Wave 11 includes the deferred `/ui-smoke 10` as Phase 0 (mandatory before any implementation)

**Context:** Wave 10 shipped with `/ui-smoke 10` deferred (autonomous orchestrator session; Cole not interactively available at wrap; Preview MCP not wired for the Electron shell). The Wave 10 result brief documented this as "the painful honest finding" and explicitly said: "The Wave 11 session must run smoke as its very first action." This session: Cole IS interactively available and Wave 11 is starting; the smoke can run live before any Wave 11 implementation. The trade-off Cole made when choosing "Skip smoke, plan Wave 11 now" was about not blocking the planning — but the planning is now done and execution is where the smoke risk actually compounds.

**Options considered:**
- *Industry standard:* Run the wave-N smoke at wave-N wrap. Wave 10's smoke runs at the start of Wave 11 since it slipped, as a phase-0 gate before implementation. The Wave 11 result brief covers BOTH smokes (Wave 10 catch-up + Wave 11 wrap).
- *Emerging best practice:* Same. The wave-process is explicit that smoke is a wave-end gate; when a wave ships without it, the next wave inherits the obligation as a pre-implementation gate, not a wave-end add-on.
- *Experimental / cutting-edge:* Defer indefinitely on the bet that Wave 11 implementation will not be perturbed by any latent Wave 10 bug. This is the bet Wave 0–9 made, repeatedly, and which produced the 20-gap surprise on 2026-05-23.

**Pick:** Industry standard — Phase 0 of Wave 11 is `/ui-smoke 10`. Tier: standard / pipeline-corrective.

**Rationale:** The catch-up is small (one smoke pass over Wave 10's surfaces); the cost of skipping is potentially compound (any Wave 10 bug is inherited into Wave 11 work + has to be diagnosed against a moving baseline). Running smoke before Phase 1 means Wave 11 is implemented against a known-good Wave 10 baseline; running it at Wave 11 wrap means it covers Waves 10 + 11 together and any bug surfaced from Wave 11 has ambiguous provenance. Phase 0 is cheap; bug-attribution-debugging is not.

**Consequences:** Wave 11 has 4 phases: (0) `/ui-smoke 10` catch-up + report appended to `roadmap/wave-10-project-scoped-state-foundation/wave-10-smoke-report.md`; (1) wire file-tree click → modal open; (2) diagnose + fix scroll/collapse; (3) wave wrap including `/ui-smoke 11`. If Phase 0 surfaces a HIGH/CRITICAL Wave 10 bug, Phase 0 ends in a Tier 3 follow-up + Cole call; Wave 11 implementation pauses pending Cole's go/no-go on whether to fix-in-Wave-11 (in-scope) or defer (out-of-scope). If Phase 0 is clean or only surfaces LOW items, implementation proceeds.

**Outcome (2026-05-24):** Phase 0 smoke catch-up surfaced a CRITICAL Wave 10 startup crash on Cole's first launch — `canonWorkbenchSessions` schema validation failed on legacy Wave 9 flat-shape data on disk; Cole signed off on inline-fix-in-Wave-11 (Wave 10.1 hotfix) per D6 below.

## Decision 6: Wave 10.1 inline hotfix for `canonWorkbenchSessions` startup crash

**Context:** Wave 11 Phase 0 surfaced a CRITICAL Wave 10 bug: `new Conf()` throws on app init when persisted Wave 9 `canonWorkbenchSessions` data is present (legacy flat `{ upper, lower }` shape fails the new `Record<projectRoot, ...>` schema). Wave 10 ADR D1 intended a cold-start guard via the React hook `useWorkbenchRestore`, but that runs at render time — too late; Conf throws at construction. The fix layer must be `src/main/configPreflight.ts` (the existing file-system preflight that already strips Wave 79/86 deprecated keys before Conf reads). Three handling paths per Wave 11 D5: (a) inline hotfix in Phase 0 — expand Wave 11 scope; (b) dedicated Wave 10.1 — separate wave + ADR + ship; (c) manual workaround — Cole deletes the key from `%APPDATA%\ouroboros\config.json` + file follow-up for future fix.

**Options considered:**
- *Industry standard:* Spin a dedicated Wave 10.1 — proper isolation, fully versioned, clear scope boundary. The standard pattern for critical hotfixes that shouldn't be entangled with the next wave's scope.
- *Emerging best practice:* Inline hotfix when the fix is genuinely tiny (~10 LOC, single file, established pattern) AND the user is interactively available to verify AND the next wave is already in-flight. Modern fast-feedback engineering prefers the inline path when the entanglement is minimal — the overhead of a separate wave-cycle exceeds the work itself.
- *Experimental / cutting-edge:* Manual workaround — accept the bug and document it. Rejected because it leaves the bug open for any future Wave 9-data scenario (Cole on a fresh clone, teammates, etc.).

**Pick:** Emerging best practice — inline hotfix in Wave 11 Phase 0. Tier: pragmatic.

**Rationale:** The fix is 10 LOC of additive code in `configPreflight.ts` matching an existing well-trodden pattern (4 prior wave key-removals follow the same shape). Tests are 4 small cases co-located in `configPreflight.test.ts`. Cole is interactively available to verify on relaunch. A dedicated Wave 10.1 would impose ~30-60 min of process overhead (plan + ADR + result brief + tag + push + audit-followups) for what is essentially a 5-minute fix. The Wave 11 D5 escape hatch (HIGH/CRITICAL findings get Cole's go-no-go before inline-fix) is satisfied: Cole's go-no-go came in via the AskUserQuestion prompt 2026-05-24 11:42-ish.

**Consequences:** Wave 11 Phase 0's scope expands to include: (i) the `configPreflight.ts` fix; (ii) 4 new tests; (iii) the follow-up file `roadmap/follow-ups/2026-05-24-wave-10-canon-workbench-sessions-startup-crash.md` marked RESOLVED; (iv) this ADR D6. The hotfix commits as a separate "fix(wave-10.1)" commit on the wave-11-plan worktree branch BEFORE the smoke catch-up resumes — the smoke needs the app to actually launch. The hotfix is cherry-picked to master + pushed immediately so Cole can pull + relaunch without switching branches. Wave 11's wrap (Phase 3) tags `v2.31.1` (patch bump for the hotfix) IN ADDITION to `v2.32.0` (the minor bump for Wave 11 itself), per the standard hotfix-then-feature ordering — actually NO: a single Wave 11 ship tag of `v2.32.0` is sufficient because the hotfix lands on master well before Wave 11 ships. Decision deferred to wrap-time orchestrator call. A future wave should add an integration test that constructs a real `Conf` with a temp-dir userData against a legacy-flat-shape disk file to lock in the regression guard at the Conf-construction layer (not just the file-preflight layer). Filed as a follow-up at Phase 3.
