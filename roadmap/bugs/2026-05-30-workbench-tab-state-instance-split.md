---
status: TRIAGED
created: 2026-05-30
updated: 2026-05-30
---

# Bug: Workbench tab state instance split — double spawn + sidebar pane mismatch

## Refactor goal

Extract `useWorkbenchTabs` from a per-consumer hook into a `WorkbenchTabsProvider` React
context that owns tab state ONCE per (frame, project), eliminating the double-spawn on
startup and ensuring `AgentSidebar`'s pane-id always reflects the tab the user is actually
looking at.

---

## Confirmed root cause (do not re-investigate)

`useWorkbenchTabs(frame, projectRoot)` is stateful (`useState`) with NO shared store and is
called from TWO sites:

- `TerminalShell.tsx:84` — instance A (the actual terminal the user interacts with)
- `AgentSidebar.tsx:274` inside `useActivePaneId()` — instance B

Each instance initialises its own `TabCollection` via `useTabRestoreInit`, including
`buildNewTab(frame, defaultKind(frame))` run synchronously in `useRef` at line 185,
and fires `spawnTab(tab.id, tab.kind, cwd)` via the `useEffect` at lines 193-210.

Consequences:
1. On every app start, two idle claude PTY processes are spawned for the upper frame
   (one from each hook instance — the `spawnedTabsRef` dedup guard only protects within
   a single hook call, not across instances).
2. `AgentSidebar` (`useActivePaneId`) reads `activeTabId` from instance B, which is a
   separate `TabCollection` that never receives the tab selections or spawns made by the
   user through instance A (TerminalShell). The sidebar is always bound to an idle,
   invisible pane.

---

## Current structure

| File | Responsibility | Lines |
|---|---|---|
| `src/renderer/components/Workbench/Terminals/useWorkbenchTabs.ts` | Stateful hook: TabCollection state, spawn, restore, persist — one instance per call site | 241 |
| `src/renderer/components/Workbench/Terminals/TerminalShell.tsx` | Renders upper/lower terminal shell; calls `useWorkbenchTabs` at line 84 | 113 |
| `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.tsx` | `useActivePaneId()` at line 270 calls `useWorkbenchTabs`; uses `activeTabId` to derive pane id | 308 |
| `src/renderer/components/Workbench/Workbench.tsx` | Root shell; mounts `<ActiveFrameProvider>` at line 212; renders `<CenterPane>` + `<AgentSidebar>` inside `MiddleRow` at lines 127-134 | 228 |
| `src/renderer/components/Workbench/Terminals/CenterPane.tsx` | Mounts two `<TerminalShell>` instances at lines 163-180 | 207 |
| `src/renderer/components/Workbench/Terminals/useWorkbenchRestore.ts` | One-shot async read of `canonWorkbenchSessions`; returns `isReady` + `upper/lowerCollection` | 138 |
| `src/renderer/components/Workbench/Terminals/useWorkbenchSessionPersist.ts` | Debounced + safety-interval writer per frame; called once per `useWorkbenchTabs` instance | 158 |
| `src/renderer/components/Workbench/useActiveWorkbenchFrame.tsx` | `ActiveFrameProvider` context; tracks which frame the user last moused into | 63 |

---

## Proposed structure

### New file: `WorkbenchTabsProvider.tsx`

`src/renderer/components/Workbench/Terminals/WorkbenchTabsProvider.tsx`

Estimated ~200 lines (within the 300-line lint cap).

**Responsibilities:**
- Owns `TabCollection` state for BOTH frames (`upper` and `lower`) under one React context.
- Owns ONE `spawnedTabsRef` per provider instance; this ref is shared across both frames so
  a given tab id is spawned at most once globally, even if the component tree re-renders.
- Calls `useWorkbenchRestore(projectRoot)` ONCE and distributes `upperCollection` /
  `lowerCollection` into the respective frame states.
- Calls `useWorkbenchSessionPersist` ONCE per frame (two calls total, same as before).
- Exposes a `useWorkbenchTabsContext(frame)` hook that returns the same
  `UseWorkbenchTabsResult` shape as the current hook.
