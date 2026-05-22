/**
 * useWorkbenchFileLoad — file-load state for the canon Workbench FileViewer modal.
 *
 * Race-guarded loader: text read with a binary fallback, plus special-viewer
 * (image/pdf/audio/video) detection that skips the content fetch. Split out of
 * WorkbenchFileViewerModal.tsx to keep that file under the max-lines cap.
 */

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  isAudioFile,
  isImageFile,
  isPdfFile,
  isVideoFile,
  looksLikeBinary,
} from '../../FileViewer/FileViewerManager.helpers';

export interface FileLoadState {
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

function buildSpecialViewerState(): FileLoadState {
  return { content: null, binaryContent: undefined, isLoading: false, error: null, isDirty: false };
}

async function readAsTextOrBinary(path: string): Promise<Partial<FileLoadState>> {
  const result = await window.electronAPI.files.readFile(path);
  if (!result.success) {
    return {
      content: null,
      binaryContent: undefined,
      isLoading: false,
      error: result.error ?? 'Failed to read file',
    };
  }
  const text = result.content ?? '';
  if (looksLikeBinary(text)) {
    const binResult = await window.electronAPI.files.readBinaryFile(path);
    // ReadBinaryFileResult exposes `data?: Uint8Array` (already typed bytes), not `content`.
    const bytes = binResult.success ? binResult.data : undefined;
    return { content: null, binaryContent: bytes, isLoading: false, error: null };
  }
  return { content: text, binaryContent: undefined, isLoading: false, error: null };
}

function isSpecialViewerFile(path: string): boolean {
  return isImageFile(path) || isPdfFile(path) || isAudioFile(path) || isVideoFile(path);
}

type SetFileLoadState = Dispatch<SetStateAction<FileLoadState>>;

/** Loads `path` and applies state iff this token is still the latest (race guard). */
async function runFileLoad(
  path: string,
  token: number,
  loadCountRef: MutableRefObject<number>,
  setState: SetFileLoadState,
): Promise<void> {
  if (isSpecialViewerFile(path)) {
    if (token === loadCountRef.current) setState(buildSpecialViewerState());
    return;
  }
  const partial = await readAsTextOrBinary(path);
  if (token === loadCountRef.current) {
    setState((prev) => ({ ...prev, isDirty: false, ...partial }));
  }
}

export interface UseWorkbenchFileLoadReturn extends FileLoadState {
  reload: () => void;
  handleContentChange: (c: string) => void;
  handleSave: (c: string) => Promise<void>;
}

export function useWorkbenchFileLoad(filePath: string | null): UseWorkbenchFileLoadReturn {
  const [state, setState] = useState<FileLoadState>(INITIAL_STATE);
  const loadCount = useRef(0);

  const load = useCallback((path: string): void => {
    const token = ++loadCount.current;
    setState({ ...INITIAL_STATE, isLoading: true });
    void runFileLoad(path, token, loadCount, setState);
  }, []);

  useEffect(() => {
    if (!filePath) {
      setState(INITIAL_STATE);
      return;
    }
    load(filePath);
  }, [filePath, load]);

  const reload = useCallback((): void => {
    if (filePath) load(filePath);
  }, [filePath, load]);

  const handleContentChange = useCallback((c: string): void => {
    setState((prev) => ({ ...prev, content: c, isDirty: true }));
  }, []);

  const handleSave = useCallback(
    async (c: string): Promise<void> => {
      if (!filePath) return;
      const result = await window.electronAPI.files.saveFile(filePath, c);
      if (result.success) setState((prev) => ({ ...prev, content: c, isDirty: false }));
    },
    [filePath],
  );

  return { ...state, reload, handleContentChange, handleSave };
}
