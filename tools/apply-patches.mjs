/**
 * apply-patches.mjs
 *
 * Postinstall patcher for @xterm/addon-webgl 0.19.0.
 *
 * Applies the fix from upstream PR xtermjs/xterm.js#5883
 * ("Fix webgl rendering corruption from atlas page merges") to the
 * installed minified bundles.  The fix addresses issue #5847
 * ("Partial row ghosting with transparent theme background") which
 * manifests as ghost cursors / cell artifacts during high-throughput
 * streams when allowTransparency: true is set.
 *
 * Safe to re-run: exits without error if already patched or if the
 * bundle version has changed upstream (patch may already be included).
 *
 * See patches/README.md for removal and update instructions.
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Known SHA-256 hashes ────────────────────────────────────────────────────
// original: hash of @xterm/addon-webgl 0.19.0 as shipped by npm
// patched:  hash after PR #5883 changes applied by this script

const HASHES = {
  'addon-webgl.mjs': {
    original: '5ac2cbbb8a861ba99176eda0ee91f10c08de32d091e3488edf699ad111131ebb',
    patched: '7b8f37ed14e621b036705abf9c61d444977e6c6181af92c538ce4646ce395fff',
  },
  'addon-webgl.js': {
    original: 'b85f8d4b3e9756bebb757e3fe47134d70f03ea3d6b187624426d2e2b65dec06c',
    patched: 'd04ed8e0f21c3fd54885387947bf9ab5b91a85c2187d4cf90dd400f5dc7d87e9',
  },
};

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Replace old with new; throw if old not found (signals pattern mismatch). */
function sub(src, old, next, label) {
  if (!src.includes(old)) throw new Error(`Cannot find pattern: ${label}`);
  return src.replace(old, next);
}

// ─── PR #5883 change sets ─────────────────────────────────────────────────────

/** Shared change 1: TextureAtlas.beginFrame() — reset flag before return. */
function applyBeginFrame(src) {
  return sub(
    src,
    'beginFrame(){return this._requestClearModel}',
    'beginFrame(){const e=this._requestClearModel;this._requestClearModel=!1;return e}',
    'beginFrame()',
  );
}

/**
 * Changes for .mjs ESM bundle (AtlasPage minified as `ot`).
 *
 * Change 2: AtlasPage.version — per-instance counter → global monotonic
 *   counter (ot.nextVersion) across constructor, _mergePages, _clearAtlasPage,
 *   addGlyph, and AtlasPage.clear().
 * Change 3: WebglRenderer.renderRows() — add retry loop for nested merges.
 */
function applyMjsVersionAndRetry(src) {
  // 2a. constructor init
  let out = sub(src, 'this.version=0;this.currentRow',
    'this.version=++ot.nextVersion;this.currentRow', '2a ctor [mjs]');
  // 2b. _mergePages result
  out = sub(out, ';l.version++;for(let u=r.length-1;',
    ';l.version=++ot.nextVersion;for(let u=r.length-1;', '2b mergePages [mjs]');
  // 2c. _clearAtlasPage loop
  out = sub(out, 's.texturePage--;n.version++}}getRasterizedGlyphCombinedChar',
    's.texturePage--;n.version=++ot.nextVersion}}getRasterizedGlyphCombinedChar',
    '2c clearAtlasPage [mjs]');
  // 2d. addGlyph
  out = sub(out, '_.addGlyph(m),_.version++,m}',
    '_.addGlyph(m),_.version=++ot.nextVersion,m}', '2d addGlyph [mjs]');
  // 2e. AtlasPage.clear()
  out = sub(out, 'this.fixedRows.length=0,this.version++}};function Di',
    'this.fixedRows.length=0,this.version=++ot.nextVersion}};function Di',
    '2e AtlasPage.clear [mjs]');
  // 2f. static initializer
  out = sub(out, 'function Di(i,e,t,n){',
    'ot.nextVersion=0;function Di(i,e,t,n){', '2f static [mjs]');
  // 3. renderRows retry loop
  // NOTE: The ternary is inside a comma expression — cannot inject statements
  // directly. Wrap the retry loop in an IIFE so it fits as the next comma item.
  const RR_OLD =
    'this._glyphRenderer.value.beginFrame()?(this._clearModel(!0),this._updateModel(0,this._terminal.rows-1)):this._updateModel(t,n)';
  const RR_NEW =
    'this._glyphRenderer.value.beginFrame()?(this._clearModel(!0),this._updateModel(0,this._terminal.rows-1)):this._updateModel(t,n),' +
    '(()=>{let $r=0;while(this._charAtlas&&this._glyphRenderer.value.beginFrame()&&$r++<3)' +
    '{this._clearModel(!0);this._updateModel(0,this._terminal.rows-1)}})()';
  return sub(out, RR_OLD, RR_NEW, '3 renderRows [mjs]');
}

