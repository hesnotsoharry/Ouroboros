/* global React */
/* workbench-data.jsx — mock data + tiny SVG icon set + small reusable pieces */

const { useState, useEffect, useRef } = React;

// ── Icons (lucide-style, 16px, 1.6px stroke) ───────────────────────────────
const I = (path, props = {}) => (
  <svg
    width={props.size || 14}
    height={props.size || 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={props.sw || 1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={props.style}
  >
    {path}
  </svg>
);

const Icon = {
  Terminal: (p) => I(<><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>, p),
  Folder: (p) => I(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />, p),
  File: (p) => I(<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /></>, p),
  Chevron: (p) => I(<polyline points="9 6 15 12 9 18" />, p),
  ChevronD: (p) => I(<polyline points="6 9 12 15 18 9" />, p),
  Plus: (p) => I(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>, p),
  X: (p) => I(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>, p),
  Search: (p) => I(<><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></>, p),
  Settings: (p) => I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>, p),
  Edit: (p) => I(<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" /></>, p),
  Read: (p) => I(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>, p),
  Bash: (p) => I(<><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>, p),
  Grep: (p) => I(<><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.65" y2="16.65" /></>, p),
  Glob: (p) => I(<><circle cx="12" cy="12" r="9" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>, p),
  Write: (p) => I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></>, p),
  Web: (p) => I(<><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>, p),
  Brain: (p) => I(<path d="M9.5 3A2.5 2.5 0 0 0 7 5.5v.5a3 3 0 0 0-3 3v1a3 3 0 0 0 2 2.83V14a3 3 0 0 0 3 3 2 2 0 0 0 4 0 3 3 0 0 0 3-3v-1.17a3 3 0 0 0 2-2.83V9a3 3 0 0 0-3-3v-.5A2.5 2.5 0 0 0 12.5 3 1.5 1.5 0 0 0 11 4.5 1.5 1.5 0 0 0 9.5 3z" />, p),
  Git: (p) => I(<><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 8.5v7M15.5 9.5 8.5 17M18 12v3a3 3 0 0 1-3 3H9" /></>, p),
  Branch: (p) => I(<><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>, p),
  Bolt: (p) => I(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />, p),
  Sparkle: (p) => I(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>, p),
  Layers: (p) => I(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>, p),
  Bell: (p) => I(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>, p),
  Box: (p) => I(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>, p),
  Stop: (p) => I(<rect x="5" y="5" width="14" height="14" rx="2" />, p),
  Play: (p) => I(<polygon points="6 4 20 12 6 20 6 4" />, p),
  Pause: (p) => I(<><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></>, p),
  Clock: (p) => I(<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>, p),
  Dollar: (p) => I(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>, p),
  Split: (p) => I(<><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="12" x2="21" y2="12" /></>, p),
  Maximize: (p) => I(<><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>, p),
  Cmd: (p) => I(<path d="M6 9V6a3 3 0 0 1 6 0v12a3 3 0 0 0 6 0v-3M15 9V6a3 3 0 0 1 6 0v12a3 3 0 0 0-6 0v-3M9 15H6a3 3 0 0 0 0 6h0a3 3 0 0 0 3-3v-3M15 9h3a3 3 0 0 0 0-6h0a3 3 0 0 0-3 3v3" />, p),
  Eye: (p) => I(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>, p),
  Pin: (p) => I(<><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14l-2-7-3-2V4H10v4l-3 2-2 7z" /></>, p),
  Check: (p) => I(<polyline points="20 6 9 17 4 12" />, p),
  ToolBadge: (p) => I(<><circle cx="12" cy="12" r="9" /><path d="M9 12 11 14 15 10" /></>, p),
  Diamond: (p) => I(<path d="M12 2 22 12 12 22 2 12z" />, p),
};

// ── Mock data ──────────────────────────────────────────────────────────────

const PROJECTS = [
  { id: 'agent-ide',   name: 'agent-ide',   color: '#818cf8', initial: 'A', branch: 'wave/96-glass-pivot', dirty: 4,  active: true },
  { id: 'pinpoint',    name: 'pinpoint',    color: '#f472b6', initial: 'P', branch: 'main',                 dirty: 0,  active: false },
  { id: 'lumen-cli',   name: 'lumen-cli',   color: '#34d399', initial: 'L', branch: 'fix/streaming-edge',   dirty: 2,  active: false },
];

const TERM_TABS_UPPER = [
  { id: 't1', label: 'claude · main', kind: 'cc', status: 'running', dirty: false, active: true },
  { id: 't2', label: 'claude · refactor', kind: 'cc', status: 'idle', dirty: false, active: false },
];
const TERM_TABS_LOWER = [
  { id: 's1', label: 'dev server',   kind: 'shell', status: 'running', dirty: false, active: true },
  { id: 's2', label: 'test:watch',   kind: 'shell', status: 'running', dirty: false, active: false },
  { id: 's3', label: 'shell',         kind: 'shell', status: 'idle',   dirty: false, active: false },
];

const FILE_TREE = [
  { type: 'dir',  depth: 0, name: 'src',                open: true },
  { type: 'dir',  depth: 1, name: 'renderer',           open: true },
  { type: 'dir',  depth: 2, name: 'components',         open: true },
  { type: 'dir',  depth: 3, name: 'Layout',             open: true },
  { type: 'file', depth: 4, name: 'ChatOnlyShell.tsx',  badge: 'M' },
  { type: 'file', depth: 4, name: 'WorkbenchMenuBar.tsx', badge: null },
  { type: 'dir',  depth: 3, name: 'Terminal',           open: true },
  { type: 'file', depth: 4, name: 'TerminalPane.tsx',   badge: 'M' },
  { type: 'file', depth: 4, name: 'CommandBlockOverlayBody.tsx', badge: null },
  { type: 'file', depth: 4, name: 'RichInputBody.tsx',  badge: null },
  { type: 'dir',  depth: 2, name: 'styles',             open: true },
  { type: 'file', depth: 3, name: 'tokens.css',         badge: 'M' },
  { type: 'file', depth: 3, name: 'globals.css',        badge: null },
  { type: 'dir',  depth: 2, name: 'themes',             open: false },
  { type: 'dir',  depth: 0, name: 'roadmap',            open: false },
  { type: 'file', depth: 0, name: 'package.json',       badge: null },
  { type: 'file', depth: 0, name: 'CLAUDE.md',          badge: 'A' },
];

// Hook events — the things we KNOW about reliably (PreToolUse / PostToolUse / Stop)
const HOOK_EVENTS = [
  { id: 'e1', t: -312, kind: 'prompt', text: 'refactor TerminalPane to use the new hook event API', tokens: 14 },
  { id: 'e2', t: -298, kind: 'tool',   tool: 'Read',  target: 'src/renderer/components/Terminal/TerminalPane.tsx', duration: 240, lines: 412, status: 'ok' },
  { id: 'e3', t: -284, kind: 'tool',   tool: 'Read',  target: 'src/renderer/components/Terminal/CommandBlockOverlayBody.tsx', duration: 180, lines: 286, status: 'ok' },
  { id: 'e4', t: -271, kind: 'tool',   tool: 'Grep',  target: 'hookEvent', files: 12, matches: 38, duration: 320, status: 'ok' },
  { id: 'e5', t: -255, kind: 'think',  text: 'The TerminalPane currently parses xterm scrollback to surface tool calls. With hooks I can replace this with a subscription to the PostToolUse event.', dur: 4200 },
  { id: 'e6', t: -240, kind: 'tool',   tool: 'Edit',  target: 'src/renderer/components/Terminal/TerminalPane.tsx', adds: 28, dels: 12, duration: 410, status: 'ok' },
  { id: 'e7', t: -222, kind: 'tool',   tool: 'Bash',  target: 'pnpm typecheck', duration: 1340, status: 'ok', exitCode: 0 },
  { id: 'e8', t: -201, kind: 'tool',   tool: 'Edit',  target: 'src/renderer/hooks/useHookSubscription.ts', adds: 64, dels: 0, duration: 380, status: 'ok' },
  { id: 'e9', t: -184, kind: 'tool',   tool: 'Bash',  target: 'pnpm test:run terminal', duration: 4200, status: 'warn', exitCode: 0, note: '2 snapshots updated' },
  { id: 'e10', t: -160, kind: 'tool',  tool: 'Read',  target: 'src/renderer/components/Terminal/RichInputBody.tsx', duration: 120, lines: 168, status: 'ok' },
  { id: 'e11', t: -141, kind: 'tool',  tool: 'Edit',  target: 'src/renderer/components/Terminal/RichInputBody.tsx', adds: 18, dels: 9, duration: 290, status: 'ok' },
  { id: 'e12', t: -12,  kind: 'tool',  tool: 'Edit',  target: 'src/renderer/components/Terminal/TerminalPane.tsx', adds: 6, dels: 4, duration: 0, status: 'running' },
];

// Files touched this session (derived from hook events normally)
const FILES_TOUCHED = [
  { path: 'src/renderer/components/Terminal/TerminalPane.tsx', adds: 34, dels: 16, status: 'editing' },
  { path: 'src/renderer/hooks/useHookSubscription.ts',         adds: 64, dels: 0,  status: 'edited' },
  { path: 'src/renderer/components/Terminal/RichInputBody.tsx',adds: 18, dels: 9,  status: 'edited' },
  { path: 'src/renderer/components/Terminal/CommandBlockOverlayBody.tsx', adds: 0, dels: 0, status: 'read' },
];

// Recent diff hunk (shown in sidebar)
const DIFF_HUNK = [
  { type: 'ctx', n: 84,  text: '  useEffect(() => {' },
  { type: 'del', n: 85,  text: '    const lines = parseXtermBuffer(term.buffer)' },
  { type: 'del', n: 86,  text: '    const calls = extractToolCalls(lines)' },
  { type: 'add', n: 85,  text: '    const unsubscribe = hooks.on(\'PostToolUse\', (e) => {' },
  { type: 'add', n: 86,  text: '      setCommandBlocks((prev) => [...prev, fromHookEvent(e)])' },
  { type: 'add', n: 87,  text: '    })' },
  { type: 'ctx', n: 88,  text: '    setBlocks(calls)' },
  { type: 'ctx', n: 89,  text: '  }, [term])' },
];

// ── CC TUI mock content (the sealed-box terminal) ──────────────────────────
const CC_TUI_LINES = [
  { c: 'dim', t: '╭──────────────────────────────────────────────────────────────────╮' },
  { c: 'dim', t: '│' },
  { c: 'mix', parts: [
    { c: 'dim', t: '│  ' },
    { c: 'acc bold', t: '✻ ' },
    { c: 'ink2', t: 'Welcome to ' },
    { c: 'acc bold', t: 'Claude Code' },
    { c: 'ink2', t: ' · ' },
    { c: 'dim', t: 'sonnet-4.5' },
  ]},
  { c: 'dim', t: '│' },
  { c: 'mix', parts: [
    { c: 'dim', t: '│  ' },
    { c: 'ink2', t: 'cwd: ' },
    { c: 'info', t: '~/projects/agent-ide' },
  ]},
  { c: 'dim', t: '│' },
  { c: 'dim', t: '╰──────────────────────────────────────────────────────────────────╯' },
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'acc', t: '> ' },
    { c: 'ink', t: 'refactor TerminalPane to use the new hook event API' },
  ]},
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'dim', t: '⏺ ' },
    { c: 'pur', t: 'Read' },
    { c: 'dim', t: '(' },
    { c: 'ink2', t: 'src/renderer/components/Terminal/TerminalPane.tsx' },
    { c: 'dim', t: ')' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '  ⎿  Read 412 lines' },
  ]},
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'dim', t: '⏺ ' },
    { c: 'pur', t: 'Grep' },
    { c: 'dim', t: '(' },
    { c: 'ink2', t: 'pattern: "hookEvent", glob: "**/*.ts"' },
    { c: 'dim', t: ')' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '  ⎿  Found 38 matches in 12 files' },
  ]},
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'ink2 bold', t: '✻ Thinking…' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '  The TerminalPane currently parses xterm scrollback to surface' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '  tool calls. With hooks I can replace that with a subscription.' },
  ]},
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'dim', t: '⏺ ' },
    { c: 'pur', t: 'Edit' },
    { c: 'dim', t: '(' },
    { c: 'ink2', t: 'src/renderer/components/Terminal/TerminalPane.tsx' },
    { c: 'dim', t: ')' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '  ⎿  ' },
    { c: 'ok',  t: '+28' },
    { c: 'dim', t: ' ' },
    { c: 'err', t: '-12' },
    { c: 'dim', t: '   (replace parseXtermBuffer with hooks.on)' },
  ]},
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'dim', t: '⏺ ' },
    { c: 'pur', t: 'Bash' },
    { c: 'dim', t: '(' },
    { c: 'ink2', t: 'pnpm typecheck' },
    { c: 'dim', t: ')' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '  ⎿  ' },
    { c: 'ok', t: '✓ no errors found ' },
    { c: 'dim', t: '(1.3s)' },
  ]},
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'ink', t: 'Replaced the scrollback parser with a ' },
    { c: 'acc', t: 'PostToolUse' },
    { c: 'ink', t: ' hook subscription.' },
  ]},
  { c: 'mix', parts: [
    { c: 'ink', t: 'The new ' },
    { c: 'pur', t: 'useHookSubscription' },
    { c: 'ink', t: ' wraps the event source. Running' },
  ]},
  { c: 'mix', parts: [
    { c: 'ink', t: 'tests now…' },
  ]},
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'dim', t: '⏺ ' },
    { c: 'pur', t: 'Bash' },
    { c: 'dim', t: '(' },
    { c: 'ink2', t: 'pnpm test:run terminal' },
    { c: 'dim', t: ')' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '  ⎿  ' },
    { c: 'warn', t: '✓ 24 passed · 2 snapshots updated ' },
    { c: 'dim', t: '(4.2s)' },
  ]},
];

