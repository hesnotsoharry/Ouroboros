---
status: IN-PROGRESS
created: 2026-05-23
updated: 2026-05-23
---

# Wave 10 — Architecture Decisions

## Decision 1: `canonWorkbenchSessions` schema reshape — cold-start, no migration

**Context:** Wave 9 introduced `canonWorkbenchSessions` as a flat `{ upper, lower }` electron-store key supporting a single-project mental model. Wave 10 changes the model to multi-project (per-window project switching) and must reshape the key to `Record<projectRoot, { upper, lower }>`. Two strategies exist: (a) write a one-shot migration that reads the flat shape and places it under the active project's key, (b) cold-start — treat any flat-shape data as legacy throwaway, return empty record.

**Options considered:**
- *Industry standard:* Write the migration. Standard schema-evolution pattern — preserve user state across upgrades. Applicable when user state is meaningful (production users, real captured data).
- *Emerging best practice:* Same as standard for production; experimental-flag features often skip migration. The signal: was the data "production-grade" when written?
- *Experimental / cutting-edge:* Wave-versioned schema with discriminated unions (`{ version: 1, shape: ... } | { version: 2, shape: ... }`). Overkill for a 2-key store within an experimental flag.

**Pick:** Experimental / cutting-edge — cold-start, no migration. Tier: appropriate-for-context.

**Rationale:** Wave 9's `canonWorkbenchSessions` was written behind a default-off experimental flag (`layout.canonWorkbench`). The single live user (Cole) ran the IDE with the flag on during dev cycles, but the data is throwaway — Wave 10's smoke (Phase 0 of the deferred Wave 15) hasn't even verified that Wave 9's persisted data is meaningful. Writing a migration to preserve data Cole hasn't validated as load-bearing is overhead for no payoff. Cold-start has the additional property of cleaning up any half-captured state from the buggy single-project mode.

