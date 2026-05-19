---
status: COMPLETE
timestamp: 2026-05-20T17:45:00Z
wave: all
auditor: haiku-followup-auditor
---

# Follow-Up Audit — 2026-05-20 Misc Chat & Digests

## Summary

Audited **9 OPEN follow-ups** from `roadmap/follow-ups/` against HEAD commit `bb81a0d0` (Wave 98 wrap). No wave-result brief provided — evaluated on line-reference staleness axis only (staleness-only mode). The audit identified distinct categories: heat-map issues (chat-driven, ACTIVE pending chat retirement context), electron MCP wiring (ACTIVE, early-stage), test-quality work (ACTIVE, catalogued), chat-tied items (WONTFIX-CANDIDATE per chat retirement), and aggregate index files (leave untouched). No confirmed RESOLVED items in this batch. One outstanding action item (Wave 95 manual smoke) left OPEN per orchestrator guidance.

## RESOLVED

None detected in this audit.

## LIKELY-RESOLVED

None detected in this audit.

## NEEDS-REVIEW

None detected in this audit.

## WONTFIX-CANDIDATE

The following items depend on the **in-app chat surface**, which is being retired in favor of terminal-driven design (per `~/.claude/CLAUDE.md` and the system context: "in-IDE chat surface is being retired in favor of terminal-driven design"). These should be reviewed for WONTFIX classification before any further work.

| File | Reason | Evidence |
|------|--------|----------|
| `2026-05-10-context-injection-missing-non-agent-ide-projects.md` | Chat-only feature (context auto-injection at chat start) | "The IDE auto-injects project / repo context at chat start — ... This is a flagship feature of the **chat-only shell**." Intrinsic to chat orchestration bridge; terminal-driven model may not apply same pattern. |
| `agent-chat-swipe-navigation.md` | Chat UI gesture feature (swipe between chat threads) | "Wave 32 Phase I built it intending to let users swipe between chat threads." Capacitor mobile swipe nav is chat-only. Desktop swipe is low-priority per product guidance. |

## ACTIVE

**7 items** left untouched (recent, no explicit resolution signal, valid ongoing work).

| File | Status | Classification | Notes |
|---|---|---|---|
| `2026-05-06-file-heat-map-still-broken.md` | OPEN (2026-05-06) | ACTIVE | Heat-map after agent edits does not render. Diagnostic investigation needed per debug-before-fix rule. Chat-driven events may be the signal source, but file-watcher events are also possible — depends on event source investigation. Flagged "don't propose fix from code reading," awaiting instrumentation. |
| `2026-05-11-heatmap-full-rescan-jank.md` | OPEN (2026-05-11) | ACTIVE | Related to above. Full-rescan pattern on every heat-map context update causes visible jank during parallel edits. Incremental scan + memoization + rAF throttling are candidate fixes. Deferred pending broader chat-state overhaul. Low-medium severity. |
| `2026-05-05-electron-renderer-browser-mcp-wiring.md` | OPEN (2026-05-05, updated 2026-05-16) | ACTIVE | Multi-stage effort to wire electron renderer (for bug reproduction via browser MCP). Updated 2026-05-16 with three new candidate paths (electron-mcp-server, circuit-mcp, Anthropic Computer Use). Requires Stage 1 research (verify maturity, test against actual renderer). Early-stage, no immediate commitment. |
| `2026-05-17-classifier-test-tier-weak-matcher.md` | OPEN (2026-05-17) | ACTIVE | Test-quality anti-pattern detected in `src/main/router/classifier.test.ts`. Weak matcher asserts "result is one of valid values" rather than "result equals expected value." Cross-referenced in meta-framework test-discipline audit. Project-specific work, actionable anytime. |
| `2026-05-19-wave-95-manual-smoke.md` | OPEN (2026-05-19) | ACTIVE | Wave 95 deferred full smoke walk (phases G, H, D extension). Requires Cole's hands-on verification (30-45 min). Outstanding action per wave-wrap — correctly left OPEN for Cole to triage. No age signal; just filed. |
| `follow-ups.md` | INDEX | ACTIVE | Aggregate index / pointer file (Wave 82 Phase I closure manifest). Read-only; consolidates 71+ de-duplicated follow-up items. No action needed; reference for triage. |
| `outstanding-2026-05-03.md` | DIGEST | ACTIVE | Aggregate digest from Wave 82 Phase I. Read-only; ~140 items broken down by category with source pointers. No action needed; reference for next session's triage sweep. |
| `cypher-engine-feature-additions.md` | PLANNING | ACTIVE | Three-phase plan (Wave A: diagnostics + cheap wins; Wave B: WITH support; Wave C: investigation). No immediate work; prerequisites are Wave A shipping + telemetry confirming agent query patterns. Early-stage planning. |

## Summary of findings

- **Heat-map issues (2 items):** Both chat-event-driven (or possibly file-watcher-driven). Require instrumentation to diagnose; debug-before-fix rule enforced. Pending investigation, not blocked.
- **Electron MCP wiring (1 item):** Early-stage planning (updated 2026-05-16 with new research paths). Requires spike before wave commitment. ACTIVE.
- **Chat-tied items (2 items):** Depend on in-app chat surface being active. Chat is being retired in favor of terminal-driven design per product guidance. Recommended for WONTFIX review before future work.
- **Test-quality work (1 item):** Weak matcher anti-pattern in classifier tests. Cross-referenced in meta-framework test-discipline audit. Actionable anytime, no blocker.
- **Outstanding action (1 item):** Wave 95 manual smoke. Correctly left OPEN; Cole to triage.
- **Aggregate indexes (2 items):** Read-only reference files. No action.
- **Cypher engine feature additions (1 item):** Three-phase planning (prerequisites unmet). ACTIVE planning.

---

## Notes on audit methodology

1. **No wave-result brief provided** — used staleness-only evaluation (created/updated dates, file-existence checks, explicit resolution markers).
2. **No wave-diff provided** — path-touch axis skipped.
3. **Chat retirement context applied** — per system prompt guidance, in-app chat items flagged as WONTFIX-CANDIDATE for Cole's decision.
4. **Frontmatter parsing:** All 9 files parsed successfully. No corrupted entries.
5. **Line-reference checks:** No `<file>:<line>` patterns requiring snippet verification in this batch.

---

## Recommendations for next auditor

1. **Follow-up on WONTFIX-CANDIDATE items:** Cole should decide whether `2026-05-10-context-injection-missing-non-agent-ide-projects.md` and `agent-chat-swipe-navigation.md` are WONTFIX (chat retired) or should be re-scoped for terminal-driven architecture.

2. **Heat-map investigation:** When the next renderer-touching wave lands, dispatch `sonnet-diagnostician` with instrumentation plan from `2026-05-06-file-heat-map-still-broken.md` § "How to investigate."

3. **Electron MCP wiring:** Suitable for `/wave-plan-lite` as a Profile B feature. Current follow-up has sufficient research pointers; Stage 1 (decide Path A vs Path B vs both) can begin in next session.

4. **Triage sweep:** Next `/triage-sweep` should re-check `follow-ups.md` and `outstanding-2026-05-03.md` to confirm closure status on the 71+ de-duplicated items (those two files are 2026-05-01/03 snapshots; some may have been resolved since).
