---
status: RESOLVED
created: 2026-05-20
updated: 2026-05-20
---

# Claude Code TUI "ghost cursor" — investigation handoff

## Symptom

When running the Claude Code CLI (a TUI) inside an Ouroboros terminal, **two cursors
appear**: a **white** cursor (Claude's own, drawn by Claude, at the correct input
position) and an **orange** cursor (the user's theme cursor color) at a *different,
stale* position. The orange one is the "ghost." A plain shell prompt shows only the
single (correct) native cursor — no ghost.

Reproduces in **both** the packaged/production app and `npm run dev`. Renderer-independent
(see below). Focus-gated: with `cursorInactiveStyle: 'none'`, the ghost only paints when
the terminal has focus.

## Confirmed root cause (high confidence)

The orange ghost is **xterm's own native cursor** (`.xterm-cursor`, block style, focused),
rendered at xterm's tracked cursor position. Claude Code draws its *own* cursor (the white
one) as content and leaves the terminal's hardware cursor at a different position, so the
native cursor reads as a duplicate/ghost. In a plain shell there's no competing cursor, so
the native cursor is correct and wanted.

Verified via a DOM probe (`window.__cursorProbe`, since removed): the ghost element while
focused is `<span class="xterm-cursor xterm-cursor-blink xterm-cursor-block">` with an
orange `outline` (theme cursor color `rgb(249,115,22)`), `background: transparent`.

DECTCEM trace (`[trace:cursor]`): Claude emits `?25l` (hide) then `?25h` (show) **paired,
once per frame**; the resting state between frames is **shown** (`?25h`). So Claude does
NOT keep the cursor hidden — it expects the terminal cursor to be its cursor, but its drawn
white cursor and the native cursor positions diverge.

## What was RULED OUT (do not re-chase)

