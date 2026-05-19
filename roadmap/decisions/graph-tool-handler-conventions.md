---
status: ACTIVE
decided: 2026-04-30
decided-in: wave-66
type: ADR
---

# ADR: Codebase graph MCP tool handler conventions

## Context

Wave 66 repaired the codebase graph MCP tool surface after a corpus audit found 0% adoption across 369 sessions. Root cause: parameter-name drift between handler implementations, their JSON schemas, and the routing rule injected into sessions. Agents called tools with natural parameter names (`query`, `symbol`, `direction: "callers"`) that differed from the schema-declared names (`name_pattern`, `qualified_name`, `direction: "inbound"`). The tools silently misfired or threw TypeErrors.

Wave 66 established handler conventions that prevent recurrence. These conventions apply to all 14 graph tool handlers and to any new handlers added in future waves.

## Options considered

For return type:
- *MCP spec envelope:* `{ isError: boolean, content: [{ type: "text", text: "..." }] }`. Structurally distinguishable errors; requires changing `McpToolDefinition`, the registrar, and all handlers.
- *`Promise<string>` with prefix convention:* Handlers return strings; errors are prefixed `"Error: "`. Claude Code handles string-prefixed errors gracefully. No interface change.

For parameter name drift:
- *Hard rename to natural names:* Breaks any existing caller using old schema-correct names.
- *Bilingual aliasing:* Handlers accept both old and new names; new name wins on collision. One-wave deprecation window.
- *Update routing rule only:* Rule-only fix has zero code reliability — same bet that produced 0% adoption.

For validation:
- *Zod:* Schema-first, detailed errors. ~10KB bundle; proportionate to hundreds of schemas, not 28 flat param reads.
- *Inline helpers:* Three functions (`assertString`, `assertOneOf`, `assertJsonString`) in `mcpToolHandlerValidation.ts`. ~30 lines, consistent error format, no deps.
- *Ad hoc guards per handler:* Inconsistent error messages; harder for Claude Code to parse.

## Pick

**Return type:** `Promise<string>`. Errors are prefixed `"Error: <message>"`. This is the current interface; migration to the MCP envelope would cascade across `McpToolDefinition`, the SDK registrar, and all renderer mocks — that is a separate, multi-wave change.

**Parameter names:** Bilingual aliasing. Handlers read `args.query ?? args.name_pattern`, `args.symbol ?? args.qualified_name`, `args.direction` maps `"callers" → "inbound"`, `"callees" → "outbound"` (both sets remain valid; natural names are primary). New handlers must use natural names as primary from the start; old-schema aliases exist only as one-wave deprecation bridges.

**Validation:** Inline helpers from `mcpToolHandlerValidation.ts` (`assertString`, `assertOneOf`, `assertJsonString`). Every handler validates all required params before any DB call. Missing or wrong-type params throw with `"Error: missing required parameter '<name>'"` or `"Error: '<name>' must be one of: a, b, c"`.

**Unsupported Cypher functions:** Error out. `query_graph` throws `"unsupported function: <name>"` rather than silently returning empty results. Silent wrong results are categorically worse than explicit errors for a tool agents use to verify data.

## Rationale

The `Promise<string>` + `"Error: "` prefix convention is the existing codebase pattern. Changing it requires a coordinated migration across tool definitions, the MCP server registrar, and renderer-side mocks — that scope belongs in its own wave, not as incidental change to a repair wave. Bilingual aliasing avoids breaking callers while making natural names canonical. Inline validation helpers produce consistent error strings all starting with `"Error: "` (matching the return-type convention), are pure functions (easily tested without DB), and keep the handler files lean.

## Consequences

- **Every graph tool handler** must validate all required parameters via `mcpToolHandlerValidation.ts` helpers before any DB call.
- **Bilingual aliases** (`name_pattern`, `qualified_name`, `function_name`, `inbound`/`outbound`) are deprecated. Future waves may remove them; when removed, the `??` fallback in the handler is also deleted. Do not add new aliases without a clear deprecation path.
- **Natural-name-first:** new handlers added in future waves must use natural parameter names in their JSON schemas from the start. No need to introduce old-style names.
- The `"Error: "` prefix convention is load-bearing — Claude Code agents detect tool errors by this prefix. Any handler that returns an error must use this prefix consistently.
- The `query_graph` tool description must enumerate the supported Cypher subset so agents know what is and isn't available before querying. Maintain this documentation when the supported set changes.
