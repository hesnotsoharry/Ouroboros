---
status: ACTIVE
decided: 2026-04-29
decided-in: wave-53g
type: ADR
---

# ADR: MCP server registration target — `.mcp.json` + `~/.claude.json`, not `.claude/settings.json`

## Context

Claude Code CLI reads MCP server configuration from two places: project-local `.mcp.json` (plus per-project `enabledMcpjsonServers` in `~/.claude.json`) and user-level `mcpServers` in `~/.claude.json`. It does NOT read MCP entries from `.claude/settings.json` — that file is used by Anthropic Desktop, not the CLI.

Waves 53d through 53g discovered this the hard way: five sequential fix waves were required because earlier waves had been writing `mcpServers.ouroboros` to `.claude/settings.json`, producing dead-letter config. The IDE's MCP server was technically healthy but completely invisible to CLI agents for the entire period.

Wave 53k further confirmed that Claude Code's `--strict-mcp-config` flag and `disabledMcpjsonServers` toggle are both non-functional for project-scoped isolation in some environments (verified against v2.1.122 on Windows), so CodeMode's isolation contract was rewritten to use destructive `.mcp.json` edits rather than depending on those mechanisms.

## Options considered

- *Write to `.claude/settings.json` `mcpServers`:* Industry-standard-looking JSON config, already present in project. Wrong target — CLI never reads it for MCP discovery.
- *Write to `~/.claude.json` top-level `mcpServers`:* Works, but wrong scope — user-level entries appear in every project, while the IDE's MCP server is per-instance with a random port.
- *Write to project-local `.mcp.json` + `~/.claude.json enabledMcpjsonServers`:* Correct scope (per-project) and correct file (what the CLI actually reads).

## Pick

Project-local `.mcp.json` as the registration target. `~/.claude.json projects.<root>.enabledMcpjsonServers` updated automatically on startup to trust the entry without an interactive prompt.

Every `.mcp.json` entry must include a `type` field (`"sse"` or `"stdio"`); entries without it are silently rejected by the CLI schema validator.

`.claude/settings.json` is NOT written for MCP registration. Any existing `mcpServers.ouroboros` entry there is cleaned up on first launch (wave 53g's `cleanupLegacySettingsJson`).

## Rationale

The IDE's MCP server is per-instance (random port per launch). Writing to user-level `mcpServers` would point every project at one stale port. Project-local `.mcp.json` is the correct scope: the IDE upserts the entry on startup with the current port, so stale entries between launches are harmless.

The `enabledMcpjsonServers` auto-update is necessary because Claude Code requires an explicit trust grant before auto-loading `.mcp.json`-declared servers — without it, the server registers but is never started.

## Consequences

- `internalMcpAutoInject.ts` writes `.mcp.json` and updates `~/.claude.json` on every IDE startup. Both writes are atomic (`.tmp` + rename).
- `.mcp.json` is in `.gitignore` — the port is per-launch and must not be committed.
- `~/.claude.json` is owned jointly by Anthropic's CLI and the IDE. Writes are idempotent and additive; other keys are preserved. Concurrent writes use last-write-wins (cross-process lock coordination with Anthropic's CLI is not feasible).
- Any future wave adding a new IDE MCP server must follow this registration shape. Do not reintroduce `.claude/settings.json` as a registration target.
- The standalone Ouroboros MCP server (wave 60) uses the same shape: a single `ouroboros` entry in `.mcp.json` pointing at the bundled standalone binary.
