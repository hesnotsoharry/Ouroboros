---
status: OPEN
created: 2026-05-18
updated: 2026-05-18
source: Wave 95 Phase D ADR D4
severity: low
---

# OSC 11 partial read-allow for TUI dark/light detection

Filed during Wave 95 Phase D wrap. The Phase D diagnostician's H2
hypothesis (medium confidence): Claude TUI uses OSC 11 `?`
read-queries to detect dark/light mode. The IDE's current handler
blocks both write AND read-response (`() => true`). With Phase D
shipping an opaque xterm canvas, OSC 11 read-allow becomes meaningful
— Claude can now correctly self-detect the actual background color.

## Fix shape

In `src/renderer/components/Terminal/useTerminalSetup.lifecycle.ts`,
change the OSC 11 handler from:

```ts
oscBg: term.parser.registerOscHandler(11, (data: string) => {
  log.info('[trace:osc] OSC 11 received', { data, sessionId: context.sessionId });
  return true;
}),
```

to a handler that:
- Detects the `?` read-query form (data starts with `?` or matches a
  read-query pattern per the OSC 11 spec).
- For READ queries: return `false` (let xterm.js emit its standard
  response — the opaque `--palette-term-bg`).
- For WRITE forms: log + return `true` (suppress, keep theme stable).

Same pattern applies to OSC 10 (foreground) and OSC 12 (cursor color)
if desired — though bg is the most TUI-relevant.

## Prerequisite — capture what Claude actually emits

Before implementing, capture a real Claude TUI session's OSC sequences
via the `[trace:osc]` instrumentation Phase D added:

1. `npm run dev`
2. Open dock-slot terminal, run `claude` interactively.
3. Open DevTools (View → Toggle Developer Tools), filter Console for
   `[trace:osc]`.
4. Capture the OSC 10/11/12 sequences Claude emits during TUI startup
   and during normal operation.
5. Confirm: are there `?` read-queries? At what point in the session?
   What does the data field look like?

If Claude doesn't emit OSC 11 reads at all, this follow-up becomes a
no-op — close as wontfix.

## Pointers

- `src/renderer/components/Terminal/useTerminalSetup.lifecycle.ts` —
  OSC handler registration site.
- xterm.js source for the default OSC 11 read-response behavior — search
  for `OSC` + `background` in the xterm.js parser.

## Estimate

15 min once OSC capture confirms `?` queries exist. Skip if no reads
appear.
