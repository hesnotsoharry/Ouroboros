---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
priority: LOW
source: wave-20-phase-c-wrap
---

# `src/main/codebaseGraph/mcpToolHandlers.ts` over `max-lines: 300` cap

## Context

Wave 20 Phase C dropped one line from this file (`id` property removed from `manage_adr` schema). The file was 317 lines pre-Wave-20 — already over the project's ESLint `max-lines: 300` cap. Prettier reformatting during the wrap then expanded several long inline `description: '...'` strings into multi-line property declarations per the project's print-width setting, pushing the file to 325 lines.

A scoped `/* eslint-disable max-lines */` was added at the top of the file with a back-reference to this FU. That's a workaround; the proper fix is a file split.

## Why this happened

Prior contributors had been packing long descriptions onto single lines to keep the file under cap. This worked because prettier with single-line property values kept the line count low. But each long-line property is a fragile workaround:
- The descriptions are agent-facing documentation; they keep growing.
- Prettier may expand them on any future edit if they exceed print-width.
- The eslint cap was never *really* satisfied — the line count was dancing on the threshold.

The TOOL_SCHEMAS constant is the bulk of the file (~140 lines of inline JSON-schema literals). Splitting it into a separate module is the natural fix.

## Recommended fix

Extract `TOOL_SCHEMAS` into `mcpToolHandlerSchemas.ts`:

```ts
// src/main/codebaseGraph/mcpToolHandlerSchemas.ts
export const TOOL_SCHEMAS = {
  search_graph: { /* ... */ },
  // ...
} as const;
```

Then `mcpToolHandlers.ts` imports the constant. Net effect: ~140 lines moved out of `mcpToolHandlers.ts`, comfortable under 300 in both files. Remove the `/* eslint-disable max-lines */` directive.

Effort: S (~30 min). Mechanical extraction, no behavior change.

## Verification

- `npm run test:codebasegraph` passes unchanged after the split.
- `npm run lint` finds zero `max-lines` violations in the directory.
- Diff is move-only; no semantic changes.

## Priority

LOW. The disable directive is a clean workaround that documents itself. The file is functional and the schema declarations are well-organized. Natural to do during the Wave 22 standalone-MCP extraction wave when the MCP surface gets restructured anyway.
