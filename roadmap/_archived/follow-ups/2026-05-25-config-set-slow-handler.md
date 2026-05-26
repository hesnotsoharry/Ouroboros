---
status: RESOLVED
created: 2026-05-25
updated: 2026-05-26
priority: MED
---

# `config:set` is a slow handler (1.1–4.0s observed)

## Context

Surfaced in Cole's second 3-window boot trace (2026-05-25 19:05–19:06). The
`config:set` handler emitted three `[ipc-perf] slow handler` lines:

- 1327ms
- 1104ms
- 3983ms

The 3983ms call corresponded to a single jank event of 3854ms — the entire
main-process event loop was blocked for nearly 4 seconds on a config write.

This was not in the first boot trace, so it's likely tied to a specific code
path (which key was being set?) rather than a constant overhead.

## Hypotheses to test (in order of likelihood)

1. **Synchronous JSON.stringify of a large config object** — electron-store
   persists the entire config blob on every `set()` call. If the config grew
   large (lots of saved sessions, project roots, telemetry buffers), this
   could be the cost.
2. **Synchronous disk write under contention** — if config is being set by
   multiple windows simultaneously, lock contention on the config file.
3. **Side-effects on set** — a `config:set` listener somewhere doing heavy
   work synchronously (recompute, broadcast, persistence chain).
4. **Schema validation hot path** — if the schema validator runs on every
   set and the schema is now large (per `configSchema.ts` → `configSchemaMiddle.ts`
   → `configSchemaTail.ts` split), validation could be expensive.

## Investigation shape

- Log which key was being set in each slow `config:set` call (add a
  `log.info('[config:set]', { key, ms })` line at the handler).
- Measure JSON.stringify cost on the current config blob.
- Profile electron-store's write path on Windows.

Dispatch a `sonnet-diagnostician` if instrumented data isn't conclusive.

## Why this isn't in Wave 16

Wave 16 was scoped to four specific cacheable handler families with known
costs. `config:set` is a write path, not a cacheable read, and the cost
shape is unknown — needs diagnosis before fix.

## Related

- Boot trace timestamp: 2026-05-25 19:06:38–19:06:44
- Files probably involved: `src/main/config.ts`, `src/main/configSchema*.ts`

## Resolution (2026-05-26, wave-17)

See `roadmap/wave-17-editor-cascade-perf/wave-17-followup-audit.md` for full citation. Closed as RESOLVED by Wave 17 wrap audit.
