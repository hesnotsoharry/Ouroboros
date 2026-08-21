# Known Issues

Distilled, verified fixes for non-obvious recurring problems. Keyed by slug. Each entry: signature (how to recognize it) / fix / pointer / assert (how to confirm it's actually this).

## packaged-build-defender-thrash

**Signature:** The packaged Ouroboros `.exe` pegs NVMe I/O and climbs system RAM toward 100% during iterative install/launch testing, while `npm run dev` stays completely fine. Main-process memory instrumentation (heap, RSS, cache sizes) stays flat — no code-side leak signature.

**Root cause:** Windows Defender (`MsMpEng.exe`) real-time scanning, not an Ouroboros memory leak. `npm run dev` never runs `electron-builder`, so it never produces installers. Iterative packaged testing creates many fresh **unsigned** ~217MB `.exe` installers in `dist/` (observed: 15 installers = 3.4GB in one session) plus an unsigned install tree at `%LOCALAPPDATA%\Programs\Ouroboros`. Defender scans freshly-written unsigned executables aggressively and re-scans the 200MB+ `app.asar` on every launch; the IDE's own indexing I/O (autoSync reindex, contextWorker repo map) triggers additional on-access scans on top.

**Fix (environmental, not code):**
1. Purge the `dist/` installer pile between test cycles — keep only the current version: `find dist -name "Ouroboros Setup *.exe*" ! -name "*<current-version>*" -delete`.
2. Add Defender exclusions in an **elevated** PowerShell: `Add-MpPreference -ExclusionPath` for `%LOCALAPPDATA%\Programs\Ouroboros`, `%APPDATA%\Ouroboros`, and the repo root; `Add-MpPreference -ExclusionProcess "Ouroboros.exe"`.
3. Long-term / shipping implication: unsigned installers also cause Defender/SmartScreen friction for end users — code signing is the real fix if/when distribution matters (track separately).

**Pointer:** diagnosed 2026-05-20 via Resource Monitor → Disk tab, which showed `MsMpEng.exe` in 7 of the top 10 disk consumers at the time of the thrash.

**Assert / how to confirm it's this, not a real leak:** open Resource Monitor → Disk **before** chasing code-side leak theories. If `MsMpEng.exe` shows heavy disk activity concurrent with the thrash, and main-process `memoryUsage()`/RSS stays flat, it's this — not a code leak.

## os-level-event-loop-starvation

**Signature:** An in-app operation that should take milliseconds instead takes **double-digit seconds** (e.g. `git:branch` or `files:mkdir` IPC handlers logging tens-of-seconds durations), the `[jank] event loop blocked for ~Nms` log line shows a long block with `ops: []` (no tracked async op), and main-process heap/RSS stays flat (no memory growth).

**Root cause:** This is NOT the app blocking on its own code and NOT a memory leak — it is the Electron main thread being **starved at the OS scheduler level** by other processes competing for CPU/disk. Confirmed cause in the 2026-05-30 investigation: a storm of spawned `codebase-memory-mcp.exe` / graph-MCP / Claude CLI processes (see `roadmap/bugs/2026-05-30-machine-lockup-mcp-process-storm.md`, status TRIAGED). Four wrong mechanism theories (process-table → git semaphore → diff-review → hook-dispatch) were chased first by trusting in-app `[trace:*]` instrumentation, which cannot see OS-level process contention.

**Fix / how to diagnose:** STOP adding in-app instrumentation once you see seconds-long blocks with `ops: []` + flat heap. Pivot immediately to the OS process list — Task Manager's Disk/CPU tabs, or `tasklist` / `Get-Process` with parent-PID lookup — and ask "what is eating the whole machine," not "what is slow in my code." Per-process spawn storms (MCP servers, subprocesses, repo scans) are invisible to the app's own trace logs.

**Pointer:** diagnosed 2026-05-30 via Resource Monitor / Task Manager, which showed dozens of `codebase-memory-mcp.exe` / `node.exe` processes spawned as children of the IDE process tree after renderer mount.

**Assert / how to confirm it's this, not app-code blocking:** the `[jank]` log shows `ops: []` (nothing tracked) with a block duration in the seconds-to-minutes range, AND `memoryUsage()`/RSS stays flat throughout. If both hold, check the OS process list before re-reading application code.

## workbench-tests-uncovered-by-test-layout-script

**Signature:** A change under `src/renderer/components/Workbench/**` reports green via `npm run test:layout`, but Workbench-specific regressions are still present.

**Root cause:** `test:layout` runs `vitest run src/renderer/components/Layout` (see `package.json`), but the Workbench components live in the sibling directory `src/renderer/components/Workbench/` — a separate tree the script never touches. There is currently no scoped npm script covering Workbench at all, so `test:layout` passing says nothing about it. (Observed 2026-05-30: a subagent cited "test:layout 819 passed" as proof a Workbench refactor was safe while 72 Workbench tests were actually red, 2 of which had been silently broken since Wave 13.)

**Fix:** When touching `src/renderer/components/Workbench/**`, run `npx vitest run src/renderer/components/Workbench` explicitly — do not trust `test:layout` for Workbench coverage. Read the literal `Tests N failed | M passed` line rather than a piped/truncated summary (piping through `tail`/`grep` can mask a non-zero exit code).

**Pointer:** diagnosed 2026-05-30; verify still-true before relying on it — a `test:workbench` script may have been added since (check `package.json` "scripts").

**Assert / how to confirm it's this:** `grep -n "test:layout" package.json` shows the script scoped to `components/Layout`, and `ls src/renderer/components/Workbench` shows the directory exists as a sibling, not a subdirectory, of `Layout`.
