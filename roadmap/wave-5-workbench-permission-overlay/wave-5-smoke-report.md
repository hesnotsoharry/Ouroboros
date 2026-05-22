---
status: DEFERRED
created: 2026-05-22
updated: 2026-05-22
wave: 5
slug: workbench-permission-overlay
---

# Wave 5 — UI Smoke Report (DEFERRED — queued for next dev session)

`/ui-smoke 5` was **not run live** this session, consistent with the Wave 0–4 posture: the canon workbench
is experimental, default-off, and Cole is not using the app until the remake is done. The per-phase
observation points were verified at the unit/integration boundary only (acceptance test 8/8 + render tests
7/7 + workbench suite 190/190), NOT in a running IDE. This file is the queued checklist.

## Preconditions

1. `npm run dev`.
2. Settings → Appearance → enable **"Canon workbench (experimental)"** (`layout.canonWorkbench`).
3. Have the hook-based approval flow active (a `claude` session whose tool calls hit the PreToolUse
   approval gate — i.e. a tool/command outside the session allowlist).

## Checklist

### Terminal overlay (canon §13a)
- [ ] Trigger a tool needing approval (e.g. a Bash command the session will gate). A glass, amber-bordered
      card **slides up** from near the bottom of the terminal pane.
- [ ] The card names the **tool** (e.g. "Bash") and shows a **truncated command preview** (the actual
      command, not a dumped object).
- [ ] The header shows the session id (first 8 chars), an elapsed pill, and a "+N queued" badge if more
      than one request is pending.
- [ ] **Approve** (or press **Y**) → the request clears and the agent **continues** in the terminal.
- [ ] **Always `<tool>`** (or **A**) → the tool is whitelisted for the session (subsequent same-tool calls
      don't prompt).
- [ ] **Deny** click → a reason field appears; the button becomes "Confirm deny"; confirming denies. Pressing
      **N** / **Esc** denies directly.

### Sidebar NOW-takeover (canon §13b)
- [ ] **Simultaneously** with the overlay, the agent sidebar's **NOW panel becomes the permission card**
      (full-width Approve, then Always + Deny).
- [ ] Panels 2–5 (Context / Files Touched / Latest Hunk / Hook Timeline) **dim to ~0.7 opacity**; the
      permission card itself stays full opacity.
- [ ] Resolving from either surface (overlay or sidebar) clears **both** at once.

### Single keyboard owner (D3)
- [ ] With both surfaces visible, a single **Y** / **A** / **N** keypress resolves the request **once** (the
      agent doesn't double-approve / the request doesn't get resolved twice).
- [ ] Typing in the reject-reason field does **not** trigger the Y/A/N shortcuts.

### Flag-off regression
- [ ] Disable the canon flag → the existing approval surfaces (`WorkbenchApprovalPanel` in the chat shell,
      `AgentChatApprovalBanner`) behave as before; no canon overlay appears.

## Capture
- [ ] Screenshot: overlay + dimmed sidebar in the awaiting state.
- [ ] Console: no errors during request → resolve.
