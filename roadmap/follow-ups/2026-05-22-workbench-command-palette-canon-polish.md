---
status: OPEN
created: 2026-05-22
severity: LOW
area: Workbench / CommandPalette
---

# Canon Workbench Command Palette — two polish items (Wave 7 Phase 2 deferrals)

Wave 7 Phase 2 wired the canon TitleBar Ctrl-K pill to open the existing command palette. Two known
limitations were deferred (documented in the Phase 2 commit + ADR D4):

1. **Global keybind is Ctrl+Shift+P, not canon's Ctrl+K.** The TitleBar *button* opens the palette
   (dispatches `agent-ide:command-palette`), but the keyboard shortcut handled inside `useCommandPalette`
   is still Ctrl+Shift+P. Canon §06 labels the affordance "Ctrl K". Aligning the keybind needs a check
   that Ctrl+K isn't already bound elsewhere in the renderer (it may be — VS Code uses Ctrl+K as a chord
   prefix). Resolve the binding, then either change `useCommandPalette`'s keybind or add a canon-shell-local
   Ctrl+K handler that dispatches the open event.

2. **Command surface includes legacy-shell commands that no-op in the canon shell.** `useCommandRegistry`'s
   `buildBuiltinCommands()` includes commands that target features the canon shell doesn't mount (open file
   in editor, toggle panels that don't exist, etc.). In the canon shell these are dead entries. Curate the
   command list for the canon shell — either filter by what the canon shell supports, or (cleaner) audit
   `buildBuiltinCommands` for canon relevance once the cutover scope is final.

**Why LOW.** The palette is functional; both items are refinements. Best done alongside Wave 8 when the
canon shell's final feature surface is locked.
