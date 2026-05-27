import fs from 'fs/promises'
import path from 'path'

import {
  type ContextFileSnapshot,
  loadContextFileSnapshotFast,
  resolveWorkspaceFile,
} from './contextSelectionSupport'
import {
  addReason,
  findKeywordMatches,
  findRelatedSeeds,
  getOrCreateCandidate,
  type MutableCandidate,
  type NormalizedSelection,
  resolveDiagnosticFiles,
  resolveDiffFiles,
  resolveRecentEdits,
} from './contextSelectorHelpers'
import {
  isDiffAgentAuthored,
  isRecentUserEdit,
  resolveEditReasonKind,
} from './contextSelectorProvenance'
import { getEditProvenanceStore } from './editProvenance'
import type { ContextReasonKind, RepoFacts } from './types'

const REASON_WEIGHTS = new Map<ContextReasonKind, number>([
  ['user_selected', 100],
  ['pinned', 95],
  ['included', 85],
  ['dirty_buffer', 68],
  ['test_companion', 38],
  ['recent_edit', 32],
  ['recent_user_edit', 32],
  ['recent_agent_edit', 4],
  ['git_diff', 56],
  ['diagnostic', 52],
  ['keyword_match', 26],
  ['import_adjacency', 22],
  ['dependency', 12],
  ['pagerank', 40],
])

const AGENT_DIFF_WEIGHT = 12

export const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'be',
  'build',
  'by',
  'current',
  'do',
  'edit',
  'feature',
  'file',
  'files',
  'fix',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'make',
  'mode',
  'new',
  'of',
  'on',
  'or',
  'plan',
  'task',
  'that',
  'the',
  'this',
  'to',
  'update',
  'with',
  'without',
  'you',
  'your',
])

type GetProv = (p: string) => { lastAgentEditAt: number; lastUserEditAt: number } | null

const makeGetProv = (enabled: boolean): GetProv => {
  const s = enabled ? getEditProvenanceStore() : null
  return s ? (p) => s.getEditProvenance(p) : () => null
}

function applyProvenanceEditReasons(
  candidates: Map<string, MutableCandidate>,
  recentEdits: string[],
  provenanceEnabled: boolean,
): void {
  const getProv = makeGetProv(provenanceEnabled)
  for (const filePath of recentEdits) {
    const kind = resolveEditReasonKind(filePath, getProv)
    addReason(
      getOrCreateCandidate(candidates, filePath),
      kind,
      'Recently edited in the workspace',
      REASON_WEIGHTS.get(kind) ?? 32,
    )
  }
}

function applyProvenanceDiffReasons(
  candidates: Map<string, MutableCandidate>,
  diffFiles: string[],
  repoFacts: RepoFacts,
  provenanceEnabled: boolean,
): void {
  const getProv = makeGetProv(provenanceEnabled)
  for (const filePath of diffFiles) {
    const weight = isDiffAgentAuthored(filePath, repoFacts, getProv)
      ? AGENT_DIFF_WEIGHT
      : REASON_WEIGHTS.get('git_diff') ?? 56
    addReason(
      getOrCreateCandidate(candidates, filePath),
      'git_diff',
      'Present in the current git diff',
      weight,
    )
  }
}

interface RepoCandidateOpts {
  candidates: Map<string, MutableCandidate>
  addCandidate: (filePath: string, kind: ContextReasonKind, detail: string) => void
  repoFacts: RepoFacts
  workspaceRoots: string[]
  provenanceEnabled: boolean
}

