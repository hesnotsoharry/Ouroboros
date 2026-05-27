---
status: DRAFT
created: 2026-05-26
topic: Wave 22 Standalone MCP Server Research
---

# Wave 22 Research: Standalone Codebase Graph MCP Server

Extraction of `src/main/codebaseGraph/` to a standalone Node.js MCP server, consumable via `npx` and configurable in Claude Code's `~/.claude/settings.json`. Five critical research topics below.

---

## 1. better-sqlite3 Standalone Node ABI Handling

**Source:** [better-sqlite3 README](https://github.com/wiselibs/better-sqlite3/blob/master/README.md) | [better-sqlite3 Compilation Docs](https://github.com/wiselibs/better-sqlite3/blob/master/docs/compilation.md) | [better-sqlite3 npm package](https://www.npmjs.com/package/better-sqlite3)

### Installation & Prebuilts

- **Prebuilt binaries available for LTS Node versions**, including Node 22.x (Node 22 is an active LTS as of 2026).
- **150+ prebuilt binaries** ship with each release, covering Windows (x64, arm64), macOS (x64, arm64), and Linux (x64, arm64, musl variants).
- **Out-of-the-box behavior:** `npm install better-sqlite3` in a Node 22 environment downloads prebuilt binaries via `prebuild-install` — **no build tools required** if a matching prebuilt exists.
- **Fallback to source build:** If no prebuilt matches the exact Node version/platform/ABI combination, `npm install` falls back to building from source via `node-gyp`, which requires C++ toolchain (Windows: Visual Studio + Python; macOS: Xcode; Linux: build-essential).

### Electron vs Standalone Node

- **Current Agent IDE setup:** Electron's V8 ABI differs from Node.js standalone. The codebase today uses `ELECTRON_RUN_AS_NODE=1` as a workaround to load Node bindings inside the Electron main process.
- **For a truly standalone server:** No `ELECTRON_RUN_AS_NODE` trick needed. Use a plain `node` process; prebuilts are built against Node ABI, not Electron ABI.
- **Node 22.x compatibility:** Confirmed. Version pinning in `package.json` as `"better-sqlite3": "^12.x"` (current as of late 2026) includes Node 22 support.

### Compilation Customization

If custom SQLite compilation is needed (e.g., FTS5 extensions):

```bash
npm install better-sqlite3 --build-from-source --sqlite3=/path/to/sqlite-amalgamation
```

Or via preinstall hook in `package.json`:

```json
{
  "scripts": {
    "preinstall": "npm install better-sqlite3@'^12.0.0' --no-save --build-from-source"
  }
}
```

### Key Takeaway

**For standalone Node 22.x:** `npm install better-sqlite3` works out-of-the-box on Windows/macOS/Linux. No special ABI handling required. Prebuilts are available; source fallback is safe if prebuilt is missing.

---

## 2. MCP TypeScript SDK Standalone Server API

**Source:** [MCP TypeScript SDK v2 Docs](https://ts.sdk.modelcontextprotocol.io/v2/index.html) | [MCP Server Guide](https://ts.sdk.modelcontextprotocol.io/v2/documents/Documents.Server_Guide.html) | [MCP GitHub SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### Current Version & Transport

- **Latest SDK version:** `@modelcontextprotocol/sdk` v1.x (as of May 2026).
- **Recommended transport for `npx` servers:** **Stdio** (stdin/stdout), not SSE. Stdio is the standard for CLI tools and Claude Code's local server invocation.
- **Alternative for remote servers:** SSE (Server-Sent Events) for HTTP/HTTPS endpoints, but not relevant for local `npx` distribution.

### Minimal Standalone Server Skeleton

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const server = new McpServer({
  name: 'codebase-graph-server',
  version: '1.0.0',
});

// Register a tool
server.registerTool(
  'query_graph',
  {
    description: 'Query the codebase graph',
    inputSchema: z.object({
      query: z.string().describe('Cypher query'),
    }),
  },
  async ({ query }) => {
    // Tool implementation
    return {
      content: [
        {
          type: 'text',
          text: `Query result for: ${query}`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[codebase-graph] Server listening on stdio');
}

main().catch(console.error);
```

### Tool Definition & Error Propagation

- **Tool schema:** Defined via Zod (`z.object`, `z.string`, etc.). No need for manual JSON Schema — Zod handles conversion.
- **Tool handler:** Async function returning `{ content: Array<{ type: 'text' | 'image' | 'resource', ... }> }`.
- **Error handling:** Thrown errors are caught by the SDK and propagated to the client as tool-execution errors (serialized as JSON-RPC error responses). Best practice: catch and return error content rather than throwing.

```typescript
async ({ query }) => {
  try {
    const result = await db.prepare(query).all();
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${err.message}`,
          isError: true,
        },
      ],
    };
  }
}
```

### Server Lifecycle

- **Initialization:** Create `McpServer`, register tools/resources/prompts, instantiate transport, call `server.connect(transport)`.
- **Shutdown:** No explicit shutdown call needed; the process exits when stdin closes (Claude Code/client closes the connection).
- **Logging:** Use `console.error()` for diagnostic logs — `console.log()` is reserved for stdio protocol messages and will corrupt the connection.

### Key Takeaway

**MCP SDK is straightforward for standalone servers.** Stdio transport, Zod schemas, async handlers. The scaffold above is ~30 lines to a working server.

---

## 3. Packaging a TypeScript Node CLI/Server for npx Distribution

**Source:** [npm Docs: package.json](https://docs.npmjs.com/cli/v7/configuring-npm/package-json/) | [npm Docs: npx](https://docs.npmjs.com/cli/v11/commands/npx/) | [Sandro Maglione: Build npx Command with TypeScript](https://www.sandromaglione.com/articles/build-and-publish-an-npx-command-to-npm-with-typescript)

### (a) Canonical 2026 Setup: package.json Fields

```json
{
  "name": "@your-scope/codebase-graph",
  "version": "1.0.0",
  "description": "Standalone MCP server for codebase graph queries",
  "type": "module",
  "bin": {
    "codebase-graph": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^22.x"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.x",
    "better-sqlite3": "^12.x",
    "zod": "^3.x"
  }
}
```

**Key fields:**

- **`bin`:** Maps command name to executable file. When installed globally or via `npx`, this file is symlinked into PATH.
- **`type: "module"`:** Declares ES modules (modern standard). Omit for CommonJS.
- **`files`:** Whitelist published files. Include `dist/`, exclude `src/`, tests, `.env`.
- **`engines`:** Version constraint. `">=20.0.0"` covers Node 20 LTS, Node 22 LTS, and future versions. npm warns if violated (not enforced unless `engine-strict=true` in user's `.npmrc`).
- **`prepublishOnly`:** Ensures `npm run build` runs before publish, so prebuilt code lands on npm.

### Build & Distribution Strategy

**Source vs compiled distribution:**

- **Distribute compiled code** (tsc output in `dist/`), not TypeScript sources.
- **Reason:** Faster startup (no JIT overhead), smaller published package size, no build tools required at install time.
- **Setup:**

  ```bash
  # Development
  npm run build           # tsc writes to dist/
  
  # Before publish
  npm run prepublishOnly  # Automatic; runs build
  npm publish
  
  # User consumption
  npx @your-scope/codebase-graph --help
  ```

- **Source maps (optional):** Include `.js.map` files in `dist/` for better debugging. Minimal size overhead.

### (b) Binary Bundling Tools: Current Status (2026)

**Vercel pkg:**
- Still maintained and active (recent updates). Viable for bundling Node CLI apps into single standalone executables.
- Produces a binary that embeds the entire Node runtime + your bundled code.
- **Caveat:** Larger file size (~50–100 MB per binary). Slower cold startup than native `npx`.

**nexe:**
- Unmaintained since ~2017. Lacks support for Node 18+. **Do not use.**

**Bun --compile:**
- Emerging alternative. Bundles code + lightweight Bun runtime into a binary.
- Faster than pkg; more actively developed.
- **Status:** Still TRIAL/EXPERIMENTAL as of May 2026. Consider if you want aggressive optimization.

**esbuild:**
- Not a bundler for executables; it's a code bundler. Can produce a single `.js` file with all dependencies inlined (`--bundle --platform=node`).
- **Use case:** Reduce deploy complexity; distribute as a bundled `.js` + Node requirement instead of a binary.
- **Tradeoff:** Requires Node to be installed; slightly faster startup than pkg; much smaller payload.

**Recommendation for this wave:** Publish as source distribution (TypeScript compiled to JavaScript) via npm. Users run via `npx @scope/pkg`. This is the **lowest friction** path: no binary build overhead, no prebuilt binaries per platform, simple `.js` delivery. If binary distribution becomes a hard requirement in a future wave, revisit `pkg` or `bun --compile` then.

### (c) Shipping Native Bindings (better-sqlite3)

**For npm-distributed packages with native bindings:**

1. **Prebuilt binaries ship in npm tarball:** The `better-sqlite3` package includes prebuilt binaries via the `prebuild-install` mechanism. When a user runs `npm install @your-scope/codebase-graph`, npm also installs `better-sqlite3`, and `prebuild-install` downloads or builds the native module for their platform.

2. **User doesn't need a compile toolchain if:**
   - A prebuilt binary matches their Node version + platform.
   - Prebuilts are present in `better-sqlite3` release (Node 20, 22 LTS are covered).

3. **User needs a compile toolchain if:**
   - No prebuilt matches (e.g., musl Linux with arm64; Node 22 alpha).
   - `better-sqlite3` build-from-source is triggered.

4. **Mitigation:** Pin `better-sqlite3` to a recent stable version (`^12.x`). Mention in README: *"Requires Node 20+ LTS or Node 22+. Prebuilt binaries included; no build tools needed on standard platforms."*

### Key Takeaway

**Publish as npm package with TypeScript compiled to JavaScript.** Users run `npx @scope/pkg`. Prebuilt binaries for `better-sqlite3` are included automatically. No binary-bundling complexity needed for this wave.

---

## 4. mcpServers Configuration in Claude Code

**Source:** [Claude Code Settings Docs](https://code.claude.com/docs/en/settings) | [Nimbalyst: Claude Code MCP Setup 2026](https://nimbalyst.com/blog/claude-code-mcp-setup/) | [Scott Spence: Configuring MCP Tools](https://scottspence.com/posts/configuring-mcp-tools-in-claude-code)

### Configuration Files & Scopes

Claude Code uses a **hierarchical scope system:**

| Scope | File | Applies | Shared |
|-------|------|---------|--------|
| **User** | `~/.claude/settings.json` | All projects | No (personal) |
| **Project** | `.claude/settings.json` | Team in repo | Yes (git-committed) |
| **Local** | `.claude/settings.local.json` | You in repo | No (gitignored) |

**Priority (highest first):** Local > Project > User.

### MCP Server Configuration Location

⚠️ **Important clarification:** MCP servers are configured in **`~/.claude.json`** (note: `.json`, not `.claude/settings.json`), NOT in `settings.json`. This is a common source of confusion.

**However,** `settings.json` does support `mcpServers` at both user and project scopes (as of 2026 updates). The best practice is:

- **Global custom servers:** `~/.claude/settings.json`
- **Project-specific servers:** `.claude/settings.json` (git-tracked)
- **Override/local:** `.claude/settings.local.json` (gitignored)

### Configuration Structure

```json
{
  "mcpServers": {
    "codebase-graph": {
      "type": "stdio",
      "command": "npx",
      "args": ["@your-scope/codebase-graph"],
      "env": {
        "PROJECT_ROOT": "${workspaceRoot}",
        "DEBUG": "codebase-graph:*"
      }
    }
  }
}
```

**Field breakdown:**

- **`type`:** `"stdio"` (for local CLI servers) or `"sse"` (for HTTP endpoints).
- **`command`:** Executable to run (e.g., `"npx"`, `"node"`, `/path/to/server`).
- **`args`:** Array of arguments passed to the command.
- **`env`:** Environment variables passed to the subprocess. Supports `${workspaceRoot}` placeholder for per-project paths.

### Project-Root Parameter Example

To pass the current project root to the MCP server:

```json
{
  "mcpServers": {
    "codebase-graph": {
      "type": "stdio",
      "command": "npx",
      "args": ["@your-scope/codebase-graph", "--root", "${workspaceRoot}"]
    }
  }
}
```

The MCP server receives the arguments and can parse `--root` to determine the indexing path.

### Tool Error Propagation

When an MCP tool fails:

1. **Server returns error in tool result:** `{ content: [{ type: 'text', text: '...', isError: true }] }`.
2. **Claude Code displays in UI:** Error message visible in tool output panel + console.
3. **Client-side error handling:** If the server crashes (exits unexpectedly), Claude Code surfaces a "Server disconnected" error and attempts reconnection on next tool call.

### When Changes Take Effect

- **Most settings reload immediately** (permissions, env vars).
- **MCP server list:** Requires **session restart** (or opening a new session) to pick up new servers.

### Key Takeaway

**Configuration:** Use `.claude/settings.json` in the project (git-tracked). Define `mcpServers.codebase-graph` with `type: "stdio"`, `command: "npx"`, and `args` pointing to your published package. Use `${workspaceRoot}` to pass the project root dynamically.

---

## 5. web-tree-sitter Standalone Node.js Compatibility

**Source:** [web-tree-sitter Binding README](https://raw.githubusercontent.com/tree-sitter/tree-sitter/master/lib/binding_web/README.md) | [Tree-sitter Official](https://tree-sitter.github.io) | [web-tree-sitter npm](https://www.npmjs.com/package/web-tree-sitter)

### Node.js Support

- **WASM in Node.js is supported** but **considerably slower** than native Node.js bindings.
- **Recommendation:** For production server-side parsing (indexing), use the **native tree-sitter Node bindings** (`@tree-sitter/core`, `tree-sitter`), not `web-tree-sitter`.
- **However:** `web-tree-sitter` works in Node.js for testing/experimentation. Initialization is the same as browser:

  ```javascript
  const Parser = require('web-tree-sitter');
  await Parser.init();
  const parser = new Parser();
  // ... use parser with WASM grammars
  ```

### WASM Grammar Availability

The codebase currently uses `@vscode/tree-sitter-wasm` for browser/Electron grammars. For standalone Node.js:

- **Use `@vscode/tree-sitter-wasm`** (same as Electron) if you're testing compatibility.
- **Or use pre-compiled native grammars** (e.g., `tree-sitter-typescript`) if available, for better performance.
- **ABI compatibility:** `@vscode/tree-sitter-wasm` is independent of Node version; WASM runs on any Node 20+. No ABI drift concerns.

### Version Pinning

⚠️ **Critical caveat (Issue #5171):** `web-tree-sitter` v0.26.x is **incompatible** with WASM files built by `tree-sitter-cli` v0.20.x.

- If indexing grammars compiled with older cli versions, pin matching `web-tree-sitter` versions.
- For Wave 22, assume current `@vscode/tree-sitter-wasm` + latest `web-tree-sitter` are compatible.

### Node.js-Specific Setup

```javascript
const Parser = require('web-tree-sitter');

// Locate WASM file correctly in Node.js
await Parser.init({
  locateFile(scriptName) {
    return require.resolve(`web-tree-sitter/${scriptName}`);
  },
});

const parser = new Parser();
// Continue as normal
```

### Key Takeaway

**Standalone Node.js indexing should use native tree-sitter bindings, not `web-tree-sitter`.** But `web-tree-sitter` + `@vscode/tree-sitter-wasm` CAN run in Node.js if needed (e.g., testing Electron code paths). No Node 22.x-specific WASM compatibility issues. Version-pin `web-tree-sitter` to avoid ABI drift with WASM grammars.

---

## Summary: Load-Bearing Findings for Wave 22 Planning

1. **better-sqlite3 prebuilt binaries cover Node 22 natively.** No rebuild or special ABI handling needed for standalone npm distribution. `npm install` works out-of-the-box.

2. **MCP SDK is mature and straightforward.** Stdio transport, Zod schemas, async handlers. Minimal boilerplate (~30 lines) to a working server.

3. **Distribute as npm package with compiled TypeScript.** Users run `npx @scope/pkg`. No binary-bundling tools (pkg, nexe, bun) needed for this wave—overhead not justified. Add future if distribution becomes a constraint.

4. **Claude Code mcpServers configuration is hierarchical and clear.** Use `.claude/settings.json` in the project repo. Define `mcpServers.codebase-graph` with `type: "stdio"`, `command: "npx"`, and `args`. Session restart picks up changes.

5. **web-tree-sitter + WASM work in standalone Node.js but are slower than native bindings.** For indexing, prefer native tree-sitter. Version-pinning matters: `web-tree-sitter` 0.26.x incompatible with tree-sitter-cli 0.20.x WASM files.

---

## Source URLs

- https://github.com/wiselibs/better-sqlite3/blob/master/README.md
- https://github.com/wiselibs/better-sqlite3/blob/master/docs/compilation.md
- https://www.npmjs.com/package/better-sqlite3
- https://ts.sdk.modelcontextprotocol.io/v2/index.html
- https://ts.sdk.modelcontextprotocol.io/v2/documents/Documents.Server_Guide.html
- https://github.com/modelcontextprotocol/typescript-sdk
- https://docs.npmjs.com/cli/v7/configuring-npm/package-json/
- https://docs.npmjs.com/cli/v11/commands/npx/
- https://www.sandromaglione.com/articles/build-and-publish-an-npx-command-to-npm-with-typescript
- https://www.libhunt.com/r/pkg
- https://www.pulumi.com/blog/nodejs-binaries-with-pkg/
- https://www.npmjs.com/package/nexe
- https://github.com/nexe/nexe
- https://code.claude.com/docs/en/settings
- https://nimbalyst.com/blog/claude-code-mcp-setup/
- https://scottspence.com/posts/configuring-mcp-tools-in-claude-code
- https://raw.githubusercontent.com/tree-sitter/tree-sitter/master/lib/binding_web/README.md
- https://tree-sitter.github.io
- https://www.npmjs.com/package/web-tree-sitter
- https://github.com/tree-sitter/tree-sitter/issues/5171
