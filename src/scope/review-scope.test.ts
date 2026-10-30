import { describe, expect, it } from 'vitest'

import { fakeGitRepository, headCommit } from '../test-support/fakes.js'
import { buildReviewScope } from './build-review-scope.js'
import { isLikelySecretFile } from './excluded-files.js'

describe('isLikelySecretFile', () => {
  it.each(['.env', 'config/.env.production', 'certs/server.pem', 'deploy/prod.key', '.ssh/id_ed25519', '.npmrc'])(
    'treats %s as a possible secret',
    (path) => {
      expect(isLikelySecretFile(path)).toBe(true)
    },
  )

  it.each(['.env.example', 'src/keyboard.ts', 'docs/api-key-rotation.md'])('keeps %s', (path) => {
    expect(isLikelySecretFile(path)).toBe(false)
  })
})

describe('buildReviewScope', () => {
  it('collects uncommitted changes against HEAD and leaves secrets out', async () => {
    const result = await buildReviewScope(fakeGitRepository(), '/repo', { kind: 'uncommitted' })

    expect(result).toEqual({
      ok: true,
      scope: {
        kind: 'uncommitted',
        base: headCommit,
        changedFiles: [{ path: 'src/checkout.ts', previousPath: null, change: 'modified' }],
        excludedFiles: ['.env.local'],
      },
    })
  })

  it('resolves a short commit hash', async () => {
    const result = await buildReviewScope(fakeGitRepository(), '/repo', { kind: 'since-commit', commitRef: ' aaaa ' })

    expect(result.ok && result.scope.base).toEqual(headCommit)
  })

  it('rejects a ref that is not a hash before calling Git', async () => {
    const result = await buildReviewScope(fakeGitRepository(), '/repo', { kind: 'since-commit', commitRef: 'main' })

    expect(result).toEqual({ ok: false, error: 'Enter a commit hash: 4 to 40 hexadecimal characters.' })
  })

  it('reports an unknown commit', async () => {
    const result = await buildReviewScope(fakeGitRepository(), '/repo', { kind: 'since-commit', commitRef: 'bbbb' })

    expect(result).toEqual({ ok: false, error: 'Commit "bbbb" was not found or is ambiguous.' })
  })

  it('rejects a commit outside the history of the current branch', async () => {
    const git = fakeGitRepository({ isInHeadHistory: async () => false })
    const result = await buildReviewScope(git, '/repo', { kind: 'since-commit', commitRef: 'aaaa' })

    expect(result).toEqual({
      ok: false,
      error: 'Commit aaaaaaa is not in the history of the current branch. Pick one from `git log`.',
    })
  })

  it('diffs the working tree against the base commit, as `git reset --soft` would leave it', async () => {
    const bases: string[] = []
    const git = fakeGitRepository({
      listChangedFiles: async (_root, baseHash) => {
        bases.push(baseHash)

        return [{ path: 'src/cart.ts', previousPath: null, change: 'modified' }]
      },
    })
    await buildReviewScope(git, '/repo', { kind: 'since-commit', commitRef: 'aaaa' })

    expect(bases).toEqual([headCommit.hash])
  })

  it('blocks a scope with nothing to review, also when only secrets changed', async () => {
    const git = fakeGitRepository({
      listChangedFiles: async () => [{ path: '.env', previousPath: null, change: 'modified' }],
    })

    expect(await buildReviewScope(git, '/repo', { kind: 'uncommitted' })).toEqual({
      ok: false,
      error: 'There are no uncommitted changes to review.',
    })
    expect(await buildReviewScope(git, '/repo', { kind: 'since-commit', commitRef: 'aaaa' })).toEqual({
      ok: false,
      error: 'There are no changes after aaaaaaa to review.',
    })
  })
})
