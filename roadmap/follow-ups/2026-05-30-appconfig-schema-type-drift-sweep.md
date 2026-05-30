---
status: OPEN
created: 2026-05-30
updated: 2026-05-30
---

# AppConfig / electron-store schema-type drift sweep

## What
The runtime electron-store JSON schema (`src/main/configSchema*.ts`, `configSchemaTailExt*.ts`) and
the `AppConfig` TypeScript interface (`src/main/configAppTypes.ts`) have drifted apart. Two keys were
caught reactively during the 2026-05-30 typecheck repair (commit `6fe19109`):

- `canonWorkbenchSessions` — in the runtime schema since ~Wave 10, missing from `AppConfig`.
- `terminalSessionsPerProject` — in the runtime schema since ~Wave 94, missing from `AppConfig`.

Both surfaced as `keyof AppConfig` errors in `migrateStaleRoots.ts` only once the web-side typecheck
errors were cleared (they'd been hidden behind the `&&` short-circuit in the `typecheck` script).

## Why it matters
This is a recurring pattern: a key is added to the runtime schema in a wave but never added to the TS
interface. Each one is a latent `keyof AppConfig` error waiting to surface, and any `config.get(...)`
on a drifted key is silently untyped. The two found were fixed; there may be more.

## Action
1. Sweep every key in `configSchema*.ts` / `configSchemaTailExt*.ts` against the `AppConfig` interface;
   add any missing keys with correct value types (match existing renderer usage / `@shared/config`).
2. Add a guard so the drift can't recur silently — a unit test (or type-level assertion) that the set
   of runtime schema keys is a subset of `keyof AppConfig`.

## Origin
Discovered while clearing pre-existing typecheck rot during the 2026-05-30 machine-lockup fix session.
See `bugs/2026-05-30-machine-lockup-mcp-process-storm.md`.
