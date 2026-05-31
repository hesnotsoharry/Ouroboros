---
status: OPEN
created: 2026-05-30
updated: 2026-05-30
priority: LOW
---

# AgentGlobe thinking-vs-idle heuristic has no real wire signal

Carved out of `2026-05-30-workbench-globe-pane-unaware-stuck-thinking.md` (the
pane-awareness half was resolved in commit `6cc20e45`). This is the remaining,
cosmetic half.

## Symptom
A freshly-spawned, idle-at-prompt claude reads `'thinking'` on the globe and stays
there. The globe now tracks the correct (active-pane) session, but its presentation
state for that session can be wrong.

## Root cause
`deriveState` in `src/renderer/components/Workbench/useWorkbenchGlobeData.ts` maps
`running` + no pending tool call → `'thinking'`. **The wire carries no real
thinking/idle signal** (documented in the Workbench `CLAUDE.md` gotcha: "`thinking`
is a best-effort heuristic … the wire has no thinking signal"). So "running but
idle at the prompt" is indistinguishable from "running and actually working" with
the data currently available.

## Fix shape (needs design — no obvious correct answer)
- Option A: treat "running with no tool activity for N seconds" as idle (timeout
  heuristic). Cheap, renderer-only, but picks an arbitrary N and can flicker.
- Option B: derive idle from the absence of a pending conversation turn (if such a
  signal can be surfaced from the hook stream). More correct; may need a new wire
  field / IPC.
- Do NOT invent a fake signal. If a real idle marker isn't available from Claude
  Code's hook events, Option A with a conservative N is the pragmatic stopgap.

## Priority
LOW / cosmetic. The globe shows the right session now; only its state label can be
imprecise.
