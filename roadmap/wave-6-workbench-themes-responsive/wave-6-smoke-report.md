---
status: QUEUED-DEFERRED
created: 2026-05-22
wave: 6
slug: workbench-themes-responsive
---

# Wave 6 — UI Smoke Report (DEFERRED — queued for next dev session)

`/ui-smoke 6` live smoke was **not run**, consistent with the Wave 0–5 posture: Cole isn't using the app
until the remake is complete, so a live dev-server smoke isn't run mid-overhaul. Phase observation points
were verified at the unit/render boundary (jsdom, mocked matchMedia) only — NOT in a running IDE.

## Next dev session — manual smoke checklist

Enable **Settings → Appearance → "Canon workbench (experimental)"** (`layout.canonWorkbench`), then:

### Themes (canon §15)
- [ ] **Modern**: the terminal background reads as a **deeper, clearly-tinted indigo well** in the glass
      (the 0.35→0.62 fix) — not the near-transparent wash it had before.
- [ ] **Warp**: switching theme washes the **entire workbench warm amber** (ambient wash + corner glows go
      orange, not indigo); the accent edges/prompt tint warm.
- [ ] **Retro**: panels go **opaque matte green** with **visible CRT scanlines** across the surface and
      **no glassy blur**; the green phosphor glow stays on accents.
- [ ] cursor / kiro / light / high-contrast still render correctly (no per-theme tuning this wave — just
      confirm nothing broke).

### Responsive collapse (canon §16 — three tiers)
- [ ] Drag the IDE window **narrower past ~1760px**: the agent sidebar **narrows** (348→300) and the Latest
      Hunk panel **collapses to a one-line indicator**; clicking it expands the full hunk.
- [ ] Drag **narrower past ~1440px**: the left **project rail + inner rail merge into the single unified rail**;
      the unified rail shows the **live** project list + branch (not mock data).
- [ ] **Widen back**: the full layout restores with the same project still selected.
- [ ] Click a rail **collapse handle** at a wide width: forces the unified rail; the unified rail's **expand**
      button restores dual rails. (Known: manual collapse doesn't auto-clear on widen — follow-up
      `2026-05-22-workbench-forceunified-no-autoclear.md`.)

### Permission surfaces at narrowed width (Wave 5 regression check)
- [ ] At compact/unified (300px sidebar), trigger a tool needing approval — the sidebar NOW-takeover permission
      card renders **un-clipped** with all actions visible.

### Flag-off regression
- [ ] With the flag OFF, the legacy shells and all seven themes render exactly as before (no scanlines, no
      responsive behavior, terminal wells unchanged except Modern's corrected 0.62).
