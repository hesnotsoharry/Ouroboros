---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
source: wave-22-graph-standalone-mcp Phase 4 review (sonnet-phase-reviewer)
severity: LOW
scope: packages/codebase-graph-mcp
---

# `fix-extensions.mjs` does not rewrite dynamic `import('./specifier')` calls

## Context

Wave 22 Phase 4 introduced `packages/codebase-graph-mcp/scripts/fix-extensions.mjs` — a post-`tsc` build step that rewrites extensionless relative imports in `dist/` to add `.js`, since Node v20+ ESM (`"type": "module"`) cannot resolve extensionless relative specifiers.

The current regex covers static `import` / `export` syntax but misses dynamic `import()`:

```js
// scripts/fix-extensions.mjs
/((?:import|export)[^'"]*from\s+['"])(\.[^'"]+)(['"])/g
```

Dynamic imports like `await import('./graphControllerCompatRegistry')` have no `from` keyword and slip past the regex.

## Latent impact

`src/graphControllerSupport.ts:135-140` contains four dynamic `import()` calls to relative specifiers:

- `./graphControllerCompatRegistry`
- `./indexingPipeline`
- `./treeSitterParser`
- `./graphDatabase`

These specifiers retain their extensionless form after `tsc` emits to `dist/`. At runtime, Node ESM would fail to resolve them.

**Why this is currently NOT a runtime bug:** the standalone MCP server's import graph (`src/index.ts` → `src/serverBootstrap.ts`) does not include `graphControllerSupport.ts`. The dynamic imports are unreachable in the server's current execution path. The acceptance test (7/7 green) confirms the active surface is healthy.

**When this becomes a real bug:** if a future change wires `graphControllerSupport` (or `lib.ts`, the migrated barrel) into the server's import graph, the dynamic imports would silently break in `dist/` (works in TS source / vitest because vitest resolves through tsx, fails only against `node dist/index.js`).

## Fix

Add a second regex pass for dynamic `import('./specifier')` to `fix-extensions.mjs`:

```js
content = content.replace(
  /(import\(\s*['"])(\.[^'"]+)(['"]\s*\))/g,
  (_m, pre, spec, post) => `${pre}${ensureJs(spec)}${post}`,
);
```

(Reuse the existing `ensureJs` helper.)

## Verification path

1. Build the package.
2. `grep -rn "import('\\." dist/` — should show every dynamic import with a `.js` suffix.
3. Add a unit test for `fix-extensions.mjs` that asserts both static and dynamic forms are rewritten.

## Why not fix now

Phase 4 acceptance test is 7/7 green. The current server's import graph doesn't trigger the gap. Treating it as latent brittleness rather than an immediate blocker keeps the wave moving; a 10-line fix in a future maintenance pass closes it cleanly.

## Suggested resolution timing

Either:

- Fold into Wave 23 (or whatever wave next touches the standalone MCP package), OR
- Fix in a small post-Wave-22 cleanup commit before npm publish (Decision 7 / Phase 8 — if `npm publish` happens, this should be closed first so `dist/` is fully Node-ESM-clean).
