---
status: COMPLETED
created: 2026-05-22
updated: 2026-05-22
---

# Wave 7 Pre-Flight — Workbench Parity Audit (why "cutover & teardown" is blocked)

> **TL;DR.** The reconciliation doc sequenced Wave 7 as a single "cutover & teardown" wave, on the
> stated premise: *"Single big deletion wave, **after parity is proven**."* This audit (run before
> writing the plan) found **parity was never reached**. Waves 1–6 delivered *visual* parity with the
> canon shell, but several canon-intended affordances were left as **stubs** — most critically,
> **Settings is unreachable from the canon shell** (the Settings button is a dead `onClick`-less stub).
> Deleting `InnerAppLayout` now would strand the app: no Settings access, no command palette, a
> mock-only file tree. **Teardown is therefore deferred. The real next wave is parity completion.**

---

## How this audit was run

Cole granted autonomous overnight authority to "plan and implement Wave 7." Per the parity-then-delete
discipline the wave was designed around, the first step was to verify parity statically (functional /
code-level — distinct from the *visual* smoke Cole explicitly waived). Five read-only explorer
dispatches mapped: the shell-selection architecture, the `Dispatch/` surface + `mobileAccess`
dependency (Open Q3), the remaining deletion targets, the ChatOnlyShell external-consumer boundary +
liveness, the `InnerAppLayout`↔`Workbench` feature parity matrix, and the canon-intent classification
of every gap. Citations are file:line against the tree at `master` @ `49753376`.

## Resolved on the way (no longer blockers)

- **Open Q3 — `mobileAccess` ↔ `Dispatch/`: RESOLVED.** `mobileAccess.enabled` gates the web/mobile
  *pairing middleware* (`src/main/web/pairingMiddleware.ts`, `webServer.ts:175`), NOT the dispatch
  queue. Deleting `Dispatch/` does not break mobile access. The two are unrelated subsystems.
- **`Dispatch/` import surface: confirmed minimal.** Exactly one real import
  (`Layout/InnerAppLayout.agent.tsx:19`), itself slated for deletion. `DispatchBadge` + `useDispatchJobs`
  (consumed by `AgentMonitor`) are separate from `Dispatch/` and survive.
- **Canon Workbench has zero imports from the legacy shells.** It resolves only to shared
  hooks/contexts already mounted above the shell branch (`AgentEventsContext`, `ProjectContext`,
  `ApprovalContext`, `ToastContext`, `FocusContext`). The cutover routing change is clean.
- **`AgentMonitor/ApprovalDialog` is genuinely orphaned** (mounted nowhere; only self-import + a test
  mock). Safe to delete in the teardown wave.

## The shell-selection seam (for the eventual cutover)

`src/renderer/App.helpers.tsx:261–280`, three-way branch in `InnerApp`:

```
if (canonWorkbenchFlag) return <Workbench />;                          // canon shell (default-OFF)
if (isImmersive)        return <ChatOnlyShellWrapper terminal=… />;    // immersive / mobile-web / ?mode=chat
return <InnerAppLayout … />;                                           // legacy IDE shell (default path)
```

`isImmersive = isChatWindow || immersiveFlag || isMobileWeb`. The legacy `InnerAppLayout` is the
**current default render path** — i.e. what every normal desktop launch shows today.

---

## Parity matrix — what `InnerAppLayout` mounts vs. what the canon `Workbench` mounts

Classification of each "missing in Workbench" feature against the canon design (`design-system/canon.html`)
and the reconciliation decisions:

