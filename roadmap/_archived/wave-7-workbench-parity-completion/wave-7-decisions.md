---
status: COMPLETED
created: 2026-05-22
updated: 2026-05-22
---

# Wave 7 — Architecture Decision Record (Workbench Parity Completion)

## Decision 1: Re-sequence — teardown deferred to Wave 8

**Context:** The reconciliation doc sequenced Wave 7 as "cutover & teardown" on the premise that parity
would be reached by Wave 6. The pre-flight parity audit (`wave-7-parity-audit.md`) found it was not —
canon-intended affordances (Settings access, Command Palette, Notification center, live FileTree) were
left as stubs. Deleting the legacy shell now strands the app (no Settings access on the sole shell).

**Pick:** Split the original Wave 7. **Wave 7 = parity completion** (close the gaps behind the existing
flag); **Wave 8 = cutover & teardown** (the original deletion scope, unchanged, gated on parity).

**Rationale:** Parity-then-delete was the explicit design discipline. Honoring it means completing
parity before deleting the fallback. Doing the deletion first — even under "proceed on green tests" —
would ship a silent regression that no test catches.

**Consequences:** The workbench overhaul sequence becomes 0–8 (was 0–7). All prior references to
"Wave 7 = teardown" now mean Wave 8. The teardown's full deletion map (targets, import surfaces,
Open-Q3 resolution) is already captured in the parity audit, so Wave 8 is plan-ready.

---

## Decision 2: Scope this wave to the TitleBar right-cluster trio (Settings / Ctrl-K / Bell)

**Context:** Four parity gaps remain. Implementing all four well overnight risks rushing. The three
TitleBar affordances form a coherent canon §06 slice and are each *clean, additive, decision-free*
wiring over self-contained machinery; FileTree needs a data source and is a larger, separable change.

**Pick:** Implement Settings, Command Palette, and Notification center this session. Plan FileTree as
the immediate follow-on. Leave the 3 canon-silent items + multi-terminal-tabs for Cole.

**Rationale:** Settings + Command Palette are hard prerequisites for *any* future cutover (on every
critical path regardless of how the ambiguous items resolve). All three are behind the default-off
`layout.canonWorkbench` flag → zero risk to Cole's daily use (he runs the legacy shell). Quality over
speed: a coherent, fully-tested 3-affordance slice beats four half-done ones.

---

## Decision 3: Settings — Workbench-local overlay host wrapping the shared `SettingsModal`

**Context:** Settings opens two ways today: (a) `OPEN_SETTINGS_EVENT` (`agent-ide:open-settings-modal`)
→ `ChatOnlySettingsOverlay` renders `SettingsModal` (but that overlay lives in doomed `ChatOnlyShell/`);
(b) `OPEN_SETTINGS_PANEL_EVENT` → `SettingsPanel` as a CentrePane *special view* (the canon centre pane
is terminals-only — no special-view system). Neither host works as-is in the canon shell.

**Options considered:**
- *Reuse `ChatOnlySettingsOverlay`:* rejected — it's in the directory Wave 8 deletes.
- *Port the CentrePane special-view system:* rejected — canon §08 centre pane is two terminals; no
  special views by design.
- *New Workbench-local overlay host (industry standard for modal settings):* mirror the proven
  `ChatOnlySettingsOverlay` pattern (listen for `OPEN_SETTINGS_EVENT`, render the shared `SettingsModal`)
  as a Workbench-owned component.

**Pick:** New `Workbench/Overlays/WorkbenchSettingsOverlay.tsx` reusing the shared `SettingsModal`. — industry standard.

**Rationale:** Reuses the shared modal content (no duplication of the Settings UI), follows the existing
event-driven open pattern, and is self-contained to `Workbench/` so it survives the Wave-8 teardown
unchanged. The Settings button dispatches the existing `OPEN_SETTINGS_EVENT`.

**Consequences:** Two settings hosts coexist while both shells exist (legacy CentrePane panel + canon
overlay), each listening for its own event — no conflict (different event names). Wave 8 deletes the
legacy host with `InnerAppLayout`.

---

## Decision 4: Command Palette — mount the existing `CommandPalette` via its self-contained hooks

**Context:** `CommandPalette` needs `{isOpen, onClose, commands, recentIds, onExecute}`. `useCommandPalette`
(open/close state + listens for `agent-ide:command-palette` + a keybind) and `useCommandRegistry`
(`commands`/`recentIds`/`execute`, builtin commands + localStorage recents) are **self-contained** — no
props need threading from `InnerApp`.

**Pick:** New `Workbench/Overlays/WorkbenchCommandPalette.tsx` calls both hooks and renders `CommandPalette`.
The Ctrl-K button dispatches the existing `agent-ide:command-palette` event (decoupled, matching the
existing design).

**Rationale:** Maximum reuse, zero new state plumbing, consistent with how the palette is opened elsewhere.

**Consequences / known limitation:** (a) the existing palette keybind is **Ctrl+Shift+P**, not the canon
Ctrl+K — the *button* works regardless; aligning the global keybind to Ctrl+K is deferred to a follow-up
(risk of clobbering an existing Ctrl+K binding needs its own check). (b) Some builtin commands target
legacy-shell features (open file in editor, etc.) that the canon shell doesn't mount — those commands
are no-ops in the canon shell for now. Acceptable: the palette is functional; command-surface curation
for the canon shell is a follow-up. Both noted in the result brief.

---

## Decision 5: Notification center — replicate `NotificationBell`, badge on toast notifications

**Context:** The real notification center (`shared/NotificationCenter.tsx`) is fed by `useToastContext()`
(provided above the shell branch). The existing `TitleBar.controls.tsx:NotificationBell` manages local
`open` + `anchorRect` and badges on unread toast count. Canon §06 phrases the badge as "permission
requests pending."

**Pick:** Replicate the `NotificationBell` pattern on the Workbench `BellButton` — badge + panel both
driven by `useToastContext()` (toast notifications). Remove `MOCK_PENDING_COUNT`.

**Rationale:** Reuses the proven `NotificationCenter` component and its real data source. Approval-pending
state already has a dedicated, prominent dual-surface UI (Wave 5 permission overlay + sidebar takeover) —
badging the bell on approvals too would double-signal. "Notification center" semantically = notifications,
not approvals.

**Consequences:** Canon §06's literal "pending permissions" badge wording is satisfied by the Wave-5
permission surfaces rather than the bell. If Cole wants the bell to also reflect pending approvals, that's
a small follow-on (read `useApprovalContext()` pending count into the badge) — noted as a possible
refinement, not built.

---

## Decision 6: Everything stays behind the default-off `layout.canonWorkbench` flag

**Context:** Cole is not using the canon shell daily until the remake is done; the legacy shell is the
live default.

**Pick:** No flag flip, no routing change, no deletion this wave. Pure additive wiring inside `Workbench/`.

**Rationale:** Zero production risk. The flag flip + deletions are Wave 8's job, gated on proven parity.
