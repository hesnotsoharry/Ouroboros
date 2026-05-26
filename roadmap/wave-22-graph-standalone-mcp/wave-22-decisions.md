---
status: RESOLVED
created: 2026-05-26
updated: 2026-05-26
wave: 22
---

# Wave 22 — Architecture Decision Record

All 8 decisions ratified inline by Cole during the wave-plan session on 2026-05-26.

---

## Decision 1: Repository layout — in-tree subdirectory `packages/codebase-graph-mcp/`

**Context:** The standalone codebase-graph MCP server needs a code home. Options span monorepo subdirectory, separate repository, or in-place evolution of the existing `src/main/codebaseGraph/`.

**Options considered:**
- *Industry standard:* In-tree subdirectory under a `packages/` folder (monorepo pattern). Shared lockfile, single PR per cross-package change.
- *Emerging best practice:* Same as industry standard for solo / small-team projects with high cross-package coupling.
- *Conservative:* Separate repository (`github.com/hesnotsoharry/codebase-graph-mcp` standalone). Cleanest separation of concerns; doubles git infrastructure.

**Pick:** In-tree `packages/codebase-graph-mcp/` — industry standard.

**Rationale:** Wave 22's standalone package lives in lockstep with Ouroboros (shared developers, shared release cadence, shared deps). Monorepo gives one PR per cross-package change, one lockfile, no version-drift risk. Splitting to a separate repo doubles overhead (issues, PRs, CI) for a project that isn't yet OSS-distributed.

**Consequences:** New `packages/` top-level folder enters the repo. Root `package.json` may need `workspaces` config (verified at Phase 3). All graph-code commits land in this same repo.

---

## Decision 2: Distribution model — npm package via `npx`, no binary bundling

**Context:** The standalone server needs a distribution mechanism — npm package, packaged binary (`pkg` / `nexe` / `bun --compile` / Node SEA), or source tarball.

**Options considered:**
- *Industry standard:* npm package, TypeScript compiled to JavaScript, consumed via `npx @scope/pkg`. Native deps (`better-sqlite3`) ship with prebuilt binaries via `prebuild-install`.
- *Emerging best practice:* Same as industry standard. Bun `--compile` exists but still TRIAL as of May 2026.
- *Cutting-edge:* Bun `--compile` for single-binary distribution. Faster startup than `pkg`; smaller than `nexe`.

**Pick:** npm package via `npx` — industry standard.

**Rationale:** Per research-22.md, `better-sqlite3@^12.x` includes prebuilt binaries covering Node 22.x LTS on Windows/macOS/Linux out of the box. The "biggest unknown" the FU flagged (ABI rebuild) is a non-issue. `pkg` adds 50-100 MB binary size + slower cold start; `nexe` is dead (no Node 18+ support); `bun --compile` is still TRIAL. The npm-package path is the simplest, lowest-friction option and is the standard for MCP server distribution per the SDK docs.

**Consequences:** Package built via `tsc` to `dist/`, published to npm. Users invoke via `npx @hesnotsoharry/codebase-graph-mcp` (or `node packages/.../dist/index.js` for local development). `package.json` declares `bin`, `engines.node >= 20`, `type: "module"`.

---

## Decision 3: Tree-sitter binding strategy — keep `web-tree-sitter` + WASM (lift-and-shift)

**Context:** The current graph implementation uses `web-tree-sitter@^0.26.x` with WASM grammars from `@vscode/tree-sitter-wasm`. For the standalone Node server, the choice is between lifting that as-is or migrating to native `tree-sitter` Node bindings (`tree-sitter-typescript`, `tree-sitter-javascript`, etc.) which are ~2-5× faster at indexing.

**Options considered:**
- *Industry standard:* Lift-and-shift `web-tree-sitter` + WASM. One binding library; per-language support = one WASM grammar drop-in. Slower indexing; consistent across platforms; no per-grammar prebuild story.
- *Emerging best practice:* Native `tree-sitter` Node bindings per language. ~2-5× faster indexing; each language is a separate npm dep with platform-specific prebuilds; adds C++ build dependency surface for languages without prebuilts.
- *Cutting-edge:* Hybrid lazy-load — native bindings for the hot path (TS/TSX) + WASM fallback for everything else.

**Pick:** Lift-and-shift `web-tree-sitter` + WASM — industry standard. Cole delegated this decision with the question "which is better long term?"; orchestrator picked on technical merits.

**Rationale:** Ouroboros aims for multi-language graph coverage (TS, JS, Python, Go, Rust, etc.). With `web-tree-sitter`, adding a language is "drop in a WASM grammar." With native bindings, each new language is a new npm dep with its own per-platform prebuild story. Native is faster on indexing, but indexing is a long-running server operation (init cost amortized); queries are the actual hot path, and those are SQL-bound not parser-bound. For a tool that wants to be the universal codebase-graph MCP, the simplicity of "one binding + WASM grammars" wins over a 12-month horizon. Native-binding migration is a performance optimization that's separately wave-able if a real consumer surfaces the gap.

