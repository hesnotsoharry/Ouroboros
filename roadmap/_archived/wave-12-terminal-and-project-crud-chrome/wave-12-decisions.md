---
status: SHIPPED
created: 2026-05-24
updated: 2026-05-24
---

# Wave 12 — Architecture Decisions

All decisions locked by Cole 2026-05-24 before plan validation re-run. Plan: `waveplan-12.md`.

---

## Decision 1: Terminal tab persistence shape

**Context:** Wave 12 adds tab collections to each terminal frame, each scoped per-project. Two persistence shapes are reasonable: (a) extend Wave 10's `canonWorkbenchSessions` schema in-place — evolve `SessionSlot` to `TabCollection`; (b) add a parallel `canonWorkbenchTabs` key alongside `canonWorkbenchSessions`. The choice affects schema-migration handling, restore-hook complexity, and the doctrine for future tab-related schema changes.

**Options considered:**
- *Industry standard / continuation:* extend `canonWorkbenchSessions` in-place to `Record<projectRoot, { upper: TabCollection, lower: TabCollection } | null>`. Legacy single-slot shape gets a cold-start reset (Wave 9 → 10 pattern), no migration. Single source of truth per project.
- *Defensive alternative:* parallel `canonWorkbenchTabs` key. Two persistence writes per state change; lower migration risk (existing data shape untouched); split reads across keys.

**Pick:** Extend `canonWorkbenchSessions` in-place — *continuation tier*.

**Rationale:** Wave 10 already cold-started the Wave 9 flat shape via `configPreflight`; Wave 12 cold-starting the Wave 10 single-slot shape is a known-good pattern. The canon flag is still default-off and only Cole has live data — no production users to migrate. Keeping persistence in one key keeps the restore/persist hook surface tight and matches the Wave 9–10 doctrine. The parallel-key option's "lower migration risk" payoff is illusory because either way the legacy shape is incompatible and must cold-start.

**Consequences:** `configPreflight.ts` extends with a Wave-10-shape detector. Wave 9's `useWorkbenchTerminals.restore.acceptance.test.ts` regression-checks. Future tab-related schema evolutions inherit the same in-place pattern. No data loss for any production user (canon flag default-off).

---

## Decision 2: Auto-detect-stale project UX

**Context:** When `useWorkbenchProjects` derives `exists: false` for a path via the new `pathExists` IPC, the UI needs to surface this so Cole knows the project is broken AND can remove it in one action.

**Options considered:**
- *Industry standard:* inline dim (opacity 0.5) on stale chips/rows + always-visible X remove button on stale entries. Healthy entries show the X only on hover.
- *More aggressive:* one-time launch prompt — banner or modal — "3 projects no longer exist on disk — remove?".
- *Defensive both:* inline by default, plus prompt only if N ≥ 3 stale paths.

**Pick:** Inline dim + always-visible X — *industry standard tier*.

**Rationale:** VS Code's "missing folder" pattern. Less interruptive; user fixes when they care. The launch-prompt option creates friction at every app start once any path goes stale, which is the wrong incentive — user might dismiss without acting. Inline dim makes the broken state visible without demanding immediate action.

**Consequences:** Phase 2's three orchestrator-owned tests cover the dim styling + always-visible X behavior. No launch-prompt machinery to maintain. If staleness becomes a frequent enough pain that inline-only isn't enough, a future wave can add the prompt as an enhancement.

---

## Decision 3: Tab rename UX

**Context:** Wave 12 wires tab rename so users can label tabs meaningfully ("build", "test:watch") instead of the default kind-based label.

**Options considered:**
- *Industry standard:* double-click tab → inline contenteditable. Enter/blur commits, Esc cancels, 40-char cap, empty/whitespace-only input reverts.
- *Discoverable but heavier:* right-click → modal rename dialog.
- *Defer:* no rename in Wave 12; tabs auto-labeled "cc 1", "shell 1".

**Pick:** Double-click inline contenteditable — *industry standard tier*.

**Rationale:** VS Code / Terminal.app / iTerm all use this pattern; it's the user's expected gesture. Modal adds clicks per rename and creates a heavy UX path for a frequent operation. Defer-rename would land Wave 12 visibly incomplete vs the original "terminal CRUD" scope.

**Consequences:** Phase 4 implements rename input as uncontrolled (`defaultValue`, ref-based commit) to avoid the controlled-input focus-loss bug under parent re-render. 40-char cap is a soft UX cap (truncation in display), not a security boundary.

---

## Decision 4: Terminal split scope

**Context:** Terminal split (dividing a frame into multiple panes) is one of the original Wave 12 "terminal CRUD + chrome" line items. It's also significantly more complex than the rest — split introduces a new geometry (3+ terminals in a single frame, possibly nested split trees) with its own state-shape ADR.

**Options considered:**
- *Defer to a single-focus future wave:* Split button stays mounted but inert, `title="Split — coming in a future wave"`. Wave 12 stays at 6 phases.
- *Include in Wave 12:* implement basic 2-way split per frame, no nested splits. Wave 12 expands to ~8 phases.

**Pick:** Defer — *scope-boundary call*.

**Rationale:** Wave 12 already bundles two distinct surfaces (terminal CRUD + project CRUD + auto-detect-stale). Adding a third surface (split geometry) inflates the wave substantially and forces a state-shape decision (split-tree vs flat-with-grouping) that's better made in a single-focus wave where the choice is the wave's primary deliverable. Keeping the button mounted with a tooltip means the UI doesn't visibly regress.

