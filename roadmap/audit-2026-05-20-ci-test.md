---
status: COMPLETE
timestamp: 2026-05-20T18:15:00Z
wave: all
auditor: haiku-followup-auditor
---

# Follow-Up Audit — CI / Test Infrastructure Cluster (2026-05-20)

## Summary

Audited 4 OPEN items from the CI/test infrastructure cluster. No wave result brief provided — evaluated on explicit resolution markers, git-log evidence, and code inspection. Findings:

- **1 RESOLVED** — `2026-05-13-ci-distutils-node-gyp.md`: commit 0d6ee197 explicitly closed this; verified package.json override and CI workflow split.
- **1 LIKELY-RESOLVED** — `2026-05-13-electron-e2e-spec-drift.md`: playwright.config.ts testIgnore cites this file; 6 specs disabled pending fix wave.
- **2 ACTIVE** — both filed 2026-05-16, OPEN status, no resolution signals. Recommend proceeding when waves planned.

Action taken: 1 file moved to `_archived/follow-ups/`.

## RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-13-ci-distutils-node-gyp.md` | Commit 0d6ee197 explicitly closed with Path A + Path C implementation | Commit message: "Closes roadmap/follow-ups/2026-05-13-ci-distutils-node-gyp.md (Path A)"; package.json overrides node-gyp to ^11.0.0; CI workflow split npm ci / electron-rebuild; @electron/rebuild upgraded ^4.0.4. |

## LIKELY-RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-13-electron-e2e-spec-drift.md` | playwright.config.ts testIgnore block cites this file; 11 failing specs documented and disabled | playwright.config.ts lines 39–54 reference this follow-up; 6 spec files (agent-launch, checkpoint-restore, conflict-banner, diff-gutter, spec-scaffold, theme-import) are in testIgnore; M-4 documented resolution path (future triage + fix wave). Not RESOLVED because specs still disabled. |

## NEEDS-REVIEW

None detected in this audit.

## ACTIVE

| Item | Status |
|---|---|
| `2026-05-16-threadstoresearch-perf-test-flaky-windows-ci.md` | OPEN. Filed 2026-05-16. Flaky perf test on Windows CI runners. Recommended fix (Option 1: bump timeout via process.env.CI) not applied. Test hardcodes 10000ms at threadStoreSearch.test.ts:328 (no change since Wave 41). |
| `2026-05-16-stryker-mutate-scope-expansion.md` | OPEN. Filed 2026-05-16. Stryker scope still v1 (src/shared only). Expansion candidates documented in three risk tiers (low/medium/high). ADR Decision 5 + Phase 2 audit complete; awaiting expansion wave. |

## Per-File Analysis

### 2026-05-13-ci-distutils-node-gyp.md → RESOLVED

**Status:** Inline `**Status:** Open` (pre-YAML format).

**Evidence:**
- Commit 0d6ee197 (2026-05-13): "fix(ci): override node-gyp to ^11" explicitly states "Closes roadmap/follow-ups/2026-05-13-ci-distutils-node-gyp.md (Path A)"
- Implementation: package.json overrides block; .github/workflows/ci.yml split postinstall; @electron/rebuild ^4.0.4
- Root cause fixed: Python 3.12 removed distutils; node-gyp ^11 removed dependency
- Result: All 3 matrix jobs (Windows/macOS/Ubuntu) pass npm ci step

**Verdict:** PRIMARY criterion — explicit resolution marker in commit 0d6ee197 that predates audit.

---

### 2026-05-13-electron-e2e-spec-drift.md → LIKELY-RESOLVED

**Status:** Inline `**Status:** Open` (pre-YAML format).

**Evidence:**
- Follow-up documents 11 e2e test failures discovered during M-4 e2e harness wiring
- playwright.config.ts lines 38–55 have testIgnore block with this inline comment:
  "Also ignoring 6 spec files with known drift bugs...see roadmap/follow-ups/2026-05-13-electron-e2e-spec-drift.md for the 11 individual test failures"
- 6 spec files (agent-launch.spec.ts, checkpoint-restore.spec.ts, conflict-banner.spec.ts, diff-gutter.spec.ts, spec-scaffold.spec.ts, theme-import.spec.ts) match the follow-up's enumerated failures
- M-4 documented resolution path: Path B (triage + selective fixes in future wave); "Re-enable per-spec as underlying bugs are fixed"

**Signal:** Path-touch strong (playwright.config.ts cites file by name) + content-word overlap (testIgnore, spec drift, bugs).

**Verdict:** LIKELY-RESOLVED. CI gate is unblocked (9 stable specs run) and failing specs documented with re-enable path. Bugs themselves not fixed, so not RESOLVED — but infrastructure is in place.

---

### 2026-05-16-threadstoresearch-perf-test-flaky-windows-ci.md → ACTIVE

**Status:** YAML `status: OPEN`.

**Evidence:**
- Filed 2026-05-16 (7+ days old)
- Test: searchThreads perf test times out at 10000ms on Windows GitHub runners
- Recommended fix: Option 1 (bump to process.env.CI ? 30000 : 10000) not applied
- Current code: threadStoreSearch.test.ts:328 still hardcodes vi.setConfig({ testTimeout: 10000 })
- No git commits touch this file since Wave 41 (filed weeks after Wave 41 completed)

**Verdict:** ACTIVE. No resolution signal. Recent. Recommend when next test-infra or performance wave is planned.

---

### 2026-05-16-stryker-mutate-scope-expansion.md → ACTIVE

**Status:** YAML `status: OPEN`.

**Evidence:**
- Filed 2026-05-16 (7+ days old)
- Source: Wave 92 Decision 5 (Cole's explicit request to file expansion candidates)
- Wave 92 shipped 2026-05-16 with Stryker v1 scope: src/shared only
- Current stryker.config.mjs still scoped to src/shared/**
- Follow-up provides three tiers: low-risk (subsystem boundaries), medium-risk (orchestration), high-risk (IPC/renderer)
- Phase 2 audit from Wave 92 provides ready-to-use globs and risk classification

**Verdict:** ACTIVE. Filed 7+ days ago. Pre-work complete (audit + candidates). Awaiting expansion wave to apply.

---

## Related artifacts

- Commit 0d6ee197: node-gyp fix for distutils crash
- Wave 92 (Cross-Platform Lockfile + Stryker): baseline and ADR Decision 5
- .github/workflows/ci.yml: CI matrix with npm ci / electron-rebuild split
- playwright.config.ts: testIgnore block with e2e spec exclusions
- stryker.config.mjs: v1 scope (src/shared only)
- roadmap/wave-92-cross-platform-lockfile-stryker/phase-2-audit.md: expansion candidates
