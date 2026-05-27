---
status: COMPLETED
created: 2026-05-20
updated: 2026-05-20
wave: 98
slug: orchestration-types-relocation
tag: v2.19.3
---

# Wave 98 — Orchestration Types Relocation: Result Brief

## TL;DR

Wave 98 shipped 2026-05-20 as a small, mechanical follow-on to Wave 97. The renderer no longer reaches into `src/main/` for orchestration types — every reference now resolves through `@shared/types/orchestration`. The 4 load-bearing `tsconfig.web.json` `include` lines for `src/main/orchestration/*.ts` are gone. Pure type-only refactor, zero behavior change, four commits.

## What shipped

| Commit | Phase | What |
|---|---|---|
| `e02e749f` | Phase A | Move 14 IPC-surface interfaces from `typesProvider.ts` to `@shared/types/orchestration{Provider,Api}.ts`. `typesProvider.ts` becomes a pure re-export shim. |
| `d9c03eb1` | Phase B | Re-point `electron-orchestration.d.ts` imports from `../../main/orchestration/types` to `@shared/types/orchestration`. |
| `3f8f9d9c` | Tier-1 inline | Mark `WorkbenchRightPane.tsx:50` close button `touch-target-ok` — pre-existing audit failure that surfaced during Phase B's `test:renderer` gate. Resolves `roadmap/follow-ups/2026-05-19-mobile-touch-target-workbench-right-pane.md`. |
| `f5fef74b` | Phase C | Drop the 4 `src/main/orchestration/*.ts` `include` lines from `tsconfig.web.json`. The architectural payoff. |
| Phase D (this) | Phase D | Wrap — CHANGELOG `[2.19.3]`, `package.json` → 2.19.3, result brief, follow-up audit, tag `v2.19.3`. |

## Scope reshape vs the original follow-up

The source follow-up (`roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md`) estimated ~60 types still owned by `src/main/`. Phase 0 inventory showed the actual scope was much smaller:

- `typesContext.ts` (25 lines) and `typesDomain.ts` (46 lines) were **already** pure re-export shims from a prior wave. Zero work needed.
- `typesProvider.ts` retained ~10 interfaces classified by its file header as "main-process-only" — but `electron-orchestration.d.ts` reaches 12 of them via direct import + bulk re-export. The classification was wrong.
- The reference-closure of the 10 main-side interfaces resolved to **14 names** that had to move as a unit to preserve `tsc` validity.

So the wave executed on 14 names from a single file, not ~60 across three. The result brief'd this in the waveplan Context section before any code was written.

## ADR decisions (locked at Phase 0)

Per `roadmap/wave-98-orchestration-types-relocation/wave-98-decisions.md`:

- **D1: Destination module.** Extend `src/shared/types/orchestration.ts` (the barrel). After move would exceed the 300-line ESLint cap, so Phase A split into existing `orchestrationProvider.ts` (5 primitives) + new `orchestrationApi.ts` (9 IPC-surface types). Both files under cap (250 + 125 lines).
- **D2: Main-side import-path stability.** `typesProvider.ts` becomes a pure re-export shim. Mirrors W97 Decision 2. `haiku-explorer` confirmed zero deep-imports under `src/main/orchestration/providers/` before Phase A dispatch.
- **D3: Renderer re-pointing target.** Direct to `@shared/types/orchestration`, not via the `electron.d.ts` barrel. Reasoning: `electron-orchestration.d.ts` is a producer-side declaration file, not consumer-side renderer code; the "import from electron.d.ts only" rule is about renderer code consuming the types.
- **D4: `tsconfig.web.json` cleanup timing.** In-wave (Phase C). The wave's whole point.
- **D5: Semver bump.** Patch — `v2.19.3`.

## Gate results

| Gate | Phase | Result |
|---|---|---|
| `tsc.web` (with includes still in place) | A, B | EXIT 0 |
| `tsc.web` (WITHOUT includes) | C | EXIT 0 — architectural payoff verified |
| `tsc.node` | A, B, C | EXIT 0 (unchanged across all phases) |
| `test:main` | A | PASS |
| `test:orchestration` | A | PASS (66 test files, 898 tests) |
| `test:renderer` | B | 1 pre-existing failure (touch-target audit on WorkbenchRightPane.tsx:50). Resolved by the Tier-1 inline fix; full re-run green. |
| `useDiffReviewTrigger.acceptance.test.tsx` (W94 boundary contract) | A, B, C, D | 5/5 PASS throughout |
| `npm run lint` (full) | D | EXIT 0 (4 pre-existing warnings outside W98 scope) |
| `npm test` (full vitest) | D | 1095/1095 test files, 11352/11352 tests pass (8 skipped, 15min Windows-local) |
| `sonnet-phase-reviewer` on Phase A | A | PROCEED on all 4 axes (file-change scope, spec alignment, integrity, runtime viability) |

## What worked

- **Phase 0 inventory caught the scope mismatch.** The follow-up estimate (~60 types) was wrong by an order of magnitude. Reading the actual three files in ~5 minutes rewrote the wave from "big refactor" to "tight 3-phase shape." If we'd dispatched against the follow-up's premise without grounding, we'd have spent the wave hunting types that were already in `@shared`.
- **The implementer's mid-flight split was the right call.** ADR Decision 1 contemplated a split if the 300-line cap was approached. The implementer found the destination (`orchestration.ts`) was already a 3-line barrel, not a content file, and split the 14 interfaces across the existing structure rather than forcing them all into one file. The reviewer flagged this as the executed form of the ADR's contingency, not unauthorized expansion.
- **`sonnet-phase-reviewer` on the IPC surface contract** — Phase A was the high-stakes phase (the interfaces ARE the IPC contract). The reviewer cross-checked shape preservation against the 14-name list and confirmed `tsc` identity-preservation despite the implementer's "inline import simplification." That's exactly the catch a per-phase review buys.
- **Tier-1 inline fix posture.** When `test:renderer` surfaced the pre-existing touch-target audit failure, the development-pipeline doctrine (default fix-inline, Tier 3 is the exception) cleanly handled it. The follow-up was already filed with the exact fix shape; one-line edit closed it as a separate commit so the bisect surface stayed clean.

