---
status: DRAFT
created: 2026-05-24
updated: 2026-05-24
wave: 13
---

# Wave 13 — Architecture Decisions

Decisions locked before any code is written. Source plan: `waveplan-13.md`. Per `~/.claude/rules/best-practice-spectrum.md`, decisions follow the Context / Options / Pick / Rationale / Consequences shape; routine "use this existing pattern" calls use the abbreviated Context / Pick / Rationale form.

---

## Decision 1: Reuse `TabState.id` as `OUROBOROS_PANE_ID` (no parallel `paneId` field)

**Context:** The pane-id round-trip needs a per-pane-stable anchor minted once at tab creation and never updated. Wave 12 already added `TabState.sessionId` set equal to `TabState.id` at `useWorkbenchTabs.ts:83–85` (`buildNewTab`); they are always equal because nothing in the codebase reassigns `sessionId`. Adding a parallel `paneId` field is an option — explicit naming — at the cost of three-field maintenance and possible drift.

**Options considered:**
- *Industry standard (DRY):* reuse `TabState.id` — single source of truth, no schema migration, no parallel state.
- *Emerging best practice:* add a parallel `paneId` field for semantic clarity (the `id` is the React-key / pty-session-id; `paneId` would unambiguously mean "the binding anchor sent to claude").

**Pick:** Reuse `TabState.id`. (industry standard)

**Rationale:** `TabState.id` is already globally unique (`Date.now() + random.toString(36).slice(2,8)`), already per-pane-stable, already persisted via the Wave 12 schema, and already used as the pty session id. A parallel field would add a write site at tab creation, a read site at every spawn / hook injection, and a third place that has to stay in sync. The semantic-clarity argument is weak — the value's role expands; the value doesn't change.

**Consequences:** If a future wave introduces Claude session rotation (a new `sessionId` per `--resume` call, decoupling `sessionId` from `id`), the field equality breaks but the binding still works because Wave 13 uses `id`, not `sessionId`. No migration debt.

---

## Decision 2: Env-var name = `OUROBOROS_PANE_ID`

**Context:** The env var Wave 13 injects at pty spawn needs a name. Existing `OUROBOROS_*` namespace already covers `OUROBOROS_HOOKS_TOKEN`, `OUROBOROS_HOOKS_ADDRESS`, `OUROBOROS_IDE_SESSION`, `OUROBOROS_CHAT_SESSION`, `OUROBOROS_INTERNAL`, `OUROBOROS_TOOL_TOKEN`.

**Pick:** `OUROBOROS_PANE_ID`.

**Rationale:** Matches the existing namespace convention. Specific enough to not collide with hypothetical future env vars; generic enough to apply across upper-cc panes, lower-shell panes, and any future pane kinds. Cole-confirmed in HANDOFF 2026-05-24.

---

## Decision 3: Hook payload field name = `paneId` (camelCase)

**Context:** The hook scripts (`agent_start.mjs`, `agent_end.mjs`) read `process.env.OUROBOROS_PANE_ID` and emit a field on the payload object that flows to the renderer. The receiving `HookPayload` interface in `src/main/hooks.ts:54–87` uses camelCase (`sessionId`, `parentSessionId`, `taskLabel`, `costUsd`, `ideSpawned`).

**Pick:** `paneId`.

**Rationale:** Matches existing `HookPayload` convention. Renderer-side event consumers read `event.paneId` directly without case-conversion ceremony.

---

## Decision 4: Active-pane no-paneId-events fallback = explicit empty state

**Context:** When the AgentSidebar's currently-active pane has no `paneId`-tagged events in the stream — because (a) Cole hasn't spawned a claude there, (b) only an external/IDE-in-itself claude is running, or (c) cold-start before any tab spawn — the sidebar needs a defined behavior. Three options.

**Options considered:**
- *Industry standard:* explicit empty state — sidebar shows "No active claude session in this pane" copy; never shows another session's data.
- *Emerging best practice:* fall back to project-cwd filter (Wave 8 P1's no-binding rescue) — sidebar shows any session in the active project.
- *Experimental:* show last-seen session for this pane via per-pane LRU cache.

**Pick:** Option A — explicit empty state. (industry standard) Cole-locked 2026-05-24.

**Rationale:** Wave 13 exists to close the hijack bug. Option B re-introduces a weaker version of the same hijack (an external claude in the same project still appears). Option C introduces stale-data confusion (Cole sees a finished session's NOW panel and thinks claude is still working). Option A is the only choice that delivers the wave's correctness goal without an asterisk.

**Consequences:** When Cole has no IDE-spawned claude running, the AgentSidebar shows the empty state. This is intentional — the sidebar reflects the IDE's bound state, not the system-wide claude pool. Cole spawns a workbench-tab claude → sidebar lights up immediately.

---

## Decision 5: Eliminate `useWorkbenchClaudeCapture` heuristic in the same wave (no overlap window)

**Context:** The heuristic capture path lives at `useWorkbenchTerminals.ts:169–191`. Keeping it as a fallback (after the new paneId binding ships) would mean: if a hook event arrives without `paneId`, the heuristic re-binds and the hijack remains possible.

**Pick:** Delete in Phase 2, alongside the new paneId-keyed binding. Also delete the `claudeSessionId` `useState` in `Workbench.tsx:215` and the `onClaudeSessionId` callback prop chain through `CenterPane.tsx`.

**Rationale:** The heuristic IS the bug — keeping it as a fallback re-enables what the wave is closing. The five consumers (`Workbench.tsx:215, 184, 137`; `CenterPane.tsx:192–195`; `AgentSidebar.tsx:121–125, 274–276`) all re-point to the paneId-derived binding in Phase 2; no other readers exist per the grounding consumer list.

**Consequences:** Wave 13 is the deletion wave for this heuristic. Any new "show me a session for this pane" requirement after Wave 13 must use the paneId binding — no escape hatch.

---

## Decision 6: Wave 9 auto-resume path (`autoResumeCcTab`) also receives env injection via shared helper

**Context:** Two pty spawn call sites in `useWorkbenchTabs.ts` — `spawnTab` (51–56, manual new-tab path) and `autoResumeCcTab` (59–72, Wave 9 restore path that uses `resumeMode: tab.sessionId`). The restore path currently does not pass `env`. If Phase 1 only updates `spawnTab`, restored tabs from prior sessions would have no `OUROBOROS_PANE_ID` injection until manually re-spawned — a one-time silent gap.

**Pick:** Introduce a `buildSpawnEnv(tabId)` helper used by BOTH spawn call sites. Phase 1 acceptance test asserts both flows.

**Rationale:** Helper-via-both-call-sites is the structural way to prevent the gap from recurring (any future spawn path uses the helper). One-line redundancy at each call site (`{ env: buildSpawnEnv(id) }`) is acceptable.

**Consequences:** Mechanical implementation invariant. Any new spawn site added in future waves must also use `buildSpawnEnv` — note in `useWorkbenchTabs.ts` adjacent to the helper.
