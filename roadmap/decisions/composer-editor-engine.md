---
status: ACTIVE
decided: 2026-05-02
decided-in: wave-81
type: ADR
---

# ADR: Chat composer editor engine — Lexical

## Context

The AgentChat composer used `rich-textarea` v0.27, an overlay-style component that re-renders the entire highlight token tree from scratch on every value change. Live investigation (2026-05-02) confirmed 2–3 second renderer freezes when backspacing through `@` mention chips. Root cause: `rich-textarea`'s render-children pattern runs `tokenizeComposerHighlights` over the full value on every keystroke — O(n) re-renders of all spans, not just the changed range.

Pre-wave perf fixes (substring search replacing Fuse.js, view selector for the conversation, memoized context preview) reduced search latency to ~5ms but did not address the structural cause. Research via Context7 (`/facebook/lexical`, `/sodenn/lexical-beautiful-mentions`) confirmed the residual stutter is structural to `rich-textarea`'s overlay model.

## Options considered

- *Industry standard — Lexical (Meta):* Immutable-node tree; commits a delta per keystroke touching only the affected text node. React 19 compatible, active maintenance. `lexical-beautiful-mentions` covers the `@`-trigger mention-chip pattern.
- *Emerging — Slate.js:* Flexible plugin architecture, large community, but historically prone to React major-version regressions and heavier API surface.
- *Experimental — TipTap (ProseMirror):* Rich-text first, complex for a plain-text chat composer, larger bundle.
- *In-house patch — fix `rich-textarea`:* React.memo + portal + CSS containment. Research estimated ceiling of 100–150ms responsiveness; the user's symptom required reaching 16ms (single-frame). Structural cause cannot be fixed without replacing the overlay model.

## Pick

**Lexical** — industry-standard tier.

New code lives under `src/renderer/components/AgentChat/lexicalComposer/`. `@` mentions handled by `lexical-beautiful-mentions`. Slash commands handled by a small custom `SlashCommandPlugin.ts` (watches editor state for `/` patterns, toggles the existing `SlashCommandMenu` open state). `rich-textarea` dependency removed at migration completion.

## Rationale

Four independently weighted factors all favor Lexical:

1. **Reconciliation model eliminates the bug structurally.** Delta commits per keystroke; only the affected text node re-renders.
2. **React 19 compatibility, verified.** `@lexical/react` and `lexical-beautiful-mentions` are explicitly tested against React 19 per Context7 docs at wave start.
3. **Plugin ecosystem covers the full parity surface.** `lexical-beautiful-mentions` provides exactly the `@`-trigger + chip token + custom menu shape needed, including the `useBeautifulMentions` hook for programmatic insertion (drag-from-FileTree, quote-to-composer).
4. **Migration is encapsulated and reversible.** Single directory; existing helpers (`MentionChipsBar`, `SlashCommandMenu`, `useAgentChatContext`, draft persistence, image attachment) are unchanged. Reverting is one directory deletion + one dependency change + a branching import.

## Consequences

- Runtime dependencies: `lexical`, `@lexical/react`, `lexical-beautiful-mentions` added; `rich-textarea` removed. Net dependency count +2.
- `lexical-beautiful-mentions` is pinned to a specific minor version verified against React 19 at wave start. Upgrade deliberately; verify React compatibility before bumping.
- A custom `SlashCommandPlugin.ts` is in our maintenance footprint (~50 lines). Its contract is stable: it only toggles `SlashCommandMenu` open state; it does not own the menu itself.
- Draft persistence stays string-based (per-thread in localStorage). Lexical's JSON-state serialization (preserves mention chip positions across reloads) was evaluated and deferred — current behavior already loses partial mention positions across thread switches; JSON-state adds restore complexity for no perceived user win. Revisit if telemetry shows demand.
- Auto-resize behavior moves from `rich-textarea`'s `autoHeight` JS to CSS rules on the ContentEditable container. Up to ~4px visual difference is a known accepted regression.
- **Future composer work must use Lexical primitives.** Do not introduce a competing editor engine for any composer surface in this application. If additional text-entry surfaces (Settings inputs, search overlays, terminal command-palette) ever need rich editing, evaluate Lexical extensions for those specifically — but they were explicitly excluded from this wave and have no current perf problem.
