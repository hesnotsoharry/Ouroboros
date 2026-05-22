---
status: RESOLVED
created: 2026-05-22
updated: 2026-05-22
resolved: 2026-05-22
resolved-during: wave-8-workbench-canon-parity-2
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

## Resolution (wave-8-workbench-canon-parity-2)

Closed by `haiku-followup-auditor` during wave audit on 2026-05-22.

**Evidence:** Phase 2 shipped the live FileTree implementation:
- `InnerRail.tsx` (line 55) now renders `<FilesSection />` which mounts `<WorkbenchFileTree rootPath={projectRoot} />`
- `WorkbenchFileTree.tsx` (new file, verified in wave diff) implements the live canon §07 file tree with lazy directory expansion
- `useWorkbenchFileTree.ts` (new file) wires to `useFileWatcher` + `window.electronAPI.files.readDir` for live directory data
- The component uses `FileNode` for row rendering with canon token styling (indent depth×12px+6 base, dir icon `--accent-hi`, file `--ink-3`)
- M/A git-status badges deferred to follow-up (`2026-05-21-workbench-live-git-diff-stats.md`), consistent with the planning scope

Resolves the HIGH-priority FileTree parity gap that was blocking Wave 8 cutover — the InnerRail "Files" section is now live and functional.
