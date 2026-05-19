# Architecture decisions index

One line per durable cross-wave ADR. Updated when a new ADR is filed in `roadmap/decisions/`. ADRs follow Nygard's template (Status / Context / Decision / Consequences).

| Decision | Topic | Decided | Status | Link |
|---|---|---|---|---|
| MCP server registration target | `.mcp.json` + `~/.claude.json` is the correct registration target; `.claude/settings.json` is NOT read by Claude Code CLI for MCP discovery | wave-53g, 2026-04-29 | ACTIVE | [mcp-server-registration-target.md](mcp-server-registration-target.md) |
| MCP transport: SDK over hand-rolling | `@modelcontextprotocol/sdk` is adopted for all MCP transport surfaces; hand-rolled wire format is not maintained | wave-53i, 2026-04-29 | ACTIVE | [mcp-transport-sdk-adoption.md](mcp-transport-sdk-adoption.md) |
| Chat state ownership boundary | Main process owns canonical chat state; renderer owns ephemeral UI; every canonical mutation flows from a main-emitted IPC diff | wave-86, 2026-05-11 | ACTIVE | [chat-state-ownership-boundary.md](chat-state-ownership-boundary.md) |
| Composer editor engine | Lexical is the chat composer's editor engine; `rich-textarea` is removed; competing engines are excluded | wave-81, 2026-05-02 | ACTIVE | [composer-editor-engine.md](composer-editor-engine.md) |
| Graph tool handler conventions | Handlers return `Promise<string>` with `"Error: "` prefix; use bilingual parameter aliases; validate via `mcpToolHandlerValidation.ts` helpers; unsupported functions error out | wave-66, 2026-04-30 | ACTIVE | [graph-tool-handler-conventions.md](graph-tool-handler-conventions.md) |
| Hook policy enforcement semantics | Unconditional policy violations → immediate deny (bypass approval UI); advisory signals → IDE-log-only | wave-50, 2026-04-28 | ACTIVE | [hook-policy-enforcement-semantics.md](hook-policy-enforcement-semantics.md) |

## How to read this

Wave-scoped ADRs (decisions that pertain only to one wave's implementation) live inside each `wave-{N}-{slug}/wave-{N}-decisions.md` — not here. This index is reserved for **durable cross-wave ADRs** that record load-bearing architectural choices outliving any single wave.

See `roadmap/decisions/README.md` for the per-project rationale; see `~/.claude/rules/best-practice-spectrum.md` for when an ADR is required.
