---
status: DRAFT
created: 2026-05-27
updated: 2026-05-27
---

# Wave 14 — Architecture Decisions

## Decision 1: Project-remove UX — right-click context menu + stale-only inline X

**Context:** Wave 12 (`v2.33.0`, ADR D2) shipped per-row inline X buttons on the three project-switcher surfaces (outer rail chips, title-bar dropdown rows, inner-rail dropdown rows) as the project-remove affordance. Visibility was `always-visible on stale (exists: false) + hover-only on healthy`. Cole's 2026-05-27 feedback: the inline X is too small / visually noisy, and right-click → context menu is the desktop-canonical pattern users expect (VS Code workspace items, JetBrains project pane). Wave 14 must revise the UX. Question: replace entirely vs hybrid?

**Options considered:**
- *Industry standard:* **Right-click → context menu** on all 3 surfaces. Healthy and stale both use right-click. Inline X removed entirely. Matches VS Code workspaces, JetBrains projects, Finder/Explorer files.
- *Hybrid (recommended):* Right-click on all 3 surfaces + retain inline X on **stale chips only** (always-visible). Healthy chips show no X — discoverability via right-click. Preserves Wave 12's stale-chip discoverability safety affordance (which is more critical than healthy-chip discoverability — stale = broken, users need a "this is broken, fix it" cue).
- *Emerging best practice:* Right-click + kebab-menu icon on hover (3-dot vertical icon, click opens dropdown). Modern web app pattern (Slack channel rows, Linear issues). Adds visual weight but maximally discoverable.

**Pick:** Hybrid (right-click everywhere + inline X on stale chips only) — *emerging best practice*.

**Rationale:** Hybrid honors Cole's UX preference (right-click is the primary remove path) without sacrificing the stale-chip discoverability Wave 12 prioritized — stale entries need a more aggressive visual cue than healthy ones because the user CAN'T "just keep using" a stale entry. Pure industry-standard (right-click only) would regress that. Kebab-menu icon adds visual weight on every chip which violates the original "tiny X is noisy" complaint. The hybrid is minimal change from Wave 12's mental model (X stays meaningful, just only when needed) + adds the right-click pattern users expect.

**Consequences:** Wave 12's "always-visible stale X / hover X healthy" rule becomes "always-visible stale X / NO X healthy." Wave 12's `ProjectRail.removeButton.acceptance.test.tsx` may need a small adjustment for healthy-chip behavior (assert NO X visible on hover). Future Wave 14+1 can add kebab menu or "Reveal in Explorer" etc. extensions without revisiting this decision — the ContextMenu primitive will be built extensible.

---

## Decision 2: ContextMenu primitive — reuse-first

**Context:** Phase 3 needs a ContextMenu primitive to render the right-click menu on each project surface. The codebase may already have one (Wave 11 added file-tree right-click for the FileViewer modal flow; other surfaces in the renderer may have introduced one). Building a parallel ContextMenu creates two competing primitives — exactly the kind of drift the lean codebase principle resists.

**Options considered:**
- *Industry standard:* Reuse-first. Grep for `ContextMenu`, `onContextMenu`, `context-menu` across `src/renderer/components/`; if a primitive exists, import it and pass props matching its API; only build new if no match.
- *Build-fresh:* Always build a new primitive scoped to project rails; avoids coupling to a primitive that might evolve in ways that don't fit project-rail needs. More code, less coupling.

**Pick:** Reuse-first — *industry standard*.

