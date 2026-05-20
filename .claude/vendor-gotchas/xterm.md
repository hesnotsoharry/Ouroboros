---
vendor: "@xterm/xterm + @xterm/addon-*"
sdkVersion: "@xterm/xterm 6.0.0, addon-webgl 0.19.0, addon-unicode-graphemes 0.4.0"
firstWritten: 2026-05-14
lastVerified: 2026-05-14
relatedPaths:
  - src/renderer/components/Terminal/useTerminalSetup.lifecycle.ts
  - src/renderer/components/Terminal/terminalAddonManifest.ts
  - src/renderer/components/Terminal/CommandBlockOverlayBody.styles.ts
  - src/renderer/components/Terminal/CLAUDE.md
notes: "xterm.js v6 + addons: WebGL context-loss timing, addon version-string identifiers, removed private APIs in v6.0.0. All @xterm/* packages must be at compatible versions — mixing majors crashes."
---

# @xterm/xterm v6 + addons gotchas

> First written 2026-05-14 (Wave 88 — Terminal Foundation). xterm.js v6 was a major bump; re-check these when `@xterm/xterm` bumps minor or any addon bumps major.

## Configuration

### `@xterm/addon-unicode-graphemes` registers version `'15-graphemes'`, not `'graphemes'`

**Symptom:** Every terminal bootstrap throws `Error: unknown Unicode version "graphemes"` (non-fatal — caught as an "optional post-open addon failed" — but the grapheme-aware width provider never activates).
**Why:** After `term.loadAddon(new UnicodeGraphemesAddon())` you must set `term.unicode.activeVersion` to the version string the addon *registers*. The addon registers `'15-graphemes'` when grapheme handling is enabled (the default) — verified in the installed package source: `UnicodeGraphemeProvider` sets `this.version = e ? "15-graphemes" : "15"`. The intuitive guess `'graphemes'` is wrong.
**Fix:** `term.unicode.activeVersion = '15-graphemes';`
**Source:** Wave 88 Phase 1 (commit `009eb17d`), found during manual smoke.

## Runtime

### WebGL context loss blanks the canvas synchronously — hide it before `dispose()`

