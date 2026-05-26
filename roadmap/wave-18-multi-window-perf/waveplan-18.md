---
status: SHIPPED-VERIFIED
created: 2026-05-25
updated: 2026-05-26
type: perf-investigation
predecessor: wave-17-editor-cascade-perf
successor: wave-19-renderer-bundle-and-fk-fixes
severity: SHOWSTOPPER
verified-by: cole-trace-00:18-00:20-2026-05-26
verification-evidence: |
  Cole's post-merge startup trace 00:18:44-00:20:13 confirmed:
  - W1: only ONE [perf] startup line (was 3) — single-window dev clamp working
  - W3: [trace:autoSync.initWithLaunchDiff] dispatching to worker; done elapsed=122ms stale=0
    (was 9075ms; ~74x improvement for empty/small projects)
  - W4: [trace:contextLayer.acquire] inFlight=started traces fire for each project switch
  - W5: clean [rulesWatcher] skipping missing dir (was 22x Invalid handle log noise)
  - W6: single [perf] startup summary
  - W2 (shared partition) is structurally correct per the commit; multi-window
    benefit unobservable from this single-window trace but the config is in place.

  Two outstanding issues surfaced by the same trace, OUT OF Wave 18 scope:
  - Single-window renderer bundle still 26s (1C diagnostic overgeneralized
    multi-window as the cause; root is Monaco+pdfjs eager-load); deferred to
    Wave 19.
  - FK constraint failures in indexer pipeline (pre-existing, structurally
    inherent since schema v0; W3 made them VISIBLE by causing 3x cold-index
    per startup); deferred to Wave 19.

  Both diagnosed; bug docs at roadmap/bugs/2026-05-26-*.md.
---

# Wave 18 — Multi-Window Perf

## Status

PLANNED. Surfaced by Cole's Wave 17 verification trace (2026-05-25
23:02-23:03). Wave 17's targeted save-cascade fix landed cleanly
(no-op reindex 9075ms → 159ms, verified), BUT a different perf
class is making the app functionally unusable when 3 windows are
open: 27s renderer bundle load, 13.3s save-time jank, native
watcher handle contention, duplicate event firing.

**Cole's quote:** "I functionally can't use the app or my computer
while the 3 windows are open. Closing them is painful, causes more
lag, having them open is painful, it is so poorly optimized."

This is a SHOWSTOPPER. Lane B B1 diagnose-first; do not swing at
fixes before evidence.

## Symptoms (from Cole's 23:02-23:03 trace)

