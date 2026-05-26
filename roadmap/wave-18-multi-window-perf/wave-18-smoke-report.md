---
status: PENDING-COLE
created: 2026-05-26
wave: 18
---

# Wave 18 Smoke Report — Multi-Window Perf

The autonomous orchestrator could not drive a live IDE session. Cole walks through this checklist on the next interactive session; results land here. Flip status → SHIPPED-VERIFIED on PASS.

## Pre-flight

- [ ] On master (post-merge of `wave-18-multi-window-perf`)
- [ ] Worktree removed (per standing directive)
- [ ] DevTools open + console filtered to `[trace:|[jank]|[perf]|[rulesWatcher]`

## Scenarios

### 1. `npm run dev` opens ONE window (W1 verification)

Run `npm run dev` from PowerShell.

Expected:
- [ ] **Exactly ONE BrowserWindow opens** (not 3)
- [ ] `[perf] startup` summary line fires ONCE (not 3 times)
- [ ] No `[perf] markStartup: phase X already marked` warnings
- [ ] Window opens in <10s (not 27s)

### 2. Override single-window default (W1 opt-out verification)

Quit. From PowerShell: `$env:OUROBOROS_SINGLE_WINDOW=0; npm run dev`

Expected:
- [ ] All sessions restore (N windows where N = prior session count)
- [ ] Multi-window behavior unchanged from pre-Wave-18 EXCEPT shared partition + dedup'd init

### 3. 3-window cold start (W2 + W4 verification, after re-enabling multi-window)

Set up: have 3 windows open at last quit. Relaunch with override (Scenario 2).

Expected:
- [ ] 3 windows open
- [ ] **No 27s renderer-bundle-loaded** — should be <10s total (W2: shared partition lets Chromium cache the bundle after first window fetches it)
- [ ] `[trace:contextLayer.acquire]` for the same root fires ONCE as `inFlight=started`, then twice more as `inFlight=joined` (W4 verification)
- [ ] **Active subprocess count under 20** when 3 windows finish loading (was 45 pre-wave)

### 4. Cold-start indexer (W3 — the critical fix)

After the 3-window cold start, watch for the indexer trace:

Expected:
- [ ] **`[trace:autoSync.initWithLaunchDiff] dispatching to worker root=...`** fires (W3 confirmation — work routed to worker, not main thread)
- [ ] **`[trace:worker.launchDiff] start projectName=...`** + **`[trace:worker.launchDiff] hashes=... changed=... deleted=... elapsed=...ms`** appear in the worker log
- [ ] **Zero `[jank]` events > 500ms during the cold-start indexing window**
- [ ] If the project has stale files, `[trace:worker.launchDiff] reindex triggered changedPaths=...` fires
- [ ] Indexing completes without blocking IDE interactivity (you can click, scroll, type while indexing runs)

### 5. rulesWatcher noise gone (W5)

Watch the startup log:

Expected:
- [ ] **Zero `[rulesWatcher] watchRecursive failed: Invalid handle` lines** (was 22)
- [ ] If `.claude/commands` or `.claude/rules` don't exist on disk for your project: silently skipped, no log noise

### 6. Active editing (post-Wave-17 fix retest)

Open a source file, save with no changes (no-op save).

Expected (Wave 17 fix still working):
- [ ] `[trace:autoSync.reindex] done in <100ms files=0` ✓
- [ ] `[trace:pipeline.runIndex] no-op fast-path` fires ✓
- [ ] **Plus Wave 18:** during the save, no `[jank]` events from concurrent activity in other windows

### 7. Settle-back (5+ minutes normal editing)

Edit and save files for a few minutes across the windows.

Expected:
- [ ] **0 jank events > 500ms over 5 minutes** ← PRIMARY ACCEPTANCE
- [ ] No accumulating slowness
- [ ] Cole's verdict: "actually usable"

## If any scenario fails

Report scenario # + observed traces. Will dispatch a follow-up diagnostician.

## If all pass

Flip `SHIPPED-PENDING-SMOKE` → `SHIPPED-VERIFIED` in `waveplan-18.md` + `HANDOFF.md`. Update the temperature log entry from "COOL pending verification" → just "COOL".
