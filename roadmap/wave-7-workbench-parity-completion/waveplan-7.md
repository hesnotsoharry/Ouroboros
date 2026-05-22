---
status: SHIPPED
created: 2026-05-22
updated: 2026-05-22
wave: 7
slug: workbench-parity-completion
flag: layout.canonWorkbench (default-off — unchanged this wave)
---

# Wave 7 — Workbench Parity Completion

## 1. Goal

Close the canon-intended affordance gaps that block making the canon Workbench the sole shell, behind
the existing default-off flag. This wave delivers canon §06's complete TitleBar right cluster — Settings,
Command Palette, Notification center — turning three dead stubs into live, wired affordances. Live
FileTree is the planned follow-on; three canon-silent items are surfaced for product decision.

See `wave-7-parity-audit.md` (why teardown was deferred) and `wave-7-decisions.md` (ADR).

## 2. Non-goals

- **No teardown / deletion** — that is Wave 8. No `InnerAppLayout`/`ChatOnlyShell`/`Dispatch/` removal.
- **No flag flip / routing change** — legacy shell remains the live default.
- **No live FileTree** this wave (planned next; needs a file-data source decision).
- **No product-decision items** — FilePicker, SymbolSearch, session-restore-on-launch stay unbuilt
  pending Cole's call.
- **No global keybind change** — Ctrl-K alignment deferred (follow-up).

## 3. User-observable outcome (per phase)

With `layout.canonWorkbench` enabled (Settings → Appearance → "Canon workbench"):

| Phase | Observable |
|---|---|
| 1 — Settings | Click the TitleBar cog → the Settings modal opens over the workbench; close returns to it. |
| 2 — Command Palette | Click the "Ctrl K" pill → the command palette opens with the command list; Esc/select closes it. |
| 3 — Notification center | Click the Bell → the notification center panel opens anchored to the bell; the badge reflects real unread notifications (no longer a hardcoded 3). |

## 4. Phases

### Phase 1 — Settings access
- **New:** `Workbench/Overlays/WorkbenchSettingsOverlay.tsx` — listens for `OPEN_SETTINGS_EVENT`
  (`agent-ide:open-settings-modal`), renders the shared `SettingsModal` as a glass modal; closes on
  the modal's close + Esc.
- **Edit:** `TitleBar/TitleBar.tsx` — `SettingsButton` gets `onClick` dispatching `OPEN_SETTINGS_EVENT`.
- **Edit:** `Workbench.tsx` — mount `<WorkbenchSettingsOverlay/>`.
- **Test:** clicking the cog opens the modal; the overlay subscribes to the event and renders the modal.
- **Commit:** `feat(workbench): wave 7 phase 1 — Settings access (canon §06 cog)`

### Phase 2 — Command Palette
- **New:** `Workbench/Overlays/WorkbenchCommandPalette.tsx` — calls `useCommandPalette` +
  `useCommandRegistry`, renders `CommandPalette` with `{isOpen,onClose,commands,recentIds,onExecute}`.
- **Edit:** `TitleBar/TitleBar.tsx` — `CtrlKButton` gets `onClick` dispatching `agent-ide:command-palette`.
- **Edit:** `Workbench.tsx` — mount `<WorkbenchCommandPalette/>`.
- **Test:** clicking the pill dispatches the event and opens the palette; commands render.
- **Commit:** `feat(workbench): wave 7 phase 2 — Command Palette (canon §06 Ctrl-K)`

### Phase 3 — Notification center
- **Edit:** `TitleBar/TitleBar.tsx` — replace the stub `BellButton` + `MOCK_PENDING_COUNT` with a live
  bell: local `open`/`anchorRect` state, badge from `useToastContext()` unread count, renders
  `NotificationCenter` (mirrors `TitleBar.controls.tsx:NotificationBell`).
- **Test:** badge reflects toast count; click opens `NotificationCenter`; close hides it.
- **Commit:** `feat(workbench): wave 7 phase 3 — Notification center (canon §06 bell)`

### Phase 4 — Wrap
- Full suite + tsc + `eslint src/` + prettier. Result brief, `/review` mechanical, CHANGELOG, CLAUDE.md,
  temperature log. File follow-ups (FileTree, product decisions, Ctrl-K keybind, command-surface curation,
  AgentChat dead-after-cutover, `?mode=chat` pop-out). Update HANDOFF (teardown = Wave 8, gated on parity).
  Tag (`v2.28.0`) + push.

## 5. Risk / mitigation

- **Workbench tests must mock `AgentEventsContext`** (CLAUDE.md gotcha — `AgentGlobe`/`TitleBar` throw
  outside the provider). New TitleBar tests follow the existing `Workbench.test.tsx` mock pattern.
- **Overlay components must mount within the providers above the shell branch only** (`ToastContext`,
  `ApprovalContext`, etc. — all present). No new provider needed; verified in the audit.
- **Each phase is independently revertable** and behind the flag — no production exposure.

## 6. Gates

Per-phase: scoped vitest (`test:layout` covers `Workbench/`) + tsc + lint on touched files +
orchestrator diff review. Wave-end: full suite + full lint + prettier + `/review` mechanical.

## 7. Decisions log

See `wave-7-decisions.md`. Spectrum-worthy picks: D3 (Settings host strategy), D5 (notification badge
source). Routine reuse picks: D4 (palette hooks), D6 (flag posture).