- **`allowTransparency` / the addon-webgl atlas patch (#5847)** — already `false` / applied;
  ghost persists. Wrong subsystem.
- **React StrictMode dev-only double-mount orphan** — plausible in dev (an orphaned `.xterm`
  element from mount→cleanup→remount), and `term.dispose()` genuinely does NOT remove its
  element (gotcha already in Terminal/CLAUDE.md). BUT the ghost reproduces in **production**
  (no StrictMode), so this is at most a dev-only *additional* contributor, not the cause.
- **Serialize/restore cursor-position desync** (the `fittedPromise` / deferred-restore work)
  — a real latent issue (restore writes into an 80×24 terminal before `fit()`, reflowing the
  cursor out of bounds) but NOT the ghost; that fix did not change the ghost.
- **Shell integration being inactive** — the cursor-suppression fix was gated on OSC 133
  being active; we confirmed (via pwsh 7, below) that with integration **active** the ghost
  STILL appears. So shell-integration state was not the blocker.

## Renderer interaction (important)

- **DOM renderer:** the ghost is the `.xterm-cursor` DOM span → CSS *can* hide it. (A prior
  blanket `.xterm-cursor { visibility:hidden }` rule in globals.css hid it — but also blanked
  the *shell* cursor, since that span IS the shell's cursor too. That rule was the cause of
  an earlier "no cursor in shell on DOM renderer" symptom.)
- **WebGL renderer:** the cursor is drawn on the GPU canvas, **not** the `.xterm-cursor` span
  → CSS cannot touch it. So any CSS-based fix only works with WebGL disabled.

WebGL was temporarily disabled during investigation; it has been **re-enabled** (restored
`loadWebGLAddon`, extracted to `terminalWebglAddon.ts`). The current state ships WebGL ON.

## Attempted fixes (none fully successful — all reverted)

1. CSS `.xterm-cursor { visibility:hidden }` (blanket) → hid shell cursor too. Bad.
2. Scoped `.xterm-cursor:not(.xterm-cursor-block)...` → the focused ghost HAS the block
   modifier, so the selector skipped it. No effect.
3. Cursor-mode state machine (`cursorMode.ts` — kept as a clean reducer + test): latch
   `app` on `?25l`, return to `shell` on the OSC 133 prompt marker; suppress the native
   cursor in `app` mode. Wired as a CSS class (`term-suppress-native-cursor`) on the DOM
   renderer, gated on `osc133EnabledRef`. **Did not visibly engage** even on pwsh 7 with
   integration active — root cause of *that* never confirmed (the `[trace:cursor-mode]`
   diagnostic log was added but never read against a live repro). Suspects: the OSC 133
   prompt un-latch firing mid-Claude (Claude may emit its own OSC 133), or the dev
   StrictMode orphan masking it in dev.
4. DECTCEM-interception approach (renderer-independent: in `app` mode, consume Claude's
   `?25h` so xterm honors the preceding `?25l` and keeps the cursor hidden; restore on the
   shell prompt) — **designed but NOT implemented** (the user opted to revert first).

## The shell rabbit hole (separate but entangled)

The cursor-suppression latch needs to know "am I at the shell or in a TUI," which it took
from OSC 133 shell-integration markers. That led here:

- `getDefaultShell()` (`src/main/ptyEnv.ts`) **hardcodes `powershell.exe`** (Windows
  PowerShell **5.1**) on Windows. `detectShellType` (`shellIntegration/resolve.ts`)
  deliberately returns `'unknown'` for `powershell.exe` (5.1 is NOT integratable — the
  comment explains the `[Console]::Write` ESC issue). So **5.1 gets NO shell integration**
  → no command blocks, no OSC-133 history, and the cursor latch can't detect shell-vs-app.
- The user's default shell is 5.1. Switching to **PowerShell 7 (`pwsh`)** enables
  integration. BUT:
  - The user has the **Microsoft Store** build of pwsh, not the MSI. The MSI path
    (`C:\Program Files\PowerShell\7\pwsh.exe`) does not exist; the `pwsh` on PATH is an
    AppExecLink reparse alias that **node-pty cannot spawn**. The real exe is under
    `C:\Program Files\WindowsApps\Microsoft.PowerShell_<ver>_x64__.../pwsh.exe` — node
    **can `existsSync` a known full path** but **cannot `readdirSync` WindowsApps** (EPERM),
    so the version can't be auto-discovered from node. (The "PowerShell 7" preset in
    `terminalSectionShared.tsx` hardcodes the MSI path → "process exited" for Store users.)
  - **Regression caused by switching to pwsh 7:** activating shell integration turned on the
    app's OSC-633 **history feature** (`useTerminalHistory`), which **intercepts the up-arrow**
    and shows its own per-session command buffer (empty after a reload) — *overriding*
    PSReadLine's superior persistent history. Net effect for the user: "lost all up-arrow
    history." On 5.1 (no integration) the up-arrow passed through to PSReadLine and worked.

### Shell-resolution code added this session (in `ptyEnv.ts`, now stashed)

`getDefaultShell()` was changed to prefer pwsh 7 (MSI path check → WindowsApps enumeration →
fall back to 5.1) and `TerminalSection.tsx`'s forced-default `useEffect` was removed so a
blank shell setting falls through to that resolver. The WindowsApps enumeration **fails with
EPERM from node**, so for Store-only users it still falls back to 5.1. This needs a
registry-based or AppExecLink-resolution approach to actually find the Store build — OR
recommend the user `winget install` the MSI build (note: winget saw the Store package as
already-installed and refused; needs `--source winget` or a direct MSI).

## Recommended next approach (for a fresh, focused session)

1. **Decouple the cursor fix from shell integration** so it works on 5.1 (and doesn't force
   the pwsh switch + history regression). The latch signal `?25l` is shell-independent; the
   hard part is the *un-latch* ("back at shell") without OSC 133. Options to evaluate:
   - Tie suppression to the **alternate screen buffer** (`term.buffer.active.type`) IF Claude
     uses it — the serialized snapshot showed `hasAltScreen:false`, but verify against a LIVE
     session (the snapshot may not reflect live state). Alt-screen is the standard, robust
     "full-screen app vs shell" signal.
   - A **manual per-terminal toggle** to suppress the native cursor — reliable, no detection,
     user-controlled. Lowest risk.
