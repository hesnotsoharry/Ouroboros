---
status: OPEN
created: 2026-05-26
updated: 2026-05-26
priority: LOW
source: wave-21
---

# Worktree `npm install` postinstall step fails (electron-rebuild OR build-changelog OR apply-patches)

## What happened

During Wave 21 setup, `npm install` in a fresh worktree at `.worktrees/wave-21-ouroboros-graph-tier-2/` failed with exit code -1 on the postinstall script:

```
electron-rebuild -f -w better-sqlite3,node-pty && node tools/build-changelog.js && node tools/apply-patches.mjs
```

The native module install steps preceding this all succeeded cleanly (`better-sqlite3@12.8.0 install { code: 0 }`, `node-pty@1.2.0-beta.12 install { code: 0 }`, etc.). The failure is in the chained postinstall command but npm's debug log does not surface the individual command's stderr — only the wrapper "command failed" with exit code 4294967295 (Windows -1 unsigned). Log: `C:\Users\coles\AppData\Local\npm-cache\_logs\2026-05-26T17_51_46_156Z-debug-0.log`.

## Impact

**Wave 21 was unaffected.** Vitest tests run cleanly against the worktree (98 graphDatabase tests in 1.21s; full `npm run test:codebasegraph` 743 passed). The native bindings (better-sqlite3, node-pty) work despite electron-rebuild not having run to completion in postinstall context — likely because the build step DID run, the failure was downstream in build-changelog.js or apply-patches.mjs.

`node tools/build-changelog.js` was run manually at wave-wrap to regenerate `src/renderer/generated/changelog.ts` for the pre-push hook; it succeeded standalone.

## Hypothesis

The chained command's failure is in either:
1. `electron-rebuild` exit code propagation (the rebuild may have succeeded but emitted a non-zero exit on a warning, breaking the `&&` chain)
2. `node tools/apply-patches.mjs` — the patches script may fail if it can't find a target or if a patch is missing.

`build-changelog.js` is least likely (it ran cleanly when invoked alone post-wave).

## Repro

1. From master, create a fresh worktree: `git worktree add .worktrees/test-postinstall -b throwaway-test master`
2. `cd .worktrees/test-postinstall`
3. `npm install` — observe the postinstall failure.
4. Each chained command can be tested individually: `npx electron-rebuild -f -w better-sqlite3,node-pty`, then `node tools/build-changelog.js`, then `node tools/apply-patches.mjs`. The one with non-zero exit is the culprit.

## Recommendation

Either:

- Add explicit per-command echo / error capture in `package.json`'s postinstall:
  ```json
  "postinstall": "electron-rebuild -f -w better-sqlite3,node-pty && echo '[postinstall] changelog' && node tools/build-changelog.js && echo '[postinstall] patches' && node tools/apply-patches.mjs"
  ```
- OR split the postinstall into discrete steps with their own npm scripts so failures surface specifically.
- OR investigate `tools/apply-patches.mjs` directly — it may have a Windows-path bug or be referencing a patch file that doesn't exist.

## Priority

LOW. Did not block Wave 21 implementation or testing. Would block clean future worktree setup if recurring, but `tools/build-changelog.js` can be re-run manually before push, and electron-rebuild's failure mode is silent (better-sqlite3 still works for vitest under the Node ABI; only `npm run dev` electron-runtime would be affected).
