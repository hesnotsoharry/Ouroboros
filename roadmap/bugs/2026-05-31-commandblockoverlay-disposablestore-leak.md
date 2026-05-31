---
status: TRIAGED
created: 2026-05-31
branch: freeze-fix-and-wave-101-scaffold
severity: LOW
---

# CommandBlockOverlayBody — DisposableStore "already disposed" leak on project switch

## Summary

On every workbench **project switch**, the console throws (repeatedly):

```
CommandBlockOverlayBody.tsx:183 Error: Trying to add a disposable to a
DisposableStore that has already been disposed of. The added object will be leaked!
    at dr2.add (@xterm/xterm.js)
    at yn._register (@xterm/xterm.js)
    at get onScroll (@xterm/xterm.js)
    at CommandBlockOverlayBody.tsx:183:26
    (commitHookEffectListMount → commitPassiveMountOnFiber)
```

It's an xterm-lifecycle leak warning, **not a crash** — surfaced incidentally
while diagnosing the 2026-05-31 AgentSidebar paneId-misbinding bug (it appears in
every project-switch trace). Confirmed separate from that bug (which is fixed in
`6ad5747f`).

## Mechanism (hypothesis, not yet instrumented)

`CommandBlockOverlayBody.tsx:183` registers an xterm `onScroll` handler in a
passive effect (`commitHookEffectListMount`). On project switch, `CenterPane` /
`TerminalInstance` remounts (the workbench is keyed by `projectKey`), and the
xterm instance's `DisposableStore` is disposed during teardown — but the
`onScroll` `_register` runs against the already-disposed store. Classic xterm
pattern: a disposable is `.add()`-ed after `dispose()`. Likely a missing
"is the terminal still alive / not disposed" guard before registering the
scroll listener, or an effect that should re-run its cleanup before re-register.

## Repro

1. `npm run dev`, open the workbench with ≥2 projects.
2. Switch project (rail) A → B (or B → A).
3. Observe the console error fire (often 2–3× per switch).

## Fix direction (unverified)

Guard the `onScroll` registration in `CommandBlockOverlayBody.tsx:183` so it does
not `.add()` to a disposed store — e.g. check the xterm instance / DisposableStore
liveness before `_register`, or ensure the effect's cleanup disposes the prior
registration and the effect only re-registers against a live terminal. Confirm
against `@xterm/xterm` v6 disposable semantics (see `.claude/vendor-gotchas/xterm.md`).

## Notes

- LOW severity: leak warning, no functional break observed. Filed for hygiene +
  because it may compound over many switches (leaked scroll listeners).
- Not addressed in the 2026-05-31 workbench bug stack (agent_end / resume removal /
  inferSessionId / Start-Claude-button) — strictly out of scope there.
