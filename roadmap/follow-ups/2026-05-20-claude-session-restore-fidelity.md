---
status: OPEN
created: 2026-05-20
updated: 2026-05-20
---

# Claude-session restore fidelity (workbench)

## Summary

Workbench terminal **persistence + restore now works for plain shells** (shipped 2026-05-20). But **Claude sessions do not restore faithfully**: a terminal that was running Claude comes back as a bare shell (or vanishes entirely, depending on timing). Restoring a Claude session *with its conversation resumed* needs deeper work in two subsystems and was deferred by product decision.

This follow-up captures the confirmed diagnosis so the work can be picked up without re-investigating.

## Confirmed findings (from runtime instrumentation, 2026-05-20)

Reproduction: open 1 Claude + 2 plain shells in the workbench (ChatOnlyShell), restart `npm run dev`.

### Problem 1 — workbench never tags Claude terminals with `isClaude`

`[trace:persist] session-detail` showed **`isClaude: undefined` for every session**, including the one running Claude:

```
session-detail {id: 'term-…-9ru1h', isClaude: undefined, isCodex: undefined, claudeSessionId: …, status: 'running'}
session-detail {id: 'term-…-qrf15', isClaude: undefined, isCodex: undefined, claudeSessionId: null, status: 'running'}
session-detail {id: 'term-…-bumoi', isClaude: undefined, isCodex: undefined, claudeSessionId: 'f1cfe0d1-…', status: 'running'}
```

- `useSpawnClaudeSession` (`useTerminalSessions.effects.ts:~254`) *does* set `isClaude: true` on the live session. But workbench terminals are evidently **not created through that path** — they're plain `spawnSession` terminals (Claude runs inside them, likely via `claudeAutoLaunch`), so `isClaude` is never set.
- `createSessionSnapshot` (`useTerminalSessions.sync.helpers.ts:76`) stores `isClaude: session.isClaude === true` → `false` for all → on restore, `spawnSavedSession` (`useTerminalSessions.restore.ts:317`) takes the plain-shell branch → **Claude terminal restores as a bare shell.**
- **Fix direction:** determine how the workbench creates terminals and where "this terminal is a Claude session" should be recorded. Either route workbench Claude creation through `spawnClaudeSession`, or set `isClaude` when Claude is auto-launched into a plain terminal, so the snapshot captures it.

### Problem 2 — `claudeSessionId` binding is contaminated by the ambient Claude Code session

Same log showed the **same `claudeSessionId` bound to multiple terminals and flip-flopping over time**:

```
9ru1h: null → f1cfe0d1 → d5249243 → f1cfe0d1
bumoi: f1cfe0d1   (same id as 9ru1h simultaneously)
qrf15: null       (always)
```

- Root: `applyTerminalFallbackBind` (`useTerminalSessions.sync.helpers.ts:53`) stamps the incoming `claudeSessionId` onto the **active** terminal whenever a hook event arrives without an explicit target. Because **the IDE runs a Claude Code session inside itself** (the dev/terminal session editing the code), its `session_start`/hook events leak onto whichever workbench terminal is active. This is exactly the hazard documented in `.claude/rules/multi-process-debugging.md` ("never assume two IDs are the same; account for the terminal session").
- Consequence: even if Problem 1 were fixed, the persisted `claudeSessionId` is unreliable — restoring with `--resume <id>` could resume the **wrong** conversation (this is what produced the earlier "all terminals became one shared Claude session" symptom before the type-fidelity fix gated it off).
- **Fix direction:** make the bind attributable to the originating terminal (correlate the hook event's session/PTY to the specific terminal that owns it) rather than falling back to "active terminal." This is the harder half and touches the flaky multi-process binding area.

### Timing variance (explains the two symptoms seen)

- **Vanished entirely:** Claude terminal's `claudeSessionId` was `null` at quit (id not yet bound). *(Note: the validator-rejects-`null` theory was investigated and ruled out — the store write uses `config.set('terminalSessions', snapshots)` with raw objects, so absent fields are omitted as `undefined`, not stored as `null`. The vanish is more likely the session not being `status: 'running'` at quit, excluded by `getRunningSessions` in `useTerminalSessions.sync.ts:23`. Confirm when picking this up.)*
- **Restored as plain shell:** Claude terminal survived persist but `isClaude:false` → plain branch on restore (Problem 1).

## Suggested approach when picked up

1. Re-add targeted `[trace:persist] session-detail` + `[trace:restore] snapshot-entry` probes (they were stripped at ship time).
2. Map workbench terminal creation (ChatOnlyShell → ProjectTerminalsProvider → useProjectTerminals → useTerminalSessions) to find where `isClaude` should be set. Fix Problem 1 first — it's bounded and gives "Claude terminals re-open Claude" even with a fresh conversation.
3. Decide product behavior: resume the exact conversation (requires fixing Problem 2's binding) vs. relaunch Claude fresh (only needs Problem 1). Fresh-relaunch is the smaller, reliable win; conversation-resume depends on fixing the binding contamination.
4. Fix Problem 2 (attributable binding) only if conversation-resume is required.

## Related (separate, lower priority)

- **Session state is component-local `useState`** (`useSessionState` in `useTerminalSessions`), which is why restore was fragile to remounts. The remount trigger (immersive-flag flip) was fixed, but lifting `sessions` into a remount-proof store via React 18 `useSyncExternalStore` would harden it against any future remount source (project switch, hot reload). Defense-in-depth, not urgent.

## What shipped alongside this follow-up (2026-05-20)

- Restore mechanics: StrictMode-safe once-guard (module flag + generation-counter cancellation), immersive-flag synchronous init (eliminated the subtree remount that wiped session state).
- Slot-ref attribution on restore (restored sessions render in the rail).
- Type fidelity: `spawnSavedSession` honors stored type; missing `claudeSessionId` → fresh (no `--resume`/`--continue`), which gated off the "all merged to one conversation" bug.
- `persistTerminalSessions` setting now governs workbench persistence (was ignored); default flipped to `true`.
