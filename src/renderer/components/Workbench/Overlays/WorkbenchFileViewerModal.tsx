/**
 * WorkbenchFileViewerModal — File viewer modal for the canon Workbench shell.
 *
 * Wave 8 Phase 3. Mirrors the Wave 7 Overlays/ pattern.
 *
 * Mounts FileViewer directly (NOT via FileViewerManager) to avoid registering
 * duplicate global DOM listeners ('agent-ide:open-file' etc.) that collide with
 * the legacy shell's FileViewerManager while it is still mounted (Wave 8).
 *
 * Opened by WorkbenchFilePicker (via setOpenFilePath in Workbench.tsx) after
 * the user selects a file in the quick-open palette.
 */

import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useProjectOptional } from '../../../contexts/ProjectContext';
import {
  isAudioFile,
  isImageFile,
  isPdfFile,
  isVideoFile,
  looksLikeBinary,
} from '../../FileViewer/FileViewerManager.helpers';
// Lazy-load FileViewer to keep Monaco/pdfjs out of the Workbench shell's static
// import graph. The dynamic import() only fires when openFilePath is non-null
// (the modal is open), so shell tests and the initial bundle stay Monaco-free.
// FileViewer is a named export — wrap in { default } for React.lazy.
const FileViewer = React.lazy(
  () => import('../../FileViewer/FileViewer').then((m) => ({ default: m.FileViewer })),
);

// ── File-load state ───────────────────────────────────────────────────────────

interface FileLoadState {
  content: string | null;
  binaryContent: Uint8Array | undefined;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
}

const INITIAL_STATE: FileLoadState = {
  content: null,
  binaryContent: undefined,
  isLoading: false,
  error: null,
  isDirty: false,
};

// ── Binary-only file (image/pdf/audio/video) — no content to fetch ────────────

function buildSpecialViewerState(): FileLoadState {
  return { content: null, binaryContent: undefined, isLoading: false, error: null, isDirty: false };
}

// ── Text read → binary fallback ───────────────────────────────────────────────

async function readAsTextOrBinary(path: string): Promise<Partial<FileLoadState>> {
  const result = await window.electronAPI.files.readFile(path);
  if (!result.success) {
    return { content: null, binaryContent: undefined, isLoading: false, error: result.error ?? 'Failed to read file' };
  }
  const text = result.content ?? '';
  if (looksLikeBinary(text)) {
    const binResult = await window.electronAPI.files.readBinaryFile(path);
    const bytes = binResult.success && binResult.content ? new Uint8Array(binResult.content) : undefined;
    return { content: null, binaryContent: bytes, isLoading: false, error: null };
  }
  return { content: text, binaryContent: undefined, isLoading: false, error: null };
}

// ── File-load hook ────────────────────────────────────────────────────────────

function useWorkbenchFileLoad(filePath: string | null): FileLoadState & {
  reload: () => void;
  handleContentChange: (c: string) => void;
  handleSave: (c: string) => Promise<void>;
} {
  const [state, setState] = useState<FileLoadState>(INITIAL_STATE);
  const loadCount = useRef(0);

  const load = useCallback((path: string): void => {
    const token = ++loadCount.current;
    setState({ ...INITIAL_STATE, isLoading: true });

    const isSpecial = isImageFile(path) || isPdfFile(path) || isAudioFile(path) || isVideoFile(path);
    if (isSpecial) {
      if (token !== loadCount.current) return;
      setState(buildSpecialViewerState());
      return;
    }

    void readAsTextOrBinary(path).then((partial) => {
      if (token !== loadCount.current) return;
      setState((prev) => ({ ...prev, isDirty: false, ...partial }));
    });
  }, []);

  useEffect(() => {
    if (!filePath) { setState(INITIAL_STATE); return; }
    load(filePath);
  }, [filePath, load]);

  const reload = useCallback((): void => {
    if (filePath) load(filePath);
  }, [filePath, load]);

  const handleContentChange = useCallback((c: string): void => {
    setState((prev) => ({ ...prev, content: c, isDirty: true }));
  }, []);

  const handleSave = useCallback(async (c: string): Promise<void> => {
    if (!filePath) return;
    const result = await window.electronAPI.files.saveFile(filePath, c);
    if (result.success) setState((prev) => ({ ...prev, content: c, isDirty: false }));
  }, [filePath]);

  return { ...state, reload, handleContentChange, handleSave };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9000,
  background: 'rgba(0,0,0,0.48)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const panelStyle: React.CSSProperties = {
  position: 'relative',
  width: '80vw',
  height: '80vh',
  maxWidth: 1200,
  background: 'var(--glass-panel)',
  border: '1px solid var(--stroke-inner)',
  borderRadius: 'var(--r-md)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 10,
  zIndex: 1,
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-3)',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: '2px 6px',
};

const viewerWrapStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
};

// ── Dirty-close guard ─────────────────────────────────────────────────────────

function guardClose(isDirty: boolean, onClose: () => void): void {
  if (isDirty && !window.confirm('Discard unsaved changes?')) return;
  onClose();
}

// ── ModalPanel — layout + keyboard + FileViewer wiring ────────────────────────

function useModalKeyboard(isDirty: boolean, onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') guardClose(isDirty, onClose);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // no deps — intentional: re-registers each render so isDirty is current
}

function useMonacoLayoutFix(filePath: string): React.RefObject<HTMLDivElement | null> {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      // Monaco measures its container at mount; dispatch resize so its
      // ResizeObserver re-measures the (now visible) modal panel.
      window.dispatchEvent(new Event('resize'));
    });
    return () => cancelAnimationFrame(frame);
  }, [filePath]);
  return viewerRef;
}

// ── Suspense fallback — shown while Monaco chunk loads ────────────────────────

const loadingFallbackStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-3)',
  fontSize: 13,
};

function ViewerLoadingFallback(): React.ReactElement {
  return <div style={loadingFallbackStyle}>Loading…</div>;
}

// ── Viewer slot — FileViewer with derived type flags ─────────────────────────

interface ViewerSlotProps {
  filePath: string;
  projectRoot: string | null;
  loadState: FileLoadState;
  onReload: () => void;
  onContentChange: (c: string) => void;
  onSave: (c: string) => void;
  viewerRef: React.RefObject<HTMLDivElement | null>;
}

function ViewerSlot({
  filePath,
  projectRoot,
  loadState,
  onReload,
  onContentChange,
  onSave,
  viewerRef,
}: ViewerSlotProps): React.ReactElement {
  const { content, binaryContent, isLoading, error, isDirty } = loadState;
  const isImage = isImageFile(filePath);
  const isPdf = isPdfFile(filePath);
  const isAudio = isAudioFile(filePath);
  const isVideo = isVideoFile(filePath);
  const isBinary = !isImage && !isPdf && !isAudio && !isVideo && binaryContent !== undefined;

  return (
    <div ref={viewerRef} style={viewerWrapStyle}>
      <Suspense fallback={<ViewerLoadingFallback />}>
        <FileViewer
          binaryContent={binaryContent}
          content={content}
          error={error}
          filePath={filePath}
          isAudio={isAudio}
          isBinary={isBinary}
          isDirty={isDirty}
          isImage={isImage}
          isLoading={isLoading}
          isPdf={isPdf}
          isVideo={isVideo}
          projectRoot={projectRoot}
          onContentChange={onContentChange}
          onReload={onReload}
          onSave={onSave}
        />
      </Suspense>
    </div>
  );
}

// ── ModalPanel — modal frame, keyboard, dirty guard ───────────────────────────

/**
 * Inner panel — rendered only when filePath is non-null.
 */
function ModalPanel({
  filePath,
  onClose,
}: {
  filePath: string;
  onClose: () => void;
}): React.ReactElement {
  const projectContext = useProjectOptional();
  const projectRoot = projectContext?.projectRoot ?? null;

  const { handleContentChange, handleSave, reload, ...loadState } = useWorkbenchFileLoad(filePath);
  const { isDirty } = loadState;

  const viewerRef = useMonacoLayoutFix(filePath);
  useModalKeyboard(isDirty, onClose);

  const handleClose = useCallback((): void => guardClose(isDirty, onClose), [isDirty, onClose]);
  const handleSaveCallback = useCallback((c: string): void => { void handleSave(c); }, [handleSave]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose],
  );

  return (
    <div aria-modal="true" role="dialog" style={backdropStyle} onClick={handleBackdropClick}>
      <div style={panelStyle}>
        <button aria-label="Close file viewer" style={closeBtnStyle} title="Close" onClick={handleClose}>
          ×
        </button>
        <ViewerSlot
          filePath={filePath}
          loadState={loadState}
          projectRoot={projectRoot}
          viewerRef={viewerRef}
          onContentChange={handleContentChange}
          onReload={reload}
          onSave={handleSaveCallback}
        />
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface WorkbenchFileViewerModalProps {
  openFilePath: string | null;
  onClose: () => void;
}

export function WorkbenchFileViewerModal({
  openFilePath,
  onClose,
}: WorkbenchFileViewerModalProps): React.ReactElement | null {
  if (!openFilePath) return null;
  return <ModalPanel filePath={openFilePath} onClose={onClose} />;
}
