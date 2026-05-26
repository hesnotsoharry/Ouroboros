---
status: COMPLETE
created: 2026-05-25
phase: 3-diagnostic
---

# Wave 17 -- Phase 3 Diagnostic: `config:set` Slow Handler

## 1. TL;DR

`config:set` is a **timer-artifact victim** of the same jank mechanism Phase 1 established for `files:saveFile`. The handler itself does less than 15ms of real work on every call: one AJV validation pass + one `atomically.writeFileSync` (~4ms baseline on this machine) + one `notifyExternalConfigChange` broadcast (~0.2ms `JSON.stringify`). The three `[ipc-perf] slow handler` reports (1327ms, 1104ms, 3983ms) are false latency readings produced by `patchIpcMainHandle`'s wall-clock timer firing after the event loop was stalled by the Phase 1 root cause (indexing worker O(N) catalog scan). The 3983ms call corresponds to a 3854ms jank stall -- not to 3854ms of work inside `handleConfigSet`.

**Phase 4 is not needed for `config:set`.** Phase 2's fix for the O(N) catalog scan eliminates the jank source. Once jank stalls go away, `config:set` will report its true cost (~8-15ms) and will not fire the 500ms slow-handler threshold.

Secondary finding: `setConfigValue` triggers a full-blob write of `config.json` (currently 62.2 KB on this machine) with `fsync` on every call. `notifyExternalConfigChange` then immediately reads the file back (via `getConfig()` with `configCache=null`), producing a double I/O per set call. Under normal conditions this totals ~8-15ms -- not a fix target but structurally wasteful. A low-priority follow-up is noted in Section 4.

---

## 2. Reproduction -- Call Graph from IPC Receive to Return

```
Renderer: IPC invoke "config:set" (key, value)

ipc.ts:258-270  patchIpcMainHandle wraps all handlers
  const t = Date.now()              [timer start]
  await handler(event, key, value)
    handleConfigSet (ipc-handlers/config.ts:126-149)
      interceptSecrets(key, value)              [sync, <0.1ms]
      setConfigValue(key, safeValue)            [config.ts:65-68, sync]
        configStoreLazy.ts Proxy -> ensureStore().set(key, value)
          conf.set(key, value)                  [conf/dist/source/index.js:160-189]
            dotProp.set(store, key, value)       [in-memory mutation]
            this.store = store                   [store setter line 293-298]
              this._validate(value)             [AJV compiled validator, full blob]
              this._write(value)                [line 360-388]
                this._serialize(value)          [JSON.stringify(fullBlob, tab) -- 0.19ms]
                atomically.writeFileSync(path, data)
                  fs.openSync(tmpPath, 'w')
                  fs.writeSync(fd, data)        [62KB write]
                  fs.fsyncSync(fd)              [kernel flush -- ~4ms baseline]
                  fs.renameSync(tmp->config.json)
              this.events.emit('change')        [no onDidChange listeners registered]
          configCache = null                    [cache invalidate -- config.ts:67]
      notifyExternalConfigChange(getConfig())   [ipc-handlers/config.ts:130]
        getConfig()
          configCache is null -> ensureStore().store
            conf get-store getter (conf/index.js:274-292)
              fs.readFileSync(config.json, 'utf8')  [SYNC re-read of 62KB back from disk]
              JSON.parse(data)
              this._validate(data)             [second AJV validate pass]
        forEach window -> webContents.send('config:externalChange', sanitized)
        broadcastToWebClients(...)
          if (wsClients.size === 0) return;    [no-op when no web clients]
          JSON.stringify(envelope with full config)  [0.13ms]
      return { success: true }
      [handler DONE -- real elapsed: ~8-15ms total synchronous work]

  finally: ms = Date.now() - t
    [if event loop stalled 3854ms by indexing worker O(N) scan,
     finally fires 3854ms after handler returned -> reports 3983ms -- FALSE POSITIVE]
```

Key discovery: `notifyExternalConfigChange` calls `getConfig()` which finds `configCache=null`
(just invalidated by `setConfigValue` at `config.ts:67`). This forces `conf`'s `get store` getter
(`conf/index.js:274-292`) to call `fs.readFileSync(config.json, 'utf8')` -- a synchronous re-read of
the file that was just written. Each `config:set` therefore does: 1x `JSON.stringify` + 1x
`fsync`-write + 1x `readFileSync`-readback + 2x AJV validate. Measured total: ~8-15ms.

---

## 3. Per-Hypothesis Verdict

### H1: Timer artifact -- CONFIRMED (primary explanation)

Evidence: identical mechanism to the `files:saveFile` false-latency Phase 1 confirmed in Section 3 H3.

`patchIpcMainHandle` at `ipc.ts:258-270` uses `const t = Date.now()` before `await handler(...)`
and `ms = Date.now() - t` in `finally`. The `finally` block is a microtask that cannot execute
during an event-loop stall. If the indexing worker O(N) scan stalls the loop for 3854ms,
`finally` fires 3854ms after the handler actually returned, reporting 3983ms.

Quantitative proof: `handleConfigSet` has NO `await`, NO `.then`, NO callbacks -- entirely
synchronous. A true 3983ms synchronous call would block the loop from that callstack alone;
the jank detector would report `config:set` in its own callstack, not the indexing worker
callstack. Measured `atomically.writeFileSync` on the actual 62KB file: **4.1ms average,
4.7ms max** (10 runs). Three concurrent writes simulating 3-window boot: **9.2ms total**.
Both are 400x below the reported minimum (1104ms). CONFIRMED.

### H2: Large blob JSON.stringify on each set -- REFUTED

Current `config.json`: 62.2 KB, 109 top-level keys, 3 `sessionsData` entries (1631 bytes).

