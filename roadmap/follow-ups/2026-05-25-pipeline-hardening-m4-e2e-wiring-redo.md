---
status: OPEN
created: 2026-05-25
severity: MED
area: CI / test:e2e
target: dedicated-wave or fold-into-wave-87-resolution
---

# Re-do `test:e2e` CI wiring (lost when `pipeline-hardening-m4` was deleted)

The `pipeline-hardening-m4` branch contained two valuable CI commits that did
not exist on any other branch:

- `d250fa0d test(e2e): pipeline-hardening M-4 phase 1 — stabilize Electron e2e harness`
- `4a8f2a38 ci(e2e): pipeline-hardening M-4 phase 2 — wire test:e2e to CI on Ubuntu`
- `7dbf91d8 docs(roadmap): pipeline-hardening M-4 phase 3 — wave wrap-up artifacts`

The branch also carried a subset of Wave 87 phase commits (different SHAs from
the canonical `wave-87-chat-orchestration-cleanup` line). Per Cole's call
2026-05-25, `wave-87-chat-orchestration-cleanup` is the canonical Wave 87 line,
so keeping `pipeline-hardening-m4` around would have meant two parallel Wave 87
histories. The branch was deleted (local + origin) to remove ambiguity.

**The Wave 87 phase commits are preserved on `wave-87-chat-orchestration-cleanup`.
The CI e2e wiring is NOT preserved anywhere except git's reflog** (and `origin/pipeline-hardening-m4` if it
existed there; check `git ls-remote origin pipeline-hardening-m4` before assuming
it's recoverable from the remote).

## What needs to be re-done

1. **Electron e2e harness stabilization** (`pipeline-hardening-m4` phase 1) —
   whatever fixes made the e2e tests reliable for CI. Likely touches
   `tests/e2e/**` and `playwright.config.ts` (or equivalent harness config).
2. **CI workflow wiring** (`pipeline-hardening-m4` phase 2) — a workflow file
   under `.github/workflows/` that runs `test:e2e` on Ubuntu. The Windows
   pre-push hook runs the unit suite; CI is where e2e should run because Linux
   GH Actions runners are cheaper + faster + Cole's Windows-local e2e workflow
   is brittle.

## How to recover the diff

```bash
# If origin still has it:
git fetch origin
git log origin/pipeline-hardening-m4 --oneline

# Then either:
git checkout origin/pipeline-hardening-m4 -- .github/workflows/<file> tests/e2e/<files>

# Or look in the reflog locally:
git reflog | grep pipeline-hardening-m4
git show <reflog-sha>:.github/workflows/<file>
```

## Sequencing note

This could fold into the dedicated Wave 87 resolution wave
(`roadmap/follow-ups/2026-05-25-wave-87-chat-orchestration-cleanup-conflict-resolution.md`)
since that wave will already touch chat/orchestration test surfaces. Or it
could be its own small wave focused purely on CI hardening. Either is fine.

## Why MED (not HIGH)

CI minutes are exhausted until 2026-06-01 anyway (per the bulletin), so even if
the workflow were wired today it couldn't run. After 2026-06-01, missing e2e
coverage is a real gap — the unit suite catches a lot but not full app-launch
regressions. Promote to HIGH after 2026-06-01 if not addressed.
