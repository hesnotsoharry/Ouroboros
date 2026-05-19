---
status: OPEN
created: 2026-05-19
updated: 2026-05-19
source: wave-97 Phase D full-test surfaced pre-existing failure
---

# `mobile-touch-targets.test.ts` failure — WorkbenchRightPane.tsx:50

## Symptom

```
FAIL  src/renderer/styles/mobile-touch-targets.test.ts > mobile touch-target audit
  > no <button> elements have a height below 32px without touch-target-ok opt-out

AssertionError: Found 1 button(s) with height < 32px.
  src/renderer/components/Layout/ChatOnlyShell/WorkbenchRightPane.tsx:50
    — Tailwind h-6 (24px) on <button ...>
```

## Confirmation it's pre-existing (not W97)

Verified during Wave 97 Phase C: stashed Phase C edits, `git checkout HEAD~1 -- electron-foundation.d.ts CLAUDE.md` to roll back Phase A as well, ran `npx vitest run src/renderer/styles/mobile-touch-targets.test.ts` against pre-W97 state — same failure, same offender, same line. Wave 97 (pure type-only refactor) cannot mechanically affect a CSS-class audit on a Layout component.

Likely origin: Wave 95 Phase H reshape (`ChatWorkbenchArtifactPane` removal + workbench surface consolidation; net −1094 lines). A button on the right pane lost its `/* touch-target-ok */` opt-out comment OR was migrated to a smaller `h-6` size without adding the opt-out.

## Fix shape

Either:
1. Add `/* touch-target-ok */` to the `WorkbenchRightPane.tsx:50` button if it's intentionally desktop-only (no mobile path renders this surface).
2. Bump the button to `h-8` (32px) to satisfy the audit on every viewport.

Option 1 is the W95-pattern fix (the audit explicitly supports desktop-only opt-out).

## Scope

Single-file, single-line. Mechanical Tier-1 inline fix in any wave touching ChatOnlyShell. Not worth a dedicated wave.
