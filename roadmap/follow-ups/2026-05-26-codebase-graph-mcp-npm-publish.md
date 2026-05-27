---
status: OPEN
created: 2026-05-26
updated: 2026-05-27
source: Wave 22 Phase 8 (per Decision 7 — fail-soft publish)
severity: LOW
scope: packages/codebase-graph-mcp
---

# `@hesnotsoharry/codebase-graph-mcp` npm publish

## Context

Wave 22 Decision 7: "publish if easy, if not add to follow up." Phase 8 attempted `npm publish --access public` from `packages/codebase-graph-mcp/`. The build + tarball succeeded (349.5 kB compressed, 1.9 MB unpacked, 470 files), but the publish failed:

```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@hesnotsoharry%2fcodebase-graph-mcp - Not found
npm error 404
npm error 404  The requested resource '@hesnotsoharry/codebase-graph-mcp@0.1.0' could not be found or you do not have permission to access it.
```

Two likely causes:
1. The `@hesnotsoharry` scope is not yet registered on npm.
2. The local npm session is not authenticated, OR the authenticated user does not have publish rights to the scope.

## Resolution

In a quick follow-up session:

1. Verify npm authentication: `npm whoami` should return the github-handle account (`hesnotsoharry`).
2. If not logged in: `npm login` and follow the prompt.
3. Verify the scope `@hesnotsoharry` is reserved on npm — visit `https://www.npmjs.com/~hesnotsoharry` or use `npm access list packages @hesnotsoharry` (after login).
4. If the scope doesn't exist, npm reserves it on first publish from an authenticated owner. The E404 above usually means "scope reserved but you're not authenticated as the owner" rather than "scope free for the taking."
5. Retry: `cd packages/codebase-graph-mcp/ && npm publish --access public`. Expected output ends with `+ @hesnotsoharry/codebase-graph-mcp@0.1.0`.
6. Verify install works from anywhere: `cd /tmp && npx @hesnotsoharry/codebase-graph-mcp --root <some-project>` should spawn the server.

## Why this matters

Currently the `.mcp.json` entries across all four workspaces use absolute local paths:

```json
"args": ["C:/Web App/AgentIDE/packages/codebase-graph-mcp/dist/index.js", "--root", "..."]
```

Once published, all four projects' `.mcp.json` files can switch to the portable form:

```json
"args": ["@hesnotsoharry/codebase-graph-mcp", "--root", "..."]
```
with `"command": "npx"` instead of `"command": "node"`. This works on any machine without `C:/Web App/AgentIDE/` being present, which is the actual cross-project portability promise.

## Tarball preserved

The local tarball (`packages/codebase-graph-mcp/hesnotsoharry-codebase-graph-mcp-0.1.0.tgz`) is reproducible via `npm run build && npm pack`. Users who want to install locally without npm publish can `npm install <path-to-tarball>` against the tarball.

## Suggested timing

Anytime in the next 1-2 sessions. Quick — 5-10 min once auth is set up.
