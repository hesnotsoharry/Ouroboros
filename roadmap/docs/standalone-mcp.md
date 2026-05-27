# Standalone Codebase Graph MCP Server

`@hesnotsoharry/codebase-graph-mcp` — a standalone Node-process MCP server (stdio transport) that indexes
source code into a SQLite-backed knowledge graph and exposes 15 query tools. No IDE dependency.

## Package overview

The in-IDE graph (previously `src/main/codebaseGraph/`) was extracted into an independent npm package in
Wave 22. Any Claude Code session in any project can now attach a live structural graph by adding one
`.mcp.json` entry — no Electron, no IDE running. The package is the same indexing + query engine
(tree-sitter WASM, SQLite, Cypher subset) that ran inside the IDE, now compiled as a standalone Node ESM
binary.

Tools surface as `mcp__ouroboros__*` in Claude Code after restart picks up the config.

## Architecture

```
Claude Code (or any MCP client)
  │  stdio JSON-RPC
  ▼
C:\Web App\codebase-graph-mcp\dist\index.js  (Node.js process)
  │
  ├── serverBootstrap.ts
  │     buildContext(rootPath, dbPath)
  │     registerGraphTools(server, context, rootPath)
  │
  ├── GraphDatabase  ─────────────────► ~/.ouroboros-graph/<hash8>/graph.db  (SQLite)
  ├── QueryEngine    (search, trace, architecture, change-detection)
  ├── CypherEngine   (simplified Cypher subset)
  ├── IndexingPipeline
  │     └── IndexingWorker (worker_threads, CPU-bound)
  │           └── TreeSitterParser  (web-tree-sitter WASM)
  │                 grammars: TS · JS · Python · Go · Rust · Java · C++
  └── 14 graph tools  +  ping (health-check)
```

## Consumption pattern — `.mcp.json`

Drop this in the project root (or merge into an existing `.mcp.json`):

```json
{
  "mcpServers": {
    "ouroboros": {
      "type": "stdio",
      "command": "node",
      "args": [
        "C:/Web App/codebase-graph-mcp/dist/index.js",
        "--root",
        "<absolute-path-to-this-project>"
      ]
    }
  }
}
```

Once `npm publish` ships (`@hesnotsoharry/codebase-graph-mcp`), replace the absolute path with:

```json
"args": ["--root", "<absolute-path>"],
"command": "npx",
"args": ["-y", "@hesnotsoharry/codebase-graph-mcp", "--root", "<absolute-path>"]
```

Note: `.mcp.json` at the Agent IDE repo root is gitignored (Wave 53g comment in `.gitignore`). Each
project's `.mcp.json` is its own concern; commit-to-git vs gitignore depends on that project's preference.

## CLI usage

```
node dist/index.js --root <absolute-path-to-repo>
```

- `--root` is required unless you want the server to index the process's cwd.
- The server emits all diagnostics on stderr (`console.error`). stdout is reserved for MCP JSON-RPC
  traffic — anything written to stdout (e.g. a stray `console.log`) corrupts the protocol.
- The server starts, connects stdio transport, and then waits for MCP calls. It does NOT index eagerly on
  boot. Call `index_repository` first (or `index_status` to check if a prior index already exists).

## Tools — 15 total

### Lifecycle (4)

| Tool | Description |
|---|---|
| `index_repository` | Index (or re-index) the configured project root into the knowledge graph. Full cold index on first run; incremental on subsequent runs when the file catalog is present. |
| `list_projects` | List all indexed projects stored in the DB, with node/edge counts and last-indexed timestamp. |
| `delete_project` | Remove a project and all its graph data from the DB. Irreversible. |
| `index_status` | Health probe for the current project. Returns node/edge counts by label/type plus a `parseAnomalies` field (0 = clean). Pass a project name or omit to use the `--root` project. |

### Search (4)

