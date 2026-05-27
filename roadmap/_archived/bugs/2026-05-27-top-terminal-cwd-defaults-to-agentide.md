---
status: OPEN
severity: HIGH
created: 2026-05-27
updated: 2026-05-27
scheduled-for: wave-14-rails-ui-fix-sweep
---

# Bug: Top dock terminal auto-spawns Claude in AgentIDE cwd regardless of active project

## Symptom

Cole, 2026-05-27:

> The bottom shell populates the correct cwd for whichever project I am in, but the top terminal auto spawns claude into agentide, which makes no sense.

When the workbench dock mounts (two terminal slots: top + bottom), the **bottom terminal correctly uses the active project's root as cwd**. The **top terminal ignores the active project and always launches Claude in `C:\Web App\AgentIDE`** (the IDE's own working directory).

This is consistent across project switches: bottom slot follows the active project, top slot is pinned to AgentIDE.

## Code surface (per prior explorer)

- `src/renderer/components/Workbench/Terminals/useWorkbenchTerminals.ts`
  - Bottom spawn (~line 78): `cwd: lowerCwd` derived from persisted workbench state
  - Top spawn: likely the symmetric `upperCwd` path; either lacks the fallback, has a hardcoded path, or threads `cwd: undefined` to the spawn
- `src/renderer/components/Workbench/Terminals/useWorkbenchRestore.ts` — derives `lowerCwd` / `upperCwd` from persisted `canonWorkbenchSessions[projectRoot]`
- `src/main/ipc-handlers/pty.ts` — `spawnClaudePty()` / `spawnPty()`. When `cwd` is undefined, the spawn falls back to `process.cwd()` which is the IDE's own root (`C:\Web App\AgentIDE`)
- `claudeAutoLaunch` (wherever it lives — likely renderer) — if the top slot's "auto-launch Claude" path bypasses the workbench cwd resolution and goes direct to a spawn helper

## Suspected root cause (to be confirmed by diagnosis)

The top slot's spawn path is missing the `cwd: lowerCwd ?? projectRootRef.current ?? undefined` fallback chain that the bottom slot uses. When `upperCwd` is undefined on first mount (no persisted top-slot data for the project), the spawn fires without a cwd and the main process resolves to `process.cwd()`.

Wave 12 added per-project `TabCollection` persistence (`{ upper: TabCollection, lower: TabCollection }`), so the schema supports per-slot cwd. The bug is in how the top slot READS that schema or what it does when no entry exists yet.

## Reproduction

1. Launch the IDE (`npm run dev`).
2. Switch to a project other than AgentIDE (e.g. Gamify, Contractor App).
3. Observe the top dock terminal: Claude prompt shows `(C:\Web App\AgentIDE)` or similar.
4. Observe the bottom dock terminal: correct project cwd.

## Fix direction (small, scoped)

Mirror the bottom slot's cwd resolution in the top slot's spawn. Likely a 1-3 LOC fix in `useWorkbenchTerminals.ts`. If `claudeAutoLaunch` bypasses workbench cwd resolution entirely, the fix is to plumb the active project root through that path.

## Severity rationale

HIGH because the top terminal is the primary "agent in current project" surface — when it's pinned to AgentIDE, every agent action (file ops, builds, tests) happens in the wrong repo. Cole has been working around this manually but it's a correctness bug, not a UX bug.

## Acceptance

- Switching active project causes the top terminal's next-spawned Claude session to use the new project's root as cwd.
- For an already-running top-terminal session, the existing cwd is preserved (Claude was already there; switching projects shouldn't kill the live session).
- Behavior matches the bottom slot exactly.
