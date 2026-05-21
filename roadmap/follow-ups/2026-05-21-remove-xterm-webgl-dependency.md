---
status: OPEN
created: 2026-05-21
updated: 2026-05-21
---

# Remove @xterm/addon-webgl dependency

## Context

The WebGL addon was dropped from all terminal instances in this change (branch:
`fix/crash-log-settings-freeze`, same commit). The DOM renderer is now the sole
renderer — it honours `allowTransparency` correctly, enabling the tinted-well/glass
aesthetic that WebGL could not provide (xterm #1004: WebGL composites the canvas
opaque regardless of the flag).

The `@xterm/addon-webgl` package and its local patch files are still present but
have no runtime effect. They should be removed in a cleanup wave to reduce the
dependency surface and eliminate the dead postinstall patch step.

## Work to do

1. Remove `@xterm/addon-webgl` from `package.json` dependencies and regenerate
   the lockfile via `npm run lockfile:sync`.
2. Delete `patches/addon-webgl-0.19.0.patched.mjs` and
   `patches/addon-webgl-0.19.0.patched.js`.
3. Remove the WebGL patch step from `tools/apply-patches.mjs`. If no other patches
   remain, delete the script and remove the `postinstall` hook from `package.json`.
4. Delete `patches/README.md` if it only documented the WebGL patch.
5. Run `npx tsc --noEmit` and the terminal test suite (`npm run test:agentchat` +
   `npm run test:layout`) to confirm nothing was pulled along.

## References

- xterm upstream issue: https://github.com/xtermjs/xterm.js/issues/1004
- Atlas-merge bug: https://github.com/xtermjs/xterm.js/issues/5847
- Drop commit: this branch (fix/crash-log-settings-freeze), 2026-05-21