## Surprises (worth remembering)

- **`src/shared/types/orchestration.ts` is a barrel, not a content file.** Worth a re-read before any future wave that thinks it's appending to that file. Its content lives in `orchestrationDomain.ts`, `orchestrationContext.ts`, `orchestrationProvider.ts`, and now `orchestrationApi.ts`.
- **The `typesProvider.ts` "main-process-only" header comment was wrong.** Future waves touching this surface should not trust file-header classifications — verify against actual import sites.
- **The renderer's `electron-orchestration.d.ts` was reaching 12 interfaces via the bulk re-export at lines 7-66, not the obvious named-import block at lines 1-5.** A grep for `'../../main/orchestration/types'` would have found both reach sites; reading only the import block would have under-scoped Phase B's edit.

## Follow-ups

**Resolved this wave:**

- `roadmap/follow-ups/2026-05-19-orchestration-types-relocation.md` — original follow-up that filed this wave. Marked RESOLVED + archived by Phase D's `/audit-followups` step.
- `roadmap/follow-ups/2026-05-19-mobile-touch-target-workbench-right-pane.md` — closed by Tier-1 inline fix in commit `3f8f9d9c`. Archive in Phase D.

**Carried forward (unchanged from W97 HANDOFF):**

- `roadmap/follow-ups/2026-05-19-wave-95-manual-smoke.md` — Wave 95 hands-on smoke walk for Phases G/H still outstanding.
- `roadmap/follow-ups/2026-05-18-osc-11-read-allow.md`
- `roadmap/follow-ups/2026-05-18-ansi-palette-tuning.md`
- `roadmap/follow-ups/2026-05-16-wave-89-*` (3 items)
- `roadmap/follow-ups/2026-05-05-electron-renderer-browser-mcp-wiring.md`

**Bugs (unchanged from W97 HANDOFF):**

- `2026-05-17-chatstatenewpath-dynamic-require-threadstore.md` — OPEN, medium
- `2026-05-17-silent-buildrepoindex-hang-post-graph-ready.md` — TRIAGED, medium
- `2026-05-15-e2e-teardown-hang.md` — Wave 93 carry-over

## Pre-existing uncommitted state (untouched by W98)

The W97 HANDOFF flagged two pieces of pre-existing tree state. Status at W98 wrap:

- `tools/__fixtures__/train-context/test-output-weights.json` — only regenerated timestamps; still uncommitted. W98 did not touch it. Same recommendation as W97 HANDOFF: review and commit-or-discard at Cole's discretion.
- `tools/__scratch__/sample.test.ts` — scratch dir; needs `.gitignore` entry (separate follow-up if Cole wants).

(The other W97-residue items — uncommitted DiffReview helper extractions — were committed earlier in this session before Wave 98 started, as `f3ff0f96`.)

## Push status

**Not pushed.** Per the 2026-05-19 bulletin (GH Actions minutes held until 2026-06-01), agents do not initiate pushes. Local commits + tag `v2.19.3` only.

Cole will push manually when minutes restore. Cumulative push backlog at wave-end:

```
master:    e02e749f .. f5fef74b (+ this wrap commit), 6 commits ahead of origin/master
v2.19.3:   local tag, not pushed
```

(W97's tag `v2.19.2` and its master were pushed during the 2026-05-19 overnight one-time-override run; W98 stack rides on top of that pushed state.)

## Process notes (for the temperature log)

Drafted entry for `roadmap/wave-temperature-log.md`:

> | W-98 (Orchestration Types Relocation) | 2026-05-20 | COOL | 3 work phases + 1 Tier-1 inline. The wave plan correctly anticipated this would mirror W97's shape, and it did. Phase 0 inventory caught a 6x scope-estimate error in the source follow-up (~60 → 14 types) before any code dispatched — exactly what the inventory step is for. Phase A surfaced a structural surprise (destination `orchestration.ts` was a barrel, not a content file) which the implementer handled in-flight by splitting per ADR Decision 1's contingency clause. `sonnet-phase-reviewer` returned PROCEED on the IPC-surface contract — the per-phase review layer pays for itself when the spec is mechanical but the safety target (type identity) is structural. Tier-1 inline doctrine (test surfaces unrelated failure → fix inline → separate commit) worked cleanly here too. Total: ~1.5 hours orchestration. Net diff: ~+86 lines (14 interfaces appearing in shared, file-shape unchanged) and −4 tsconfig include lines. |

## Files of interest for the next session

- `roadmap/wave-98-orchestration-types-relocation/waveplan-98.md` — this wave's plan.
- `roadmap/wave-98-orchestration-types-relocation/wave-98-decisions.md` — ADR with the 14-name list and the Phase 0 deep-import check result.
- `src/shared/types/orchestrationApi.ts` — new home for the 9 IPC-surface types.
- `src/shared/types/orchestrationProvider.ts` — extended with 5 primitive types.
- `src/main/orchestration/typesProvider.ts` — 48-line pure re-export shim (was 220 lines).
- `roadmap/HANDOFF.md` — updated by Phase D.
