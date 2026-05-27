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

## Decision 4: Bug #2 fake-sessions fix — restore `cwd` through persist round-trip

**Context:** Phase 1a diagnostic (HIGH confidence) identified the root cause: `buildPersistedSessionFields` in `src/renderer/hooks/useAgentEvents.payload.ts:219-239` does NOT include `cwd` in its field list. Every session restored from SQLite arrives with `cwd: undefined`. `deriveProjectId` (`useWorkbenchAgentData.ts:186-188`) falls back to `'unknown'` for sessions with no `cwd`. `InnerRail`'s project filter (`InnerRail.tsx:44-48`) compares against the real project basename; sessions with `projectId === 'unknown'` never match, so they appear under EVERY project simultaneously. The UUID-keyed sessions Cole sees are real stored sessions from prior dev/test runs, faithfully restored — just without their `cwd`.

**Options considered:**
- *Industry standard:* **Renderer-only fix** — add `cwd: getStringValue(raw, 'cwd')` to `buildPersistedSessionFields`. Restores `cwd` through the persist/load round-trip; `deriveProjectId` then produces real project basenames; filter works. ~3-5 LOC + 1 test assertion update. Conditional on SQLite schema already having a `cwd` column (must verify before dispatch).
- *Emerging best practice:* **Renderer fix + SQLite schema migration** — if the schema has no `cwd` column, save-side has been silently dropping `cwd` all along, and the restore-side fix alone won't help. Adds a migration step + BOUNDARY-phase discipline.
- *Defensive:* **Sweep stale rows** — one-time deletion / re-save pass over already-persisted rows that lack `cwd`. Optional hygiene, not load-bearing.

**Pick:** Renderer-only fix (with mandatory SQLite schema verification gate) — *industry standard*.

**Rationale:** Diagnostician confirmed the missing field is downstream of (not upstream of) the SQLite write path. If `sessions.save(session)` passes the full AgentSession object (which includes live `cwd`), and the SQLite schema has a `cwd` column, the save side already persists it correctly — the restore side just drops it. This is the smallest correct fix. The schema-verification gate ensures we don't ship a half-fix: implementer reads `src/main/storage/` schema FIRST; if no `cwd` column, fix expands to BOUNDARY (migration), and Phase 4 dispatches `sonnet-implementer` with orchestrator-owned acceptance test pre-authored + `sonnet-phase-reviewer` PASS required.

**Consequences:** Phase 4 dispatch: `sonnet-implementer` with a 2-step contract — (1) verify SQLite schema has `cwd` column, (2) if yes, apply renderer-only fix; if no, file Tier 3 + stop. Acceptance test asserts: with N projects each holding M live sessions (correct `cwd`), seeded into the store, restored on cold-boot, `InnerRail` shows only the active project's M sessions; switching projects updates the list; no `'unknown'` projectId entries appear. Already-persisted stale rows (from before this fix) remain `'unknown'` until re-saved or deleted — acceptable degrade, optional follow-up for one-time sweep.

---

---

## Decision 5: Bug #4 unified-rail fix — `useState` + `onToggle` callback + swap MOCK for `WorkbenchFileTree`

**Context:** Phase 1b diagnostic (HIGH confidence) refined the scope: only UNIFIED mode (<1440px) is affected — compact mode (1440-1760px) uses the same `InnerRail` component as full mode, which already calls `<WorkbenchFileTree>` with real data. Two defects, both literal in `UnifiedRail.parts.tsx`: (1) line 9 imports `MOCK_FILE_TREE`, line 271 renders it inside `AccordionBody`; (2) line 123 `AccordionHeader`'s `onClick` is hardcoded to `() => undefined` — the callback chain back to a state owner was never built; `ProjectAccordionProps` has no `onToggle` prop and `UnifiedRail.tsx` passes none. No z-index/event-swallowing issue — click reaches handler, handler is a deliberate no-op stub.