| Tool | Description |
|---|---|
| `search_graph` | Symbol search — pass the identifier (PascalCase/camelCase, no spaces). Returns graph nodes with `file:line` + metadata. Prefer over Grep; Grep returns text matches including comments, `search_graph` returns actual definitions. |
| `get_architecture` | Orientation pass — hotspots (most-connected functions), module structure, file-tree overview, entry points, routes. Cheaper than reading multiple files; tells you where a change has the widest impact. |
| `search_code` | String/regex search across source files. Use for literal text (error messages, log lines). For symbol queries, prefer `search_graph`. |
| `get_code_snippet` | Full source body for a named symbol. Pass the identifier; auto-resolves bare names when unique. Prefer over Read for single-symbol inspections. |

### Trace + changes (2)

| Tool | Description |
|---|---|
| `trace_call_path` | Caller/callee graph for a symbol. `direction: 'inbound'/'callers'` = who calls this; `'outbound'/'callees'` = what this calls; `'both'` (default). Returns call edges with optional risk labels and confidence filtering. |
| `detect_changes` | Pre-refactor impact analysis. Maps git working-tree or staged changes to affected symbols; computes blast radius. Scope options: `unstaged`, `staged`, `all`, `branch` (requires `base_branch`). |

### Cypher + ADR (2)

| Tool | Description |
|---|---|
| `query_graph` | Complex relationship queries via a Cypher subset. Supports `MATCH`, `WHERE`, `RETURN`, `ORDER BY`, `LIMIT`, variable-length paths `*1..3`, and aggregation `COUNT(*)`. Cap: 200 rows. Call `get_graph_schema` first to discover node labels and edge types. |
| `manage_adr` | Manage Architecture Decision Records stored in the graph. Modes: `list`, `get`, `store`, `update`, `delete`. |

### Meta (2)

| Tool | Description |
|---|---|
| `get_graph_schema` | Returns node/edge counts, relationship patterns, and sample names. Call once per session before writing Cypher queries — it tells you what labels and edge types are actually present. |
| `ingest_traces` | Add or strengthen `HTTP_CALLS` edges by ingesting external call traces. Pass `traces` as a `JSON.stringify`'d array of `{ fromId, toId, type, weight? }`. |

### Health (1)

| Tool | Description |
|---|---|
| `ping` | Health-check — returns `pong`. Useful for walking-skeleton smoke verification before indexing. |

## Storage layout

```
~/.ouroboros-graph/
  └── <sha256(rootPath)[:8]>/   ← first 8 hex chars of SHA-256 of the absolute root path
        └── graph.db             ← SQLite (better-sqlite3)
```

Each project root gets a deterministic, collision-resistant subdirectory. The hash is computed in
`serverBootstrap.buildDbPath()`. The directory is created on first boot.

GC behavior: no automatic GC runs from the standalone server. The in-IDE version ran `graphGc.pruneExpiredProjects()` at startup; the standalone package does not (it has no concept of "last-opened" window). Stale project data accumulates until manually deleted via `delete_project` or by removing the `~/.ouroboros-graph/<hash>/` directory directly.

## Debugging tips

1. **Inspect server startup.** The server writes two lines on successful boot:
   ```
   [trace:graph-mcp.server.start] codebase-graph-mcp server listening on stdio
   [trace:graph-mcp.server.start] root=<path> db=<dbPath>
   ```
   These go to stderr, which Claude Code surfaces in its MCP server error logs.

2. **Per-tool traces.** Every tool call emits:
   ```
   [trace:graph-mcp.tool.<name>] called
   ```
   to stderr before the handler runs. If a tool silently returns nothing, check whether the call trace
   appeared — it distinguishes "MCP dispatch failed" from "handler returned empty results".

3. **Health probe first.** Call `ping` or `index_status` after connecting. If `index_status` returns
   node count 0, the project hasn't been indexed yet — call `index_repository` first.

4. **Empty `search_graph` results.** The most common cause: natural-language query instead of an
   identifier. `search_graph({ query: "chat workbench" })` returns zero. Use the actual symbol name:
   `search_graph({ query: "ChatWorkbenchArtifactPane" })`.

