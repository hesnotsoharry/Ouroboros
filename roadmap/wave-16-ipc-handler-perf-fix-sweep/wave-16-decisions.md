---
status: PLANNED
created: 2026-05-25
updated: 2026-05-25
---

# Wave 16 — Architectural Decisions

## Decision 1: git:isRepo cache TTL policy

**Context:** `git rev-parse --git-dir` is the single most expensive IPC handler in the boot trace (8 calls, ~20s cumulative, 3.8s worst case on Windows). Zero caching.

**Options considered:**
- *Industry standard:* Short-TTL cache (30–60s for both positive and negative). Trivially correct, low payoff for long sessions.
- *Emerging best practice:* Asymmetric TTL — positive results cached for session lifetime (∞), negative results TTL'd briefly. Matches the actual filesystem invariant: once a directory is a git repo, it stays one until `.git/` is manually deleted. Non-repos can become repos via `git init`, so the negative side needs a window.
- *Experimental / cutting-edge:* Cache + `fs.watch` on `.git/` to invalidate on actual filesystem changes. Most accurate; highest implementation cost; FSWatcher handle proliferation risk.

**Pick:** Emerging best practice — positive ∞, negative 30s — chosen by Cole.

**Rationale:** Matches the actual semantics: `.git/` deletion is a rare manual operation; `git init` is common in development. 30s on the negative side picks up `git init` within a normal user reaction window. No FSWatcher overhead. Single Map<string, {value, expires?}>, ~20 LOC.

**Consequences:** A user who manually deletes `.git/` mid-session would see a stale `isRepo: true` until next IDE relaunch. Acceptable — that's a developer-only scenario and self-explanatory on the next boot.

## Decision 2: Cache scope (module-global vs per-window)

**Context:** The IDE supports multiple windows. Should the cache live at module scope (shared across windows) or be window-keyed?

**Pick:** Module scope — git repo status is a filesystem fact, not a window-specific fact.

**Rationale:** A repo at `C:\foo` is the same repo from any window. No window-specific invalidation logic needed. Cuts the win further for multi-window sessions.

**Consequences:** None. The path-security check still fires per-call against the requesting window's project roots, so this doesn't widen the auth surface.

## Decision 3: Test placement

**Context:** Where do the cache-behavior tests live?

**Pick:** Co-located `gitOperations.test.ts` alongside the source.

**Rationale:** Matches the repo's existing convention (per CLAUDE.md test-files rule). Scoped vitest run via `test:main`.

**Consequences:** None.

## Decision 4 (deferred to phase): extensionStore invalidation event source

**Context:** Phase 2 needs to invalidate the theme cache when extensions are installed/uninstalled. The event source isn't yet identified.

**Pick:** Defer to Phase 2 brief — the dispatched sonnet-implementer reads `src/main/extensions.ts` to find the right event hook before implementing.

**Rationale:** Don't bind a decision the implementer is better-placed to make. Document the constraint here; let the worker resolve it.

## Decision 5 (deferred to phase): usage poller coalescing key

**Context:** Phase 4 needs to dedup concurrent `getUsageWindowSnapshot` calls across windows. The dedup key is the question.

**Pick:** Defer to Phase 4 brief.

**Rationale:** Same as Decision 4 — needs to read the poller code first.