**Options considered:**
- *Industry standard:* **Two-file edit with one new state hook** — `UnifiedRail.tsx` adds `useState<string | null>` for expanded project id (initialize from `activeProject?.id`); pass `onToggle: (id) => void` down through `ProjectAccordion` → `AccordionHeader`; wire `AccordionHeader`'s `onClick` to call the prop; replace `MOCK_FILE_TREE` block in `AccordionBody` with `<WorkbenchFileTree rootPath={project.id} />` (project.id is already the full project path per `UnifiedRail.tsx:31` `adaptProject`). ~15-20 LOC added/modified, ~5 removed. No new state-management surface, no new files.
- *Emerging best practice:* **Multi-expanded state** — instead of `string | null`, use `Set<string>` to allow multiple accordions open simultaneously. Adds slight UX flexibility but doesn't match VS Code / Finder accordion convention (typically one-at-a-time).
- *Persistence:* **Persist expanded state across relaunch** — store the active expanded id in config. Not in Wave 14 scope; can be added later if Cole asks.

**Pick:** Two-file edit with one new state hook (single-expanded id) — *industry standard*.

**Rationale:** Diagnostician confirmed the structural defect is a missing callback chain + a hardcoded mock import, both visible in the same two files. Single-id state matches conventional accordion UX (one expanded at a time) and matches the existing `expanded` prop's binary semantics. The fix is contained — no new shared primitives, no state-management library, no IPC. `InnerRail.tsx` is NOT touched, so the full-mode + compact-mode rails have zero regression risk.

**Consequences:** Phase 5 dispatch: `sonnet-implementer` with a 2-test contract — (1) `UnifiedRail.fileTreeReal.acceptance.test.tsx` asserts no `MOCK_FILE_TREE` filename appears inside `data-testid="workbench-unifiedrail"` with a project root set, and `WorkbenchFileTree` is rendered for the expanded project; (2) `UnifiedRail.collapseToggle.acceptance.test.tsx` asserts clicking `AccordionHeader` on project B (when project A is active) toggles project B's body visibility. Plus a regression-preserve check that `InnerRail`-using full/compact modes still call `WorkbenchFileTree` (existing test `WorkbenchFileTree.test.tsx:130` covers this — verify it stays green). NOT a boundary phase; no `sonnet-phase-reviewer` required unless ambiguity surfaces.

---

---

## Decision 6: Scope boundary — context menu extensibility OUT in Wave 14

**Context:** D2's ContextMenu primitive is built extensible (caller provides menu items as children). Future natural additions for project-row context menus include: "Reveal in Explorer / Finder", "Copy path", "Rename project label" (display name distinct from path), "Open in new window". Question: ship any of these in Wave 14?

**Options considered:**
- *Bundle:* Ship "Reveal in Explorer" + "Copy path" alongside "Remove" in Wave 14. Two extra menu items; each is ~1-2 LOC of caller code + a tiny IPC shell-open for Reveal. Low cost, high user-perceived polish.
- *Scope-bound (recommended):* Ship ONLY "Remove from workbench" in Wave 14. Each future item gets its own scoped decision (UX, IPC, permissions) without bloating this wave.

**Pick:** Scope-bound — *industry standard for fix-sweeps*.

**Rationale:** Wave 14 is a fix-sweep, not a feature wave. Bundling additional features dilutes scope discipline AND introduces decisions that don't have grounding yet (e.g., what does "Reveal" do on packaged Linux builds — `xdg-open`? `gio open`? Per-distro?). Each future menu item has real cross-cutting questions; tackling them piecemeal in their own decisions is cleaner.

**Consequences:** ContextMenu primitive ships extensible; project context menu carries one item. Future PR / wave adds items one at a time, each with its own ADR entry if non-trivial (Reveal in Explorer: cross-platform shell open is non-trivial → ADR; Copy path: trivial → no ADR). Wave 14's plan + tests do not cover any future-item behavior.