/**
 * Changes for .js CJS bundle (AtlasPage minified as `g`).
 *
 * Same logic as .mjs but different minified symbols and renderRows params.
 */
function applyJsVersionAndRetry(src) {
  // 2a. constructor init (CJS uses comma not semicolon between assignments)
  let out = sub(src, 'this.version=0,this.currentRow',
    'this.version=++g.nextVersion,this.currentRow', '2a ctor [js]');
  // 2b. _mergePages result
  out = sub(out, ';o.version++;for(let e=n.length-1;e>=0;e--)this._deletePage',
    ';o.version=++g.nextVersion;for(let e=n.length-1;e>=0;e--)this._deletePage',
    '2b mergePages [js]');
  // 2c. _clearAtlasPage loop
  out = sub(out, 't.texturePage--;e.version++}}getRasterizedGlyphCombinedChar',
    't.texturePage--;e.version=++g.nextVersion}}getRasterizedGlyphCombinedChar',
    '2c clearAtlasPage [js]');
  // 2d. addGlyph
  out = sub(out, 'K.addGlyph(W),K.version++,W}',
    'K.addGlyph(W),K.version=++g.nextVersion,W}', '2d addGlyph [js]');
  // 2e. AtlasPage.clear()
  out = sub(out, 'this.fixedRows.length=0,this.version++}}function m(e,t,i,s)',
    'this.fixedRows.length=0,this.version=++g.nextVersion}}function m(e,t,i,s)',
    '2e AtlasPage.clear [js]');
  // 2f. static initializer
  out = sub(out, 'function m(e,t,i,s){const n=t.rgba',
    'g.nextVersion=0;function m(e,t,i,s){const n=t.rgba', '2f static [js]');
  // 3. renderRows retry loop (CJS uses params e,t instead of t,n)
  // NOTE: Same IIFE injection as MJS — ternary is inside a comma expression.
  const RR_OLD =
    'this._glyphRenderer.value.beginFrame()?(this._clearModel(!0),this._updateModel(0,this._terminal.rows-1)):this._updateModel(e,t)';
  const RR_NEW =
    'this._glyphRenderer.value.beginFrame()?(this._clearModel(!0),this._updateModel(0,this._terminal.rows-1)):this._updateModel(e,t),' +
    '(()=>{let $r=0;while(this._charAtlas&&this._glyphRenderer.value.beginFrame()&&$r++<3)' +
    '{this._clearModel(!0);this._updateModel(0,this._terminal.rows-1)}})()';
  return sub(out, RR_OLD, RR_NEW, '3 renderRows [js]');
}

function patchMjs(src) {
  return applyMjsVersionAndRetry(applyBeginFrame(src));
}

function patchJs(src) {
  return applyJsVersionAndRetry(applyBeginFrame(src));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const TARGETS = [
  {
    rel: 'node_modules/@xterm/addon-webgl/lib/addon-webgl.mjs',
    hashKey: 'addon-webgl.mjs',
    patchFn: patchMjs,
  },
  {
    rel: 'node_modules/@xterm/addon-webgl/lib/addon-webgl.js',
    hashKey: 'addon-webgl.js',
    patchFn: patchJs,
  },
];

let anyApplied = false;
let anySkipped = false;
let anyUnknown = false;

for (const { rel, hashKey, patchFn } of TARGETS) {
  const absPath = resolve(ROOT, rel);
  const { original: originalHash, patched: patchedHash } = HASHES[hashKey];

  let buf;
  try {
    buf = readFileSync(absPath);
  } catch (err) {
    console.warn(`[apply-patches] WARNING: Cannot read ${rel}: ${err.message}`);
    anyUnknown = true;
    continue;
  }

  const currentHash = sha256(buf);

  if (currentHash === originalHash) {
    console.log(`[apply-patches] Patching ${rel} (PR #5883)…`);
    const patched = patchFn(buf.toString('utf8'));
    writeFileSync(absPath, Buffer.from(patched, 'utf8'));
    console.log(`[apply-patches] Applied PR #5883 patch to ${rel}`);
    anyApplied = true;
  } else if (currentHash === patchedHash) {
    console.log(`[apply-patches] ${rel}: already patched, skipping`);
    anySkipped = true;
  } else {
    const shortSha = currentHash.substring(0, 12);
    console.warn(
      `[apply-patches] WARNING: ${rel} does not match known original or patched SHA ` +
        `(current: ${shortSha}…). Upstream may have shipped a new version — ` +
        `patch skipped without error. If ghost cursor persists, re-map the patch. ` +
        `See patches/README.md for instructions.`,
    );
    anyUnknown = true;
  }
}

if (anyApplied) {
  console.log('[apply-patches] Done — PR #5883 ghost-cursor fix applied.');
} else if (anySkipped && !anyUnknown) {
  console.log('[apply-patches] Done — all bundles already patched.');
} else if (anyUnknown && !anyApplied) {
  console.log('[apply-patches] Done — one or more bundles skipped (unknown version). See warnings above.');
}
