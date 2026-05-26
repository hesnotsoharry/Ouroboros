---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
priority: TRIVIAL
source: wave-21
---

# Orphan worktree dir `.worktrees/wave-21-ouroboros-graph-tier-2/` — cleanup needed

## What

Wave 21 wrap merged the worktree branch to master and deleted the branch, but the filesystem directory `.worktrees/wave-21-ouroboros-graph-tier-2/` could not be removed during the wrap session — the worktree was bound to the session's process via EnterWorktree (Claude Code harness behavior) and `rm -rf` returned "Device or resource busy."

Git has correctly unregistered the worktree (`git worktree list` shows only main); the branch is deleted (`git branch -d wave-21-ouroboros-graph-tier-2` succeeded). The directory is orphan on disk — purely filesystem residue.

## How to clean up

From a fresh shell session (any shell NOT bound to the worktree):

```bash
cd "C:/Web App/AgentIDE"
rm -rf .worktrees/wave-21-ouroboros-graph-tier-2
ls .worktrees/  # should now show only wave-76-warn-hooks (the other pre-existing orphan)
```

## Pre-existing orphan also worth cleaning

`.worktrees/wave-76-warn-hooks/` has existed since before Wave 21 (noted in Wave 21's session-start orientation but not actioned per scope discipline). Likely also safe to `rm -rf` if its branch is merged or abandoned. Verify branch state first:

```bash
git worktree list
git branch -a | grep wave-76
```

## Priority

TRIVIAL. Disk-space residue only; no impact on git operations or future waves. Clean up on next session start in a fresh shell.
