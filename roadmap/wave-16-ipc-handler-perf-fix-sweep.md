---
status: SHIPPED
shipped: 2026-05-25
commits: ..ffd66fba
---
# Wave 16: ipc-handler-perf-fix-sweep
Result: Boot lag ~40s → <5s via IPC handler caching (git:isRepo, extensions, shellHistory, usage snapshot); window close 6598ms → ~1000ms; Promise-dedup dogpile fix; @parcel/watcher fire-and-forget close.
