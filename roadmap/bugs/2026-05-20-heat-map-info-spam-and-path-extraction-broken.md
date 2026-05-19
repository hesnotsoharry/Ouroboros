---
status: OPEN
created: 2026-05-20
severity: medium
---

# Heat-map: info-level log spam + path extraction always returns `null`

## Symptom

Observed in the packaged `v2.19.3` build's `%APPDATA%\Ouroboros\logs\main.log` while a terminal-driven Claude Code session was active:

```
[2026-05-19 15:40:14.333] [info] [heat-map] tool event {
  toolName: 'Edit',
  toolInput: '{"session_id":"0eda47ed-f3c1-4770-b626-3be3285a310b","transcript_path":"C:\\\\User…',
  sessionId: 'cbe1ebfb-cd75-405d-9c1d-e859c0d8829b'
}
[2026-05-19 15:40:14.333] [info] [heat-map] extracted path {
  rawPath: '{"session_id":"0eda47ed-f3c1-4770-b626-3be3285a310b","transcript_path":"C:\\\\User…',
  normalized: null
}
```

Two issues:

### 1. `toolInput` is the entire JSON blob, not the per-tool args

The handler is being passed the whole hook payload (`{ session_id, transcript_path, tool_name, tool_input: { file_path: ... } }`) as `toolInput`. It treats that string as `rawPath`, which obviously normalizes to `null` for every Edit / Read / Write event. The heat-map can never light up because it can't extract a file path from any event.

Likely cause: somewhere in the hook → heat-map plumbing the field extraction was inverted, or the hook payload shape changed and the heat-map adapter wasn't updated. Compare against the hook payload shape in `src/main/hooks.ts` / `hooksDispatchLogic.ts` and the heat-map listener in `src/renderer/hooks/useFileHeatMap.ts` (or wherever the path extractor lives now).

### 2. Info-level log spam

Each tool event produces:
- 1 `[heat-map] tool event` line
- 1 `[heat-map] extracted path` line
- ~20 `[heat-map] row lookup` lines (one per top-level project directory)

At burst rates (a single Claude turn making 10–20 tool calls in a few hundred ms) this is hundreds of info-level lines per second flooding the log file. Same shape as the `2026-05-14-trace-logging-floods-console.md` follow-up that W93 Phase B closed — the heat-map paths were missed.

Drop to `debug` level (matching the W93 pattern) OR gate behind a `heatMapTrace` config flag.

## Connection to the other heat-map follow-ups

This is distinct from but related to:

- `2026-05-06-file-heat-map-still-broken.md` — "edited files don't get a colored border." Likely root cause is THIS bug: if path extraction is always `null`, no row lookup can succeed, so no border ever paints.
- `2026-05-11-heatmap-full-rescan-jank.md` — separate symptom (full-rescan on bursty edits). Independent of path extraction.

If this bug is fixed, `file-heat-map-still-broken.md` should be re-tested — it may auto-resolve.

## Reproduction

1. Install `Ouroboros Setup 2.19.3.exe` (or any current packaged build).
2. Open Agent IDE workspace.
3. Spawn a terminal Claude Code session.
4. Have the agent do any Edit / Read / Write — heat-map borders never appear in the file tree even with the toggle on.
5. Tail `%APPDATA%\Ouroboros\logs\main.log` — observe the info-spam + `normalized: null` pattern.

Works the same in dev mode (`npm run dev`), confirmed by the fact that the path extraction logic isn't packaging-specific.

## Suspected files

- `src/renderer/hooks/useFileHeatMap.ts` (or wherever the path extractor lives)
- Whatever IPC channel surfaces tool events to the renderer for the heat-map (likely `hooks:tool-event` or similar)
- The hook event normalization layer (`src/main/hooks.ts` / `hooksDispatchLogic.ts`)

## Severity rationale

Medium, not high: the heat-map is a non-critical visual indicator. But it's a flagship feature, the log spam is wasteful, and the existence of the bug means two filed follow-ups (`file-heat-map-still-broken.md`, possibly others) are stuck.
