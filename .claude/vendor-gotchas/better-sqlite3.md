---
vendor: "better-sqlite3"
sdkVersion: "better-sqlite3 12.8.0 (SQLite 3.53.x)"
firstWritten: 2026-05-26
lastVerified: 2026-05-26
relatedPaths:
  - src/main/codebaseGraph/graphDatabaseTraversal.ts
  - src/main/codebaseGraph/cypherEngineVarpath.ts
  - src/main/codebaseGraph/cypherEngineRegression.test.ts
notes: "SQLite JSON1 cycle detection in recursive CTEs; prefix-collision hazard in string-LIKE cycle guards."
---

# better-sqlite3 gotchas

> First written 2026-05-26 (Wave 20 — Ouroboros Graph Tier-1 Cleanup). Covers
> the JSON1 bundling guarantee and the canonical recursive-CTE cycle-detection
> pattern used in this codebase.

## Recursive CTEs

### Use JSON1 visited-set for cycle detection — never string-LIKE

**Symptom:** A `WITH RECURSIVE` CTE that guards against cycles with
`AND r.path NOT LIKE '%' || nextNode || '%'` (where `path` is a
`>`-delimited string accumulator) will silently suppress valid nodes whenever
one node ID is a prefix of another already in the path. For example, once
`src.auth` is in the path string, a traversal step to `src.a` would fail the
`LIKE '%src.a%'` check because `src.auth` contains the substring `src.a` — the
node is incorrectly treated as "already visited" and the BFS terminates early.

**Root cause:** String substring matching (`LIKE '%X%'`) is not a safe
membership test when node IDs can share prefixes — e.g. `pkg.a` and `pkg.auth`,
`mod.parse` and `mod.parseConfig`, or any qualified names where one is a strict
lexical prefix of another.

**Fix:** Replace the string accumulator with a per-row JSON array and use
`json_each` for membership testing:

```sql
-- Anchor: initialize path as a JSON array containing only the start node.
SELECT n_start.id, 0, json_array(n_start.id)
FROM nodes n_start
WHERE ...
UNION ALL
-- Recursive step: append next node to the JSON array.
SELECT nextNode, r.depth + 1, json_insert(r.path, '$[#]', nextNode)
FROM reachable r
JOIN edges e ON ...
WHERE r.depth < ?
  -- Membership guard: structural array lookup, not substring match.
  AND NOT EXISTS (SELECT 1 FROM json_each(r.path) WHERE value = nextNode)
```

`$[#]` is SQLite's "next array index" path expression — it appends to the end
of the array. Supported since SQLite 3.31.0 (2020); well within
`better-sqlite3@12.8.0`'s bundled SQLite 3.53.x.

**Start-node recovery:** If the outer query needs the first element of the path
(e.g. to join back to the start node), use `json_extract(r.path, '$[0]')` — NOT
`SUBSTR(path, 1, INSTR(path || '>', '>') - 1)`, which assumed `>`-delimiter
format and breaks with the JSON array shape.

**JSON1 availability:** JSON1 is compiled into `better-sqlite3` by default in
all versions ≥ 8.x. No extra flags required. Verify with
`db.prepare("SELECT json_array(1,2,3)").get()` — returns `[1,2,3]` if present.

**Wave 20 sources:** `graphDatabaseTraversal.ts` (`runBfsTraversal`),
`cypherEngineVarpath.ts` (`buildVarpathSqlTemplate`).
Regression test: `cypherEngineRegression.test.ts`
("BFS handles prefix-collision node IDs without substring confusion").
