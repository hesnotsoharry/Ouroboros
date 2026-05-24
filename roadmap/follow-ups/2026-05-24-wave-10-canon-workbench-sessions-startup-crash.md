---
status: RESOLVED
severity: CRITICAL
created: 2026-05-24
updated: 2026-05-24
resolved-in: wave-11-file-tree-viewer-modal (Phase 0 inline hotfix; Wave 10.1)
---

# Wave 10.1 — `canonWorkbenchSessions` startup crash from legacy Wave 9 data

## Summary

Surfaced during Wave 11 Phase 0 smoke catch-up (2026-05-24, Cole's first `npm run dev` post-Wave-10). The IDE crashes at app init on any disk with persisted Wave 9 `canonWorkbenchSessions` data in the flat `{ upper, lower }` shape. **Wave 11 plan D5 (HIGH/CRITICAL findings pause Wave 11) triggered**; Cole signed off on the inline hotfix path; fix landed in Wave 11's worktree branch as a Wave 10.1 prefix commit.

## Reproduction

1. Run any Wave 9 build (`v2.30.0`); enable `layout.canonWorkbench`; spawn at least one canon Workbench terminal so that `canonWorkbenchSessions` gets the legacy flat shape persisted to disk.
2. Upgrade to Wave 10 (`v2.31.0`).
3. Launch the IDE.

Observed:

```
unhandledRejection: Error: Config schema violation: `canonWorkbenchSessions/upper` must NOT have additional properties; `canonWorkbenchSessions/upper` must NOT have additional properties; `canonWorkbenchSessions/upper` must be null; `canonWorkbenchSessions/upper` must match exactly one schema in oneOf; `canonWorkbenchSessions/lower` must NOT have additional properties; `canonWorkbenchSessions/lower` must be null; `canonWorkbenchSessions/lower` must match exactly one schema in oneOf
    at Conf._validate (.../conf/dist/source/index.js:354:15)
    at get store (.../conf/dist/source/index.js:279:18)
    at new Conf (.../conf/dist/source/index.js:131:32)
    at constructWithRetry (.../database-B2laTjCr.js:1469:12)
    at ensureStore (.../database-B2laTjCr.js:1447:21)
    ...
    at initializeApplication (.../main/index.js:3807:32)
```

## Root cause

Wave 10 reshaped the `canonWorkbenchSessions` electron-store schema from flat `{ upper: ... | null, lower: ... | null }` to `Record<projectRoot, { upper, lower } | null>` (`src/main/configSchemaMiddle.ts:109-146`). Wave 9 data on disk is the legacy flat shape. Conf's schema validation at construction-time (`Conf._validate` inside `new Conf(...)`) sees the literal string keys `"upper"` and `"lower"` at the top level of `canonWorkbenchSessions` and treats them as the new schema's `additionalProperties` entries — i.e., as if they were project-root keys. Each value (the legacy `{ cwd, claudeSessionId }` shape) then fails the inner `oneOf`:

- Option A in the oneOf is `{ type: 'object', additionalProperties: false, properties: { upper, lower } }` — the legacy value has `cwd`/`claudeSessionId` properties, not `upper`/`lower`, and `additionalProperties: false` rejects them.
- Option B in the oneOf is `null` — the legacy value is an object.

Hence the four-clause error message.

ADR D1 (`roadmap/wave-10-project-scoped-state-foundation/wave-10-decisions.md`) said "cold-start, no migration" and implemented the legacy-shape discard via the React hook `useWorkbenchRestore`'s guard (`'upper' in obj || 'lower' in obj` → return empty record). That guard runs at **render time**, downstream of `new Conf()`. Conf throws synchronously at construction, before any hook reads. **The cold-start guard was implemented at the wrong layer.**

## Fix

Extend `src/main/configPreflight.ts`'s `stripDeprecatedKeys` with a new step that detects the legacy flat shape on disk (top-level `canonWorkbenchSessions` value is an object containing `'upper'` or `'lower'` as keys) and resets it to `{}` before Conf reads the file. Idempotent: a properly-keyed record (absolute paths) does not match the detection and is left alone.

`configPreflight` already exists for exactly this purpose — it ran before this hotfix to strip Wave 79 deprecated keys, Wave 86 promoted flags, etc. (see file header). The hotfix adds one entry to the existing pattern.

Code change: `src/main/configPreflight.ts` — added `resetLegacyCanonWorkbenchSessions(data)` helper + invocation in `stripDeprecatedKeys`. Tests: 4 new cases in `src/main/configPreflight.test.ts` covering legacy reset, valid record passthrough, partial-flat reset, and empty-record no-op.

## Verification

- `npx vitest run src/main/configPreflight.test.ts` — 14/14 (4 new + 10 pre-existing).
- `npx vitest run src/renderer/components/Workbench/Terminals/canonWorkbenchSessions.projectKeyed.acceptance.test.ts src/main/configStoreLazy.test.ts src/main/config.test.ts src/main/configMigrations.test.ts` — 22/22 (regression).
- `tsc --noEmit` + `eslint src/main/configPreflight.ts src/main/configPreflight.test.ts` + `prettier --write` — clean.
- **Live verify (pending):** Cole pulls the hotfix into master + relaunches `npm run dev`; the previously-crashing init succeeds and the canon Workbench mounts with an empty `canonWorkbenchSessions` (cold-start per D1).

## Why this wasn't caught at Wave 10 wrap

- Wave 10's acceptance test (`canonWorkbenchSessions.projectKeyed.acceptance.test.ts`) mocks the Conf layer entirely and asserts the hook-level guard. The Conf-init path isn't covered by any Wave 10 test — and isn't covered by the unit-test boundary as a class.
- `/ui-smoke 10` was deferred (Wave 10 result brief lesson 5 — "the painful honest finding"). A live smoke would have caught this on the first launch.

## Lesson promoted

Schema-validation-throws-before-read is a class of bug that hook-level guards CANNOT defend against. Two corrective directions for future schema reshapes:

1. **Where the cold-start guard lives matters.** ADRs that say "cold-start" must specify the layer — pre-Conf preflight (file-system sanitize) or post-Conf hook (read-time discard). The former is the only layer that handles strict schema validation at Conf init; the latter only works for permissive schemas (or for schemas that allow `additionalProperties: true` for legacy data).
2. **Live smoke is the only test that catches Conf-init bugs.** Wave-end smoke must run live against a disk-with-legacy-data scenario whenever a schema-reshape ADR ships. The Wave 10 deferred-smoke pattern produced this exact failure mode — and was the direct lesson the Wave 11 plan's D5 was written against.

A vendor-gotcha entry for `electron-store` / `conf` to be promoted via `/promote-vendor-lessons` at Wave 11 wrap.

## Related

- `roadmap/wave-10-project-scoped-state-foundation/wave-10-decisions.md` D1 — the original "cold-start, no migration" decision (correct in intent, wrong in implementation layer).
- `roadmap/wave-11-file-tree-viewer-modal/waveplan-11.md` Phase 0 — inline hotfix scope expansion.
- `roadmap/wave-11-file-tree-viewer-modal/wave-11-decisions.md` D6 — the ADR for the Phase 0 inline-hotfix decision.
