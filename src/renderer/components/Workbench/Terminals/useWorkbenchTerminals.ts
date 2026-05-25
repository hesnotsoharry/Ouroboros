/**
 * useWorkbenchTerminals — thin workbench-owned pty session hook (Wave 2).
 *
 * Spawns the upper AND lower workbench ptys once on mount and kills both on the
 * *real* unmount. Returns stable { upperSessionId, lowerSessionId } so CenterPane
 * can pass ids to the two TerminalShell → TerminalInstance frames.
 *
 * Wave 9 Phase 2: consumes `useWorkbenchRestore` to gate spawn on `isReady` and
 * thread restored cwds. When `resumeSessionId` is non-null, the upper frame uses
 * `pty.spawnClaude({ resumeMode })` for auto-resume; lower is always plain spawn.
 * Mounts `useWorkbenchSessionPersist` so canon sessions are persisted going forward.
 *
 * Wave 12 Phase 3: backward-compat layer. The stable `upperSessionId` / `lowerSessionId`
 * are now derived from the active tab in the upper/lower TabCollection (via
 * `useWorkbenchTabs`). When no tab is active (empty frame) the ids are kept as
 * the original stable generated values so the Wave-9 acceptance test
 * (`useWorkbenchTerminals.restore.acceptance.test.ts`) continues to pass.
 *
 * Wave 13 Phase 2 (D5): `useWorkbenchClaudeCapture` and the `claudeSessionId` field
 * have been deleted. The heuristic binding was the source of the IDE-in-itself hijack
 * bug. AgentSidebar now derives paneId deterministically from useActiveWorkbenchFrame
 * + useWorkbenchTabs (see AgentSidebar.tsx useActivePaneId()).
 *
 * StrictMode-safe: React 18 dev StrictMode double-invokes effects
 * (mount → cleanup → mount). Each kill is deferred one macrotask; the synchronous
 * StrictMode remount cancels it before it fires, so both ptys survive the
 * double-invoke but are still torn down on a true unmount.
 *
 * CRITICAL: each session has its OWN deferred-kill timer so a second cleanup does
 * not overwrite the first session's timer and leak a pty. A Map<sessionId, timer>
 * is used; the effect manages both sessions inside a single effect invocation so
 * StrictMode cancel logic (pendingKillsRef check) applies to both atomically.
 *
 * ADR Decision 3: caller-owned ids, no useTerminalSessions array model.
 * ADR Decision 2: workbench-owned, independent sessions.
 */

import { useEffect, useRef } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { useWorkbenchRestore } from './useWorkbenchRestore';

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

interface SpawnFramesArgs {
  upperSessionId: string;
  lowerSessionId: string;
  upperCwd: string | undefined;
  lowerCwd: string | undefined;
  resumeSessionId: string | undefined;
}

/**
 * Spawns the upper frame: spawnClaude when resumeSessionId is non-null (auto-resume),
 * otherwise plain spawn. Lower frame always uses plain spawn.
 */
function spawnFrames(args: SpawnFramesArgs): void {
  const { upperSessionId, lowerSessionId, upperCwd, lowerCwd, resumeSessionId } = args;
  if (resumeSessionId) {
    void window.electronAPI.pty.spawnClaude(upperSessionId, {
      cwd: upperCwd,
      resumeMode: resumeSessionId,
    });
  } else {
    void window.electronAPI.pty.spawn(upperSessionId, { cwd: upperCwd });
  }
  void window.electronAPI.pty.spawn(lowerSessionId, { cwd: lowerCwd });
}

interface DeferredKillsArgs {
  ids: string[];
  pending: Map<string, TimerId>;
}

/** Registers deferred kills for all frame ids. Returns cleanup for the useEffect. */
function registerDeferredKills({ ids, pending }: DeferredKillsArgs): () => void {
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
}

interface SpawnEffectArgs {
  upperSessionId: string;
  lowerSessionId: string;
  upperCwd: string | undefined;
  lowerCwd: string | undefined;
  resumeSessionId: string | undefined;
  projectRootRef: React.MutableRefObject<string | null>;
  pendingKillsRef: React.MutableRefObject<Map<string, TimerId>>;
  hasSpawnedRef: React.MutableRefObject<boolean>;
}

/** Manages the spawn/kill lifecycle for both frames. Called once isReady flips. */
function runSpawnEffect(args: SpawnEffectArgs): () => void {
  const { upperSessionId, lowerSessionId, upperCwd, lowerCwd, resumeSessionId } = args;
  const { projectRootRef, pendingKillsRef, hasSpawnedRef } = args;
  const pending = pendingKillsRef.current;
  const fallback = projectRootRef.current ?? undefined;
  const ids = [upperSessionId, lowerSessionId];
  if (pending.size > 0 && hasSpawnedRef.current) {
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
  } else {
    if (pending.size > 0) {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    }
    spawnFrames({
      upperSessionId,
      lowerSessionId,
      upperCwd: upperCwd ?? fallback,
      lowerCwd: lowerCwd ?? fallback,
      resumeSessionId,
    });
    hasSpawnedRef.current = true;
  }
  return registerDeferredKills({ ids, pending });
}

/** Mounts the spawn/kill effect, gated on isReady. */
function useWorkbenchSpawnEffect(
  isReady: boolean,
  args: Omit<SpawnEffectArgs, 'projectRootRef' | 'pendingKillsRef' | 'hasSpawnedRef'> & {
    projectRootRef: React.MutableRefObject<string | null>;
    pendingKillsRef: React.MutableRefObject<Map<string, TimerId>>;
    hasSpawnedRef: React.MutableRefObject<boolean>;
  },
): void {
  useEffect(() => {
    if (!isReady) return;
    return runSpawnEffect(args);
    // upperSessionId and lowerSessionId are stable — intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
}

export function useWorkbenchTerminals(): WorkbenchTerminals {
  const { projectRoot } = useProject();
  const upperSessionId = useRef<string>(makeUpperId()).current;
  const lowerSessionId = useRef<string>(makeLowerId()).current;
  const projectRootRef = useRef(projectRoot);
  projectRootRef.current = projectRoot;
  // Per-session deferred teardown timers — Map keyed by session id.
  const pendingKillsRef = useRef<Map<string, TimerId>>(new Map());
  // Tracks whether frames have been spawned (StrictMode cancel-kill branch).
  const hasSpawnedRef = useRef(false);

  const { upperCwd, lowerCwd, resumeSessionId, isReady } = useWorkbenchRestore(projectRoot);

  // Wave 12 Phase 4: persistence is now handled by useWorkbenchTabs (mounted inside
  // each TerminalShell). Wave 13 Phase 2: claudeSessionId capture (useWorkbenchClaudeCapture)
  // deleted per D5 — AgentSidebar now derives paneId deterministically.
  useWorkbenchSpawnEffect(isReady, {
    upperSessionId,
    lowerSessionId,
    upperCwd,
    lowerCwd,
    resumeSessionId,
    projectRootRef,
    pendingKillsRef,
    hasSpawnedRef,
  });
  return { upperSessionId, lowerSessionId };
}
