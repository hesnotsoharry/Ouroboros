/**
 * conflictMonitorSupport.ts — Pure helpers extracted from conflictMonitor.ts
 * to satisfy the 40-line function and complexity ESLint limits.
 */

import type { AgentConflictReport } from '@shared/types/agentConflict';

/** Minimal stub — graph removed in Wave 22. */
export interface GraphNode {
  id: string;
  filePath?: string;
  line?: number;
  type?: string;
  name?: string;
}

// ── Key helpers ───────────────────────────────────────────────────────────────

export function rootSessionKey(root: string, session: string): string {
  return `${root}::${session}`;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}||${b}` : `${b}||${a}`;
}

export function extractSessionId(key: string): string {
  return key.includes('::') ? key.split('::').slice(1).join('::') : key;
}

// ── Severity ─────────────────────────────────────────────────────────────────

export function severityForSymbols(
  symA: GraphNode[],
  symB: GraphNode[],
): AgentConflictReport['severity'] {
  if (symA.length === 0 || symB.length === 0) return 'info';
  const idsA = new Set(symA.map((s) => s.id));
  const hasShared = symB.some((s) => idsA.has(s.id));
  return hasShared ? 'blocking' : 'info';
}

// ── Symbol computation ────────────────────────────────────────────────────────

export async function computeSymbols(
  _root: string,
  _sessionId: string,
  _files: string[],
): Promise<GraphNode[]> {
  // Graph removed in Wave 22 — symbol detection is a no-op.
  void _root
  void _sessionId
  void _files
  return [];
}

export function isGraphHot(_root: string): boolean {
  // Graph removed in Wave 22.
  void _root
  return false;
}

// ── Dismiss helpers ───────────────────────────────────────────────────────────

export interface DismissEntry {
  filesA: Set<string>;
  filesB: Set<string>;
}

export function shouldClearDismiss(
  dismissed: DismissEntry,
  filesA: Set<string>,
  filesB: Set<string>,
): boolean {
  const newInA = Array.from(filesA).some((f) => !dismissed.filesA.has(f) && filesB.has(f));
  if (newInA) return true;
  return Array.from(filesB).some((f) => !dismissed.filesB.has(f) && filesA.has(f));
}

// ── Session entry ─────────────────────────────────────────────────────────────

export interface SessionEntry {
  files: Set<string>;
  latestFile: string;
}

export type RootSessionMap = Map<string, SessionEntry>;

export function getOrCreateEntry(
  sessions: RootSessionMap,
  root: string,
  session: string,
): SessionEntry {
  const key = rootSessionKey(root, session);
  let entry = sessions.get(key);
  if (!entry) {
    entry = { files: new Set(), latestFile: '' };
    sessions.set(key, entry);
  }
  return entry;
}

export function getSessionsForRoot(
  sessions: RootSessionMap,
  root: string,
): Array<{ sessionId: string; entry: SessionEntry }> {
  const result: Array<{ sessionId: string; entry: SessionEntry }> = [];
  const prefix = `${root}::`;
  for (const [key, entry] of sessions) {
    if (key.startsWith(prefix)) {
      result.push({ sessionId: key.slice(prefix.length), entry });
    }
  }
  return result;
}

// ── Overlap symbol builder ────────────────────────────────────────────────────

export function buildOverlapSymbols(
  symsA: GraphNode[],
  symsB: GraphNode[],
): AgentConflictReport['overlappingSymbols'] {
  const overlapIds = new Set(symsA.map((s) => s.id));
  return symsB
    .filter((s) => overlapIds.has(s.id))
    .map((s) => ({ id: s.id, file: s.filePath ?? '', line: s.line, kind: s.type ?? '', name: s.name ?? '' }));
}