**Consequences:** The package inherits `web-tree-sitter@^0.26.x` + `@vscode/tree-sitter-wasm` from Agent IDE's lockfile (same versions, no drift). No new native-dependency surface. Indexing perf carries forward from the in-IDE baseline. A follow-up wave can do the native migration if the gap matters.

---

## Decision 4: In-IDE removal — aggressive removal of graph + consumer chain (A2)

**Context:** Cole asked to "remove just the graph stuff" from the IDE alongside the extraction. Three readings: (A1) loopback — in-IDE consumers rewired to call the standalone MCP; (A2) accept capability loss — delete the graph and its consumer chain; (A3) absorb Wave 100's broader chat-surface removal; (C) dual-use — keep both.

**Options considered:**
- *Conservative:* (C) dual-use — graph in BOTH places this wave; in-IDE deletion in a follow-up wave.
- *Industry standard:* (A1) loopback — preserve in-IDE capability by rewiring consumers to consume the standalone MCP in-process. Adds latency to context injection; preserves agent-context-aware terminal sessions.
- *Aggressive:* (A2) accept capability loss — delete `src/main/codebaseGraph/` + `contextLayer/repoMap*` + `contextInjector*` + cross-cutting wiring. Terminal Claude Code sessions inside the IDE lose auto-context injection.
- *Maximalist:* (A3) absorb Wave 100's broader contextLayer-removal work. ~5 extra dev days; couples Wave 22 to Wave 100's scope.

**Pick:** (A2) accept capability loss — Cole's locked direction.

**Rationale:** Cole's clear directional intent throughout this session ("chat is retired," "terminal only," "make standalone") implies "graph out of IDE." A2 honors that without coupling to Wave 100 (separate scope; paused) and without preserving the in-IDE consumer through loopback (adds complexity for capability the user has chosen to drop). The lost capability is acknowledged and documented; restoration is a future-wave option if dogfood surfaces friction.

