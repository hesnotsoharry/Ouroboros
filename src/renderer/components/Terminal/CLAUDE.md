<!-- claude-md-manual:preserved -->
# Terminal — xterm.js Multi-Session Terminal UI

Full-featured terminal subsystem: xterm.js rendering, PTY IPC, shell integration (OSC 633/133), command blocks, tab completions, history search, rich multiline input, session persistence, and split panes.

## Architecture

Two-layer design: a **Controller** object assembled from hooks, consumed by a thin **View**.

```
TerminalManager (session routing)
  └── TerminalManagerContent (tab bar + split pane)
        └── TerminalInstance (mounts controller)
              └── TerminalInstanceView (pure render, receives controller)
```

The controller is built by `useTerminalInstanceController` (entry: `useTerminalSetup.ts`), which composes ~10 focused hooks into a single typed object. Nothing is threaded through props — the view destructures the controller.

## Patterns

### Controller Object Pattern

`useTerminalInstanceController` returns a single `TerminalInstanceController` object (defined in `.types.ts`). Never add state directly to `TerminalInstanceView` — add a hook, compose it in `TerminalInstanceController.ts`, and expose it through the controller type.

### `useTerminalSetup` Decomposition

The setup hook is split by phase:

- `.lifecycle` — creates xterm, attaches addons, tears down
- `.runtime` — ResizeObserver + fit (requires double-rAF guard)
- `Keyboard` — attaches key handlers
- `Data` — bridges PTY IPC → xterm `.write()`
- `Cleanup` — IPC listener teardown

When adding a new xterm feature, find the appropriate phase file rather than adding to the entry `.ts`.

### OSC Shell Integration Priority

OSC 633 (VS Code protocol) is preferred. `shellIntegrationAddon.ts` emits typed `ShellIntegrationEvent`s. If 633 is not detected within the first few prompts, OSC 133 heuristics in `useTerminalSetupData.ts` + `useCommandBlocksController.ts` take over. Command blocks use whichever is active (`osc133Active: boolean | null` — null means undecided).

### `terminalRegistry` for Cross-Component Access

Other modules (e.g. `useIdeToolResponder`) call `getTerminalLines(sessionId)` to read buffer content. Register on mount, unregister on unmount. Do not reach into the registry from within Terminal components — use the controller's `terminalRef` instead.

## Gotchas