2. Use the **DECTCEM-interception** mechanism (consume `?25h` in app mode) so it's
   renderer-independent and keeps WebGL on.
3. **Read the `[trace:cursor-mode]` log against a live repro** before any more attempts —
   this investigation repeatedly guessed and shipped fixes without runtime evidence; that
   was the core process failure. Instrument, observe, THEN fix.
4. Separately: decide whether the app's OSC-633 up-arrow history feature should **fall
   through to the shell** when its buffer is empty (so it doesn't clobber PSReadLine), and
   whether `getDefaultShell` should resolve the Store pwsh build via registry/AppExecLink.

## Current repo state (post-revert)

All this session's terminal/shell changes were stashed (recoverable via `git stash list`).
The working tree for the touched files is back at HEAD (last commit). The kept-as-reference
reducer `cursorMode.ts` + test were also stashed.

**User action still needed:** the custom **Shell** override (set to the full Store pwsh path)
lives in electron-store config, NOT git — reverting code does not clear it. To return to the
original 5.1 shell (and restore PSReadLine persistent up-arrow history), **clear the Shell
field in Settings → Terminal and restart.**

## Process note

This bug consumed an unusually long session with ~10 failed fix attempts. The dominant
failure mode was **proposing/shipping fixes from code-reading without runtime evidence**, then
discovering the model was wrong on the next visual test. The discipline fix: reproduce →
instrument → read the trace → diagnose → fix. Do not ship attempt N+1 without runtime data
from attempt N.

## RESOLVED (2026-05-20)

**Root cause** — confirmed via a temporary `[trace:decmode]` logger on the PTY stream (not
code-reading): Claude (an Ink TUI) draws its own cursor as screen content and leaves xterm's native
hardware cursor parked wherever it last wrote, so the native cursor shows as a duplicate "ghost".
Steady-state, NOT a timing/render artifact — the user confirmed the ghost sits *in front of* the
typing cursor and persists when idle (a frame-lag would trail *behind* and settle). The WebGL
load-order / atlas-merge theories were red herrings; the ghost is renderer-independent.

**Fix** (`src/renderer/components/Terminal/useTerminalSetupData.ts`): while a TUI is active, strip
Claude's show-cursor (`?25h`) from the stream before `term.write`, so xterm keeps the native cursor
hidden; Claude's own drawn cursor remains. Detection reads Claude's own output — no shell integration,
no PowerShell-7 dependency (the prior session's rabbit hole):
- **ON** = `?1004h` (focus reporting) — Claude sets it on entry; a PowerShell prompt never does.
- **OFF** = `?1000l`/`?1002l`/`?1003l` (mouse tracking disabled) — Claude's exit burst.
- Latch is per-terminal, mirrored to `sessionStorage` so it survives a Ctrl+R renderer reload (the
  session restore replays screen content but not terminal mode state).

**Verified:** fresh `claude` launch → no ghost; exit → normal shell cursor; Ctrl+R reload while Claude
runs → ghost stays suppressed.

**Known limitation:** a full app restart (not Ctrl+R) clears `sessionStorage`, so a restored session
with Claude already running would ghost until Claude re-asserts focus mode (resize/refocus) or is
relaunched. A complete fix needs main-process mode tracking — file a follow-up if it bites in practice.

**Trace evidence:** entry sets `?9001`+`?1004` (some launches also `?2004`+`?2031`); every frame is
wrapped in `?2026` synchronized output; exit resets `?1000/1002/1003/1006`, `?2031`, `?2004`. Mouse-mode
SET was never observed (Claude resets mouse defensively on exit), which is why the on-trigger is focus
(`?1004h`), not mouse-set.
