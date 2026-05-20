---
status: DRAFT
created: 2026-05-20
updated: 2026-05-20
---

# Wave 99 — Architecture Decisions

## Decision 1: Trigger semantics — completion + error, distinct colors

**Context:** The indicator must reflect when an agent stops. An agent can stop
cleanly (`status === 'complete'`) or in error (`status === 'error'`). Idle and
running are not "finished." We must decide which states light an indicator and
how they read visually.

**Pick:** Green (`status-success` token) for `complete`, red (`status-error`)
for `error`; `idle` / `running` light nothing. — user direction.

**Rationale:** A single color would lose the success/failure distinction that
matters most when scanning multiple projects. The two states map cleanly onto
the existing semantic status tokens.

**Consequences:** Both rail tiers carry a two-color vocabulary. When a project
has both an unseen complete and an unseen error, error wins (see Decision 4's
reducer). Idle-but-waiting-for-input is intentionally invisible — if the user
later wants an "idle/awaiting input" cue, that's a separate additive state.

## Decision 2: Dismiss model — clear on view, timestamp-based

**Context:** The indicator must clear once the user has seen it, but a *new*
completion afterward should re-light it. A boolean "seen" flag cannot express
"seen the old one, not the new one."

**Options considered:**
- *Industry standard (unread-badge):* boolean seen/unseen per item, cleared on
  view. Simple but cannot distinguish a re-completion from the already-seen one.
- *Emerging best practice (timestamp watermark):* store a `lastViewedAt` per
  item; an event is unseen iff its timestamp is newer than the watermark. This
  is how mature notification/inbox systems handle re-surfacing (e.g. last-read
  markers in chat apps).

**Pick:** Timestamp watermark — per-session `lastViewedAt` vs
`AgentSession.completedAt`. Unseen iff `completedAt > lastViewedAt`. — emerging
best practice, aligned with user's "re-lights" requirement.

**Rationale:** The user explicitly wants a new finish after viewing to re-light.
`AgentSession.completedAt` already exists as the completion timestamp, so the
watermark approach is nearly free and strictly more correct than a boolean.

**Consequences:** The hook owns a `lastViewedAt: Record<sessionId, number>` map.
`markProjectViewed(path)` stamps `Date.now()` for every session whose cwd is in
that project; `markSessionViewed(id)` stamps one. Outer-dot derivation is the
OR over a project's sessions' unseen states.

## Decision 3: Visual style — reuse the existing attention system

**Context:** The inner rail already has an attention system
(`useWorkbenchAttention` + `WorkbenchSessionRow` chips / `AttentionMark`) with a
`WorkbenchAttentionKind` union that *already includes* `'completed-unseen'` and
`'failed'` (`useWorkbenchAttention.ts:17`), plus `success` / `error` tones in
`chipClassName`. We could build a dedicated completion badge or reuse this.

**Pick:** Reuse — inner rail uses the existing `completed-unseen` / `failed`
kinds and tones; outer rail uses the same `status-success` / `status-error`
tokens for its dot. — user direction.

**Rationale:** The vocabulary already exists; a parallel badge system would
fragment the visual language and duplicate state. Reuse keeps one source of
truth for "this row needs attention."

**Consequences:** No new chip component. Phase 3 must verify the existing kinds
are actually *populated* from agent-completion state (they may be
declared-but-dead, since attention currently derives from `SessionRecord` while
completion lives in `AgentSession`) — this is the wave's main mental-model risk
and is why Phase 3 is audit-first.

## Decision 4: Project association — normalized `cwd` prefix match

**Context:** To light a project's dot we must map an `AgentSession` to a project.
`AgentSession.cwd` is the only field carrying the working directory; the rail's
projects are absolute path strings from `useWorkbenchProjects()`.

**Options considered:**
- *Exact equality:* `cwd === projectPath`. Misses agents launched in a
  subdirectory of the project.
- *Normalized prefix match:* normalize both sides (backslash→slash, strip
  trailing slash, lowercase on win32), then a session belongs to a project iff
  its cwd equals or is nested under the project path.

