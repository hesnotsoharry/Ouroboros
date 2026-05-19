---
status: ACTIVE
decided: 2026-04-29
decided-in: wave-53i
type: ADR
---

# ADR: MCP transport — adopt `@modelcontextprotocol/sdk`, no hand-rolling

## Context

Waves 53d through 53h fixed five sequential bugs in the IDE's hand-rolled MCP server transport. Each fix matched what the official `@modelcontextprotocol/sdk` already does: SSE handshake compliance, `sessionId` query param routing, endpoint event format, JSON-RPC response dispatch. The pattern was clear: every MCP spec evolution produced another wave of catch-up against a reference implementation we were maintaining manually.

Wave 53i adopted the SDK for `internalMcpServer.ts`. Wave 53j applied it to `internalMcpStdioTransport.ts`. Wave 53k applied it to `mcpClient.ts` and `proxyServer.ts` (CodeMode's client/proxy). After those three waves, the hand-rolled transport was fully replaced.

## Options considered

- *Continue hand-rolling:* Each new MCP spec evolution (Streamable HTTP graduating from optional, sessionId changes, etc.) becomes another bug wave. Subtle SDK implementation details are easy to miss.
- *Adopt `@modelcontextprotocol/sdk` as runtime dependency:* Wire format, request/response correlation, initialize handshake owned by the SDK. Future MCP changes ride in via `npm update`.
- *Hybrid — SDK for server, hand-roll for client:* Reduces adoption scope but leaves half the surface exposed to protocol drift.

## Pick

`@modelcontextprotocol/sdk` as a runtime dependency, applied to all MCP transport surfaces in the IDE (server, stdio bridge, CodeMode client/proxy). No hand-rolling of MCP wire format.

Our `McpToolDefinition` registry is preserved. The SDK owns the transport layer only; tool registration adapts at the boundary (`internalMcpServer.ts` maps `getActiveTools()` → SDK `ListToolsResponse`, routes `CallToolRequest` → `findTool().handler()`).

## Rationale

The SDK is the canonical reference implementation. Tracking it via `package.json` is cheaper and more durable than tracking it via manual diff-driven hand-rolling. Bundle weight from the SDK's transitive dependencies is acceptable in the main process — Electron externalizes server-side deps, so bundle size constraints that apply to renderer code don't apply here.

## Consequences

- `package.json` depends on `@modelcontextprotocol/sdk`. The version is pinned to a specific minor verified at adoption time; bump deliberately, not automatically.
- If Anthropic ships an SDK breaking change, we're at their pace to respond. Mitigated by the version pin.
- SSE transport is the current shape (`type: "sse"`, URL ending in `/sse`). Streamable HTTP is the newer spec but was explicitly deferred (wave 53i Decision 2) — migrate only when the SDK drops SSE support or a concrete need emerges.
- Any future MCP server or transport work in this codebase must use the SDK. Reintroducing hand-rolled MCP transport is an architectural regression; if a future wave proposes it, cite this ADR and require a strong justification.
- The SDK's `SSEServerTransport` contract tests that previously tested our hand-rolled wire format (`internalMcpServerSse.contract.test.ts`) were retired at wave 53i. Testing responsibility for the wire format shifted to the SDK. Our tests cover what we own: tool registration adapter, fallback selection, port allocation, lifecycle.