**Symptom:** On WebGL context loss (GPU reset, devtools `WEBGL_lose_context`, driver hiccup), the terminal flashes white/blank for a few milliseconds before the canvas renderer recovers.
**Why:** The browser clears the WebGL canvas to transparent/white *synchronously* when the context is lost — before any JS handler (`onContextLoss`) runs. `WebglAddon.dispose()` does correctly auto-repaint via `RenderService.setRenderer() → refreshRows()` (the DOM renderer's elements are always present underneath), but the blank GL canvas sits visible in the DOM during the dispose window. No data loss or remount — the buffer survives — it's purely a transient visual artifact.
**Fix:** In the `onContextLoss` handler, hide the WebGL canvas *before* calling `dispose()`:
```ts
const webglCanvas = term.element?.querySelector('canvas');
if (webglCanvas) (webglCanvas as HTMLElement).style.display = 'none';
webgl.dispose();
```
`term.element?.querySelector('canvas')` is unambiguous: only `WebglRenderer` appends a `<canvas>` to `screenElement`; the DOM renderer uses divs, and `OverviewRuler` / `addon-image` canvases are inserted elsewhere in the DOM.
**Source:** Wave 88 Phase 1 (commit `a7522224`), found during manual smoke.

### WebGL addon must load AFTER `term.open()` in v6 (the v5 order is wrong)

**Symptom:** v5-era code that loads `WebglAddon` before `term.open()` produces a double cursor (DOM + WebGL overlap) in v6.
**Why:** xterm v6 integrated cursor rendering into the WebGL canvas. The v5 "load WebGL after open to avoid double cursor" workaround inverted — in v6 the addon must load *after* `term.open()`. On context loss the addon is disposed and the built-in canvas renderer takes over without remount (guard re-entry with a `webglFailedRef` so it doesn't retry).
**Fix:** Load order is centralized in `terminalAddonManifest.ts` via `loadOrder: 'pre-open' | 'post-open'`. WebGL is `post-open`.
**Source:** Wave 88 Phase 1 (commit `4c942ebe`), Wave 88 Decision 1.

### xterm v6.0.0 has no public cell-size property — derive from the DOM

**Symptom:** Code reaching for `term._core._renderService.dimensions.css.cell.{width,height}` (the v5 private-API path for cell pixel size) breaks — `_core` access was removed.
**Why:** xterm v6.0.0 exposes no public API for cell dimensions, and the private `_core` path is no longer safe to touch.
**Fix:** Derive cell height from the DOM: `element.clientHeight / rows`. See `CommandBlockOverlayBody.styles.ts` (`getCellHeight`).
**Source:** Wave 88 Phase 1 (commit `4c942ebe`).

## Versioning

### All `@xterm/*` packages must be at compatible versions

**Symptom:** Mixing `@xterm/xterm` with an addon built against a different major causes duplicate-class-instance crashes at runtime.
**Why:** xterm addons depend on internal class identity from the core package.
**Fix:** Bump `@xterm/xterm` and all `@xterm/addon-*` together. Never mix with the legacy unscoped `xterm` package. The full addon set and load order is declared in `terminalAddonManifest.ts`.
**Source:** Pre-Wave-88 convention, codified in `src/renderer/components/Terminal/CLAUDE.md`.

## Known open issues

### Ghost cursor (WebGL/DOM overlap) resurfaced in Wave 94 — load-order conflict between CLAUDE.md and wave-88 decision

**Symptom:** When running `claude` in a dock-slot terminal, a ghost cursor appears in random positions while Claude is "thinking", and a second cursor appears directly in front of the typing cursor on input.
**Why:** There is a direct conflict in the repo between two pieces of documentation:
- Wave 88 Decision 1 (`wave-88-decisions.md`) changed the WebGL addon load order to **AFTER** `term.open()`, citing xterm v6 upstream guidance that the v5 pre-open pattern was retired.
- The terminal subsystem CLAUDE.md (`src/renderer/components/Terminal/CLAUDE.md`) still documents load order as **BEFORE** `term.open()` ("the VS Code pattern to avoid double cursor").

The ghost cursor re-emerged in Wave 94 smoke (2026-05-18) without any xterm changes in that wave. Wave 94 did not touch WebGL initialization — but the pivot to terminal-first layout made the artifact more visible. The root cause is either: (a) the CLAUDE.md subsystem doc was not updated when Wave 88 swapped the order, leaving future agents working from the wrong rule, or (b) the "after" order does produce the double-cursor at the actual runtime sequence used (the v6 guidance may apply to a specific initialization context not matched by Agent IDE's setup).
**Fix shape:**
1. Audit `useTerminalSetup.lifecycle.ts` to confirm whether `loadAddon(WebglAddon)` runs before or after `term.open()` in the current code.
2. If it's AFTER (Wave 88 Decision 1 was implemented), instrument with `console.log('[xterm-init]', { addonLoaded, opened })` to confirm actual runtime order.
3. If the ghost cursor persists with AFTER order, revert to BEFORE order and update `terminalAddonManifest.ts` + `CLAUDE.md` + this file to record the v6 guidance as inapplicable to this codebase's init path.
4. Whichever order is confirmed correct: update the subsystem CLAUDE.md so it matches — the conflict is the bug magnet.
**Status:** RESOLVED 2026-05-20 — the resurfaced "ghost cursor" was NOT a WebGL load-order issue (it reproduces renderer-independently, in the DOM renderer too). Real cause + fix in `roadmap/bugs/2026-05-20-claude-tui-ghost-cursor.md`: Claude (an Ink TUI) draws its own cursor and leaves xterm's native cursor parked elsewhere; the host now suppresses the native cursor while a TUI is active by stripping `?25h` from the PTY stream (`useTerminalSetupData.ts`), detected via `?1004h` (on) / mouse-tracking-off (off). The Wave-88 WebGL load-order (after `term.open()`) is correct and unrelated to this ghost.
**Source:** Wave 88 Decision 1; Wave 94 wave-wrap smoke (2026-05-18); follow-up `2026-05-18-terminal-ghost-cursor-resurfaced.md`.
