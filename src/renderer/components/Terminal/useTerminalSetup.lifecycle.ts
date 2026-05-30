import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { ImageAddon } from '@xterm/addon-image';
import { ProgressAddon } from '@xterm/addon-progress';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import log from 'electron-log/renderer';

import { INITIAL_SELECTION_TOOLTIP } from './SelectionTooltip';
import { ShellIntegrationAddon } from './shellIntegrationAddon';
import { TERMINAL_ADDONS } from './terminalAddonManifest';
import { buildXtermTheme, getCssVar } from './terminalHelpers';
import { registerFilePathLinks } from './terminalLinkProvider';
import { registerTerminal } from './terminalRegistry';
import type {
  AttachedTerminalDisposables,
  TerminalSetupLifecycleContext,
} from './useTerminalSetup.shared';
import { cleanupTerminalSetup } from './useTerminalSetupCleanup';
import { setupDataBridge, setupInputBridge } from './useTerminalSetupData';
import {
  handleClick,
  handleMouseUp,
  setupCustomKeyHandler,
  setupKeyHandler,
} from './useTerminalSetupInteractions';

export function createBootstrapTerminal(
  context: TerminalSetupLifecycleContext,
): (container: HTMLDivElement) => () => void {
  return function bootstrapTerminal(container: HTMLDivElement): () => void {
    const term = createTerminal(
      context.initialFontSize,
      context.initialCursorStyle,
      context.initialScrollback,
    );
    loadTerminalAddons(context, term, container);
    registerTerminal(context.sessionId, term);
    context.refs.terminalRef.current = term;

    const disposables = attachAllHandlers(context, container, term);
    return () => cleanupTerminalSetup(context, container, term, disposables);
  };
}

function createTerminal(
  fontSize?: number,
  cursorStyle?: 'block' | 'underline' | 'bar',
  scrollback?: number,
): Terminal {
  const opts = {
    fontFamily: getCssVar('--font-mono') || 'monospace',
    fontSize: fontSize ?? 13,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: cursorStyle ?? ('block' as const),
    cursorInactiveStyle: 'none' as const,
    scrollback: scrollback ?? 50000,
    allowProposedApi: true,
    // allowTransparency:true enables the tinted-well canvas for themes that set a well
    // (e.g. Modern: rgba(6,8,16,0.62)). The DOM renderer (now the sole renderer) honours
    // this flag correctly — transparency shows through to the glass/Mica behind.
    // The WebGL renderer ignored it (composited opaque per xterm #1004), which is why
    // WebGL was dropped. Themes WITHOUT a well (cursor, kiro, light, high-contrast)
    // resolve --term-canvas-bg to --palette-term-bg (#0c0c0e, opaque) → no change.
    // RISK: Claude TUI fill-bg cells may composite against Mica with a translucent canvas.
    // Revert to false if live verification shows broken status boxes (Wave 95 ADR D4).
    allowTransparency: true,
    theme: buildXtermTheme(),
  };
  return new Terminal(opts);
}

// ── Pre-open addon loading ────────────────────────────────────────────────────

function loadPreOpenAddons(term: Terminal): { fitAddon: FitAddon; searchAddon: SearchAddon } {
  const preOpenEntries = TERMINAL_ADDONS.filter((e) => e.loadOrder === 'pre-open');
  let fitAddon: FitAddon | null = null;
  let searchAddon: SearchAddon | null = null;

  for (const entry of preOpenEntries) {
    try {
      const instance = buildPreOpenAddon(entry.packageName);
      if (instance) term.loadAddon(instance);
      if (entry.packageName === '@xterm/addon-fit') fitAddon = instance as FitAddon;
      if (entry.packageName === '@xterm/addon-search') searchAddon = instance as SearchAddon;
    } catch (err) {
      if (entry.required) throw err;
      log.warn(`[terminal:addon] optional pre-open addon failed: ${entry.packageName}`, err);
    }
  }

  if (!fitAddon) throw new Error('[terminal] FitAddon failed — terminal cannot function');
  if (!searchAddon) throw new Error('[terminal] SearchAddon failed — terminal cannot function');
  return { fitAddon, searchAddon };
}

function buildPreOpenAddon(packageName: string): FitAddon | SearchAddon | WebLinksAddon | null {
  if (packageName === '@xterm/addon-fit') return new FitAddon();
  if (packageName === '@xterm/addon-search') return new SearchAddon();
  if (packageName === '@xterm/addon-web-links') {
    return new WebLinksAddon((_event, uri) => {
      void window.electronAPI.app.openExternal(uri);
    });
  }
  return null;
}

// ── Post-open addon loading ───────────────────────────────────────────────────

// DOM renderer is now the sole renderer (transparency support for glass themes +
// single-renderer simplicity). WebGL was dropped because xterm's WebGL renderer
// composites the canvas opaque regardless of allowTransparency (xterm #1004);
// the DOM renderer honours it correctly, enabling the tinted-well/glass aesthetic.
// The @xterm/addon-webgl package + patches/ remain installed but are not loaded —
// removal is tracked in roadmap/follow-ups/2026-05-21-remove-xterm-webgl-dependency.md.