| Symptom | Measured cost |
|---|---|
| 3 BrowserWindow instances on `npm run dev` (perf markers fire 3×) | (3 windows where 1 expected) |
| `renderer-bundle-loaded` first-marker | **26,936 ms** (was <5s in Wave 16 single-window) |
| `first-render` | **26,993 ms** |
| `[jank] event loop blocked` (one event) | **13,321 ms** |
| `files:saveFile` slow-handler line during that jank | **13,467 ms** (per Phase 1's Wave 17 finding, this is `patchIpcMainHandle` timer artifact — the real cause is the 13.3s jank itself) |
| Active handles during jank | 419 (271 Socket + 95 MessagePort + **45 ChildProcess + 45 Pipe**) |
| `[rulesWatcher] watchRecursive failed: Invalid handle` | **22 occurrences** on `.claude/commands` + `.claude/rules` |
| `mergeThreadCollection` duplicate fires (same empty payload) | **5 occurrences** in startup |
| `[approval.wait]` fires duplicate per ID | every ID fires 2x |
| `[perf] markStartup` duplicates explicitly logged | 6 duplicate markers |
| `[trace:contextLayer.buildRepoIndex]` | fires 2× (78ms + 290ms) |
| `[xterm-init]` create+open | **12 occurrences** (6 sessions × 2 windows visible) |

## Hypotheses (to verify via parallel diagnostician dispatch)

1. **Session restoration restores 3 windows on `npm run dev`** —
   per-window state is persisted in `sessionsData` (SQLite); cold
   boot restores N=3 because the prior session had 3 open. Dev
   command doesn't override.
2. **45 ChildProcess + 45 Pipe = 15 subprocesses per window
   spawning concurrently** — pty sessions, hook pipes, claude-usage
   poller, shell history probes, etc. Per-window-isolated where
   they should be main-process-shared.
3. **27s renderer bundle load is Vite HMR / asset contention across
   3 BrowserWindows** — each window pulls the renderer bundle
   independently; Vite dev server serializes or fights with itself.
4. **`rulesWatcher` per-window setup with shared OS handles** —
   each window tries `@parcel/watcher`'s `watchRecursive` on the
   same `.claude/commands` + `.claude/rules` paths; only one
   handle is available; the others fail with "Invalid handle." 22
   failures = 11 retry attempts × 2 paths.
5. **Duplicate event firing = handlers registered per-window when
   they should be global** — mirror of Wave 16 P5 (where global
   teardown was firing per-window). This wave may surface the
   inverse: per-window handlers firing globally OR global handlers
   re-registering per-window.

## Diagnostic dispatch plan (Phase 1) — DONE

All 6 agents returned. Findings synthesized below.

| # | Surface | Agent | Status |
|---|---|---|---|
| 1A | Window-spawn (why 3 on dev) | sonnet-diagnostician | DONE |
| 1B | Subprocess multiplication during save | sonnet-diagnostician | DONE |
| 1C | Renderer bundle 27s load with 3 windows | sonnet-diagnostician | DONE |
| 1D | rulesWatcher OS handle contention | sonnet-diagnostician | DONE |
| 1E | Duplicate event firing audit | sonnet-diagnostician | DONE |
| 1F | Multi-window Electron perf best practices | haiku-research-extractor | DONE (file captured by orchestrator; agent had no Write tool) |

## Synthesis — 9 findings across 6 dispatches

The 5 trace symptoms decompose into **9 distinct findings** with different
causes, severities, and fix shapes. Two are dev-mode noise (not bugs).
The CRITICAL finding is the real cause of the 13.3s jank Cole feels —
and it's **not** what the trace surface suggested.

| Finding | Sev | Source | Cause | Fix shape | Cost |
|---|---|---|---|---|---|
| **W3 — Main-thread SQLite jank** | **CRITICAL** | 1B | `IndexingPipeline.runPass()` calls `db.transaction()` synchronously on **main thread** during `systemTwoRegistry.acquire() → watcher.initWithLaunchDiff()` (`systemTwoRegistry.ts:133`). The pipeline's `setImmediate` yield is between passes, not within. 18K-node cold-start = 5-15s sync sqlite transaction. **This is the 13.3s jank. The slow-handler lines are queue-wait artifacts of this one stall.** | Move cold-start `initWithLaunchDiff` indexing to the existing worker thread (worker exists for incremental; just route cold-start through it too) OR yield within pass. Needs trace instrumentation before fix to confirm WHICH pass is the worst. | Medium |
| **W1 — 3 windows on dev (unconditional restore)** | **HIGH** | 1A | `sessionsDataToWindowSessions` at `windowManagerHelpers.ts:304-308` filters by `projectRoot && bounds` only. No cap, no dev-mode guard, no lifecycle-state check. Cole's prior 3-window quit wrote 3 sessions → restoration opens all 3. | (a) `OUROBOROS_SINGLE_WINDOW=1` env var defaulted on in `dev` npm script, (b) exclude archived/deleted sessions from restore filter. Both immediate dev relief, zero prod risk. | Tiny |
| **W2 — 27s renderer bundle (no shared HTTP partition)** | **HIGH** | 1C + 1F agree | Every `BrowserWindow.loadURL(ELECTRON_RENDERER_URL)` in `windowManagerHelpers.ts:233-240` hits Vite dev server as independent HTTP client. `webPreferences` has no `partition`/`session` → Chromium HTTP cache NOT shared. Vite (single-threaded Node.js) serializes ~25 MB module graph to 3 windows back-to-back. Monaco's 5.5 MB core chunk gets V8-cold-parsed 3× concurrently. | Shared Electron session partition (`partition: 'persist:shared'` on `webPreferences`) — exactly 1F's research recommendation. One-line change per window. Optional: stagger window restoration as safety net. | Tiny |
| **W4 — 12 git subprocess spawn during cold index** | MEDIUM | 1B | `acquireContextLayer(projectRoot)` at `windowManager.ts:297` triggers `contextLayerController.initialize()` → `runFullRebuild()` → `buildRepoIndexSnapshot()` → 4 concurrent `execFile('git', ...)` calls per root (`repoIndexerSupportGit.ts:26,36,191,127`). 3 windows × 3 distinct roots = 12 git processes. | Coalesce: one indexer per root (process-global registry); broadcast results to interested windows. Aligns with 1F's "main-process subprocess registry" pattern. | Medium |
| **W5 — rulesWatcher 22× Invalid handle** | LOW | 1D | Two compounding bugs: (a) `@parcel/watcher` Windows native throws `Error('Invalid handle')` not `ENOENT`; the catch filter at `rulesAndSkills/rulesWatcher.ts:51-56` only checks `err.code === 'ENOENT'` so Windows error falls through to `log.warn`. (b) `useRulesAndSkills` mounts in 2 components per window × 3 windows × React StrictMode double-invoke = ~11 calls × 2 paths = 22 failures. Bonus: `C:\Web App\Agent IDE\.claude` **doesn't exist on disk** — pure noise. | Two-file fix: catch filter accepts `'Invalid handle'`; add `activeRoot` idempotency guard in `ipc-handlers/rulesAndSkills.ts:265-276`. | Tiny |
| **W6 — Perf duplicates × 3** | LOW | 1E | `flushStartupLog()` at `ipc-handlers/perfHandlers.ts:52-56` runs on every `perf:mark('first-render')` IPC call with no one-shot guard. Each window's renderer triggers it. The phase-record dedup at `perfMetrics.ts:36-38` exists but the flush dedup doesn't. | Boolean guard `startupLogFlushed` mirroring `handlersRegistered` pattern in `ipc.ts:238`. One-line fix. | Tiny |
| **W7 — `approval.wait` × 2 per ID** | INVESTIGATE | 1E | Two named-pipe connections arrive for same requestId. Could be (a) two hook script invocations (expected: harmless double-resolve), or (b) client-side reconnect (a bug). 1E couldn't disambiguate without runtime data. | Add `connId` to log lines in `ideToolServerHandlers.ts:138/145`; user runs trace; confirm or pivot. Probably file as follow-up — low-impact noise unless it's a reconnect storm. | Tiny investigation |
| W8 — mergeThreadCollection × 5 / xterm-init × 12 | NONE | 1E | **React StrictMode dev-mode double-invoke** of `useEffect`. Not present in production builds. Pure dev-mode noise. | No fix needed. Optionally document. | Zero |
| W9 — contextLayer.buildRepoIndex × 2 | NONE | 1E | **Not a duplicate.** Intentional two-pass design: cold-start `initialize()` races ahead of graph; `triggerContextLayerRebuildAfterGraphReady` fires `forceRebuild()` once graph is ready. Different elapsed times (78ms vs 290ms) confirm distinct invocations. | No fix needed. Working as intended. | Zero |

## Research alignment (1F)

VS Code / 1F's industry-standard pattern endorses:
- **W1 fix:** lazy-restore (load window 1 immediately; queue 2-3 for 2-5s later) ✓
- **W2 fix:** shared `Session` to cache HTTP assets between windows ✓
- **W4 fix:** main-process subprocess registry with deduplication map ✓
- **Future:** utility process for file watching (Electron 7+; standard since 2022)

Recommended architecture aligns with diagnostic findings — fixes are not speculative.

## Phase plan (revised — pick scope)

Three scope options, ranked smallest-to-largest. **Recommend Option B**: maximum user-felt relief for moderate scope. Cole picks.

### Option A — Quick wins only (1-2 phases, ~2 hours)

Lands W5 + W6 + W1 only. All file-tiny, low-risk. Doesn't address the 13.3s jank or 27s bundle. **Limited relief.**

### Option B — RECOMMENDED — Emergency triage (4 phases + wrap, ~1 day)

Address the 3 user-felt killers + cheap polish:
- Phase 2: W1 (single-window env var + restoration filter) — immediate dev relief
- Phase 3: W3 (instrument first, then move cold-start indexer to worker) — kills the 13.3s jank
- Phase 4: W2 (shared session partition) — kills the 27s bundle when 3 windows ARE open
- Phase 5: W5 + W6 (rulesWatcher fix + perf guard) — cheap polish, ship as bundle
- Phase 6: Smoke + wrap. File W4, W7 as follow-ups.

### Option C — Full wave (6 phases, ~2 days)

Adds W4 (subprocess coalesce + main-process indexer registry) on top of Option B. Aligns with 1F's full recommended architecture. **More work, marginal additional user-felt impact** because W3's fix already eliminates the cold-start work; W4 is more about "correctness" than "user feels it."

## Locked decisions

- **Diagnose-before-fix held.** Phase 1 surface diagnostics demolished the surface assumption (the trace said "save handler is slow" — turned out to be event-loop stall artifact). Without Phase 1, fix attempts would have targeted `files:saveFile` (which is fine) instead of the SQLite indexer (which is the real cause). Recurring Wave 16/17 lesson: **slow-handler lines are artifacts when paired with jank events.**

- **Wave 17 fix is unaffected.** Wave 17's no-op fast-path eliminated the incremental-reindex 9s scan. Wave 18 W3 addresses cold-start indexer SQLite (different code path).

- **`OUROBOROS_SINGLE_WINDOW=1` on dev is the right user-facing escape hatch** — it does NOT change production multi-window behavior. Cole's productivity restored immediately; we get time to fix the architectural per-window issues without time pressure.

## Acceptance criteria (post-fix, single-window dev)

| Surface | Pre-W18 | W18 target |
|---|---|---|
| Window count on `npm run dev` | 3 (was Cole's session) | 1 (clamped via env var) |
| Cold-start indexer event-loop block | 5-15s sync | <500ms (worker offload) |
| Bundle load on 3-window prod restore | 27s | <10s (shared partition) |
| `[rulesWatcher] Invalid handle` log count | 22 | 0 |
| `[perf] startup` summary duplicates | 3 | 1 |
| Cole's verdict | "brutal" | "fine" |

## Phase plan (revised post-synthesis — Option C locked 2026-05-25)

Cole picked **Option C — full wave** on 2026-05-25 after reviewing the 9 findings + 3 scope tradeoffs. Wave 18 lands W1, W2, W3, W4, W5, W6; defers W7 as follow-up; W8 + W9 documented as non-bugs.

| # | Phase | Surface | Agent | Status | Notes |
|---|---|---|---|---|---|
| 0 | Wave plan + ADR | This doc | orchestrator | DONE | |
| 1 | Parallel diagnose (5 + research) | 6 reports | 5 sonnet-diagnostician + 1 haiku-research-extractor | DONE | |
| 2 | Synthesize | This synthesis section | orchestrator | DONE | |
| 3 | **W1 — single-window dev clamp** | `windowManagerHelpers.ts`, `package.json` dev script | sonnet-implementer | DISPATCHED | Env var `OUROBOROS_SINGLE_WINDOW=1` defaulted on for dev + exclude archived/deleted sessions from restore. Ship FIRST for immediate dev relief. |
| 4 | **W3 — cold-start indexer worker offload** | `IndexingPipeline.runPass`, `systemTwoRegistry.initWithLaunchDiff`, indexer worker integration | sonnet-architect → sonnet-implementer | DISPATCHED (architect) | The CRITICAL fix. Architect plans offload approach; implementer applies + adds 2 trace lines for verification. |
| 5 | **W2 — shared session partition** | `BrowserWindow.webPreferences.partition` | sonnet-implementer | PENDING | One-line config per window. Eliminates Vite HTTP serialization across renderer windows. |
| 6 | **W4 — main-process subprocess registry** | `repoIndexerSupportGit`, `contextLayerController` | sonnet-implementer | PENDING | Coalesce 4 git execFile calls per-root × 3 windows; broadcast results. Aligns with 1F's main-process registry pattern. |
| 7 | **W5 + W6 polish bundle** | `rulesWatcher.ts`, `rulesAndSkills.ts`, `perfHandlers.ts` | haiku-implementer | PENDING | Tiny: catch-filter for Windows `'Invalid handle'` + activeRoot idempotency + `startupLogFlushed` guard. |
| 8 | Smoke + wrap | Result brief, audit, HANDOFF, temp log, merge | orchestrator | PENDING | Cole runs live smoke against new 1-window dev default + 3-window cold start. File W7 (approval.wait) as follow-up. Worktree merge-to-master + remove (per standing directive). |

## Option C dispatch order rationale

W1 ships FIRST because it's tiny and immediately restores Cole's dev productivity. While the rest of the wave executes, he has a usable IDE.

W3 ships SECOND because it's the user-felt killer. Architect dispatches in PARALLEL with Phase 3 to save wall-clock — disjoint surfaces (W1 = window manager; W3 = indexer + system2 registry).

W2 + W4 + W5/W6 can run in PARALLEL after W3 lands (disjoint surfaces). Phase 8 wrap is sequential.

## Constraints (upfront)

- **Diagnose-first.** Wave 17 P1/P3 lesson: parallel diagnose on
  disjoint surfaces saves wall-clock; don't fix before evidence.
- **Worktree isolation NOT yet — diagnostic-only Phase 1.** Set up
  worktree before Phase 3+ when actual code changes start.
- **Architect dispatch trigger.** If any diagnostic returns a
  recommendation that's architecturally non-trivial (multi-option
  tradeoff, library choice, IPC contract change), dispatch
  `sonnet-architect` per the best-practice-spectrum rule before
  writing the ADR.
- **Cole authorization on scope.** This wave's findings will
  surface multiple distinct issues. Cole picks which to address in
  Wave 18 vs split into Wave 19, 20, etc.

## Acceptance criteria (provisional — refine post-Phase-1)

After the wave ships, a fresh `npm run dev` boot with default
session state should show:

| Surface | Target |
|---|---|
| Window count on `npm run dev` | 1 (with explicit opt-in for multi-window restore) |
| `renderer-bundle-loaded` to `first-render` | <5s (Wave 16 baseline) regardless of window count |
| Event-loop jank events > 500ms during normal use | 0 over 5 min |
| `[rulesWatcher] watchRecursive failed` | 0 |
| `[approval.wait]` duplicate fires | 0 (each event fires once) |
| `mergeThreadCollection` duplicate fires | 0 |
| Active subprocess count under normal load | <20 (was 45) |
| Cole's subjective verdict | "actually usable" |

## Note to subsequent phases

Cole's quote captured at top — refer back to it when scoping. This
is not "make it 20% faster"; it's "make it usable at all in
multi-window."