**Consequences:** **Terminal Claude Code sessions running inside the IDE no longer get auto-context injection.** Agents in the IDE's terminal behave like Claude Code CLI sessions in any other project — Grep/Read on demand, no pre-built context. The cross-project standalone MCP server (Wave 22's primary deliverable) is the future path to restore context-awareness if desired; consuming it in-IDE is out of scope here. ~110+ files deleted (`src/main/codebaseGraph/` ~80 + the consumer chain ~30); ~10 cross-cutting files edited (main.ts, windowManager.ts, hooks*, orchestration/contextPacketBuilder.ts, ipc-handlers/*, mainStartupContextLayerTrigger.ts). IPC channels exposing contextLayer to the renderer are removed; renderer-side callers updated or removed.

---

## Decision 5: First-run indexing of Gamify + meta — in scope as verification, with relief valve

**Context:** Wave 22's cross-project value-add requires indexing the two projects that aren't currently indexed (Gamify and the meta workspace). Indexing two new repos is its own friction surface (potential prebuild misses, schema migration paths).

**Options considered:**
- *Industry standard:* Include first-run indexing as Phase 6 verification with explicit relief valve (defer if > 4 hrs combined wall-clock).
- *Conservative:* Defer first-run indexing entirely to a follow-up wave; ship Wave 22 with the standalone server stood up but Gamify/meta graphs empty.
- *Maximalist:* Include first-run indexing without relief valve — Wave 22 doesn't ship until all 4 projects have populated graphs.

**Pick:** Industry standard — include with relief valve.

**Rationale:** Cole picked "run it as verification." Cross-project value can't be demonstrated without populated graphs in the missing projects; but indexing two repos for the first time is real friction surface that shouldn't burn the wave. The relief valve lets Wave 22 ship the EXTRACTION + REMOVAL (the primary deliverables) regardless of indexing completion; settings blocks land in all projects so the tools surface even if graphs are empty.

**Consequences:** Phase 6 brief includes explicit "if first-run indexing exceeds 4 hrs combined wall-clock, defer to a follow-up" clause. Follow-up filed at wave wrap if relief valve invoked. Per-project indexing latency captured in the smoke report.

---

## Decision 6: Package scope name — `@hesnotsoharry/codebase-graph-mcp`

**Context:** The npm package needs a name. Options: scoped to Cole's GitHub handle (`@hesnotsoharry/...`), scoped to the project (`@ouroboros/...`), or unscoped (`codebase-graph-mcp`).

**Options considered:**
- *Industry standard:* Scoped to the project (`@ouroboros/codebase-graph-mcp`) for OSS-independence; scopes are free.
- *Project convention:* Scoped to Cole's GitHub handle (`@hesnotsoharry/codebase-graph-mcp`) matching the planned `github.com/hesnotsoharry/codebase-graph-mcp` repo.
- *Conservative:* Unscoped (`codebase-graph-mcp`) — collision risk on public npm.

**Pick:** `@hesnotsoharry/codebase-graph-mcp` — project convention. Cole's call.

**Rationale:** Matches the planned GitHub repo name and Cole's existing personal-scope convention. The "leaks personal info into npm" concern noted in the recommended option is acknowledged but Cole's preference holds — package can be re-scoped in a follow-up if OSS distribution surfaces the need.

**Consequences:** Phase 1 `package.json` declares `name: "@hesnotsoharry/codebase-graph-mcp"`. Phase 8 publish attempt targets that scope; requires Cole to have registered the scope on npm + have publish auth set up.

---

## Decision 7: NPM publication — attempt during Wave 22, fall back to follow-up if friction

**Context:** Wave 22 produces an npm-publishable package. Publishing to public npm is a "soft commitment" (yanking is non-trivial) and depends on local auth + scope registration being in order.

**Options considered:**
- *Industry standard:* Attempt publish during the wave; fall back to follow-up on friction. Best-effort, fail-soft.
- *Conservative:* Skip publish entirely; ship Wave 22 with local-tarball install only. Defer publish to a follow-up wave after soak.
- *Maximalist:* Publish only after pre-publish auth verification + scope registration + 2-week local soak. Wave 22 doesn't ship without published artifact.

**Pick:** Industry standard — attempt with fail-soft. Cole's call ("publish if easy, if not add to follow up").

**Rationale:** Publishing is a nice-to-have; the wave's actual deliverables (extraction + removal + cross-project tools) don't depend on public npm being live. Local tarball install (`npm pack` → `npm install ./packages/codebase-graph-mcp-*.tgz` or pointing `mcpServers` config at the local `dist/` path) works for all 4 target codebases. The publish attempt is added cost only if smooth; if friction surfaces, the follow-up routes.

**Consequences:** Phase 8 includes a pre-flight check (verify `@hesnotsoharry` scope registered, verify Cole has publish auth via `npm whoami`). If pre-flight green, attempt `npm publish`; if pre-flight or publish fails, file `roadmap/follow-ups/2026-05-26-codebase-graph-mcp-npm-publish.md` and ship with tarball-only consumption.

---

## Decision 8: Phase classification — walking-skeleton-first

**Context:** Wave 22 introduces a NEW architectural surface (first npm package in the Ouroboros codebase, first standalone MCP server, first cross-process boundary between IDE and graph subsystem). Per `~/.claude/notes/wave-process.md` and `~/.claude/rules-deferred/walking-skeleton-first.md`, new-surface waves require Phase 1 to be the thinnest end-to-end slice that runs.

**Options considered:**
- *Industry standard:* Phase 1 = walking skeleton — package shell + stdio MCP + one trivial `ping` tool + automated smoke that exercises every layer (package built, server spawned, MCP protocol exchanged, agent receives response).
- *Conservative:* Phase 1 = "set up the package structure" — scaffolds files but doesn't run end-to-end yet.
- *Maximalist:* Phase 1 = walking skeleton + a couple of real tools wired (e.g., `ping` + `search_graph` minimal).

**Pick:** Industry standard — walking-skeleton-first.

**Rationale:** The walking-skeleton rule exists because integration risk surfaces at layer boundaries; exercising those boundaries in Phase 1 prevents the "5 phases of beautiful code that don't talk to each other at the end" failure. Phase 1's `ping` → `pong` smoke validates package build, stdio transport, MCP protocol, and Claude Code's `.claude/settings.local.json` consumption before any tool-surface complexity is added. Conservative "set up the package" doesn't exercise the integration; maximalist "ping + search_graph" couples integration risk with tool-implementation risk.

**Consequences:** Phase 1's deliverable is the package shell + one trivial tool + live smoke (orchestrator-authored). Phases 2-8 build on top of that proven base. Gate D (advisory) confirms the walking-skeleton declaration during plan validation.

---

## Phase 0 ratification log

| Decision | Status | Pick | Date |
|----------|--------|------|------|
| 1 | RESOLVED | In-tree `packages/codebase-graph-mcp/` | 2026-05-26 (planner — industry-standard monorepo) |
| 2 | RESOLVED | npm package via `npx`, no binary bundling | 2026-05-26 (planner — grounded by research-22.md) |
| 3 | RESOLVED | `web-tree-sitter` + WASM (lift-and-shift) | 2026-05-26 (Cole delegated; orchestrator picked on technical merits — long-term simplicity) |
| 4 | RESOLVED | Aggressive removal (A2) — graph + consumer chain | 2026-05-26 (Cole's call — "Remove. Just do A2.") |
| 5 | RESOLVED | Include first-run indexing with 4-hr relief valve | 2026-05-26 (Cole — "run it as verification") |
| 6 | RESOLVED | `@hesnotsoharry/codebase-graph-mcp` | 2026-05-26 (Cole — matches planned GitHub repo) |
| 7 | RESOLVED | Attempt publish, fail-soft to follow-up | 2026-05-26 (Cole — "publish if easy, if not add to follow up") |
| 8 | RESOLVED | Walking-skeleton-first | 2026-05-26 (planner — industry-standard per `walking-skeleton-first.md`) |

All decisions ratified. Phase 1 (walking skeleton) + Phase 2 (deletion blueprint) can dispatch in parallel.
