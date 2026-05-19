---
status: ACTIVE
decided: 2026-05-11
decided-in: wave-86
type: ADR
---

# ADR: Chat state ownership boundary — main owns canonical, renderer owns ephemeral

## Context

Waves 82, 84, and 86 collectively addressed a recurring failure mode: the chat orchestration architecture accumulated state-leakage bugs because the ownership line between main process (Electron) and renderer (React) was implicit and inconsistently honored. Renderer components mutated canonical state; main and renderer held overlapping views; desync was the recurring result.

Wave 86 formalized the ownership boundary as a first-class architectural invariant, making leakage bugs structurally impossible or loud-fail rather than silently wrong.

## Options considered

- *Renderer owns everything, main is a relay:* Natural for React state. Doesn't survive renderer reloads. Not viable for persistent chat threads.
- *Main owns everything, renderer is pure projection:* Standard for Electron applications representing persistent system state. Renderer state mutations must flow from main-emitted diffs.
- *Shared ownership with sync:* Two-way sync (CRDT, operational transform). Complex, error-prone, disproportionate for a single-user IDE.

## Pick

**Main owns everything that survives a renderer reload. Renderer owns everything that loses no information if dropped on reload.**

Concretely:
- Chat threads, messages, session IDs, fork/branch structure, tags → main process, persisted to SQLite.
- Composer drafts → renderer-side, persisted to localStorage per window (per-window survival without IPC round-trips per keystroke).
- Every renderer state mutation that affects canonical state must flow from a `chatState:diff` IPC event emitted by main.

The ownership classification is auditable: if it's persistent and needs to survive a crash, it's in main; if it's UI feel and loss on reload is acceptable, it's in renderer.

## Rationale

Eliminates the desync class that the pre-wave-86 architecture suffered from (renderer mutating canonical state, two processes holding overlapping views of the same thread). Composer drafts as renderer-owned avoids IPC overhead on every keystroke while preserving per-window typing state.

This is the industry-standard posture for Electron applications. Cursor, VS Code, and Continue.dev all place canonical state in the main process and treat the renderer as a projection layer.

## Consequences

- `ChatStateBroadcaster` fans out `chatState:diff` IPC chunks to every subscribed renderer window, not just the originating window. Multi-window live mirror is the natural result — both windows subscribe to the same main-owned state; sends from window A appear in window B instantly.
- SQLite is the authoritative persistence layer. CLI JSONL files (`~/.claude/projects/<project>/<session-id>.jsonl`) are read-only secondary sources consulted only for crash recovery / verification, not for canonical reconstruction.
- Thread hydration is capped: at any time only ~10 fully-hydrated threads exist in main+renderer memory. Thread list view loads summaries only (id, title, status, lastUpdated, messageCount). Opening a thread hydrates lazily (< 100ms perceived latency target).
- Hard-fail on impossible states: when the architecture detects an orphaned ID, missing alias, or contract violation, it throws `ChatStateError` and surfaces a non-dismissable error banner. Silent wrong state is categorically worse than explicit failure. Dev and prod builds use the same throw behavior (no "soft-fail in prod" variant).
- Future waves touching chat orchestration must preserve this boundary. If a new feature needs renderer-originated state to affect canonical persistence, the pattern is: renderer sends an IPC command → main mutates → main emits diff → all renderers update. Never mutate SQLite-backed state directly from renderer code.