// Shell mock output
const SHELL_LINES = [
  { c: 'mix', parts: [
    { c: 'ok', t: '➜ ' },
    { c: 'info', t: 'agent-ide ' },
    { c: 'pur', t: 'git:(' },
    { c: 'warn', t: 'wave/96-glass-pivot' },
    { c: 'pur', t: ') ' },
    { c: 'err', t: '✗ ' },
    { c: 'ink', t: 'pnpm dev' },
  ]},
  { c: 'sp', t: '' },
  { c: 'ink2', t: '> agent-ide@1.7.4 dev' },
  { c: 'ink2', t: '> electron-vite dev --watch' },
  { c: 'sp', t: '' },
  { c: 'mix', parts: [
    { c: 'dim', t: '14:32:08 ' },
    { c: 'info', t: '[vite]' },
    { c: 'ink', t: ' main process built in 412ms' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '14:32:08 ' },
    { c: 'info', t: '[vite]' },
    { c: 'ink', t: ' preload built in 188ms' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '14:32:09 ' },
    { c: 'info', t: '[vite]' },
    { c: 'ink', t: ' renderer ready on ' },
    { c: 'acc', t: 'http://localhost:5173' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '14:32:11 ' },
    { c: 'ok', t: '[hmr]' },
    { c: 'ink', t: ' TerminalPane.tsx updated (1.4ms)' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '14:32:18 ' },
    { c: 'ok', t: '[hmr]' },
    { c: 'ink', t: ' useHookSubscription.ts created' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '14:32:18 ' },
    { c: 'ok', t: '[hmr]' },
    { c: 'ink', t: ' tokens.css updated (0.8ms)' },
  ]},
  { c: 'mix', parts: [
    { c: 'dim', t: '14:32:34 ' },
    { c: 'warn', t: '[hooks]' },
    { c: 'ink', t: ' PostToolUse: Edit · TerminalPane.tsx' },
  ]},
];

