/**
 * useWorkbenchTerminals — thin workbench-owned pty session hook (Wave 2).
 *
 * Spawns the upper AND lower workbench ptys once on mount and kills both on the
 * *real* unmount. Returns stable { upperSessionId, lowerSessionId } so CenterPane
 * can pass ids to the two TerminalShell → TerminalInstance frames.
 *
 * StrictMode-safe: React 18 dev StrictMode double-invokes effects
 * (mount → cleanup → mount). Each kill is deferred one macrotask; the synchronous
 * StrictMode remount cancels it before it fires, so both ptys survive the
 * double-invoke but are still torn down on a true unmount.
 *
 * CRITICAL: each session has its OWN deferred-kill timer so a second cleanup does
 * not overwrite the first session's timer and leak a pty. A Map<sessionId, timer>
 * is used; the effect manages both sessions inside a single effect invocation so
 * StrictMode cancel logic (pendingKillRef check) applies to both atomically.
 *
 * ADR Decision 3: caller-owned ids, no useTerminalSessions array model.
 * ADR Decision 2: workbench-owned, independent sessions.
 */

import { useEffect, useRef } from 'react';

import { useProject } from '../../../contexts/ProjectContext';

type TimerId = ReturnType<typeof setTimeout>;

function makeUpperId(): string {
  return `wb-cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeLowerId(): string {
  return `wb-shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface WorkbenchTerminals {
  upperSessionId: string;
  lowerSessionId: string;
}

export function useWorkbenchTerminals(): WorkbenchTerminals {
  const { projectRoot } = useProject();
  // Stable ids generated once — useRef initializer runs only on mount.
  const upperSessionId = useRef<string>(makeUpperId()).current;
  const lowerSessionId = useRef<string>(makeLowerId()).current;
  // Latest cwd, read at spawn time without re-running the effect.
  const projectRootRef = useRef(projectRoot);
  projectRootRef.current = projectRoot;
  // Per-session deferred teardown timers — Map keyed by session id.
  // A StrictMode remount cancels any pending kill before a new spawn fires.
  const pendingKillsRef = useRef<Map<string, TimerId>>(new Map());

  useEffect(() => {
    const pending = pendingKillsRef.current;
    const cwd = projectRootRef.current ?? undefined;
    const ids = [upperSessionId, lowerSessionId];

    if (pending.size > 0) {
      // Remount (StrictMode / fast toggle) — cancel all pending kills, keep ptys.
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    } else {
      for (const id of ids) {
        void window.electronAPI.pty.spawn(id, { cwd });
      }
    }

    return () => {
      for (const id of ids) {
        const timer = setTimeout(() => {
          pending.delete(id);
          // Guard: electronAPI or pty may be absent if the window is torn down in tests.
          void window.electronAPI?.pty?.kill(id);
        }, 0);
        pending.set(id, timer);
      }
    };
    // Empty deps: spawn/teardown is tied to the mount lifecycle, not cwd changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { upperSessionId, lowerSessionId };
}
