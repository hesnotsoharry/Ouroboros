---
status: OPEN
created: 2026-05-21
wave-origin: 2
slug: wave-2-dead-terminal-line-mocks
priority: low
---

# Dead terminal-line mock constants after Wave 2 terminal integration

**Found during:** Wave 2 wrap (dead-export audit).

Wave 2 Phase 2 replaced the static mock terminal bodies (`CcBody`/`ShellBody`) with
live `<TerminalInstance>` mounts. That orphaned the terminal-line mock data — it is
still defined and re-exported but consumed by no component:

- `src/renderer/components/Workbench/workbenchMockData.sidebar.ts`:
  - `TermLineTone` (type, ~line 111)
  - `MockTerminalLine` (interface, ~line 120)
  - `MOCK_CC_STATUS_LINE` (~line 310)
  - `MOCK_CC_PROMPT_PLACEHOLDER` (~line 314)
  - `MOCK_CC_TUI_LINES` (~line 317)
  - `MOCK_SHELL_LINES` (~line 339)
- `src/renderer/components/Workbench/workbenchMockData.ts` — the re-export barrel
  forwards all six (~lines 44, 47, 50–52, 59).

The two types (`TermLineTone`, `MockTerminalLine`) are used **only** by those four
constants, so the removal is self-contained.

**Why deferred, not pruned at wave-2 wrap:** zero runtime impact (mock data only),
outside Wave 2's core `Terminals/` scope, and Wave 3 reworks `workbenchMockData`
wholesale (swaps mock → live hook data). The natural home for the sweep is Wave 3.

**Action for Wave 3:** delete the six symbols from `workbenchMockData.sidebar.ts`
and their re-exports from the `workbenchMockData.ts` barrel; confirm `tsc` + `eslint`
clean. If Wave 3's mock rework removes the module section anyway, this is already
covered — just verify nothing else imports them.
