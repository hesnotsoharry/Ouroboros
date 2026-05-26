import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'codebase-graph-mcp',
  version: '0.1.0',
});

server.registerTool(
  'ping',
  {
    description: 'Health-check tool — returns pong',
    inputSchema: z.object({}),
  },
  async () => {
    return {
      content: [{ type: 'text' as const, text: 'pong' }],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[trace:graph-mcp.server.start] codebase-graph-mcp server listening on stdio');
}

main().catch((err: unknown) => {
  console.error('[trace:graph-mcp.server.error] fatal error during startup', err);
  process.exit(1);
});