5. **`projectName` normalization.** The server normalizes project names: `path.basename(root).toLowerCase()
   .replace(/[^a-z0-9-]/g, '-')`. So `AgentIDE` → `agentide`, `ContractorApp` → `contractorapp`. Query
   results are filtered by this normalized name; tools that accept a `project` arg should pass the
   normalized form or omit it (the context default applies). Bug fixed in commit `78173b64` — previous
   versions had a mismatch that caused all filtered queries to return empty on projects with uppercase
   characters.

6. **stdout is protocol-only.** The MCP transport writes JSON-RPC on stdout. Any `console.log` in a
   handler corrupts the protocol frame. Use `console.error` for all diagnostic output.

## ABI and native module notes

`better-sqlite3` is a native addon. The package ships prebuilt binaries for Node 18/20/22 on
Windows x64, macOS arm64/x64, and Linux x64. On first `npm install`, Node will try the matching
prebuilt; if none matches (unusual Node version, Alpine Linux, etc.) it falls back to building from
source — requires Python and a C++ compiler.

**ABI context for internalMcp use.** When the IDE's `internalMcp` spawns the standalone server, it
uses `command: 'node'` — system Node, not Electron-as-Node. This means the package's `better-sqlite3`
compiles against the **system Node ABI**, not Electron's ABI. The two can differ; mixing them causes
the native module to crash on load. This is the correct design — the standalone server is a plain Node
process, not an Electron child.

If you see `Error: The module was compiled against a different Node.js version`, the prebuilt doesn't
match your system Node version. Fix:
```
cd "C:/Web App/codebase-graph-mcp" && npm install --build-from-source
```

## Cross-project install recipe

1. Build the package once (from its own repo):
   ```
   cd "C:/Web App/codebase-graph-mcp" && npm run build
   ```

2. Add or merge `.mcp.json` in the target project root:
   ```json
   {
     "mcpServers": {
       "ouroboros": {
         "type": "stdio",
         "command": "node",
         "args": [
           "C:/Web App/codebase-graph-mcp/dist/index.js",
           "--root",
           "C:/Web App/<your-project>"
         ]
       }
     }
   }
   ```

3. Restart Claude Code so it picks up the new MCP server config.

4. In a new session, call `index_repository` once (cold index). Then use `search_graph`,
   `trace_call_path`, etc. normally.

Projects installed as of Wave 22: Agent IDE, Contractor App, Gamify.
Meta workspace deferred — filed as `meta/roadmap/follow-ups/2026-05-26-mcp-server-config-meta-side.md`.

## Known limitations

- **Absolute-path-only install** — current `.mcp.json` entries use a machine-local absolute path.
  Not portable across machines. `npm publish` (Decision 7, Phase 8) enables `npx` invocation.
- **Asar packaging** — packaged Electron builds need `extraResources`/`asarUnpack` for the package's
  `dist/` and native modules. Filed: `roadmap/follow-ups/2026-05-27-internalmcp-asar-packaging.md`.
- **Languages** — tree-sitter grammars shipped: TypeScript, JavaScript, Python, Go, Rust, Java, C++.
  Other languages parse as unrecognized and are skipped (no symbols extracted, files still appear
  as `File` nodes).
- **No auto-sync** — the standalone server does not watch for file changes. The IDE's in-process version
  ran `AutoSyncWatcher` via `@parcel/watcher`. The standalone server relies on explicit
  `index_repository` calls (or incremental re-index on a call to any tool that triggers a stale-hash
  check). A future wave can add a `--watch` flag.
- **No GC** — stale project data is not pruned automatically (see Storage layout above).
- **`fix-extensions.mjs` misses dynamic imports** — the post-build extension-fixer rewrites static
  `import './foo'` → `import './foo.js'` but does not cover dynamic `import('./specifier')` calls.
  Filed: `roadmap/follow-ups/2026-05-26-fix-extensions-mjs-dynamic-imports.md`. Currently no dynamic
  imports in the package's dist that would be affected.