- Re-initialises (re-mounts) when `projectRoot` changes, identical to the current `key`
  prop pattern on `<CenterPane key={projectKey}>` in `Workbench.tsx`.

**Provider API:**

```ts
// New context hook — both consumers call this instead of useWorkbenchTabs.
export function useWorkbenchTabsContext(
  frame: 'upper' | 'lower',
): UseWorkbenchTabsResult

// Provider component — mounts once inside Workbench.
export function WorkbenchTabsProvider({
  projectRoot,
  children,
}: {
  projectRoot: string | null;
  children: React.ReactNode;
}): React.ReactElement
```

The `UseWorkbenchTabsResult` type (exported from `useWorkbenchTabs.ts`) stays unchanged —
this is a pure drop-in for the call sites.

### Retained/modified file: `useWorkbenchTabs.ts`

Preferred outcome: `useWorkbenchTabs` becomes a thin wrapper that calls
`useWorkbenchTabsContext(frame)`, keeping the call sites untouched except for the two
direct call sites that will be updated (see Migration order). This avoids needing to update
the acceptance-test mocks that mock `useWorkbenchTabs` at the module level.

Alternate (delete it): replace both call sites with `useWorkbenchTabsContext` directly,
then delete the file. This is cleaner but requires updating 12 test files that mock
`'./useWorkbenchTabs'`.

**Recommendation: thin-wrapper.** Rationale: the `vi.mock('./useWorkbenchTabs', ...)` calls
in `TerminalShell.*.test.tsx` files (three files) would still work without changes. The
paneIdBinding acceptance test mocks `useWorkbenchSessionPersist` and `useWorkbenchRestore`
at the module level which also still applies. Only `AgentSidebar.tsx` needs its call site
changed from `useWorkbenchTabs` to `useWorkbenchTabsContext` (or the thin wrapper
`useWorkbenchTabs` can be reused there too — see Step 5). No test files need updating in
the thin-wrapper approach.

### Mount point (Workbench.tsx:212)

The Lowest Common Ancestor of `<CenterPane>` (which mounts `<TerminalShell>`) and
`<AgentSidebar>` is `<MiddleRow>` (rendered inside `<WorkbenchStage>`, inside
`<ActiveFrameProvider>`).

The `WorkbenchTabsProvider` MUST mount INSIDE `<ActiveFrameProvider>` (because it needs no
frame context itself, but its consumers do) and INSIDE `ProjectContext` (it reads
`projectRoot`). It MUST wrap both `<CenterPane>` and `<AgentSidebar>`.

**Exact mount point:** `Workbench.tsx`, inside the `<ActiveFrameProvider>` at line 212,
wrapping `<WorkbenchStage>` (or equivalently, wrapping the `<MiddleRow>` call at line 171).

Wrapping the whole `<WorkbenchStage>` is the safer choice: it ensures any future consumer
added to any region (e.g. `TitleBar` or `StatusBar` reading the active tab) is also covered.

```tsx
// Workbench.tsx:210-226 (current)
<DiffReviewProvider>
  <ActiveFrameProvider>
    <WorkbenchStage ... />
  </ActiveFrameProvider>
</DiffReviewProvider>

// After Step 3:
<DiffReviewProvider>
  <ActiveFrameProvider>
    <WorkbenchTabsProvider projectRoot={projectKey === '__no-project__' ? null : projectKey}>
      <WorkbenchStage ... />
    </WorkbenchTabsProvider>
  </ActiveFrameProvider>
</DiffReviewProvider>
```

