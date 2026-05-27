---
status: SHIPPED
shipped: 2026-05-25
commits: ..bd6cc94f
---
# Wave 17: editor-cascade-perf
Result: Eliminated 9075ms no-op reindex via filterChangedFiles fast-path + watcher hint threading; config:set slow-handler collapsed as timer artifact; 5 trace lines for forward observability.
