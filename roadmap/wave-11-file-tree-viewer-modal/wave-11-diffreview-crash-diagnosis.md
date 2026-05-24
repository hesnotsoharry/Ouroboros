---
status: COMPLETE
created: 2026-05-24
updated: 2026-05-24
---

# Wave 11 — DiffReview crash diagnosis

## Root cause

`useDiffReview` (`DiffReviewManager.tsx:28`) throws unconditionally when `DiffReviewContext` is null. It is called at `useEditorHunkDecorations.ts:131` with no guard. `useEditorHunkDecorations` is called unconditionally inside `MonacoHunkGutterLayer` (`MonacoEditor.tsx:71`), which renders inside the lazy `<FileViewer>` mounted by `WorkbenchFileViewerModal`.

The canon Workbench tree (`Workbench.tsx`) does **not** include `DiffReviewProvider` anywhere above `WorkbenchFileViewerModal`. The only two mount sites in the codebase are:

- `InnerAppLayout.tsx:126` — inside `LayoutProviders`, nested under `FileViewerManager > MultiBufferManager > DiffReviewProvider` — this is the **legacy shell** path.
- `ChatOnlyShellWrapper.tsx:35` — the chat-only shell path.

Neither is an ancestor of the canon Workbench tree. The Wave 8 P3 decision to mount `FileViewer` directly (not via `FileViewerManager`) was correct to avoid listener collision, but the `DiffReviewProvider` that the legacy wrapper provides was silently left out. The crash was latent since Wave 8 P3; Wave 11 P1 exposed it by wiring file-tree clicks through the same modal path the picker uses.

## DiffReviewProvider profile

**Signature:** `DiffReviewProvider({ children: React.ReactNode })` — zero required props. Self-contained: owns `useReducer(diffReviewReducer, null)` (initial state = null), assembles all action hooks internally via `useDiffReviewContextValue`. No IPC subscriptions inside the provider itself (action hooks subscribe to file-watch events, but `useStaleFileWatcher` receives `state` directly — see Risks). No dependencies on `FileViewerManager`, `MultiBufferManager`, or any other ancestor — the legacy shell wraps it in those for historical reasons, but the provider is standalone.

**Legacy mount (`InnerAppLayout.tsx:126`):** `<DiffReviewProvider>{children}</DiffReviewProvider>` — no props.

## Fix-shape candidates (ranked)

Ranked by: (a) preserves Wave 8 P3 constraints (lazy-load intact, no listener collision), (b) blast radius, (c) LOC.

| Rank | Shape | File | LOC | Notes |
|------|-------|------|-----|-------|
| **1 (RECOMMENDED)** | Mount `<DiffReviewProvider>` in `Workbench.tsx` wrapping `<ActiveFrameProvider>` | `Workbench.tsx` | +3 | Provider is self-contained (no props). Sits above the lazy boundary by several levels. Additive-only. Provider state starts null — no idle overhead. |
| 2 | Mount `<DiffReviewProvider>` inside `WorkbenchFileViewerModal.tsx` wrapping `ModalPanel` | `WorkbenchFileViewerModal.tsx` | +3 | Tighter scope but provider remounts on every modal open/close — review state lost if modal closes mid-review. Contradicts brief guidance to avoid modal edits. |
| 3 | Add `useDiffReviewOptional` returning null-context; switch `useEditorHunkDecorations` to it | `DiffReviewManager.tsx` + `useEditorHunkDecorations.ts` | +8 | Symptom-fix: gutter decorations silently no-op instead of receiving live context. Less correct; still needs a provider eventually when diff review is actually exercised. |
| 4 | Guard in `MonacoHunkGutterLayer`: try/catch or conditional early-return | `MonacoEditor.tsx` | +5 | Same problem as #3 — suppresses the feature rather than wiring it correctly. |
| 5 | Add feature flag `enableTerminalDiffReview` in `MonacoHunkGutterLayer` | `MonacoEditor.tsx` + config | +10 | Overengineered for a problem with a clean structural fix. |
| 6 | Mount `<DiffReviewProvider>` only around `<WorkbenchFileViewerModal>` in `Workbench.tsx` | `Workbench.tsx` | +3 | Functionally same as #2 (provider remounts with modal). #1 is strictly better. |
| 7 | Upgrade modal to use `FileViewerManager` instead of `FileViewer` directly | `WorkbenchFileViewerModal.tsx` | +20 | Explicitly ruled out by Wave 8 P3 gotcha: listener-collision risk until legacy shell teardown. |

## Recommended fix

**File:** `src/renderer/components/Workbench/Workbench.tsx`

Add import at the top of the file:

```tsx
import { DiffReviewProvider } from '../DiffReview/DiffReviewManager';
```

Wrap the `Workbench` component return, placing `<DiffReviewProvider>` outside `<ActiveFrameProvider>`:

```tsx
// Before (line 153):
return (
  <ActiveFrameProvider>
    <div data-testid="workbench-root" style={stageStyle}>
      ...
    </div>
  </ActiveFrameProvider>
);

// After:
return (
  <DiffReviewProvider>
    <ActiveFrameProvider>
      <div data-testid="workbench-root" style={stageStyle}>
        ...
      </div>
    </ActiveFrameProvider>
  </DiffReviewProvider>
);
```

**Estimated diff: +1 import, +2 JSX lines = 3 LOC.** Single file. The lazy-load pattern in `WorkbenchFileViewerModal.tsx` is completely untouched. The provider sits above the lazy `<Suspense>` boundary (`WorkbenchFileViewerModal.tsx:155`) by several tree levels — context is guaranteed to be established before the lazy module resolves.

## Test shape

Extend `WorkbenchFileViewerModal.lazyLoad.regression.test.ts`: render `<Workbench>` (with mocks for `ProjectProvider`, `electronAPI`), open the modal with a `.ts` file path, assert no error boundary fallback is rendered. Specifically confirm the `useDiffReview` call inside `useEditorHunkDecorations` resolves to a non-null context rather than throwing.

## Risks / unknowns

- **`useStaleFileWatcher` at mount**: called unconditionally inside `useAllActions` which runs inside the provider at every render. If it subscribes to IPC/file-watch events when `state = null`, that is a new idle subscription in the Workbench tree. Verify `diffReviewState.ts:useStaleFileWatcher` no-ops cleanly on null state before merging. From inspection the function receives `state` as an argument — most watcher implementations guard on non-null state, but this is the one thing not confirmed by reading `DiffReviewManager.tsx` alone (it delegates to `diffReviewState.ts`).
- **`useCheckpointGuard` + `window.electronAPI.config.get`**: only fires inside a `useCallback` triggered by accept actions — safe at idle.
- **No visual regression risk**: `DiffReviewProvider` initial state is null; all consumer hooks short-circuit on null state. Zero UI change at idle.