**Consequences:** Split lives as a future wave (likely Wave 16+). When that wave runs, it'll decide the state shape independently — Wave 12's per-frame `TabCollection` may or may not accommodate split natively; that's the future wave's call. Tab CRUD as shipped in Wave 12 is fully usable without split.

---

## Decision 5: Terminal maximize scope + persistence

**Context:** Maximize lets one terminal frame take the full center-pane height, hiding the other frame + divider. Scope question: include in Wave 12 or defer? Persistence question: ephemeral (always start dual-frame on relaunch) or persist across relaunch?

**Options considered:**
- *Industry standard:* in-scope, ephemeral. Toggle via `TabBarControls.Maximize` per frame; state lives in `Workbench.tsx` as `maximizedFrame: 'upper' | 'lower' | null`; always reset on relaunch.
- *More feature-rich:* in-scope, persistent in `canonWorkbenchSessions` per project.
- *Defer:* Maximize button stays inert with tooltip (like Split).

**Pick:** In-scope, ephemeral — *industry standard tier*.

**Rationale:** VS Code's behavior. Persistent maximize is mildly surprising at relaunch (user expects the dual-frame view they last designed); ephemeral state matches the "I temporarily need more room" usage pattern. Deferring would leave Wave 12 visibly incomplete vs the original scope. Implementation is cheap — single state field in `Workbench.tsx`, conditional render in `CenterPane`.

**Consequences:** Phase 4 adds `maximizedFrame` state + callback chain. Phase 4 acceptance test covers toggle behavior within a single project. Cross-project maximize behavior (maximize in A, switch to B): accepted as-is — `maximizedFrame` lives in `Workbench.tsx`-level state which doesn't reset on `key={projectRoot}` re-mount of `CenterPane`, so maximize persists across project switches but resets on relaunch. Documented in Phase 4's risks table.

---

## Decision 6: Tab header text overlap fix shape

**Context:** Wave 12 fixes the long-standing tab-header text-overlap visual bug (HANDOFF Wave 12 scope line). Fix shape question: CSS-only or layout rework?

**Pick:** CSS-only — `text-overflow: ellipsis` + `overflow: hidden` + `white-space: nowrap` on `TabItem`'s label span; `title={tab.label}` for native hover tooltip; `maxWidth` cap on the label.

**Rationale:** Standard CSS truncation pattern. No layout rework needed; mechanical fix landed inside Phase 4.

**Consequences:** Phase 4 includes the CSS change in its scope. No separate phase needed.

---

## Decision 7: `pathExists` IPC scope

**Context:** Wave 12 Phase 1 introduces a new main-process IPC to support stale-detection. Scope question: minimal boolean-returning function or richer surface (`isDirectory`, `getStats`, etc.)?

**Pick:** Minimal — `pathExists(path: string): Promise<boolean>`. Main handler uses `fs.promises.access(path, fs.constants.F_OK)` with `.catch(() => false)`; never throws; no distinction between "missing" and "permission denied" (both manifest as "user can't open it").

**Rationale:** Tight boundary surface. Boundary IPCs accrete cost over time; keeping the surface minimal makes Wave 13's `OUROBOROS_PANE_ID` env-injection work (separate IPC) easier to land later. Wave 12 only needs the boolean — `isDirectory` / `getStats` would be invented scope.

**Consequences:** Phase 1's orchestrator-owned acceptance test covers 4 cases (true / false-missing / false-empty / false-malformed). If a future wave needs richer file-system inspection, it adds its own IPC with its own contract.

---

## Decision 8: Wave 11 `forceUnified-no-autoclear` follow-up

**Context:** Wave 11 carried forward `roadmap/follow-ups/2026-05-22-workbench-forceunified-no-autoclear.md` (LOW/OPEN). Question: address in Wave 12?

**Pick:** REMAINS OPEN, OUT of Wave 12 scope.

**Rationale:** Not project/terminal CRUD; tangentially related (rail behavior) but orthogonal. Wave 12 has enough surface area already.

---

## Decision 9: Wave 11 `fileviewer-modal-blocks-tree-swap` follow-up

**Context:** Wave 11 exited with `roadmap/follow-ups/2026-05-24-workbench-fileviewer-modal-blocks-tree-swap.md` (LOW/OPEN) — needs Cole's UX pick between options A (side-dock) / B (Ctrl-K canonical) / C (in-modal nav) / D (pierce-backdrop) before any work.

**Pick:** REMAINS OPEN, OUT of Wave 12 scope.

**Rationale:** Different surface (file viewer modal vs rail CRUD). Needs a UX decision before any implementation work; not a Wave 12 prerequisite.

---

## Decision 10: Wave 13 pane-ID dependency forward-compatibility

**Context:** Wave 13 will introduce `OUROBOROS_PANE_ID` env injection from `pty.spawn` to enable precise per-terminal sidebar binding (per Cole's confirmed architecture 2026-05-24). Wave 12's tab state machine introduces per-tab `sessionId` — the natural identity for Wave 13 to forward.

**Pick:** Wave 12 does NOT inject `OUROBOROS_PANE_ID` (Wave 13 territory). Wave 12 DOES preserve per-tab `sessionId` as the field Wave 13 will key against.

**Rationale:** Forward-compatibility note, not a Wave 12 decision per se. Documenting it here so future agents see the relationship.

**Consequences:** Phase 3's `TabState` shape (`{ id, label, sessionId, kind, createdAt }`) carries `sessionId` per tab. When Wave 13 ships, it'll either (a) use `sessionId` as the pane identity (simplest), or (b) introduce a parallel `paneId` field if there's a reason to separate them. That's Wave 13's call. Wave 12 doesn't have to do anything specific for Wave 13 — just don't strip per-tab identity.
