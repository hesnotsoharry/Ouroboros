---
status: OPEN
created: 2026-05-25
severity: HIGH
area: chat orchestration / bridge retirement
target: dedicated-wave
---

# Wave 87 (`wave-87-chat-orchestration-cleanup`) — merge into master blocked by drift; needs dedicated wave to resolve

The `wave-87-chat-orchestration-cleanup` branch contains 25 commits that retire the
`chatOrchestrationBridge` family, delete the `agentChat:thread/status/stream` IPC
channels, lazy-init the `threadStore` singleton, extract `agentChatGitHelpers` +
`agentChatMessageHelpers`, and migrate `docs/` → `roadmap/docs/`. The branch has
been sitting unmerged since approximately mid-May 2026 while master moved through
Waves 11/12/13. Attempting a `git merge --no-ff wave-87-chat-orchestration-cleanup`
on 2026-05-25 surfaced extensive conflicts.

The branch was held intentionally — Cole's session 2026-05-25 picked
"file as follow-up, leave the branch for a dedicated wave" over "rebase and
resolve commit-by-commit now" because the conflict surface is too large to safely
charge through at the end of an already-long session.

## Conflict surface (recorded so the next session knows what it's walking into)

### Rename / rename conflicts — 20 files

Master renamed `roadmap/archive/wave-N/wave-N-auto-brief.md` →
`roadmap/_archived/wave-N/wave-N-result.md` (subsequent waves changed both the
directory name **and** the filename convention; Waves 11/12/13 all standardize on
`wave-N-result.md`). Wave-87 renamed only the directory, keeping `auto-brief.md`.

Affected wave directories: `wave-46`, `wave-47`, `wave-48`, `wave-49`, `wave-50`,
`wave-51`, `wave-52`, `wave-53`, `wave-53a`, `wave-53b`, `wave-53c`, `wave-53d`,
`wave-53e`, `wave-53f`, `wave-53g`, `wave-53h`, `wave-53i`, `wave-53k`, `wave-58`,
`wave-59`.

**Resolution direction:** master's convention is canonical — pick the
`wave-N-result.md` name in each conflict.

### Content conflicts — 8 files

Three docs (manageable):
- `roadmap/_archived/follow-ups/2026-05-10-context-injection-missing-non-agent-ide-projects.md`
- `roadmap/_index-history.md` (add/add)
- `roadmap/decisions/index.md` (add/add)
- `roadmap/follow-ups/follow-ups.md`

Five code (real regression risk — needs care):
- `src/main/hooksDispatchLogic.ts`
- `src/main/ipc-handlers/chatStateNewPath.ts` (auto-merged but flag for review)
- `src/main/hooks.ts` (auto-merged but flag for review)
- `src/renderer/components/AgentChat/ComposerContextPreview.tsx`
- `src/renderer/hooks/useAgentEvents.ruleSkillDispatchers.ts`
- `src/renderer/styles/globals.css`

### Why this drifted

Wave-87 modified files that have since been modified on master, especially in
chat-related and event-dispatch areas. The bridge-retirement work overlaps with
Wave 13's paneId-binding work (both touch `hooks.ts`, `useAgentEvents.*`), and the
docs migration overlaps with the wave-temperature reorganization.

## Recommended approach for the dedicated wave

1. **Open with a diff audit.** `git diff master...wave-87-chat-orchestration-cleanup -- src/` to
   see the actual code delta. The 25 commits may collapse to a smaller resolution
   surface than the per-file conflict count suggests.
2. **Decide between three paths** at the wave plan stage:
   - **Rebase** `wave-87` onto current master, resolving conflicts per-commit. Most
     work; preserves authorship + commit history.
   - **Cherry-pick** the non-conflicting commits first to land the easy bits, then
     resolve the hard subset in isolation.
   - **Re-implement** the bridge retirement as a fresh wave on top of master,
     using `wave-87-chat-orchestration-cleanup` as a reference/spec. Most cleanup,
     most work, but no rebase-induced regression risk.
3. **The `pipeline-hardening-m4` branch was deleted 2026-05-25** because it held a
   duplicate subset of Wave 87 commits. Its CI e2e wiring is captured in a
   separate follow-up:
   `roadmap/follow-ups/2026-05-25-pipeline-hardening-m4-e2e-wiring-redo.md`.
4. **Wave 100 (`wave-100-chat-surface-removal`) is paused** and may depend on
   bridge retirement. Coordinate sequencing.

## Why this is HIGH

Bridge retirement is real infrastructure cleanup that unblocks Wave 100 and
reduces the chat surface area. Leaving it indefinitely means the `agentChat:thread`
/ `status` / `stream` channels stay live + the `chatOrchestrationBridge` keeps
getting touched by orthogonal work, each touch extending its lifespan.

## State at filing time

- Branch `wave-87-chat-orchestration-cleanup` exists locally + on origin (`origin/wave-87-chat-orchestration-cleanup: ahead 17`).
- Master is at the post-Wave-13 SHIPPED state.
- Branch is NOT deleted; preserved as reference + starting point for the dedicated wave.
