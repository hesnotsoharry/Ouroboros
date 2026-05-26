---
status: OPEN
created: 2026-05-26
severity: LOW
discovered: wave-19-renderer-bundle-and-fk-fixes
type: test-failure
---

# Follow-up: `channelCatalogCoverage.test.ts` failing on `persist:shared` + `app:getCrashLogCount`

## What

`src/main/mobileAccess/channelCatalogCoverage.test.ts:174` throws because 2 channels are present in the runtime channel registry but absent from `CHANNEL_CATALOG`:

```
Error: 2 channel(s) are missing from CHANNEL_CATALOG.
Add them to the appropriate channelCatalog.*.ts sub-module:
  - app:getCrashLogCount
  - persist:shared
```

## Origin

**Pre-existing on master at `9569771e` (verified by running the test against master with all worktree changes stashed during Wave 19 wrap).** Wave 19 did NOT introduce either channel; both predate the wave.

`persist:shared` was added in Wave 18 W2 (commit `524b7fa2`) — it's the session partition string for `BrowserWindow` (`partition: 'persist:shared'`). It is NOT actually an IPC channel; the runtime sniffer probably picks it up because it matches the `category:thing` channel-name shape. The catalog test should either (a) exclude session-partition strings from its sniffer, or (b) be augmented with a `persist:*` exemption.

`app:getCrashLogCount` — likely added before Wave 18 but never wired into the catalog. Quick `git log` on `src/main/ipc-handlers/` for that handler name will reveal the origin commit.

## Impact

- Blocks any "full `npm test`" from being green.
- Does NOT block scoped test runs (test:codebasegraph, test:main minus this one file, test:filetree, test:layout all pass).
- Wave 18's "test:main PASS" claim in HANDOFF was likely a scoped run that excluded this file, or the failure was missed.

## Fix shape

Two options:
1. **Add the entries to `channelCatalog.*.ts`** — quick mechanical fix. `app:getCrashLogCount` goes in whichever sub-module owns `app:*` handlers; `persist:shared` doesn't really belong there (it's not a channel) and might need a special-case exclusion in the sniffer.
2. **Tighten the sniffer to exclude non-IPC strings** — handles the `persist:shared` false positive properly. `app:getCrashLogCount` still needs its catalog entry either way.

Recommend Option 1 for `app:getCrashLogCount` + Option 2 for `persist:shared`. ~10-20 LOC.

## Why deferred

Wave 19's surface is renderer bundle + FK fix; the channel catalog gap is Wave 18 carry-over. Fixing inline would be scope creep into a different subsystem. The test failure does not affect runtime behavior — only the coverage-gate test.

## Next wave that should fold this in

Any future wave touching `src/main/mobileAccess/`, `src/main/ipc-handlers/app*`, or the next intentional fix-sweep wave.
