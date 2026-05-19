---
vendor: 'node-pty'
sdkVersion: 'node-pty@1.x (beta) — check package.json for pinned version'
firstWritten: 2026-05-18
lastVerified: 2026-05-18
relatedPaths:
  - src/main/pty.ts
  - src/main/ptyAgent.ts
  - src/main/ptyHost/
  - src/main/claudeUsagePoller.ts
notes: 'No behavioral gotchas captured yet. Primary lesson from Wave 92: node-pty is a native module and must be excluded from Stryker mutate globs — see stryker-electron.md.'
---

# node-pty gotchas

> First written 2026-05-18. node-pty is Agent IDE's PTY backend for all terminal sessions
> (`src/main/pty.ts` — 8 import sites identified in Wave 92 Phase 2 audit). No
> behavioral gotchas have been captured from waves touching node-pty directly.

## Stryker exclusion (only captured lesson to date)

node-pty is a native module. Stryker's sandbox cannot rebuild native modules at mutation
time. Any file in `mutate:` that transitively imports `node-pty` will fail the Stryker
baseline run with `Could not locate the bindings file` or `MODULE_NOT_FOUND`.

The exclusion pattern and the full 4-module no-touch list are documented in
`.claude/vendor-gotchas/stryker-electron.md`. Do not duplicate that guidance here —
treat `stryker-electron.md` as the canonical reference for native-module/Stryker
interaction.

**Import sites (Wave 92 Phase 2 audit, 2026-05-16):**

| File | Role |
|---|---|
| `src/main/pty.ts` | Session management — primary entry point |
| `src/main/ptyAgent.ts` | Agent-facing PTY wrapper |
| `src/main/ptySpawn.ts` | Spawn helpers |
| `src/main/ptyHost/` | PTY host subsystem (multiple files) |
| `src/main/claudeUsagePoller.ts` | Usage polling over PTY |

3 of the 8 sites are type-only imports (no runtime native-module load at those sites).

## TODO — capture lessons when next wave touches node-pty directly

No waves have yet documented node-pty-specific behavioral issues (version surprises,
Windows spawn edge cases, PTY resize race conditions, shell env inheritance, etc.).
When the next wave touches `pty.ts` or `ptyHost/`, add learnings here in the canonical
format (Symptom / Why / Fix / Source trail).

## Source trail

| Hit | Trigger | File |
|---|---|---|
| 2026-05-16 (Wave 92 Phase 2) | Native-module audit for Stryker exclusion list | `roadmap/wave-92-cross-platform-lockfile-stryker/wave-92-result.md` |