Measured `JSON.stringify(config, undefined, '\t')`: **0.189ms average** over 1000 runs.
Measured `JSON.stringify` of full broadcast envelope: **0.132ms average** over 1000 runs.

Not a meaningful contributor to any observed latency. REFUTED.

### H3: Synchronous disk write under contention (multi-window) -- REFUTED AS CAUSE

`atomically.writeFileSync` on 62KB with `fsync`: **4.1ms avg, 4.7ms max**.
3 sequential writes (3-window boot scenario): **9.2ms total**.

The `conf` library falls back to non-atomic `fs.writeFileSync` on Windows `EXDEV` errors
(`conf/index.js:381-383`) but this is a retry path, not a spin-wait. Does not produce
second-scale blocking on a local disk. REFUTED as cause of 1000-4000ms reports.

NOTED: The synchronous `fsync` write IS real main-thread work (~4ms per call) that cannot be
avoided with the current conf/electron-store architecture. The double I/O (write then
immediate readback) is wasteful but totals ~8ms total. See Section 4.

### H4: `config:changed` listener side effects -- REFUTED

Grep of all `src/main/**/*.ts` (excluding tests): **zero** calls to `store.onDidChange()` or
`store.onDidAnyChange()`. The `conf` library's `events.emit('change')` at line 297 fires with
no registered listeners in production code.

The `contextLayer` special-case in `handleConfigSet` (lines 131-144) uses fire-and-forget
dynamic import with `.then()` -- not awaited, cannot affect handler wall-clock time. REFUTED.

### H5: Schema validation hot path -- REFUTED AS CAUSE

AJV compiled validator is built once at Store construction (`conf/index.js:108`) and reused.
Compiled validators are JIT-optimized functions, not interpreted traversals. The schema spans
5 files (`configSchema.ts`, `configSchemaMiddle.ts`, `configSchemaTail.ts`, `configSchemaTailExt.ts`,
`configSchemaTailExt2.ts`) but the compiled function is a single closure. Estimated cost for
62KB blob: <1ms per call. `_validate` runs twice per `config:set` (in `store` setter + in
`get store` getter), adding ~2ms total. Not a bottleneck. REFUTED.

---

## 4. Dominant Blocker

`config:set` is a timer-artifact victim. There is no dominant blocker in this handler.

The jank source is `src/main/codebaseGraph/indexingPipelineIncremental.ts:65-92`
(`filterChangedFiles` O(N) catalog scan) -- the Phase 1 root cause. Phase 2 eliminates it.
After Phase 2:

- `config:set` real cost: ~8-15ms (well below 500ms threshold)
- `patchIpcMainHandle` reports accurate latency
- 3854ms jank event disappears from boot trace

**Secondary inefficiency (not a wave-17 fix target):**

`notifyExternalConfigChange` at `ipc-handlers/config.ts:130` calls `getConfig()` after
`setConfigValue` nulled `configCache` (`config.ts:67`). This forces a synchronous
`fs.readFileSync` of `config.json` immediately after writing it. Fix: change `setConfigValue`
to update `configCache` to the new blob value instead of setting it to `null`:

```typescript
// config.ts:65-68 -- current:
export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  ensureStore().set(key, value);
  configCache = null;  // forces immediate readFileSync in every subsequent getConfig()
}

// Proposed: update cache with new full blob to avoid re-read
export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  ensureStore().set(key, value);
  configCache = ensureStore().store;  // conf getter reads back once; subsequent getConfig() hits cache
}
```

This eliminates one `fs.readFileSync` + one AJV validate per `config:set` call, saving ~4ms
per call. File as a LOW-priority follow-up; does not block any wave.

---

## 5. Proposed Instrumentation

Use only if `config:set` still appears in slow-handler logs after Phase 2 ships.

**A. Real handler timing inside `handleConfigSet`** -- `ipc-handlers/config.ts:126` (top of body):

```typescript
const t0configSet = Date.now();
```

At line 145 (before `return { success: true }`):

```typescript
log.info('[trace:config:set] real-elapsed', { key, ms: Date.now() - t0configSet });
```

If this logs <20ms while `patchIpcMainHandle` logs 3983ms, the artifact diagnosis is confirmed.

**B. Write vs readback cost** -- `config.ts:65` (top of `setConfigValue`):

```typescript
const t0sv = Date.now();
// ... ensureStore().set(key, value) ...
log.info('[trace:config.set] store-write', { key, ms: Date.now() - t0sv });
```

In `ipc-handlers/config.ts:130` around `notifyExternalConfigChange`:

```typescript
const t0notify = Date.now();
notifyExternalConfigChange(getConfig());
log.info('[trace:config:set] notify-readback', { key, ms: Date.now() - t0notify });
```

Would confirm the double-I/O cost (~4ms readback) and discriminate it from write cost.

---

## 6. Phase 4 Hand-Off

**Phase 4 for `config:set` is NOT NEEDED.** `config:set` is a timer-artifact victim of the
Phase 1 jank source. Phase 2's fix handles it transitively.

**Verification after Phase 2:** Run a boot trace. If `config:set` no longer appears in
`[ipc-perf] slow handler` logs, diagnosis confirmed. If it still appears above 500ms,
add instrumentation point A above before filing a new follow-up -- the real-elapsed log
will immediately show whether it is a new jank source or genuine handler work.

**Optional low-priority follow-up to file separately:** Eliminate the double I/O in
`notifyExternalConfigChange` by changing `config.ts:setConfigValue` to update `configCache`
to the new blob value (see Section 4). Saves ~4ms per `config:set` call. File at LOW
priority; does not block this wave or Phase 2.
