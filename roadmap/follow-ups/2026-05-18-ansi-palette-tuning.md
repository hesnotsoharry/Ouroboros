---
status: OPEN
created: 2026-05-18
updated: 2026-05-18
source: Wave 95 Phase D ADR D4
severity: low
---

# ANSI palette slot tuning vs Windows Terminal Campbell defaults

Filed during Wave 95 Phase D wrap. The Phase D diagnostician's H3
hypothesis (confirmed as contributing factor, not primary): the IDE's
hardcoded ANSI palette uses muted slot values that differ from
Windows Terminal's Campbell defaults.

Examples (IDE vs Campbell):
- `cyan: '#55aaaa'` vs `'#3A96DD'`
- `brightCyan: '#55ffff'` vs `'#61D6D6'`
- `green: '#55aa55'` vs `'#13A10E'`

Not the primary cause of Claude TUI rendering issues (Phase D fixed
that via opaque bg) — but a secondary contributor to "colors look
off" in any TUI app.

## UX call required

This affects ALL terminal content, not just TUI:
- Plain shell output colors
- `ls --color` output
- `git diff` color (if not handled by separate config)
- Any program emitting ANSI SGR

Changing the palette may be unwelcome to users habituated to the
current look. UX decision — not a bug fix.

## Options

1. **Adopt Campbell** (Windows Terminal default) — most cross-platform
   familiarity, matches what users see in Windows Terminal / VS Code.
2. **Adopt VS Code "Dark+ default"** — matches the most likely
   visual reference for the user base.
3. **Make palette per-theme** — each IDE theme defines its own ANSI
   slots in its theme file. Maximum flexibility, more maintenance.
4. **Add a Settings toggle** — user picks Campbell / Dark+ / "current
   muted" / custom.
5. **Wontfix** — current palette is intentional aesthetic choice.

## Pointers

- `src/renderer/components/Terminal/terminalHelpers.ts:44-61` —
  `ANSI_COLORS` (duplicate also in `terminalTheme.ts`).
- `src/renderer/themes/` — per-theme color definitions if going with option 3.

## Estimate

- Option 1 or 2: 1 hour (table swap + visual smoke).
- Option 3: 3-4 hours (per-theme migration).
- Option 4: half-day (settings UI + persistence + plumb).
