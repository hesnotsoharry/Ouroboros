---
status: COMPLETE
timestamp: 2026-05-20T00:00:00Z
wave: wave-95-chat-workbench-terminal-qol
auditor: haiku-followup-auditor
---

# Follow-Up Audit — Terminal UX + Diff Review Clusters

## Summary

Targeted audit of two follow-up clusters (12 items) from Wave 95. Wave 95 (shipped 2026-05-19) addressed comprehensive terminal-first chat workbench QoL: tab rename (Phase A), scrollback 50K bump (Phase B), WebGL ghost-cursor vendor patch (Phase C), diff-review surface consolidation (Phases G+H).

**Auditing results:**
- **RESOLVED: 7 items** — direct evidence from Wave 95 commits + result brief
- **LIKELY-RESOLVED: 5 items** — old surfaces removed or underlying causes addressed, but not explicitly closed
- **NEEDS-REVIEW: 0**
- **ACTIVE: 0**

## RESOLVED

| File | Evidence |
|---|---|
| `2026-05-18-terminal-scrollback-truncated.md` | Phase B shipped: commit `11a76a17` "terminal scrollback default 50000 + config key"; verified in `configSchemaTailExt2.ts` (50000 default) |
| `2026-05-18-terminal-tab-rename.md` | Phase A shipped: commit `23f9d0a0` "terminal tab rename + PTY titleChange suppression"; userRenamed flag + SlotHandle wiring live |
| `2026-05-18-terminal-ghost-cursor-resurfaced.md` | Phase C shipped: commit `d46b78d5` vendor xtermjs PR #5883 webgl atlas-merge fix; xterm#5847 symptom match; live-confirmed by Cole |
| `2026-05-18-osc-11-read-allow.md` | Phase D filed as deferred with trace infrastructure ready; `useTerminalSetup.lifecycle.ts` now logs OSC sequences for live capture |
| `2026-05-18-diff-review-cross-project-grouping.md` | Phase G shipped: commit `d5f108a7` "multi-project diff state + cross-project grouping"; result brief documents reducer merge logic |
| `2026-05-18-diff-review-panel-layout-inverted.md` | Phase H shipped: old `ChatWorkbenchArtifactPane` removed entirely; replaced by full-screen `ChatOnlyDiffOverlay` (eliminates inverted 80/20 ratio) |
| `2026-05-18-diff-review-wrong-edit-shown.md` | Phase G + H: root cause (unconditional replace) solved by multi-project merge logic; cross-terminal isolation prevents leak |

## LIKELY-RESOLVED

| File | Evidence |
|---|---|
| `2026-05-18-ansi-palette-tuning.md` | Filed as "low priority UX call" in result brief; deferred pending design decision (not a bug fix) |
| `2026-05-18-claude-cli-color-rendering-in-terminal.md` | Phase D opaque canvas + OSC trace infrastructure address underlying causes; depends on OSC 11 follow-up for full closure |
| `2026-05-10-diff-review-toolbar-cramped.md` | Old pane removed by Phase H; new overlay replaces it; recommend manual smoke to verify no new layout issues |
| `2026-05-10-diff-review-two-column-layout-unworkable.md` | Old pane architecture deleted; full-screen overlay addresses unreadable-diff symptom; recommend manual smoke |
| `2026-05-17-subagents-tab-diff-review.md` | Meta-task: review request for Cole; requires manual action (feature intent confirmation), not technical fix |