`projectKey` is already computed at line 208: `const projectKey = projectCtx?.projectRoot ?? '__no-project__'`.
Pass `projectRoot` directly, not `projectKey`, since `__no-project__` should map to `null`.
Use `projectCtx?.projectRoot ?? null` (line 207's `projectCtx` is already in scope).

The `<CenterPane key={projectKey}>` prop at line 128 forces CenterPane to remount on project
switch. With the provider, that key can be lifted to `<WorkbenchTabsProvider key={projectKey}>`
instead (or kept on both — kept on CenterPane for safety since CenterPane also owns split-ratio
state). Both are acceptable; keeping the key on CenterPane AND adding key to the provider is
the safe default. See Risk 4.

---

## Migration order

Each step must leave the build typecheck-green (`npx tsc --noEmit`) before the next step starts.

### Step 1 — Create `WorkbenchTabsProvider.tsx` (new file, no callers yet)

**What:** Create
`src/renderer/components/Workbench/Terminals/WorkbenchTabsProvider.tsx`.

Extract the following from `useWorkbenchTabs.ts` into the provider (do not delete from the
original file yet — Step 2 handles that):

- Import `useWorkbenchRestore` and `useWorkbenchSessionPersist` (same imports as today)
- Own `TabCollection` state for `upper` AND `lower` frames (two `useState` calls)
- Own ONE `spawnedTabsRef: React.MutableRefObject<Set<string>>` (shared across both frames)
- Call `useTabRestoreInit` for each frame with the shared `spawnedTabsRef`
- Call `useWorkbenchSessionPersist` for each frame
- Call `useTabActions` for each frame
- Expose a context with `{ upper: UseWorkbenchTabsResult; lower: UseWorkbenchTabsResult }`
- Export `useWorkbenchTabsContext(frame)` as the public hook

**Risk at this step:** None — the file is new, has no callers, and imports only types and
helpers from existing files. TypeScript will confirm the shape is compatible.

**ESLint risk:** The provider function body will likely exceed 40 lines (two frames × restore +
persist + actions). Mitigation: extract a `useFrameTabState(frame, ...)` helper that
encapsulates the per-frame setup. This keeps the provider function and each helper under
the 40-line cap. The implementer decides the exact factoring; the planner flags the
constraint. The file itself should stay under 300 lines.

### Step 2 — Make `useWorkbenchTabs` a thin wrapper

**What:** Replace the body of `useWorkbenchTabs` in `useWorkbenchTabs.ts` with a call to
`useWorkbenchTabsContext(frame)`. The `useWorkbenchRestore`, `useWorkbenchSessionPersist`,
`spawnedTabsRef`, and all state are now in the provider.

All other exports from `useWorkbenchTabs.ts` stay intact: `TabState`, `TabCollection`,
`UseWorkbenchTabsResult`, `buildSpawnEnv`. The helpers `buildNewTab`, `makeTabId`,
`defaultKind`, `spawnTab`, `autoResumeCcTab`, `useTabActions`, `useTabRestoreInit`,
`resolveCloseResult`, `applyAddTab`, `applyRenameTab` can either stay in the file (as
unexported helpers imported by the provider) or move into the provider file — implementer's
choice, but they must not be duplicated.

**Risk at this step:** `useWorkbenchTabs` now requires `WorkbenchTabsProvider` to be mounted
above it. If the provider is NOT yet mounted (Step 3 hasn't landed), every existing call
site will throw (or get the null-context fallback if you add one). Add a null-context guard
in `useWorkbenchTabsContext` that throws a descriptive error: `"useWorkbenchTabsContext must
be used inside <WorkbenchTabsProvider>"`. This makes the failure loud during development.

**Build green check:** `npx tsc --noEmit` passes. The thin wrapper has the same signature;
nothing downstream changes type-shape.

**Transient risk:** after Step 2 but before Step 3, the running app will throw at runtime
(missing provider). This is an expected transient. Steps 2 and 3 should be committed
together if possible, or Step 3 should immediately follow in the same session. Flag: do not
leave the codebase in a deployed state between Steps 2 and 3.

### Step 3 — Mount `WorkbenchTabsProvider` in `Workbench.tsx`

**What:** In `Workbench.tsx`, import `WorkbenchTabsProvider` and wrap `<WorkbenchStage>`
(or equivalently the `<MiddleRow>` subtree) as described in the Mount Point section above.

Pass `projectRoot={projectCtx?.projectRoot ?? null}` and add `key={projectKey}` so the
provider fully re-initialises on project switch (per-project re-init preserved).

**File:line for the edit:** `Workbench.tsx:211-226` (the `<DiffReviewProvider>` /
`<ActiveFrameProvider>` / `<WorkbenchStage>` block).

**Risk at this step:** StrictMode double-mount. React StrictMode mounts → unmounts →
remounts providers in development. The existing `spawnedTabsRef` + `hasInitializedRef`
guards in `useTabRestoreInit` (lines 191 and 198) already handle this within a single hook
instance. In the provider, `spawnedTabsRef` is shared across frames and persists across the
StrictMode cleanup because it lives in the provider (one level up). Verify: on first
`isReady` fire in dev mode, only ONE spawn call per tab id reaches the PTY API. If the
provider unmounts between StrictMode cycles, the ref is recreated — this is the same risk
that existed in the original hook. The existing dedup guard still fires; it just now lives
in one place.

**Verifiable via test 2.1 in `paneIdBinding.acceptance.test.tsx`** — that test mounts the
full `<Workbench>` including the provider and asserts pane-id binding. If this step is
correct, test 2.1 passes (it currently passes because the full Workbench tree is mounted
and the REAL hooks run — the mock at the paneId level is `useWorkbenchAgentData`, not
`useWorkbenchTabs`).

### Step 4 — Update `AgentSidebar.tsx` consumer

**What:** In `AgentSidebar.tsx`, `useActivePaneId` currently calls `useWorkbenchTabs`.
After Step 2 the thin wrapper still works, so this is optional for correctness — but for
clarity, update `useActivePaneId` to call `useWorkbenchTabsContext(activeFrame)` directly,
or keep the thin-wrapper call. Either compiles.

If keeping the thin wrapper: no change to `AgentSidebar.tsx`. The thin wrapper is
transparent.

If switching to `useWorkbenchTabsContext`: update line 274 of `AgentSidebar.tsx`:
```ts
// Before
const { tabs, activeTabId } = useWorkbenchTabs(activeFrame, projectRoot);
// After
const { tabs, activeTabId } = useWorkbenchTabsContext(activeFrame);
// projectRoot is no longer needed here — the provider owns it
```

Also remove the `useProjectOptional()` call at line 272 if it is no longer needed by
anything else in `useActivePaneId` (check: it's used only to get `projectRoot` for the
tabs call).

**Recommendation:** switch to `useWorkbenchTabsContext` directly for semantic clarity.
The `projectRoot` parameter is a footgun — callers were previously responsible for passing
the right root; the provider eliminates that responsibility.

**File:line:** `AgentSidebar.tsx:270-277` (the `useActivePaneId` function).

**Risk:** If `WorkbenchTabsProvider` is not mounted above `AgentSidebar` (provider missing
from tree), the context throws. Step 3 ensures the provider is mounted before this step
lands. Sequence enforced.

### Step 5 — Update `TerminalShell.tsx` consumer

**What:** `TerminalShell.tsx:84` calls `useWorkbenchTabs(thisFrame, projectRoot)`. With the
thin wrapper from Step 2, this continues to work without change. Optionally update to
`useWorkbenchTabsContext(thisFrame)` and remove the `projectRoot` arg (same rationale as
Step 4).

If keeping the thin wrapper: no change. Mark the `projectRoot` parameter on
`useWorkbenchTabs` as deprecated (JSDoc comment) for future cleanup.

**File:line (if updating):** `TerminalShell.tsx:83-87` — remove `useProjectOptional()` call
at line 83 if it's no longer needed (check: it IS used here only for `projectRoot`). After
the provider, the frame's `projectRoot` is owned by the provider.

**Risk:** Same null-context risk as Step 4. Mitigated by Step 3 landing first.

### Step 6 — Delete dead internal state from `useWorkbenchTabs.ts`

**What:** After Steps 2-5, `useWorkbenchTabs.ts` is a thin wrapper importing
`useWorkbenchTabsContext`. All internal helpers that moved to the provider can now be either:
(a) kept in `useWorkbenchTabs.ts` as unexported helpers imported by the provider, or
(b) moved into `WorkbenchTabsProvider.tsx`.

The file must NOT exceed 300 lines. If helpers remain, verify the count. If over, move
helpers to the provider file or a shared `workbenchTabsHelpers.ts` utility.

**Risk:** Circular imports. If `WorkbenchTabsProvider.tsx` imports from `useWorkbenchTabs.ts`
and `useWorkbenchTabs.ts` imports from `WorkbenchTabsProvider.tsx` (for the thin wrapper),
that is a circular dependency that TypeScript will compile but will silently produce
undefined values at runtime in the `esm` module graph. Mitigation: move shared types and
helpers to a third file (e.g. `workbenchTabsHelpers.ts`) or keep all helpers in the provider
file and have `useWorkbenchTabs.ts` import only the context hook from the provider.

**Safe pattern:**
```
workbenchTabsHelpers.ts  ← pure helpers + types (no React)
WorkbenchTabsProvider.tsx ← imports helpers; exports context + useWorkbenchTabsContext
useWorkbenchTabs.ts       ← imports useWorkbenchTabsContext; thin wrapper only
```

No circular dependency in this arrangement.

---

## Dependency updates

After the full migration, these import statements change:

| File | Line | Old import | New import |
|---|---|---|---|
| `AgentSidebar.tsx` | 16 | `import { useWorkbenchTabs } from '../Terminals/useWorkbenchTabs'` | `import { useWorkbenchTabsContext } from '../Terminals/WorkbenchTabsProvider'` (if going direct) |
| `AgentSidebar.tsx` | 272-273 | `useProjectOptional()` call for `projectRoot` | Remove (projectRoot owned by provider) |
| `TerminalShell.tsx` | 17 | `import { useWorkbenchTabs } from './useWorkbenchTabs'` | Unchanged if thin wrapper kept; or update to `WorkbenchTabsProvider` import |
| `TerminalShell.tsx` | 83 | `const projectRoot = useProjectOptional()?.projectRoot ?? null` | Remove if `useWorkbenchTabsContext` called directly |
| `Workbench.tsx` | ~15 (imports) | *(no existing import)* | `import { WorkbenchTabsProvider } from './Terminals/WorkbenchTabsProvider'` |
| `Workbench.tsx` | 211-226 | `<ActiveFrameProvider><WorkbenchStage .../>` | Wrap with `<WorkbenchTabsProvider projectRoot={...} key={projectKey}>` |

---

## Risks

### Per-step risks

**Step 1 — ESLint max-lines-per-function (40 lines):** The provider's render body managing
two frames will exceed 40 lines. The implementer MUST extract a per-frame setup helper.
This is a lint-gate blocker if not addressed.

**Steps 2→3 transient:** Between commit of Step 2 and commit of Step 3, the app crashes at
runtime (missing provider above `useWorkbenchTabs`). The two steps should be committed
atomically (single commit or back-to-back in the same session with no deployable state in
between).

**Step 3 — StrictMode double-spawn:** React 18 StrictMode mounts+unmounts+remounts in dev.
If the provider's `spawnedTabsRef` is created fresh on each mount, the StrictMode
unmount-remount cycle could fire a second spawn before the ref's dedup guard is in place.
Mitigation: verify `spawnedTabsRef.current.has(tab.id)` guard in `useTabRestoreInit` is
still the dedup gate; it is, because it checks the ref before calling `spawnTab`.

**Step 3 — `key={projectKey}` double placement:** If both `<WorkbenchTabsProvider key={projectKey}>` 
AND `<CenterPane key={projectKey}>` carry the project key, a project switch unmounts and 
remounts BOTH independently. This is acceptable and safe (the CenterPane key was already
there). What must NOT happen is removing the CenterPane key without the provider key, or
vice versa, so that one subtree has stale state while the other reinitialises.

**Step 4/5 — `useProjectOptional` removal in AgentSidebar:** Verify `useProjectOptional`
is not used for anything else in `AgentSidebar` before removing it. Currently the only use
in `useActivePaneId` is to pass `projectRoot` to `useWorkbenchTabs`. Check the rest of the
file (lines 1-270) to confirm no other consumers.

**Step 6 — Circular import:** Explicitly guarded in the migration plan. Implementer must
verify no circular dependency before closing.

**Multi-window:** Each Electron renderer window has its own React tree. Since the provider
is a React context (not a shared singleton or IPC channel), each window instance gets its
own `WorkbenchTabsProvider`. This is correct — tab state is per-window by design. No
multi-window risk introduced by this change.

**Persist write race:** Currently `useWorkbenchSessionPersist` is called once per hook
instance (two calls from two consumers = two parallel persist writers for the same frame).
After the migration, only ONE persist call per frame exists (in the provider). This
eliminates the race. Verify: `canonWorkbenchSessions.projectKeyed.acceptance.test.ts` still
passes (it tests the persist round-trip).

---

## Test impact

### Tests that mock `useWorkbenchTabs` at module level (thin-wrapper approach: NO CHANGE NEEDED)

If `useWorkbenchTabs` stays as a thin wrapper, these files continue to mock it at the module
boundary and no updates are required:

- `src/renderer/components/Workbench/Terminals/TerminalShell.addTab.acceptance.test.tsx` — mocks `./useWorkbenchTabs` at line 32; unchanged
- `src/renderer/components/Workbench/Terminals/TerminalShell.closeTab.acceptance.test.tsx` — mocks `./useWorkbenchTabs` at line 33; unchanged
- `src/renderer/components/Workbench/Terminals/TerminalShell.rename.acceptance.test.tsx` — mocks `./useWorkbenchTabs`; unchanged

### Tests that mount full `<Workbench>` and use the REAL hook chain (require provider in tree — automatically satisfied by Step 3)

These tests already pass `<Workbench>` which will include `<WorkbenchTabsProvider>` after
Step 3. No test code changes needed — provider is transparent:

- `src/renderer/components/Workbench/AgentSidebar/paneIdBinding.acceptance.test.tsx` — mounts `<Workbench>` with real `useWorkbenchTabs` + real `ActiveFrameProvider`. After Step 3, the real provider is in the tree. Mocks for `useWorkbenchRestore` and `useWorkbenchSessionPersist` at lines 115-128 continue to apply since they mock at the module level.
- `src/renderer/components/Workbench/Workbench.test.tsx` — mounts `<Workbench>`; must already mock `useWorkbenchRestore` and `useWorkbenchSessionPersist` (or mock `useWorkbenchTabs` wholesale). Verify existing mocks are sufficient. If `useWorkbenchTabs` was mocked at module level, that mock stops applying after Step 2 because the thin wrapper delegates to the context — the mock must be updated to mock the provider's context or mock `useWorkbenchRestore` + `useWorkbenchSessionPersist` instead.
- `src/renderer/components/Workbench/Workbench.maximize.acceptance.test.tsx` — same concern as above
- `src/renderer/components/Workbench/Workbench.projectSwitch.acceptance.test.tsx` — tests project-switch re-init; MUST verify the `key={projectKey}` on the provider unmounts+remounts correctly
- `src/renderer/components/Workbench/Workbench.projectSwitch.wave10.test.tsx` — same
- `src/renderer/components/Workbench/Workbench.responsive.acceptance.test.tsx` — check if `useWorkbenchTabs` is mocked or relied on through the tree
- `src/renderer/components/Workbench/Workbench.activeProjectRemoval.acceptance.test.tsx` — same

### Tests that test `useWorkbenchTabs` directly as a hook

- `src/renderer/components/Workbench/Terminals/useWorkbenchTabs.acceptance.test.ts` — uses `renderHook(() => useWorkbenchTabs(...))`. After Step 2, this requires `WorkbenchTabsProvider` in the wrapper. **This test needs a `wrapper` option added to `renderHook`** providing `<WorkbenchTabsProvider projectRoot="/proj/A">`. Alternatively: since `useWorkbenchTabs` becomes a thin wrapper, the test effectively tests provider + context end-to-end, which is the right coverage shape. Add the provider wrapper.

### Tests that test `AgentSidebar` directly

- `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.phase2.test.tsx` — if it renders `<AgentSidebar>` in isolation and mocks `useWorkbenchTabs`, check whether the mock needs to become a mock of `useWorkbenchTabsContext` or if the thin-wrapper means the existing mock still intercepts. With thin wrapper + vi.mock at module level for `./useWorkbenchTabs`, the mock intercepts the thin wrapper call. The result returned is used by the thin wrapper's output — this works unchanged.
- `src/renderer/components/Workbench/AgentSidebar/AgentSidebar.phase3.acceptance.test.tsx` — same analysis as phase2 test.

### Tests for persist/restore (no change expected)

- `src/renderer/components/Workbench/Terminals/useWorkbenchSessionPersist.test.ts` — tests the hook in isolation; unaffected
- `src/renderer/components/Workbench/Terminals/useWorkbenchRestore.test.ts` — tests the hook in isolation; unaffected
- `src/renderer/components/Workbench/Terminals/canonWorkbenchSessions.projectKeyed.acceptance.test.ts` — tests the full persist/restore round-trip; verify it still passes after the provider owns the single persist call

### Tests requiring provider wrapper addition (confirmed change needed)

1. `src/renderer/components/Workbench/Terminals/useWorkbenchTabs.acceptance.test.ts` — `renderHook` calls need `wrapper: ({ children }) => <WorkbenchTabsProvider projectRoot="/proj/A">{children}</WorkbenchTabsProvider>`. This is the primary mechanical update.

### Test scope for this wave

Run `npm run test:layout` + manually run the acceptance tests in:
- `src/renderer/components/Workbench/Terminals/` (all TerminalShell.* + useWorkbenchTabs.*)
- `src/renderer/components/Workbench/AgentSidebar/` (all)
- `src/renderer/components/Workbench/Workbench*.test.tsx` (all Workbench-root tests)

---

## Verification

1. **Startup spawn count:** on first launch with an empty session store, only ONE
   `pty.spawnClaude` call and ONE `pty.spawn` call should be observed in the main-process
   log. Previously two of each.
2. **Sidebar pane binding:** click a tab in the upper terminal shell → AgentSidebar must
   display that tab's session data (same `OUROBOROS_PANE_ID`). Previously the sidebar was
   bound to a phantom pane.
3. **Acceptance tests green:** run the scoped test commands listed in Test Impact.
4. **`paneIdBinding.acceptance.test.tsx` tests 2.1–2.5 all pass.**
5. **`useWorkbenchTabs.acceptance.test.ts` all tests pass** (with provider wrapper added).
6. **TypeCheck:** `npx tsc --noEmit` clean at each step.
7. **ESLint:** no `max-lines-per-function` or `max-lines` violations in the new provider file.

---

## Out-of-scope

- The `CenterPane` comment at line 191-193 notes "Mounting useWorkbenchTabs here too would
  create duplicate hook instances racing the same persist write path." That comment becomes
  stale after this refactor; update it as a comment-only edit, not a behaviour change.
- The `<CenterPane key={projectKey}>` remount-on-project-switch pattern is preserved as-is.
  Lifting all per-project re-init to the provider level (removing the CenterPane key) is a
  separate concern.
- `useWorkbenchTerminals.ts` is not touched — it spawns the initial PTY sessions for the
  two frames (not tabs) and is orthogonal to tab state.
- The `buildSpawnEnv` export (`useWorkbenchTabs.ts:59`) is used externally by PTY spawn
  consumers. It stays exported from `useWorkbenchTabs.ts` (or re-exported from the provider
  file) — do not break this export.
- Any changes to `useWorkbenchGlobeData.ts` and `useWorkbenchAgentData.ts` (modified in the
  current branch per git status) are unrelated to this refactor and must not be touched.

---

## Known gaps

None after self-critique pass. The one open implementer decision — thin-wrapper vs direct
context calls at the two consumer sites — is flagged as a recommendation (thin-wrapper),
not mandated, per the planner's constraint of not embedding implementation decisions.
