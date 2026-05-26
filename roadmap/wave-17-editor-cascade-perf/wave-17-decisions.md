---
status: PLANNED
created: 2026-05-25
updated: 2026-05-25
---

# Wave 17 — Architectural Decisions

This file is intentionally near-empty at PLANNED status. Decisions get
captured here as Phase 0 (planning) and the Phase 1/3 diagnostics
resolve hypotheses into picks.

## Pending decisions (to resolve in Phase 0–3)

### Decision 1 (Phase 1 diagnosis output): What's the dominant blocker in `files:saveFile`?

**Context:** Multiple hypotheses listed in the waveplan. The diagnostician
must name ONE dominant cause with code-level evidence.

**Status:** Pending Phase 1 dispatch.

### Decision 2 (after Decision 1): How to async-ify the dominant blocker?

**Options (resolve per Decision 1's verdict):**

- *Industry standard:* Move synchronous work to a worker thread via
  `worker_threads`. Existing pattern in the codebase (`repoMap-worker`).
- *Emerging best practice:* Break work into chunks with `setImmediate`
  between iterations. Lower overhead than worker spawn; less true
  parallelism.
- *Experimental:* Use Node 22's `web Worker` API or Electron utility
  processes. Bigger change; not warranted unless current approaches blocked.

**Status:** Pending.

### Decision 3 (Phase 3 diagnosis): What makes `config:set` 1–3s?

**Status:** Pending Phase 3 dispatch.

### Decision 4 (after Decision 3): Fix shape for `config:set`.

**Options:**

- Debounce the persistence (batch multiple sets into one write).
- Async the underlying write (electron-store has both sync and async APIs).
- Split the config into multiple smaller files written independently.

**Status:** Pending.

### Decision 5: Test shape for this wave

**Pick:** Honeycomb (per the test-shape doctrine for cross-layer
integration). The save cascade traverses renderer → IPC → main file
write → fs watcher → autoSync → graph DB → broadcast back to renderer.
Boundary integration tests at the seams catch what unit tests miss.

**Rationale:** Same logic as Gamify Wave 1 Phase 5 — the failure modes
live in the layer interactions, not in each layer's pure logic.

**Status:** LOCKED upfront.

### Decision 6: Worktree isolation

**Pick:** Use `superpowers:using-git-worktrees` for this wave.

**Rationale:** Touches hot paths (file save, indexer, config) that the
running IDE depends on. Worktree gives the next session a clean
sandbox to break things without destabilizing the live IDE Cole uses
during the session.

**Status:** LOCKED upfront.
