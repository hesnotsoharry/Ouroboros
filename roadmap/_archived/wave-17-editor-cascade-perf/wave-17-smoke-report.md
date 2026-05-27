---
status: PENDING-COLE
created: 2026-05-25
wave: 17
---

# Wave 17 Smoke Report — Editor Cascade Perf

The autonomous orchestrator could not drive a live IDE session to capture traces. Cole walks through this checklist on the next interactive session; results land here.

## Pre-flight

- [ ] On master (post-merge of `wave-17-editor-cascade-perf`)
- [ ] `npm run dev` running cleanly
- [ ] At least one project open (Agent IDE itself or Gamify recommended — larger projects exercise the cascade more visibly)
- [ ] DevTools open + console filtered to `[trace:` to see the new instrumentation lines

## Scenarios

### 1. Save a file with NO changes (no-op save)

Open a source file in the editor, then Cmd-S / Ctrl-S without changing anything.

Expected console traces (in order, ~3s after save):

- [ ] `[trace:autoSync.triggerReindex] pendingEventsSize=1 reindexing=false hintPaths=N` (N may vary)
- [ ] `[trace:workerClient.runIndex] queueDepth=0 busy=false`
- [ ] `[trace:filterChangedFiles] subset start candidates=1 hints=1 project=...` (subset path active because watcher hint passed)
- [ ] `[trace:filterChangedFiles] done changed=0 elapsed=<50ms` ← **this is the key acceptance signal**
- [ ] `[trace:pipeline.resolve] allFiles=... changed=0 hint=1`
- [ ] `[trace:pipeline.runIndex] no-op fast-path: 0 changed files, skipping all passes`
- [ ] `[trace:autoSync.reindex] done in <100ms files=0` ← **was 9075ms pre-Wave-17**

### 2. Save a file WITH changes (single-file)

Change one line, save.

Expected:

- [ ] Same `[trace:autoSync.triggerReindex]` + `[trace:workerClient.runIndex]` lines
- [ ] `[trace:filterChangedFiles] subset start candidates=1 hints=1`
- [ ] `[trace:filterChangedFiles] done changed=1 elapsed=<100ms`
- [ ] `[trace:pipeline.resolve] allFiles=... changed=1 hint=1`
- [ ] NO no-op-fast-path line (because changed > 0)
- [ ] `[trace:autoSync.reindex] done in <2000ms files=1` (the actual indexing work runs on the worker but only for 1 file)

### 3. Concurrent saves (the original symptom)

Save 2-3 files in rapid succession.

Expected:

- [ ] No jank event > 500ms in the main process (no `[jank]` lines if instrumented; or no perceptible UI freeze)
- [ ] Each save's trace lines complete cleanly without intermixing chaos
- [ ] No `files:saveFile` slow-handler line at 12-13s (this WAS the original symptom — the timer-artifact line should be gone because the underlying jank is gone)
- [ ] If `[trace:autoSync.triggerReindex]` shows `reindexing=true` on the second save → second save's watcher events accumulate in `watcherHintPaths`, fire after the first reindex completes (this is the queue serialization Wave 17 didn't change but is now fast because both reindexes are no-ops)

### 4. `config:set` (settings panel)

Open Settings, change any setting, save.

Expected:

- [ ] No `config:set` slow-handler line at 1-4s (was the original symptom; should be gone because the jank source is fixed)
- [ ] Setting persists correctly (no functional regression)

### 5. Cold-start indexer (boot the IDE fresh)

Quit and relaunch.

Expected:

- [ ] `[trace:workerClient.runIndex] queueDepth=0 busy=false` on first index
- [ ] `[trace:filterChangedFiles] start allFiles=... project=...` (full-catalog path on cold start; no watcher hint)
- [ ] `[trace:filterChangedFiles] done changed=... elapsed=<X>ms` where X reflects actual indexer work
- [ ] `[trace:contextLayer.buildRepoIndex] elapsed=<Y>ms` (new trace D — was unquantified pre-wave; this is the secondary 3s gap to monitor)

### 6. Settle-back behavior (5+ minutes of editing)

Edit and save files normally for a few minutes.

Expected:

- [ ] **0 jank events > 500ms over 5 minutes** ← **PRIMARY ACCEPTANCE CRITERION**
- [ ] No accumulating slowness
- [ ] IDE feels responsive on every save

## If any scenario fails

Report which scenario + the trace lines observed + any unexpected output. Will dispatch a `sonnet-diagnostician` for follow-up.

## If all pass

Flip wave status: `SHIPPED-PENDING-SMOKE` → `SHIPPED-VERIFIED`. Update HANDOFF.md to reflect.
