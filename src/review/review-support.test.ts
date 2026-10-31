import { readFile, stat } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import type { ReviewSessionDraft } from '../domain/review-session.js'
import { instructionsDirectory, readInstructions } from '../instructions/instruction-files.js'
import { emptyTreeHash, fakeGitRepository, headCommit } from '../test-support/fakes.js'
import type { NumberedReviewer, ReviewerReport } from './review-messages.js'
import { buildReviewerMessage } from './review-messages.js'
import { describeReviewResult } from './review-output.js'
import { createWorkspacePreparer, trackedDiffPaths } from './review-workspace.js'

const session: ReviewSessionDraft = {
  language: 'en',
  repository: { root: '/repo', branch: null, hasChanges: true },
  scope: {
    kind: 'since-commit',
    base: headCommit,
    diffBase: headCommit.hash,
    changedFiles: [
      { path: 'src/cart.ts', previousPath: null, change: 'modified' },
      { path: 'src/price.ts', previousPath: 'src/cost.ts', change: 'renamed' },
      { path: 'src/new.ts', previousPath: null, change: 'untracked' },
    ],
    excludedFiles: ['.env.local'],
  },
  council: { provider: 'claude', model: 'haiku', modelLabel: 'Haiku 5.5', effort: 'low' },
  reviewers: [{ configuration: { provider: 'claude', model: 'haiku', modelLabel: 'Haiku 5.5', effort: 'low' }, reviewType: 'code' }],
  prompt: 'Total must include VAT',
  timeoutMinutes: 10,
}

const reviewer: NumberedReviewer = { number: 1, ...session.reviewers[0]! }

describe('buildReviewerMessage', () => {
  it('gives the scope, the diff path, new files to read in full and secrets to avoid', () => {
    const message = buildReviewerMessage(session, reviewer, '/tmp/x/change.diff')

    expect(message).toContain('You are reviewer 1 of 1. Variant: code.')
    expect(message).toContain('Repository: /repo (detached HEAD)')
    expect(message).toContain(
      'Everything changed after aaaaaaa Add checkout form, up to the current files with uncommitted changes. The base commit itself is not part of the change.',
    )
    expect(message).toContain('Diff of tracked changes: /tmp/x/change.diff')
    expect(message).toContain('- src/cost.ts -> src/price.ts (renamed)')
    expect(message).toContain('- src/new.ts (new, not in the diff: read it in full)')
    expect(message).toContain('Left out as likely secrets, do not open: .env.local')
    expect(message).toContain('## Review prompt\nTotal must include VAT')
  })

  it('tells agents the entire codebase is the change', () => {
    const fullSession: ReviewSessionDraft = {
      ...session,
      scope: { ...session.scope, kind: 'full', diffBase: emptyTreeHash },
    }

    expect(buildReviewerMessage(fullSession, reviewer, '/tmp/x/change.diff')).toContain(
      'The entire codebase at aaaaaaa Add checkout form, uncommitted changes included. Every file is part of the change and shows as added in the diff.',
    )
  })
})

describe('review workspace', () => {
  it('diffs tracked files only, with both sides of a rename', () => {
    expect(trackedDiffPaths(session.scope)).toEqual(['src/cart.ts', 'src/cost.ts', 'src/price.ts'])
  })

  it('writes the diff to a temporary folder and removes it on cleanup', async () => {
    const workspace = await createWorkspacePreparer(fakeGitRepository())('/repo', session.scope)

    expect(await readFile(workspace.diffPath, 'utf8')).toContain('diff --git a/src/cost.ts b/src/cost.ts')
    await workspace.cleanup()
    await expect(stat(workspace.directory)).rejects.toThrow()
  })

  it('leaves nothing behind when the diff cannot be read', async () => {
    const git = fakeGitRepository({
      readDiff: async () => {
        throw new Error('Could not read the diff from Git')
      },
    })

    await expect(createWorkspacePreparer(git)('/repo', session.scope)).rejects.toThrow('Could not read the diff')
  })

  it('takes the diff against the scope diff base, the empty tree for the entire codebase', async () => {
    const bases: string[] = []
    const git = fakeGitRepository({
      readDiff: async (_root, baseHash) => {
        bases.push(baseHash)

        return ''
      },
    })
    const workspace = await createWorkspacePreparer(git)('/repo', { ...session.scope, kind: 'full', diffBase: emptyTreeHash })
    await workspace.cleanup()

    expect(bases).toEqual([emptyTreeHash])
  })
})

describe('readInstructions', () => {
  it('joins the shipped files in the given order', async () => {
    const text = await readInstructions(instructionsDirectory, ['common.md', 'reviewer/reviewer.md'])

    expect(text.indexOf('# Common rules')).toBe(0)
    expect(text).toContain('\n\n---\n\n# Reviewer')
  })
})

describe('describeReviewResult', () => {
  const reports: ReviewerReport[] = [
    { reviewer, report: '### Finding', error: null },
    { reviewer: { ...reviewer, number: 2 }, report: null, error: 'Timed out after 10 min' },
  ]

  it('prints the council report and names failed reviewers on stderr', () => {
    expect(describeReviewResult({ kind: 'reported', report: '# Review', reviewerReports: reports })).toEqual({
      stdout: '# Review',
      stderr: 'Some reviewers failed:\nReviewer 2 · Claude Code · Haiku 5.5 · low · code: Timed out after 10 min',
      exitCode: 0,
    })
  })

  it('falls back to the unverified reviewer reports when the council fails', () => {
    const output = describeReviewResult({ kind: 'council-failed', error: 'auth expired', reviewerReports: reports })

    expect(output.exitCode).toBe(1)
    expect(output.stdout).toContain('# Review without council verification')
    expect(output.stdout).toContain('## Reviewer 1 · Claude Code · Haiku 5.5 · low · code\n\n### Finding')
    expect(output.stderr).toBe('The council failed: auth expired')
  })

  it('prints no report when every reviewer failed or the run was cancelled', () => {
    expect(describeReviewResult({ kind: 'reviewers-failed', reviewerReports: reports })).toMatchObject({
      stdout: null,
      exitCode: 1,
    })
    expect(describeReviewResult({ kind: 'cancelled' })).toEqual({ stdout: null, stderr: 'Review cancelled.', exitCode: 130 })
  })
})