export async function addRepoFactCandidates(
  opts: RepoCandidateOpts,
): Promise<{ recentEdits: string[]; diffFiles: string[]; diagnosticFiles: string[] }> {
  const { candidates, addCandidate, repoFacts, workspaceRoots, provenanceEnabled } = opts
  const [recentEdits, diffFiles, diagnosticFiles] = await Promise.all([
    resolveRecentEdits(repoFacts, workspaceRoots),
    resolveDiffFiles(repoFacts, workspaceRoots),
    resolveDiagnosticFiles(repoFacts, workspaceRoots),
  ])
  applyProvenanceEditReasons(candidates, recentEdits, provenanceEnabled)
  applyProvenanceDiffReasons(candidates, diffFiles, repoFacts, provenanceEnabled)
  for (const file of repoFacts.diagnostics.files) {
    addCandidate(
      await resolveWorkspaceFile(file.filePath, workspaceRoots),
      'diagnostic',
      `Diagnostics: ${file.errors} errors, ${file.warnings} warnings`,
    )
  }
  for (const root of repoFacts.roots) {
    for (const ep of root.entryPoints) {
      addCandidate(
        await resolveWorkspaceFile(ep, workspaceRoots, root.rootPath),
        'dependency',
        `Workspace entry point for ${path.basename(root.rootPath)}`,
      )
    }
  }
  return { recentEdits, diffFiles, diagnosticFiles }
}

export async function applyKeywordReasons(
  candidates: Map<string, MutableCandidate>,
  snapshots: Map<string, ContextFileSnapshot>,
  keywords: string[],
): Promise<void> {
  const kwWeight = REASON_WEIGHTS.get('keyword_match') ?? 26
  for (const candidate of candidates.values()) {
    const pathHits = findKeywordMatches(candidate.filePath, null, keywords)
    if (pathHits.length >= 3) {
      addReason(
        candidate,
        'keyword_match',
        `Matches keywords: ${pathHits.join(', ')}`,
        kwWeight + pathHits.length - 1,
      )
      continue
    }
    const snapshot = await loadContextFileSnapshotFast(candidate.filePath, snapshots)
    const keywordHits = findKeywordMatches(candidate.filePath, snapshot.content, keywords)
    if (keywordHits.length > 0)
      addReason(
        candidate,
        'keyword_match',
        `Matches keywords: ${keywordHits.join(', ')}`,
        kwWeight + keywordHits.length - 1,
      )
  }
}

export function applyImportAdjacency(
  candidates: Map<string, MutableCandidate>,
  snapshots: Map<string, ContextFileSnapshot>,
  seedFiles: string[],
): void {
  const iaWeight = REASON_WEIGHTS.get('import_adjacency') ?? 22
  for (const candidate of candidates.values()) {
    const related = findRelatedSeeds(candidate, snapshots, seedFiles)
    if (related.length > 0)
      addReason(
        candidate,
        'import_adjacency',
        `Import-adjacent to ${related.join(', ')}`,
        iaWeight + related.length - 1,
      )
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function addTestCompanions(
  candidates: Map<string, MutableCandidate>,
  addCandidate: (filePath: string, kind: ContextReasonKind, detail: string) => void,
): Promise<void> {
  const paths = Array.from(candidates.keys()).map((k) => candidates.get(k)!.filePath)
  for (const p of paths) {
    const norm = path.normalize(p)
    const ext = path.extname(norm)
    const base = path.basename(norm, ext)
    if (base.endsWith('.test') || base.endsWith('.spec')) continue
    const dir = path.dirname(norm)
    const patterns = [
      path.join(dir, `${base}.test${ext}`),
      path.join(dir, `${base}.spec${ext}`),
      path.join(dir, '__tests__', `${base}${ext}`),
      path.join(dir, '__tests__', `${base}.test${ext}`),
    ]
    for (const tp of patterns) {
      if (await fileExists(tp)) addCandidate(tp, 'test_companion', `Test file for ${base}${ext}`)
    }
  }
}

export function tryApplyPageRank(
  _candidates: Map<string, MutableCandidate>,
  _selection: NormalizedSelection,
  _workspaceRoots: string[],
  _provenanceEnabled: boolean,
): void {
  // Graph removed in Wave 22 — PageRank scoring is a no-op.
}