// ── Reusable pieces ────────────────────────────────────────────────────────

function ToolGlyph({ tool, size = 12 }) {
  const map = {
    Read: { Comp: Icon.Read,  color: 'var(--info)' },
    Edit: { Comp: Icon.Edit,  color: 'var(--accent)' },
    Bash: { Comp: Icon.Bash,  color: 'var(--success)' },
    Grep: { Comp: Icon.Grep,  color: 'var(--purple)' },
    Glob: { Comp: Icon.Glob,  color: 'var(--purple)' },
    Write: { Comp: Icon.Write, color: 'var(--warning)' },
    WebFetch: { Comp: Icon.Web, color: 'var(--info)' },
  };
  const { Comp, color } = map[tool] || map.Read;
  return <span style={{ color, display: 'inline-flex' }}><Comp size={size} /></span>;
}

function TermLine({ line }) {
  if (line.c === 'sp') return <div className="wb-term-line" style={{ height: 6 }}>&nbsp;</div>;
  if (line.c === 'mix') {
    return (
      <div className="wb-term-line">
        {line.parts.map((p, i) => <span key={i} className={p.c}>{p.t}</span>)}
      </div>
    );
  }
  return <div className={`wb-term-line ${line.c}`}>{line.t}</div>;
}

// Export to window for cross-script access
Object.assign(window, {
  Icon, ToolGlyph, TermLine,
  PROJECTS, TERM_TABS_UPPER, TERM_TABS_LOWER, FILE_TREE,
  HOOK_EVENTS, FILES_TOUCHED, DIFF_HUNK,
  CC_TUI_LINES, SHELL_LINES,
});
