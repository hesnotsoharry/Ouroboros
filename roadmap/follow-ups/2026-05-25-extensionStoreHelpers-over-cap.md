---
status: OPEN
created: 2026-05-25
updated: 2026-05-25
priority: LOW
---

# `extensionStoreHelpers.ts` over the 300-line cap

## Context

Discovered during Wave 16 Phase 2 (extension contributions cache). The file was
already at 310 lines before Wave 16; this wave's invalidation hooks took it to
320 lines. ESLint's `max-lines: 300` (skipBlankLines, skipComments) currently
passes because the effective count is under cap, but the file is a leak risk —
the next addition would trip the rule.

## Proposed fix

Extract the install/uninstall/enable/disable mutation functions into a sibling
`extensionStoreInstall.ts` companion. The cache invalidation hooks would move
with them; `extensionStoreCache.ts` is unaffected.

## Why deferred

Pure scope hygiene — the file is functional today, the cap is enforced by
non-blank/non-comment count and we're still under it. Filed so it gets fixed
on next touch rather than ignored.

## Related

- Wave 16 P2 commit: `b8abf975`
- File: `src/main/ipc-handlers/extensionStoreHelpers.ts`
- Touched: install/uninstall/enable/disable mutation functions
