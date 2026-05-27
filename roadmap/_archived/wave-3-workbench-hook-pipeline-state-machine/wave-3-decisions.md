---
status: DRAFT
created: 2026-05-21
updated: 2026-05-21
wave: 3
slug: workbench-hook-pipeline-state-machine
---

# Wave 3 — Architecture Decision Record

> Phase 0 deliverable. Decisions 5 + 6 were locked by Cole before planning (scope boundaries);
> Decisions 1–4 + 7 are planner/tech-lead calls. Decision 1 carries the full best-practice
> spectrum per `~/.claude/rules/best-practice-spectrum.md`; the rest use the abbreviated
> Context / Pick / Rationale form. Picks below are seeded from the waveplan's Locked-decisions
> list; the orchestrator fills any remaining spectrum/consequence detail at Phase 0.

## Decision 1: Workbench-local derived presentation state vs. extending the canonical AgentStatus

**Context:** The canon needs a six-state agent display (`fresh/thinking/running/awaiting/errored/done`);
the live `AgentStatus` (`AgentMonitor/types.ts:10`) is a 4-value enum consumed by ~48 `AgentMonitor/**` files.

**Options considered:**
- *Industry standard:* Extend the domain enum `AgentStatus` with the new states. — ripples through all consumers.
- *Emerging best practice:* A presentation state machine derived from domain state, scoped to the view layer.
- *Experimental / cutting-edge:* A formal statechart (e.g. XState) for the workbench session lifecycle. — overkill here.

**Pick:** Workbench-local `WorkbenchAgentState` derived in the adapter — *emerging best practice*.

**Rationale:** Contains blast radius to `Workbench/**`; the canonical enum and its 48 consumers stay
untouched. Matches the canon's richer display needs without a global enum migration.

**Consequences:** `thinking`/`awaiting` are derived (heuristic + `permissionEvents`), not wire-native;
documented as best-effort. Commits Wave 4+ to the same derive-don't-mutate posture for the sidebar panels.

## Decision 2: Do not plumb `transcript_path`

**Context:** Canon §11 assumes a `transcript_path` envelope field; the wire has none; its only consumer is the Wave 4 Hook Timeline.

**Pick:** Skip. **Rationale:** Not on the wire; consumer is Wave 4. Plumbing now is speculative scope.

## Decision 3: Single `useWorkbenchAgentData` adapter as the source of truth

**Context:** Five regions need live agent data in canon-idealized shapes that don't match the wire.

**Pick:** One adapter hook returns the canon-shaped data; the `workbenchMockData` interfaces become its typed output contract.

**Rationale:** One swap point; `tsc` catches shape drift at the consumer sites. Avoids per-region ad-hoc mapping.

## Decision 4: Primary-session selection rule for the Globe + sidebar header

**Context:** Multiple sessions may exist at once; the Globe/header show one. No pty↔`AgentSession` binding exists (auto-launch deferred, D6), so selection is activity-based, not terminal-frame-bound. The Globe must be able to render all six states — including `done`/`errored`, which only finished sessions carry.

**Pick:** **Two-tier.** (1) If any session is `running`, the primary is the most-recently-active running one (max last-activity = `max(completedAt, last toolCall timestamp, startedAt)`). (2) If none is running, fall back to the most-recently-active *finished* (`complete`/`error`) or `idle` session, so `done`/`errored`/`fresh` remain displayable. (3) `null` (→ `fresh`) only when there are no sessions at all. **A live running session always outranks a stale finished one.**

**Rationale:** The earlier "running session only" wording could not produce `done`/`errored` (those states require selecting a finished session) and was self-contradictory with the acceptance test. The pure "max-activity across all sessions" reading is also wrong — a recently-completed session would outrank a live one, flipping the Globe to `done` while an agent is actively working. The running-preferred two-tier rule is the only one that yields all six states AND keeps live sessions authoritative.

**Consequences:** `selectPrimarySession` partitions by `status === 'running'` first. Phase 3's status-dot mapping inherits this selection, so the two-tier rule must be settled before Phase 3. Revisit when auto-launch (D6) binds a pty to a specific session — then the focused-frame session may become the explicit primary.

## Decision 5: AgentSidebar header live this wave; the five panel bodies stay mock → Wave 4

**Context:** HANDOFF listed the sidebar in Wave 3's swap; the reconciliation sequence reserves the 5-panel re-layout + NOW/Latest-Hunk for Wave 4 (Latest Hunk's diff source is an open Wave 4 question; Files Touched has no live backing).

**Pick:** Header only in Wave 3. **(Cole-locked.)**

**Rationale:** Avoids building the hardest adapters (Files Touched, Latest Hunk) now only to re-lay-them-out next wave. Aligns with the canonical wave sequence.

## Decision 6: Claude auto-launch in the upper terminal frame stays deferred / decoupled

**Context:** Wave 2's ADR deferred auto-launch to "Wave 3", but the Globe can be driven from ambient agent events without a workbench-bound session; pty→`AgentSession` binding doesn't exist yet.

**Pick:** Decouple — Globe reads ambient events; auto-launch + pty binding ship as a later slice. **(Cole-locked.)**

**Rationale:** Keeps Wave 3 to its "mapping + state machine + live swap" title; auto-launch is a distinct UX feature with its own binding work.

## Decision 7: Sweep the Wave-2 dead mock constants in this wave

**Context:** Wave 2 orphaned the terminal-line + terminal-tab mock constants (follow-up `2026-05-21-wave-2-dead-terminal-line-mocks.md`); Wave 3 reworks `workbenchMockData`.

**Pick:** Delete the six constants + two types + barrel re-exports (recon §6) in Phase 4.

**Rationale:** Natural home — Wave 3 already touches the mock module; closes the follow-up.
