---
status: OPEN
created: 2026-05-30
updated: 2026-05-30
priority: LOW
---

# Workbench per-project tab-collection cache is unbounded within a session

Carved out of `2026-05-30-workbench-project-switch-orphans-session.md` (resolved in
commit `9e39772a`).

## Detail
The project-switch fix added an in-memory cache in `WorkbenchTabsProvider.tsx`:
`projectCacheRef = useRef<Map<string, FrameCollections>>(new Map())`. On every
switch-away the outgoing project's `{ upper, lower }` collections are saved under
its `projectRoot`, so switch-back restores instantly. The Map is never pruned — it
grows by one entry per distinct project visited during a session (reset only on a
full reload, since it lives in a `useRef`).

## Impact
LOW. Each entry is a small `TabCollection` object (a few tab descriptors), so the
memory cost is trivial even for dozens of projects. No correctness issue — purely a
tidiness / bounded-resource concern.

## Fix shape
Add a simple LRU cap (e.g. keep the last 10 visited projects; evict the
least-recently-switched on insert). Renderer-only, contained to
`useProviderCollections` / `useProjectSwitch` in `WorkbenchTabsProvider.tsx`.

## Priority
LOW. Do it when the workbench session lifecycle is next touched; not worth a
dedicated pass.
