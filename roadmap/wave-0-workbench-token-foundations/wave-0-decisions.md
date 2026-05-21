---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 0
---

# Wave 0 — Architecture Decision Record

> Scaffold. Phase 0 fills each decision using the `Context / Options / Pick / Rationale / Consequences` shape from `~/.claude/rules/best-practice-spectrum.md`. Decisions 1–5 are determined by the reconciliation doc and canon; Decision 6 was locked by Cole. The waveplan (`waveplan-0.md` → "Locked decisions") carries the one-line summary of each; expand here.

## Decision 1: Canon-name alias strategy

**Context:** The canon mockup authors against short vars (`--accent`, `--ink-2`, `--glass-panel`, `--r-md`); the app uses 3-tier semantic tokens written at runtime by the bridge. Workbench components in later waves need the canon names to exist and stay theme-reactive.

**Pick:** Canon names resolve to real semantic tokens via `var()` references where values align; canon value wins on divergence (with a `canon-divergence` marker).

**Rationale:** A `var()` alias inherits the bridge's per-theme writes, so canon names follow theme switches for free — no parallel update path. Blind-aliasing on divergence (e.g. `--accent-tint` 0.14 indigo vs `--interactive-accent-subtle` 0.08 blue) would silently shift the mockup's intended color, so the canon value is authoritative where they differ, with a marker so a later token-cleanup wave can reconcile the semantic token rather than the alias.

**Consequences:** Most canon names are zero-maintenance reactive aliases. A small set of divergent tokens carry literal values + markers, creating a known follow-up (semantic-token reconciliation) deferred out of this wave.

## Decision 2: Theme-driven vs static for accent/terminal-derived canon tokens

**Pick:** `--accent-edge`, `--accent-glow`, `--term-prompt-bg` (+ the tinted-well tokens) are written by the bridge per theme, not static.

**Rationale:** These are accent/theme-derived and differ per theme (Modern indigo edge vs Warp amber vs Retro phosphor). A static definition would freeze them to one theme's value and break on switch. Routing through the bridge means they update with `--interactive-accent` on every theme change, consistent with how the rest of the live token layer behaves.

**Consequences:** The bridge (`applyComponentTokens`) gains a few writes; per-theme values live in the theme files. Themes that don't set them fall back to a sane default (accent-derived), so out-of-v1 themes still render.

## Decision 3: Opt-in, default-preserving tinted well

**Pick:** Optional `Theme.terminalWell` / `terminalCanvasOpacity`; bridge defaults to today's `rgba(0,0,0,0)` / `1` when unset.

**Rationale:** The always-on-glass behavior (`renderer.md`) depends on the bridge forcing `--term-bg` transparent so native mica/vibrancy shows through. Making the well opt-in with the transparent value as the `??` fallback means the four out-of-v1 themes are byte-identical after the change — the canon treatment is purely additive for the three v1 themes. This is the standard "extend by optional field, preserve default" pattern, lowest-risk against a load-bearing override.

**Consequences:** A unit test pins the unset-default branch (regression guard). The `Theme` interface grows two optional fields; no theme is forced to adopt them.

## Decision 4: Per-theme well values

**Pick:** Modern `rgba(6,8,16,0.62)`/`0.86`, Warp `rgba(14,9,4,0.7)`/`1`, Retro `rgba(4,10,6,0.96)`/`1` — verbatim from `design-system/workbench-tokens.css`.

**Rationale:** The canon + mockup are the paired source of truth; copying values verbatim keeps the implementation matching the design contract with no interpretation drift. Canon only specifies Modern's reduced canvas opacity (0.86); Warp and Retro keep `1` (Retro is explicitly matte/opaque, not glass).

**Consequences:** Modern's terminal becomes a translucent well immediately (Decision 6); Warp/Retro get their well tint but full canvas opacity. Other themes unchanged.

## Decision 5: Canon alias block placement

**Pick:** New, clearly-labeled Tier-2 sub-block in `tokens.css`, separate from the legacy "remove after Phase 3" compat aliases.

**Rationale:** The legacy compat block has its own removal lifecycle; bundling canon aliases into it would entangle two unrelated cleanups. A separate labeled block keeps the canon grammar's lifetime independent and self-documenting.

**Consequences:** `tokens.css` carries two alias blocks during the overhaul; the canon block is permanent (until/unless components migrate to semantic names), the legacy block is still slated for its own removal.

## Decision 6: Apply the tinted well to the current terminal now — LOCKED (Cole, 2026-05-21)

**Context:** Wiring the bridge + setting Modern's values changes the *existing* IDE-shell terminal immediately, because the live terminal already reads `--terminal-canvas-opacity`.

**Pick:** Apply now.

**Rationale:** Gives Wave 0 a real user-observable surface, validates the well treatment early on real terminal content, and is one-line reversible.

**Consequences:** The current (eventually-replaced) shell's terminal gets the tinted-well look before the new workbench exists; if it reads poorly over busy output, unset Modern's two fields (tokens + bridge stay for Wave 2).