| # | Feature | In canon shell today | Canon intent | Verdict |
|---|---|---|---|---|
| 1 | **Command Palette** (Ctrl+K) | `CtrlKButton` visual stub, no `onClick` | §06 "Ctrl K command palette" — INTENDED | **GAP — wire it** |
| 2 | **Settings access** | `SettingsButton` stub, no `onClick`; no Settings host mounted | §06 "Settings cog icon button" — INTENDED | **GAP — hard cutover blocker** |
| 3 | **Notification center** | `BellButton` stub, `MOCK_PENDING_COUNT=3`, no `onClick` | §06 + §11 bell → notification center — INTENDED | **GAP — wire it** |
| 4 | **Live FileTree** | `InnerRail` renders `MOCK_FILE_TREE` | §07 fully-specified live tree — INTENDED | **GAP — needs data wiring** |
| 5 | Multi-terminal tab management | 2 fixed terminal slots | §08/§16 tab affordance intended; live mgmt explicitly deferred (Wave-2 ADR D1–3,6) | GAP — deferred by prior ADR |
| 6 | File editor in centre pane | Two terminals only | §08 "centre column holds two terminals"; §18 editor not selected | **Intentionally DROPPED** |
| 7 | Right-sidebar legacy panels (Git/Analytics/Memory/ClaudeConfig/Monitor/Subagent) | 5 canon panels instead | §09 defines exactly 5 panels | **Intentionally REPLACED** |
| 8 | TitleBar dropdown menus (File/Edit/…) | none | §06 title bar spec complete, no menu bar | **Intentionally DROPPED** |
| 9 | AgentChatWorkspace (chat surface) | none | §18 "the old chat UI is gone" + chat-retirement | **Intentionally DROPPED** |
| 10 | DispatchScreen | none | §18 "Discarded — user does not use it" | **Intentionally DROPPED** (teardown target) |
| 11 | FilePicker overlay | none | canon silent | **AMBIGUOUS — product call** |
| 12 | SymbolSearch overlay | none | canon silent | **AMBIGUOUS — product call** |
| 13 | Session-restore-on-launch (`RestoreSessionsGate`) | none | canon silent (startup behavior, not layout) | **AMBIGUOUS — product call** |

**Provider parity:** the Workbench does NOT mount `FileViewerManager` / `MultiBufferManager` /
`DiffReviewProvider` / `IdeToolBridge`. Verified no Workbench child calls their context hooks → **no
crash risk**. The Workbench's diff panel uses its own self-contained pipeline (`useWorkbenchAgentData.diff.ts`),
not `DiffReviewProvider`.

### Tally

- **4 genuine, canon-intended parity GAPS** that block cutover: Command Palette, Settings, Notification
  center, live FileTree. (Plus multi-terminal tabs — canon-intended but already deferred by a prior ADR.)
- **5 intentionally dropped/replaced** — not gaps; these are *why the teardown deletes those surfaces*.
- **3 ambiguous** (FilePicker, SymbolSearch, session-restore) — canon is silent; these are **product
  decisions only Cole can make**.

**The canon Workbench is ~75% complete relative to canon scope — not "far from done."** The shell,
live terminals, all 5 agent panels (live), permission UI, state machine, themes, and responsive
collapse are shipped. What remains is a bounded set of affordance-wirings + one data-wiring (FileTree)
+ three product decisions.

---

## Why this blocks teardown specifically

Making the Workbench the **sole** shell means deleting `InnerAppLayout` (the current default path).
The moment that happens:

1. **Settings becomes unreachable.** The canon Settings button has no handler and the Workbench mounts
   no Settings host. A shell you cannot open Settings from is unshippable — you couldn't even toggle
   features or recover.
2. **Command Palette is dead.** A core affordance, visually present but inert.
3. **The file tree shows fake files** (`MOCK_FILE_TREE`) — a visible, broken regression on the sole shell.

Green Workbench tests do **not** catch any of this: the Workbench's own tests pass on the stubs, and
`InnerAppLayout`'s tests get deleted alongside it. This is exactly the failure mode the parity-then-delete
sequence existed to prevent — and it would have shipped silently under "proceed on green tests."

---

## Decision

**Defer teardown. Re-sequence:**

- **Wave 7 — Workbench Parity Completion** (this wave). Close the canon-intended gaps behind the existing
  default-off flag. Implemented this session: the three TitleBar right-cluster affordances (Settings,
  Command Palette, Notification center — canon §06's complete right cluster). Planned for follow-on:
  live FileTree. Surfaced for Cole: the 3 ambiguous product decisions + multi-terminal tabs.
- **Wave 8 — Cutover & Teardown** (was Wave 7). Runs only once parity is proven. Same deletion targets
  (`AppLayout`/`InnerAppLayout`, ChatOnlyShell/, `Dispatch/`, "Explain error", orphaned `ApprovalDialog`)
  — fully mapped in this audit and ready to execute when the gates are met.

See `wave-7-decisions.md` for the ADR and `waveplan-7.md` for the plan.