**Pick:** Normalized prefix match. — resolved from grounding.

**Rationale:** Agents frequently run from a subdir; prefix match is the standard
"which workspace owns this path" resolution. Normalization is mandatory because
the codebase mixes Windows backslash paths with forward-slash storage.

**Consequences:** When multiple project paths are nested (a project inside
another), the longest matching prefix wins (assign to the most specific
project). `cwd === undefined` → unassigned, no dot, no error. A Windows-path
normalization unit test is required (Phase 1 acceptance criterion).

## Decision 5: Viewed-state lifetime — in-memory, not persisted

**Context:** Where does the `lastViewedAt` watermark live — renderer memory
(cleared on restart) or persisted config/electron-store (survives restart)?

**Options considered:**
- *In-memory (renderer hook state):* simplest; indicators reset on app restart.
- *Persisted:* indicators survive restart, matching a true "unread inbox."

**Pick:** In-memory, window-lifetime. — resolved from grounding; punt persistence
to a follow-up if requested.

**Rationale:** Completion indicators are ephemeral attention cues for *live* work.
By the time the app restarts, the agents are historical and the "go look at what
just finished" prompt is stale. Persisting adds a config-schema surface this wave
explicitly avoids. YAGNI until the user asks for cross-restart unread.

**Consequences:** No config-schema or main-process change (keeps the wave
renderer-only). On restart, all dots/chips start clear. If the user later wants
persistence, that's an additive follow-up: move `lastViewedAt` to electron-store
behind a config key — no change to the derivation logic.

## Decision 6: Inner-rail attention source — add an `AgentSession` input path, keep the chat-thread path as fallback

**Context:** The diagnostic investigation (sonnet-diagnostician, 2026-05-20)
found the root cause of "no indicators anywhere": `useWorkbenchAttention` derives
`live` / `completed-unseen` / `failed` from `AgentChatThreadRecord.status` —
the **retired in-IDE chat** thread status — reached via `SessionRecord →
resolveSessionThread`. A terminal-launched `claude` session has no chat thread,
so that path produces nothing. Meanwhile the real signal lives in
`AgentSession.status` in the `useAgentEvents` store, which `WorkbenchRail` never
reads. The attention kinds were declared but effectively dead for terminal usage.
We must decide how to reconnect the rail to the live signal.

**Options considered:**
- *Replace the chat-thread path with an AgentSession path:* cleaner end-state,
  but rips out code that is dormant-not-dead (chat retirement isn't fully
  ratified) and risks regressing any residual chat-thread behavior.
- *Add an AgentSession branch alongside, chat-thread as fallback:* additive;
  populates attention from `AgentSession.status` when a join resolves, falls back
  to the legacy thread-status path otherwise. The `UseWorkbenchAttentionOptions`
  option-bag (`useWorkbenchAttention.ts:33`) is a clean seam for a new
  `agentSessions?` input without breaking existing callers.

**Pick:** Add an `AgentSession` branch alongside the chat-thread path
(additive). — emerging best practice (strangler-pattern: new path in, old path
dormant until separately retired).

**Rationale:** The wave's job is to make terminal-session completion visible,
not to finish retiring the chat surface — that's a separate, larger decision.
Additive wiring repairs the user-visible break (including the long-dead Live
chip) with minimal blast radius and a clean rollback. The join
(`SessionRecord.activeTerminalIds → TerminalSession.claudeSessionId →
AgentSession.id`) is the new logic; the option-bag seam keeps it isolated.

**Consequences:** `useWorkbenchAttention` gains an `agentSessions?` (and/or a
precomputed `agentStatusBySessionRecordId`) input plus a join helper. Mapping:
`running → live`, `complete → completed-unseen`, `error → failed`, honoring
existing `rank` / `isSticky` / tone. The chat-thread branch stays as fallback —
a future cleanup wave can retire it once chat removal is fully ratified. The
join spans a heuristic middle link (the terminal↔session binding), so it is the
wave's primary boundary risk and gets an orchestrator-owned failing acceptance
test plus a `sonnet-phase-reviewer` pass (Phase 3).
