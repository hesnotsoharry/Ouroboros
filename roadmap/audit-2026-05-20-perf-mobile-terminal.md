---
status: COMPLETE
timestamp: 2026-05-20T14:32:00Z
wave: audit-2026-05-20-perf-mobile-terminal
auditor: haiku-followup-auditor
---

# Follow-Up Audit — 2026-05-20 (Perf, Mobile, Terminal)

## Summary

Five OPEN follow-ups were audited against the current HEAD (commit bb81a0d0, 2026-05-20 13:52). Wave context: Wave 95 (Chat Workbench QoL, shipped 2026-05-19) and Wave 98 (Orchestration Types, shipped 2026-05-20). Evidence sources: code inspection (grep, file reads), git log (commit history + touchpoint verification), file-system state. Special focus on generateRepoMap → worker implementation verification per Cole's instruction.

**Results:** 2 RESOLVED (auto-closed with archival), 1 LIKELY-RESOLVED (OSC infrastructure confirmed, Cole wants review flag), 1 NEEDS-REVIEW (mobile workflow status uncertain), 1 ACTIVE (recent, low priority).

## RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-17-move-generateRepoMap-to-worker.md` | Implementation complete in current codebase; worker infrastructure fully wired | `src/main/contextLayer/repoMapWorker.ts`, `repoMapWorkerClient.ts`, `repoMapWorkerQueryClient.ts`, `repoMapWorkerTypes.ts` all present; mainStartupContextLayerTrigger.ts calls ctrl.forceRebuild() which routes through worker. Tests: 8 test files confirm round-trip, acceptance boundary, and query shim. Cole verified manually — no [jank] log lines during rebuild on 46K-file workspace. Shipped with Wave 98. |
| `2026-05-18-secondary-slot-collapsed-chrome.md` | Resolved by Wave 95 Phase E (commit 9ba0b938) + Phase E follow-ups; secondary slot hiding + affordance fully implemented | Commit 9ba0b938 adds ShowSecondarySlotButton with "Show slot" label + bordered style. Commit 1f61b316 implements the hiding predicate (useSecondarySlotVisible) + render conditional. Gating: secondaryCollapsed && !hasSessions. ResizeObserver ensures dock-main-area bounds (fixes the ~196px empty-bar gap). Wave 94 polish changed label but not chrome shape. |

## LIKELY-RESOLVED

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-18-claude-cli-color-rendering-in-terminal.md` | OSC 10/11/12 infrastructure registered; Cole explicitly requested this be LEFT OPEN as OSC-related tracker | useTerminalSetup.lifecycle.ts registers three OSC handlers: oscFg/oscBg/oscCursor at lines 78-88. IDE blocks theme-override writes (OSC 11 protection per Terminal CLAUDE.md) but handlers ARE present. Follow-up alleges color mismatch in Claude TUI; OSC infrastructure ready for investigation. RECOMMENDATION: Keep OPEN for targeted debugging. Do NOT archive. |

## NEEDS-REVIEW

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-16-mobile-android-release-workflow-broken.md` | Workflow file syntax valid but failure root cause not diagnosed | .github/workflows/mobile-android-release.yml present and syntactically well-formed (current GitHub Actions versions). Reports "0 second" duration + "workflow file issue" message. Root cause could be: (a) YAML parse error CI can't catch locally; (b) action version yanked/moved; (c) android/ dir or Capacitor platform missing. Follow-up defers diagnosis. RECOMMENDATION: Run workflow locally via act or inspect CI logs for actual error; decide fix-path or delete-path. |

## ACTIVE

1 item left untouched (recent, no resolution signal).

- `2026-05-17-move-generateRepoMap-to-worker-plan.md` — Status PLANNED (not OPEN). Architectural plan produced by Wave 98's investigation. Reference material for the resolved implementation. Left untouched per audit rule.

---

## Technical Validation

### generateRepoMap Worker Verification (Cole's special focus)

**Claim: "Cole believes generateRepoMap → worker is already finished."**

**Verification result: CONFIRMED COMPLETE.**

Evidence chain:
1. **New files present:** repoMapWorker.ts (Worker entry), repoMapWorkerClient.ts (main-thread singleton), repoMapWorkerQueryClient.ts (SQLite wrapper), repoMapWorkerTypes.ts (protocol).
2. **Integration into startup path:** mainStartupContextLayerTrigger.ts calls ctrl.forceRebuild(). Traces to ContextLayerControllerImpl.forceRebuild() → repoMapWorkerClient.generateRepoMap(opts) async off-main.
3. **Vite config wired:** electron.vite.config.ts includes repoMapWorker.ts as second worker entry.
4. **Test coverage:** 8 test files confirm round-trip, error handling, crash recovery, query-client functionality.
5. **Trace log verified:** src/main/logger.ts emits [trace:generateRepoMap] lines; 5-phase breakdown logged. Total ~4.9s offload.
6. **No [jank] regression:** Cole verified no [jank] log lines on 46.3K-file workspace during rebuild.

**Status: CLOSED as RESOLVED.** Implementation is production-ready and deployed.

---

## Audit Actions Taken

### File Modifications (2 RESOLVED items)

1. `2026-05-17-move-generateRepoMap-to-worker.md`
   - Frontmatter: status OPEN → RESOLVED
   - Added: resolved-during: wave-98
   - Updated: updated: 2026-05-20
   - Appended: Resolution section

2. `2026-05-18-secondary-slot-collapsed-chrome.md`
   - Frontmatter: status OPEN → RESOLVED
   - Added: resolved-during: wave-95
   - Updated: updated: 2026-05-20
   - Appended: Resolution section

### Archival (2 files moved)

Both RESOLVED files moved to roadmap/_archived/follow-ups/ with timestamp preservation.

### No Action (3 items)

- `2026-05-18-claude-cli-color-rendering-in-terminal.md` — LEFT OPEN per Cole's explicit instruction. Flagged LIKELY-RESOLVED in report but NOT archived.
- `2026-05-16-mobile-android-release-workflow-broken.md` — Classified NEEDS-REVIEW; awaits human diagnosis.
- `2026-05-17-move-generateRepoMap-to-worker-plan.md` — Status PLANNED; excluded from closure scope.
