---
status: OPEN
created: 2026-05-25
updated: 2026-05-25
priority: LOW
---

# Electron GPU process crash — D3D11 device removed

## Context

Surfaced in Cole's second 3-window boot trace (2026-05-25 19:06:45). The GPU
process emitted:

```
SharedImageManager::ProduceSkia: Trying to Produce a Skia representation from
a non-existent mailbox.
[multiple instances]
ERR: Renderer11.cpp:2242 (testDeviceLost): The D3D11 device was removed,
HRESULT: 0x887A0007
SharedContextState context lost via EXT_robustness. Reset status =
GL_UNKNOWN_CONTEXT_RESET_KHR
Restarting GPU process due to unrecoverable error. Context was lost.
GPU process exited unexpectedly: exit_code=34
```

The GPU process recovered (Electron restarts it automatically), but during
the crash the renderer windows would have flashed white or shown stale
content briefly.

## What it means

HRESULT `0x887A0007` is `DXGI_ERROR_DEVICE_RESET` — the OS reset the D3D11
device, typically because:

- Another process triggered a TDR (Timeout Detection and Recovery)
- A driver bug or hardware hang in another app's GPU work
- GPU memory pressure across all running processes

This is upstream of our code — Chromium/Electron handle it; our app's only
exposure is the brief visual hiccup during GPU process restart.

## Why this isn't actionable now

The crash is reactive to system-wide GPU state, not deterministic from our
code. We can't reliably reproduce or fix the root cause. The Electron team
upstream already handles recovery.

## Mitigations to consider IF this becomes frequent

- Reduce GPU memory footprint of the renderer (smaller canvas/texture usage).
- Disable WebGL on terminals if not strictly needed (we use `@xterm/addon-webgl`
  — already conditional, but worth verifying it falls back gracefully on
  context loss).
- Audit `allowTransparency: true` and Mica transparency — both add GPU work.

Filing for visibility, not for immediate fix.

## Related

- Boot trace timestamp: 2026-05-25 19:06:45–19:06:47