- **All dock sessions stay mounted; inactive ones are hidden, not unmounted** (Wave 97): `TerminalManager.buildActiveContent` renders EVERY session in `props.sessions` (each in its own `absolute inset-0` layer), not just the active one. `getRootStyle(isActive)` in `TerminalInstanceView.helpers.ts` toggles `visibility` (`visible`/`hidden`) + `pointerEvents`, NOT `display`. Reason: the prior "render only active session" model unmounted the xterm on every tab switch, destroying its scrollback buffer and dropping any output an agent produced in a backgrounded tab. `display:none` cannot replace the unmount because a hidden element has zero client dimensions → `@xterm/addon-fit.proposeDimensions()` returns undefined → output wraps at stale columns and can't be un-wrapped on return. `visibility:hidden` keeps the element laid out so fit stays correct; `pointerEvents:none` lets clicks fall through stacked hidden layers to the active terminal. Matches the IDE's sidebar/center-pane "render-all, hide-inactive" pattern. RAM cost: ~1 scrollback buffer per open terminal (~50MB at default 50k scrollback) — accepted tradeoff; tune via `terminal.scrollback`.
- **`CONTAINER_STYLE` carries an opaque `--palette-term-bg` background** (Wave 97): the xterm canvas only paints whole character rows, so the sub-row remainder at the bottom of the wrapper would show the glass-transparent ROOT background — reading as a "gap" between stacked terminals and making the bottom-anchored `TOOLBAR_STYLE` appear to straddle a black/glass seam. `backgroundColor: var(--palette-term-bg, #0c0c0e)` fills that strip with the terminal colour, composited under `opacity: var(--terminal-canvas-opacity, 1)` so tinted-glass themes tint the wrapper identically to the canvas. Reason: keeps the terminal interior visually solid without disabling the glass aesthetic on terminal *chrome*.
- **Package**: `@xterm/xterm` only — never `xterm`. All addons must be `@xterm/*` at the same version. Mixing causes duplicate class instance crashes.
- **Fit timing**: call `fit()` only after a **double-rAF** following `term.open()`. Use `isReadyRef` guard in ResizeObserver to prevent premature calls.
- **WebGL renderer**: `@xterm/addon-webgl` is loaded AFTER `term.open()` per `@xterm/xterm` v6 upstream guidance. The v5-era "double cursor" issue (DOM + WebGL overlap) was retired when v6 integrated cursor rendering into the WebGL canvas. On WebGL context loss, the addon is disposed and xterm's built-in canvas renderer takes over without remount (`webglFailedRef` prevents retry). Addon load order is centralised in `terminalAddonManifest.ts` (`loadOrder: 'pre-open' | 'post-open'`).
- **OSC 10/11/12 blocked (with trace)**: handler returns `true` to suppress both writes (theme override) AND read-responses. As of Wave 95 Phase D, each handler also logs `[trace:osc] OSC NN received` via electron-log so Claude TUI's actual OSC probes can be captured during a live session. Reason: TUI apps like Claude Code use OSC 11 `?` read-queries to detect dark/light mode; blocking the response without observing what's actually sent leaves us guessing. Follow-up filed to consider OSC 11 partial read-allow once we have evidence of what Claude emits.
- **Xterm canvas bg is opaque on purpose** (Wave 95 Phase D): `buildXtermTheme()` reads `--palette-term-bg` (opaque `#0c0c0e`), NOT `--term-bg` (forced transparent by the glass theme bridge). Glass aesthetic stays on terminal chrome surfaces — only the xterm canvas itself is opaque. Reason: Claude TUI fill cells (status panel boxes) require an opaque background to render correctly; transparent canvas + `allowTransparency:true` made them composite against the Mica/glass behind the IDE.
- **Tinted-glass canvas via `--terminal-canvas-opacity` CSS var** (Wave 95 Phase D extension): xterm wrapper `CONTAINER_STYLE` in `TerminalInstanceView.helpers.ts` has `opacity: var(--terminal-canvas-opacity, 1)`. Default 1 = fully opaque (preserves TUI render correctness). Themes that want a faint glass tint on the canvas can override (e.g. `0.9`) — the canvas remains internally opaque (cell BG contrast preserved) but the whole canvas composites at reduced opacity over the Mica behind. Tradeoff: text is also tinted at lower opacity values; below ~0.85 the wash becomes noticeable. xterm.js fundamentally cannot do per-cell selective transparency (open upstream issue xtermjs/xterm.js#1004 since 2018), so this CSS-opacity approach is the industry pattern (Warp, Hyper). Reason: future-proofs "fun themes" without breaking TUI.
- **Session key for `useTerminalSetup`**: the `useEffect` depends only on `sessionId`. Changing any other prop does not re-bootstrap — update the effect deps deliberately.
- **Command block limits**: hard cap at 500 blocks, 1000 lines per block (`MAX_BLOCKS`, `MAX_BLOCK_LINES` in `useCommandBlocksController.ts`) to prevent memory growth in long-lived sessions.
- **RichInput** uses CodeMirror 6 with a custom `StreamLanguage` shell tokenizer — not Monaco. Keep shell keyword lists in `RichInputBody.tsx`.
- **getCellHeight**: derives cell height from `element.clientHeight / rows` (DOM calculation). xterm v6.0.0 has no public cell-size property; the former `_core._renderService.dimensions` private access was removed in Wave 88 Phase 1.
- **Scrollback memory cost**: default scrollback is 50000 lines (Wave 95 Phase B, `terminal.scrollback` config key, max 100000). xterm.js retains the buffer in memory — budget ~50MB per terminal at default, ~100MB at max, multiplied by concurrent session count. Bump the cap or open Settings → Terminal → Scrollback lines to tune. Reason: long Claude TUI runs (MultiEdit streams, status panels) blow past the prior 10000 default mid-session; raised default trades RAM for history fidelity.
- **AppConfig duplication for nested keys**: any new nested config object (e.g. `terminal: { scrollback }`, `flowTracer: { maxDepth }`) must be declared in BOTH `src/main/configAppTypes.ts` AND `src/renderer/types/electron-foundation.d.ts`. Wave 96 cut the renderer→main type import to fix the tsc:web TS6307 cascade; full extraction to `src/shared/types/` deferred to Wave 97. Reason: missing one side leaves `config.get('newKey')` typed as `never` on the renderer.
- **WebGL atlas-merge patch**: `@xterm/addon-webgl` 0.19.0 has a documented atlas-corruption bug (upstream issue xtermjs/xterm.js#5847) that produces ghost cursors / cell artifacts during high-throughput streams with `allowTransparency: true`. Patched locally via `patches/addon-webgl-0.19.0.patched.{mjs,js}` + `tools/apply-patches.mjs` (runs at postinstall). Remove when upstream ships >= 0.19.1 with PR #5883 merged. Reason: bug is JS-level in the addon's atlas-page-merge path; same library version, same workload, same flag triggers it for Claude TUI streams. Full removal flow in `patches/README.md`.
- **TUI "ghost cursor" (native cursor duplicates Claude's own)**: a TUI like Claude Code draws its own cursor and leaves xterm's native cursor parked elsewhere → a duplicate ghost (orange native + white drawn). `useTerminalSetupData.ts` strips `?25h` (show-cursor) from the PTY stream while a TUI is active so the native cursor stays hidden; Claude's drawn one remains. Detection is shell-integration-free: latch ON on `?1004h` (focus reporting — Claude sets it on entry, a PowerShell prompt never does), OFF on `?1000l/?1002l/?1003l` (mouse-tracking disabled — Claude's exit burst), mirrored to `sessionStorage` to survive a Ctrl+R reload. Distinct from the atlas-merge ghost above (that's WebGL *glyph* corruption; this is a renderer-independent cursor-*position* duplicate). Reason: Claude never positions the hardware cursor where its drawn cursor is, so the native cursor is pure noise while it runs; a full app restart clears sessionStorage so a restored running session re-ghosts until focus mode re-asserts (a complete fix needs main-process mode tracking). See `roadmap/bugs/2026-05-20-claude-tui-ghost-cursor.md`.
