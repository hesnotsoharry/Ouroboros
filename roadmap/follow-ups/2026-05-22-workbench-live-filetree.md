---
status: OPEN
created: 2026-05-22
severity: HIGH
area: Workbench / Rails
blocks: wave-8-cutover
---

# Canon Workbench InnerRail — wire live FileTree (replace MOCK_FILE_TREE)

**What.** `src/renderer/components/Workbench/Rails/InnerRail.tsx` renders a static `MOCK_FILE_TREE`
constant for its "Files" section. Canon §07 specifies a fully live file tree (indented depth × 12px,
directory icon `--accent-hi`, file icon `--ink-3`, M/A status badges).

**Why it matters.** This is a canon-intended parity gap (see `wave-7-parity-audit.md`, gap #4). It is a
**hard blocker for Wave 8 cutover** — once the canon Workbench is the sole shell, a file tree showing
fake files is a visible, broken regression. Wave 7 closed the three TitleBar affordances but
deliberately scoped FileTree out (it needs a real file-data source, not just event wiring).

**How to apply.** Wire `InnerRail`'s file section to the real file-tree data source. The legacy shell's
`SidebarSections` (`src/renderer/components/Layout/SidebarSections.tsx`) + the `FileTree` component
(`src/renderer/components/FileTree/`) are the existing implementations to draw from. Decide whether to
reuse `FileTree` directly inside the rail or derive a canon-styled tree from the same `useFileWatcher`/
project-roots data. Keep it Workbench-local; respect the canon §07 styling (token-based). Project root
comes from `ProjectContext` (already above the shell branch).

**Sequencing.** Should land before Wave 8 (cutover & teardown). Candidate for "Wave 7b" or fold into
the Wave 8 plan as a prerequisite phase.
