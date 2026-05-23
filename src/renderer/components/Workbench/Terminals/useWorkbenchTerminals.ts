/**
 * useWorkbenchTerminals — thin workbench-owned pty session hook (Wave 2).
 *
 * Spawns the upper AND lower workbench ptys once on mount and kills both on the
 * *real* unmount. Returns stable { upperSessionId, lowerSessionId } so CenterPane
 * can pass ids to the two TerminalShell → TerminalInstance frames.
 *
 * Wave 8 Phase 1: also returns `claudeSessionId` — the Claude hook session ID
 * captured from the upper (wb-cc-*) terminal. Starts null; populated when the first
 * binding-class agent event arrives from that terminal. Mirrors the capture heuristic
 * in `useClaudeSessionCapture` (src/renderer/hooks/useTerminalSessions.sync.ts) but
 * stores state locally (string | null) without the legacy TerminalSession[] model.
 *
 * Wave 9 Phase 2: consumes `useWorkbenchRestore` to gate spawn on `isReady` and
 * thread restored cwds. When `resumeSessionId` is non-null, the upper frame uses
 * `pty.spawnClaude({ resumeMode })` for auto-resume; lower is always plain spawn.
 * Mounts `useWorkbenchSessionPersist` so canon sessions are persisted going forward.
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

import { useEffect, useRef, useState } from 'react';

import { useProject } from '../../../contexts/ProjectContext';
import { TERMINAL_BIND_TRIGGER_TYPES } from '../../../hooks/useTerminalSessions.sync.helpers';
import { useWorkbenchRestore } from './useWorkbenchRestore';
import { useWorkbenchSessionPersist } from './useWorkbenchSessionPersist';

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
  /** The Claude hook session ID bound to the upper (wb-cc-*) terminal. Null until captured. */
  claudeSessionId: string | null;
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

/**
 * Captures the Claude hook session ID for the upper workbench terminal.
 *
 * Listens to all agent events; binds on the first binding-class event from an
 * unknown session ID (same trigger-type guard as the legacy capture hook). Once
 * bound, subsequent events from a different session ID rebind — this mirrors the
 * terminal-launched fallback behaviour in useClaudeSessionCapture.
 */
function useWorkbenchClaudeCapture(upperSessionId: string): string | null {
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  // Stable ref so the effect closure sees the latest value without re-subscribing.
  const upperSessionIdRef = useRef(upperSessionId);
  upperSessionIdRef.current = upperSessionId;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.hooks?.onAgentEvent) return;

    return window.electronAPI.hooks.onAgentEvent((event) => {
      const payload = event as { type?: string; sessionId?: string };
      if (typeof payload.sessionId !== 'string') return;
      if (!TERMINAL_BIND_TRIGGER_TYPES.has(payload.type ?? '')) return;
      // Bind/rebind: the running Claude is whoever last sent a binding event.
      // setClaudeSessionId is a no-op when the value is already the same string.
      setClaudeSessionId(payload.sessionId);
    });
    // upperSessionId is stable (generated once on mount) — no dep needed here,
    // but upperSessionIdRef keeps the closure fresh if it ever changed.
  }, []);

  return claudeSessionId;
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
  // Tracks whether frames have been spawned so the StrictMode cancel-kill branch
  // can distinguish a real remount (spawned=true, cancel kills) from an isReady
  // flip (spawned=false, no kills to cancel — fall through to spawn).
  const hasSpawnedRef = useRef(false);

  const { upperCwd, lowerCwd, resumeSessionId, isReady } = useWorkbenchRestore(projectRoot);
  const claudeSessionId = useWorkbenchClaudeCapture(upperSessionId);

  useWorkbenchSessionPersist({ projectRoot, upperSessionId, lowerSessionId, claudeSessionId });

  useEffect(() => {
    // Gate: do not spawn until the restore read completes.
    if (!isReady) return;

    const pending = pendingKillsRef.current;
    const fallback = projectRootRef.current ?? undefined;
    const ids = [upperSessionId, lowerSessionId];

    if (pending.size > 0 && hasSpawnedRef.current) {
      // Real StrictMode remount after a successful spawn: cancel deferred kills.
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    } else {
      // First spawn (or isReady flipped): clear any stale cleanup timers then spawn.
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
    // upperSessionId and lowerSessionId are stable primitives (generated once via
    // useRef initializer) — intentionally excluded from deps. The disable covers
    // those two; isReady is the gate that drives re-evaluation of this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return { upperSessionId, lowerSessionId, claudeSessionId };
}
