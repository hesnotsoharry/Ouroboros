/**
 * useWorkbenchTerminals — thin workbench-owned pty session hook (Wave 2).
 *
 * Spawns the upper workbench pty once on mount and kills it on the *real*
 * unmount. Returns a stable { upperSessionId } so CenterPane can pass the id to
 * TerminalShell → TerminalInstance.
 *
 * StrictMode-safe: React 18 dev StrictMode double-invokes effects
 * (mount → cleanup → mount). A naive spawn-on-mount / kill-on-cleanup hook would
 * kill the pty on the first (synthetic) cleanup. Here the kill is deferred one
 * macrotask; the synchronous StrictMode remount cancels it before it fires, so
 * the pty survives the double-invoke but is still torn down on a true unmount.
 *
 * ADR Decision 3: caller-owned ids, no useTerminalSessions array model.
 * ADR Decision 2: workbench-owned, independent sessions.
 */

import { useEffect, useRef } from 'react';

import { useProject } from '../../../contexts/ProjectContext';

function makeUpperId(): string {
  return `wb-cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface WorkbenchTerminals {
  upperSessionId: string;
}

export function useWorkbenchTerminals(): WorkbenchTerminals {
  const { projectRoot } = useProject();
  // Stable id generated once — useRef initializer runs only on mount.
  const upperSessionId = useRef<string>(makeUpperId()).current;
  // Latest cwd, read at spawn time without re-running the effect.
  const projectRootRef = useRef(projectRoot);
  projectRootRef.current = projectRoot;
  // A deferred teardown timer; a StrictMode remount cancels it.
  const pendingKillRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingKillRef.current !== null) {
      // Remount (StrictMode / fast toggle) — cancel the pending kill, keep the pty.
      clearTimeout(pendingKillRef.current);
      pendingKillRef.current = null;
    } else {
      void window.electronAPI.pty.spawn(upperSessionId, {
        cwd: projectRootRef.current ?? undefined,
      });
    }
    return () => {
      pendingKillRef.current = setTimeout(() => {
        pendingKillRef.current = null;
        void window.electronAPI.pty.kill(upperSessionId);
      }, 0);
    };
    // Empty deps: spawn/teardown is tied to the mount lifecycle, not cwd changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { upperSessionId };
}
