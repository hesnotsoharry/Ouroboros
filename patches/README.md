# Patches

This directory contains local patches applied to npm dependencies at postinstall time.

## `addon-webgl-0.19.0` — PR #5883 ghost-cursor fix

### What this fixes

`@xterm/addon-webgl` 0.19.0 has a documented atlas-corruption bug that produces ghost cursors and cell rendering artifacts during high-throughput terminal streams when `allowTransparency: true` is set.

- **Upstream issue:** [xtermjs/xterm.js#5847](https://github.com/xtermjs/xterm.js/issues/5847) — "Partial row ghosting with transparent theme background" (OPEN, 2026-04-27)
- **Upstream fix:** [xtermjs/xterm.js#5883](https://github.com/xtermjs/xterm.js/pull/5883) — "Fix webgl rendering corruption from atlas page merges" (OPEN, 2026-05-17, NOT YET MERGED)

Our workload (Claude TUI MultiEdit streams, `allowTransparency: true`) reliably triggers the bug.

### What the patch does

Three changes from PR #5883 mapped to their minified equivalents in both `addon-webgl.mjs` (ESM) and `addon-webgl.js` (CJS):

1. **`TextureAtlas.beginFrame()`** — resets `_requestClearModel` to `false` before returning, so the atlas-cleared signal is consumed atomically and not re-read on the next call.

2. **`AtlasPage.version`** — changes from a per-instance counter (`version++`) to a global monotonic counter (`AtlasPage.nextVersion`). After a page merge, the merged page's version is always strictly greater than any version the GPU texture has seen, forcing an unconditional re-upload.

3. **`WebglRenderer.renderRows()`** — adds a retry loop (max 3 iterations) after `_updateModel`. If `_updateModel` itself triggers another atlas page merge (which sets `_requestClearModel`), the renderer clears and re-draws rather than leaving stale glyph geometry on screen for the current frame.

### Files

| File | Purpose |
|---|---|
| `addon-webgl-0.19.0.original.mjs` | SHA snapshot of the ESM bundle as shipped by npm (0.19.0) |
| `addon-webgl-0.19.0.original.js` | SHA snapshot of the CJS bundle as shipped by npm (0.19.0) |
| `addon-webgl-0.19.0.patched.mjs` | ESM bundle with PR #5883 changes applied |
| `addon-webgl-0.19.0.patched.js` | CJS bundle with PR #5883 changes applied |

The patcher (`tools/apply-patches.mjs`) is wired into the `postinstall` script in `package.json`. It:
- Checks the installed bundle's SHA against the known original
- If it matches, copies the patched version into `node_modules/`
- If it already has the patched SHA (idempotent), skips silently
- If the SHA is neither (upstream updated), logs a warning and exits cleanly without failing postinstall

### Removing this patch (when upstream ships the fix)

When `@xterm/addon-webgl` >= 0.19.1 (or whichever version includes PR #5883) is available:

1. Bump `@xterm/addon-webgl` in `package.json` to the fixed version.
2. Run `npm run lockfile:sync` to regenerate the lockfile via WSL2.
3. Verify ghost cursor is gone in a live session (`npm run dev`, run `claude` interactively in a dock-slot terminal, generate heavy streaming output).
4. Delete `patches/` directory entirely.
5. Remove `&& node tools/apply-patches.mjs` from the `postinstall` script in `package.json`.
6. Delete `tools/apply-patches.mjs`.
7. Remove the WebGL atlas-merge gotcha entry from `src/renderer/components/Terminal/CLAUDE.md`.

### Re-mapping the patch (if npm auto-updates the bundle)

If `npm install` pulls a new `@xterm/addon-webgl` 0.19.0 build with different minified output (rare but possible in non-lockfile workflows):

1. Run `node tools/apply-patches.mjs` — it will warn with the new SHA.
2. Copy the new bundle from `node_modules/` as a reference.
3. Re-run the symbol-search procedure documented in `tools/apply-patches.mjs` comments to find the new minified positions of `beginFrame`, `version++` sites, and `renderRows`.
4. Update the string patterns in `patchMjs()` and `patchJs()` to match.
5. Update `HASHES.original` entries with the new SHA.
6. Re-run the patcher to generate the new patched bundles and record their SHAs in `HASHES.patched`.
7. Replace `patches/addon-webgl-0.19.0.{original,patched}.{mjs,js}` with the new snapshots.