**Rationale:** Reuse aligns with the lean codebase principle (don't duplicate primitives). If an existing ContextMenu has the wrong API for project rails, the cost of a one-time extension (add a `menuItems` prop, factor out a sub-component) is lower than the long-term cost of two parallel primitives that drift apart. If no existing primitive: build a minimal one with a single menu-item slot (extensible later) — NOT a full menu-system framework.

**Consequences:** Phase 3 implementer's first step is `Grep "ContextMenu\|onContextMenu" src/renderer/`. If found: import + use. If not: create at `src/renderer/components/common/ContextMenu.tsx` (or wherever common-primitives live in this repo) — minimal API (`<ContextMenu x={n} y={n} onDismiss={fn}>{children}</ContextMenu>`), position-fixed render, dismiss on Esc / outside-click. The primitive carries no menu-item semantics — callers provide their own item content. Future extensions (Reveal, Copy path) add menu items at caller site; no primitive change required.

---

## Decision 3: Top terminal cwd resolution — mirror bottom slot

**Context:** Bug #3 — top dock terminal auto-spawns Claude in `C:\Web App\AgentIDE` regardless of active project, while bottom slot correctly uses active project root. The bottom slot has the working pattern; Wave 14's job is to apply the same pattern to the top slot. Question: redesign cwd resolution (architectural change) vs mirror (mechanical fix)?

**Options considered:**
- *Industry standard:* **Mirror the bottom slot.** Whatever fallback chain the bottom slot uses (likely `cwd: lowerCwd ?? projectRootRef.current ?? undefined`), the top slot applies symmetrically with `upperCwd`. Zero architectural change; bug is a missing-symmetry oversight.
- *Emerging best practice:* Extract a shared `useTerminalSpawnCwd(frame, projectRoot)` hook that both top and bottom slot call. Eliminates the possibility of future drift between the two paths. More code; future-proof.

**Pick:** Mirror the bottom slot — *industry standard*.

**Rationale:** This is a fix-sweep wave; scope discipline matters. Refactoring to a shared hook is a 1-2 hour task with its own test surface and potential regressions; mirroring is a 1-5 LOC change. If future drift between top and bottom becomes a real problem (no evidence yet), Wave 14+N can extract the shared hook then. Default to the smallest fix that closes the bug.

**Consequences:** `useWorkbenchTerminals.ts` gets a symmetric `cwd: upperCwd ?? projectRootRef.current ?? undefined` (or whatever the exact bottom-slot pattern is). If diagnosis surfaces that `claudeAutoLaunch` (or equivalent) bypasses workbench cwd resolution entirely, the fix expands to that surface — but still mechanical mirroring, not refactor. The acceptance test mocks `pty.spawnClaudePty` and verifies the cwd argument, so the test catches the bug regardless of which call site fired the spawn — implementer can't ship a "fixed one path, missed the other" outcome.

---

## Decision 4: Bug #2 fake-sessions fix scope — PENDING (locks after Phase 1a diagnosis)

**Context:** Inner rail shows the same UUID-keyed sessions on every project. Suspect ranking (per bug doc): (a) missing `projectId` filter in `useWorkbenchAgentData`, (b) `sessionCrud:list` IPC returning all-projects unscoped, (c) mock data leak (unlikely — UUID style doesn't match `MOCK_SESSIONS`), (d) Wave 100 cleanup gap leaving half-wired source. Fix scope depends on which is true: renderer-only filter (smallest), IPC-side scoping (boundary phase — orchestrator-owned acceptance test required, `sonnet-phase-reviewer` PASS required), or upstream store cleanup.

**Options considered (stubs — diagnostician confirms before lock):**
- Renderer-only filter fix in `Rails/InnerRail.tsx` or `useWorkbenchAgentData.ts`.
- IPC-side scoping: `sessionCrud:list` accepts a `projectId` arg; main-process filters.
- Upstream store cleanup: identify and remove the leak source (e.g., persisted store has leaked entries that survive across projects).

**Pick:** PENDING — Phase 1a `sonnet-diagnostician` output names root cause + smallest correct fix.

**Rationale:** Without diagnosis, choosing a fix scope risks either (a) masking the symptom while leaving the leak source intact or (b) over-scoping a renderer-only filter into an IPC refactor. The diagnostician's brief explicitly asks to identify SOURCE, not just where the symptom surfaces.

**Consequences:** Locks Phase 4's implementer dispatch shape — renderer-only is `sonnet-implementer` with no reviewer; IPC-side is BOUNDARY phase requiring orchestrator-owned acceptance test pre-authored + `sonnet-phase-reviewer` PASS. Test shape locks accordingly (trophy vs honeycomb).

---

## Decision 5: Bug #4 compact-mode fix scope — PENDING (locks after Phase 1b diagnosis)

**Context:** The inner rail at compact (1440–1760) and / or unified (<1440) breakpoint has two distinct defects: (a) project collapse / expand non-functional, (b) file trees rendered are `MOCK_FILE_TREE` placeholders not real project files. Workbench `CLAUDE.md` flags `UnifiedRail.parts file-tree body uses MOCK_FILE_TREE`. Question: which mode(s) are affected, where exactly does `MOCK_FILE_TREE` get consumed, what's the collapse-handler state (missing-handler vs wired-but-broken vs click-swallow)?

**Options considered (stubs — diagnostician confirms before lock):**
- Fix scope depends on diagnostic. Likely shape: replace `MOCK_FILE_TREE` import in `UnifiedRail.parts.tsx` (and / or `InnerRail.tsx`'s compact branch) with `useFileTree(activeProjectRoot)`; wire collapse state via `useState<Record<projectRoot, boolean>>` (with optional persistence to config).
- Alternative if collapse state already exists but is wrong-scoped: adjust scope; smallest change.
- Alternative if click-swallow z-index issue: CSS fix; near-zero code change.

**Pick:** PENDING — Phase 1b `sonnet-diagnostician` output names which mode + which files + which sub-issue applies.

**Rationale:** The two sub-defects (mock data + collapse) may be in the same component or different components depending on how compact and unified branches are split. Diagnosis prevents over-scoping or under-scoping.

**Consequences:** Locks Phase 5's implementer brief shape + the acceptance test count (separate tests for mock-data-fix and collapse-fix; possibly different files). Worst case: two distinct fixes that need to land together in one phase. Best case: one well-scoped component edit with two tests.

---

## Decision 6: Scope boundary — context menu extensibility OUT in Wave 14

**Context:** D2's ContextMenu primitive is built extensible (caller provides menu items as children). Future natural additions for project-row context menus include: "Reveal in Explorer / Finder", "Copy path", "Rename project label" (display name distinct from path), "Open in new window". Question: ship any of these in Wave 14?

**Options considered:**
- *Bundle:* Ship "Reveal in Explorer" + "Copy path" alongside "Remove" in Wave 14. Two extra menu items; each is ~1-2 LOC of caller code + a tiny IPC shell-open for Reveal. Low cost, high user-perceived polish.
- *Scope-bound (recommended):* Ship ONLY "Remove from workbench" in Wave 14. Each future item gets its own scoped decision (UX, IPC, permissions) without bloating this wave.

**Pick:** Scope-bound — *industry standard for fix-sweeps*.

**Rationale:** Wave 14 is a fix-sweep, not a feature wave. Bundling additional features dilutes scope discipline AND introduces decisions that don't have grounding yet (e.g., what does "Reveal" do on packaged Linux builds — `xdg-open`? `gio open`? Per-distro?). Each future menu item has real cross-cutting questions; tackling them piecemeal in their own decisions is cleaner.

**Consequences:** ContextMenu primitive ships extensible; project context menu carries one item. Future PR / wave adds items one at a time, each with its own ADR entry if non-trivial (Reveal in Explorer: cross-platform shell open is non-trivial → ADR; Copy path: trivial → no ADR). Wave 14's plan + tests do not cover any future-item behavior.
