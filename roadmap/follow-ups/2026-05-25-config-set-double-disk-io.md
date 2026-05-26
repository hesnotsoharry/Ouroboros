---
status: OPEN
created: 2026-05-25
updated: 2026-05-25
priority: LOW
wave: 17
---

# `config:set` does double disk I/O per call

## Context

Surfaced by Wave 17 Phase 3's `sonnet-diagnostician` (`wave-17-diagnostic-config-set.md`) while ruling out `config:set` as a real slow handler. The diagnostic found `config:set` is a `patchIpcMainHandle` timer-artifact victim (handler does ~8-15ms of real work). But while measuring, it identified a structural inefficiency worth filing.

## The pattern

`handleConfigSet` at `src/main/ipc-handlers/config.ts:126-149`:

1. `interceptSecrets` — <0.1ms
2. `conf.set(key, value)` — AJV validation + `JSON.stringify` (0.19ms on 62.2KB blob) + `atomically.writeFileSync` with `fsync` (~4.1ms baseline)
3. `notifyExternalConfigChange` — invalidates `configCache = null`, then **immediately** reads the file back via `getConfig()`, which does a fresh `fs.readFileSync` (~4ms).

Net: each `config:set` does ~4.1ms write + ~4ms readback = ~8ms of disk I/O. The readback is redundant — the value just written is already known.

## Proposed fix

Either:
- **Option A:** Have `notifyExternalConfigChange` update `configCache` in-place with the just-written value (preserve the cache instead of invalidating).
- **Option B:** Drop `notifyExternalConfigChange`'s eager `getConfig()` readback. Let downstream consumers re-fetch lazily on next access.

Option A is cleaner if the cache invariants allow it; Option B is safer if the cache is read by multiple subscribers that may not all re-fetch.

## Impact

Each `config:set` is ~8ms instead of ~4ms. The total `config:set` count during normal operation is moderate (a few per minute under active use), so the saved cost is ~50-100ms per minute. Not visible to the user; not a blocker.

The diagnostic explicitly classified Phase 4 (`config:set` fix) as COLLAPSED — Phase 2's save-cascade fix eliminates the jank source that made `config:set` look slow. This double-I/O is a separate structural cleanup, not a regression.

## Why deferred from Wave 17

Wave 17 Phase 4 was collapsed because `config:set` is artifact, not cause. This double-I/O is a real inefficiency but is not on the active-editing cascade's critical path.

## Files

- `src/main/ipc-handlers/config.ts` (`handleConfigSet`, `notifyExternalConfigChange`)
- `src/main/config.ts` (`configCache`, `getConfig`)