**Consequences:** First read of `canonWorkbenchSessions` post-Wave-10 type-guards: if the value's shape doesn't look like a record (e.g., it's `{ upper, lower }` directly), return empty record. Any session that was active under Wave 9's flat shape doesn't auto-resume on first launch post-Wave-10 — the next session captured (post-upgrade) does. Acceptable per Cole. Documented in Wave 10 result brief so the post-upgrade "no auto-resume on first launch" experience isn't a confusion source.

## Decision 2: Project-switch React strategy — `key={projectRoot}` on the Terminals subtree

**Context:** When the active project changes (Phase 2's wired UI), the two terminal frames must teardown their old PTYs and respawn under the new project's restored state. Two implementations: (a) `key={projectRoot}` on the Terminals subtree — React's idiomatic "re-mount this when this prop changes" primitive; (b) explicit `useEffect([projectRoot])` cleanup + re-spawn within `useWorkbenchTerminals`.

**Options considered:**
- *Industry standard:* `key` re-mount for cases where the component's internal state shape changes with the key. React docs explicitly recommend this for "reset component state on input change" patterns. (See React docs: "Resetting state with a key.")
- *Emerging best practice:* Same. The `key` primitive is the modern React idiom; explicit cleanup effects are tolerated but considered an "imperative escape hatch."
- *Experimental / cutting-edge:* Suspense-based teardown coordination. Overkill — PTY teardown is synchronous from the renderer's perspective (fire IPC, move on).

**Pick:** Industry standard / Emerging best practice — `key={projectRoot}` re-mount. Tier: standard.

**Rationale:** `useWorkbenchTerminals` carries non-trivial internal state (refs, debounce timers, the `hasSpawnedRef` invariant added in Wave 9 P2). A `useEffect([projectRoot])` cleanup approach has to manually reset every piece of that state — fragile, easy to miss a ref. `key` re-mount drops the old instance entirely (cleanup fires naturally) and gives the new instance a fresh start (every ref is initialized fresh). Wave 9's `hasSpawnedRef` pattern survives without modification because each instance has its own ref.

**Consequences:** The Terminals subtree (`<CenterPane>` or whatever wraps both `TerminalShell` instances) gets a `key={projectRoot}` on its parent JSX element. On project change: old instance unmounts → `useWorkbenchTerminals` cleanup fires → both PTYs killed → new instance mounts → `useWorkbenchRestore(newProject)` fires → `useWorkbenchTerminals` spawn-effect fires → two new PTYs under the new project's restored cwd. StrictMode's mount-twice behavior remains a concern (each new mount could double-spawn) but Wave 9's `hasSpawnedRef` already handles that within a single instance. Phase 3's acceptance test verifies the entire chain.

## Decision 3: Active-frame state in a new sibling hook `useActiveWorkbenchFrame`, NOT inside `useWorkbenchTerminals`

**Context:** Wave 13 will need to know which terminal frame (upper or lower) is currently focused, to bind the right panel's NOW/Context/Files Touched/Latest Hunk/Hook Timeline to *that* frame's claude session. The state ("which frame is active") needs to live somewhere in Wave 10's groundwork. Two options: (a) add it to `useWorkbenchTerminals`'s return; (b) new sibling hook + context.

**Options considered:**
- *Industry standard:* Single-responsibility hooks. `useWorkbenchTerminals` already does spawn/restore lifecycle; UI focus state is a separate concern with different lifecycle (focus changes constantly; spawn happens once per project switch). Separating them keeps each hook understandable.
- *Emerging best practice:* Same — React community consensus has moved strongly toward focused hooks. See `useEvent`, `useReducer`, the React-Query ecosystem.
- *Experimental / cutting-edge:* A unified Workbench-state machine via Zustand or XState. Overkill for one boolean-shaped state; introducing a state library mid-wave is scope creep.

**Pick:** Industry standard — new sibling hook. Tier: standard.

**Rationale:** `useWorkbenchTerminals` is already non-trivial (spawn lifecycle + restore + persist + StrictMode quirks). Adding UI-focus state to it conflates two unrelated lifecycles. A small sibling hook + provider is ~30 lines and Wave 13 / Wave 12 can consume it independently of whatever else lives in `useWorkbenchTerminals`.

**Consequences:** New file `src/renderer/components/Workbench/useActiveWorkbenchFrame.ts` exports the hook + a `ActiveFrameProvider` React context provider. `Workbench.tsx` mounts the provider just inside `ProjectProvider`. Both `TerminalShell` instances consume via `useActiveWorkbenchFrame()` and call `setActiveFrame('upper' | 'lower')` on their container's `onMouseDown`. Wave 12 (terminal CRUD) and Wave 13 (right-panel binding) both consume; neither has to coordinate state changes with `useWorkbenchTerminals`.

## Decision 4: InnerRail project dropdown is a NEW component, not an extension

**Context:** Phase 2 wires three project-switching surfaces: outer rail chips (already present), title bar `ProjectChip` (already renders; needs dropdown overlay), and InnerRail header (no existing dropdown component). The InnerRail surface either reuses the title bar's dropdown or introduces a sibling.

**Options considered:**
- *Industry standard:* Extract a shared dropdown primitive both consume. DRY argument; reduces duplication.
- *Emerging best practice:* Two siblings that share a styling token but not implementation. Acknowledges the two surfaces have different ergonomic requirements (title bar dropdown opens from below; inner rail dropdown opens from within a column with limited horizontal space).
- *Experimental / cutting-edge:* A "ProjectDropdownProvider" context that any surface can opt into. Premature abstraction for two consumers.

**Pick:** Emerging best practice — two siblings sharing a styling token. Tier: pragmatic.

**Rationale:** The two surfaces have meaningfully different layout constraints (title bar: wide horizontal; inner rail: narrow vertical), and Wave 10's job is to wire functionality, not to design a long-lived dropdown primitive. Two ~60-line components is cheaper than one shared 120-line primitive + two wrappers. If a third dropdown shows up in a later wave (Wave 11 or 12), extract then.

**Consequences:** Phase 2 creates `TitleBar/TitleBarProjectDropdown.tsx` (sized for title-bar layout) and `Rails/InnerRailProjectDropdown.tsx` (sized for narrow-column layout). Both call the same `useProject()` API + `useWorkbenchProjects()` for the list. Both use the same canon-design `Tokens.surfaceMenu` / `Tokens.borderSubtle` (or whatever the canon dropdown token set is — verify at Phase 2 against `design-system/`). If duplication grows uncomfortable across Waves 11–13, extract a shared primitive in a follow-up wave.

## Decision 5: Wave 10 reads `setProjectRoot` semantics first; extends only if needed

**Context:** Wave 10's UI wiring assumes a "switch active project AMONG `projectRoots`" API. `ProjectContext.tsx` exposes `setProjectRoot`, `addProjectRoot`, `removeProjectRoot`, `clearProject` — but the exact semantics of `setProjectRoot` (does it append? replace? move-to-front? require the path to already be in `projectRoots`?) aren't visible from the explorer's pass. Wave 10 either trusts the name (`setProjectRoot` does what we want) or verifies first.

**Options considered:**
- *Industry standard:* Trust the name; if wrong, fix at Phase 2 implementation time.
- *Emerging best practice:* Verify at Phase 1 (read the source); document the finding; extend the API only if existing semantics don't fit.
- *Experimental / cutting-edge:* Refactor `ProjectContext` entirely into a more orthogonal API. Out of scope; scope creep.

**Pick:** Emerging best practice — verify first, conditionally extend. Tier: pragmatic.

**Rationale:** "Trust the name" risks Phase 2 implementers writing code against the wrong API and discovering the mismatch at integration time. Reading 156 lines of `ProjectContext.tsx` is a 2-minute Phase-1 task. The cost of verifying is trivial; the cost of guessing wrong is a Phase-2 rework. The conditional extension (adding `setActiveProjectRoot` only if `setProjectRoot` doesn't switch-active) is a thin add that doesn't risk other consumers.

**Consequences:** Phase 1's first action is to read `src/renderer/contexts/ProjectContext.tsx` and document `setProjectRoot`'s actual behavior in the result brief. Phase 2's brief is written conditionally: "if Phase 1 found `setProjectRoot` switches-active, use it; if Phase 1 added `setActiveProjectRoot`, use that." The orchestrator updates Phase 2's brief between phases based on Phase 1's documented finding. No second-guessing in the implementer's seat.