function buildPostOpenAddon(
  packageName: string,
  context: TerminalSetupLifecycleContext,
  term: Terminal,
): ImageAddon | ClipboardAddon | SerializeAddon | ProgressAddon | null {
  if (packageName === '@xterm/addon-image') {
    return new ImageAddon({
      sixelPaletteLimit: 512,
      sixelSizeLimit: 25000000,
      enableSizeReports: true,
    });
  }
  if (packageName === '@xterm/addon-clipboard') return new ClipboardAddon();
  if (packageName === '@xterm/addon-serialize') {
    const s = new SerializeAddon();
    context.refs.serializeAddonRef.current = s;
    return s;
  }
  if (packageName === '@xterm/addon-unicode-graphemes') {
    const u = new UnicodeGraphemesAddon();
    term.loadAddon(u);
    // UnicodeGraphemesAddon registers version '15-graphemes' (not 'graphemes').
    term.unicode.activeVersion = '15-graphemes';
    return null; // already loaded inline
  }
  if (packageName === '@xterm/addon-progress') {
    const p = new ProgressAddon();
    context.refs.progressAddonRef.current = p;
    return p;
  }
  return null;
}

function loadPostOpenAddons(context: TerminalSetupLifecycleContext, term: Terminal): void {
  for (const entry of TERMINAL_ADDONS.filter((e) => e.loadOrder === 'post-open')) {
    try {
      const instance = buildPostOpenAddon(entry.packageName, context, term);
      if (instance) term.loadAddon(instance);
    } catch (err) {
      if (entry.required) throw err;
      log.warn(`[terminal:addon] optional post-open addon failed: ${entry.packageName}`, err);
    }
  }

  loadShellIntegrationAddon(context, term);
}

function loadShellIntegrationAddon(context: TerminalSetupLifecycleContext, term: Terminal): void {
  try {
    const shellIntegrationAddon = new ShellIntegrationAddon();
    term.loadAddon(shellIntegrationAddon);
    context.refs.shellIntegrationAddonRef.current = shellIntegrationAddon;
  } catch (err) {
    log.warn('[terminal:addon] shell integration addon failed', err);
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

function loadTerminalAddons(
  context: TerminalSetupLifecycleContext,
  term: Terminal,
  container: HTMLDivElement,
): void {
  const { fitAddon, searchAddon } = loadPreOpenAddons(term);
  // Pre-open addons (FitAddon, SearchAddon, WebLinksAddon) load before
  // term.open(); post-open addons (WebGL, Image, Clipboard, etc.) load after.
  term.open(container);
  loadPostOpenAddons(context, term);
  context.refs.fitAddonRef.current = fitAddon;
  context.refs.searchAddonRef.current = searchAddon;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function attachAllHandlers(
  context: TerminalSetupLifecycleContext,
  container: HTMLDivElement,
  term: Terminal,
): AttachedTerminalDisposables {
  const terminalDisposables = createTerminalDisposables(context, term);
  const containerHandlers = attachContainerHandlers(context, container, term);
  const selD = term.onSelectionChange(() => {
    if (!term.getSelection()) context.callbacks.setSelectionTooltip(INITIAL_SELECTION_TOOLTIP);
  });
  const ro = createReadyObserver(context, container);
  return { ...terminalDisposables, ...containerHandlers, selD, ro };
}

function createTerminalDisposables(
  context: TerminalSetupLifecycleContext,
  term: Terminal,
): Omit<AttachedTerminalDisposables, 'clickHandler' | 'mouseUpHandler' | 'selD' | 'ro'> {
  return {
    filePathLink: registerFilePathLinks(term, () => context.projectRootRef.current),
    oscFg: term.parser.registerOscHandler(10, (data: string) => {
      log.info('[trace:osc] OSC 10 received', { data, sessionId: context.sessionId });
      return true;
    }),
    oscBg: term.parser.registerOscHandler(11, (data: string) => {
      log.info('[trace:osc] OSC 11 received', { data, sessionId: context.sessionId });
      return true;
    }),
    oscCursor: term.parser.registerOscHandler(12, (data: string) => {
      log.info('[trace:osc] OSC 12 received', { data, sessionId: context.sessionId });
      return true;
    }),
    titleD: term.onTitleChange((title) =>
      context.callbacks.onTitleChange?.(context.sessionId, title),
    ),
    dataCleanup: setupDataBridge(context, term),
    inputD: setupInputBridge(context, term),
    histKeyD: setupKeyHandler(context, term),
  };
}

function attachContainerHandlers(
  context: TerminalSetupLifecycleContext,
  container: HTMLDivElement,
  term: Terminal,
): Pick<AttachedTerminalDisposables, 'clickHandler' | 'mouseUpHandler'> {
  setupCustomKeyHandler(context, term);
  const clickHandler = (event: MouseEvent) =>
    handleClick(context.runtimeRefs, event, container, term);
  const mouseUpHandler = (event: MouseEvent) => handleMouseUp(context, event, term);
  container.addEventListener('click', clickHandler);
  container.addEventListener('mouseup', mouseUpHandler);
  return { clickHandler, mouseUpHandler };
}

function createReadyObserver(
  context: TerminalSetupLifecycleContext,
  container: HTMLDivElement,
): ResizeObserver {
  const ro = new ResizeObserver(() => context.fit());
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      context.refs.isReadyRef.current = true;
      ro.observe(container);
      context.fit();
    });
  });
  return ro;
}
