import { describe, expect, it } from 'vitest'

import { commandResult, fakeRunCommand } from '../test-support/fakes.js'
import { parseNameStatus } from './git-output.js'
import { createGitRepository, isCommitHashFormat } from './git-repository.js'

const base = 'b'.repeat(40)

describe('parseNameStatus', () => {
  it('reads modified, added, deleted and renamed files including spaces in paths', () => {
    const output = ['M', 'src/a.ts', 'A', 'docs/new file.md', 'D', 'old.ts', 'R087', 'src/before.ts', 'src/after.ts', ''].join('\0')

    expect(parseNameStatus(output)).toEqual([
      { path: 'src/a.ts', previousPath: null, change: 'modified' },
      { path: 'docs/new file.md', previousPath: null, change: 'added' },
      { path: 'old.ts', previousPath: null, change: 'deleted' },
      { path: 'src/after.ts', previousPath: 'src/before.ts', change: 'renamed' },
    ])
  })

  it('returns nothing for an empty diff', () => {
    expect(parseNameStatus('')).toEqual([])
  })
})

describe('isCommitHashFormat', () => {
  it.each(['a1b2', 'A1B2C3D', 'f'.repeat(40)])('accepts %s', (value) => {
    expect(isCommitHashFormat(value)).toBe(true)
  })

  it.each(['abc', 'f'.repeat(41), 'HEAD~1', 'main', '--output=x', ''])('rejects %s', (value) => {
    expect(isCommitHashFormat(value)).toBe(false)
  })
})

describe('createGitRepository', () => {
  it('combines tracked changes with untracked files, without duplicates', async () => {
    const git = createGitRepository(
      fakeRunCommand({
        [`git diff --name-status -z --find-renames ${base} --`]: commandResult({ stdout: 'M\0src/b.ts\0' }),
        'git ls-files --others --exclude-standard -z': commandResult({ stdout: 'src/a.ts\0src/b.ts\0' }),
      }),
    )

    expect(await git.listChangedFiles('/repo', base)).toEqual([
      { path: 'src/a.ts', previousPath: null, change: 'untracked' },
      { path: 'src/b.ts', previousPath: null, change: 'modified' },
    ])
  })

  it('fails instead of reporting an empty scope when Git cannot list changes', async () => {
    const git = createGitRepository(fakeRunCommand({}))

    await expect(git.listChangedFiles('/repo', base)).rejects.toThrow('Could not read changed files')
  })

  it('reports detached HEAD as no branch', async () => {
    const git = createGitRepository(
      fakeRunCommand({
        'git symbolic-ref --quiet --short HEAD': commandResult({ exitCode: 1 }),
        'git log -1 --format=%H%x00%s --end-of-options HEAD^{commit}': commandResult({ stdout: `${base}\0Fix bug\n` }),
        'git status --porcelain=v1 -z --untracked-files=normal': commandResult({ stdout: '' }),
      }),
    )

    expect(await git.readState('/repo')).toEqual({
      root: '/repo',
      branch: null,
      head: { hash: base, subject: 'Fix bug' },
      hasChanges: false,
    })
  })

  it('reads the diff of the given paths only, and nothing for no paths', async () => {
    const git = createGitRepository(
      fakeRunCommand({
        [`git --literal-pathspecs diff --find-renames ${base} -- src/a.ts src/b.ts`]: commandResult({ stdout: 'diff --git a/src/a.ts\n' }),
      }),
    )

    expect(await git.readDiff('/repo', base, ['src/a.ts', 'src/b.ts'])).toBe('diff --git a/src/a.ts\n')
    expect(await git.readDiff('/repo', base, [])).toBe('')
    await expect(git.readDiff('/repo', base, ['src/c.ts'])).rejects.toThrow('Could not read the diff')
  })

  it('tells whether a commit is in the history of HEAD', async () => {
    const git = createGitRepository(
      fakeRunCommand({ [`git merge-base --is-ancestor ${base} HEAD`]: commandResult({ exitCode: 0 }) }),
    )

    expect(await git.isInHeadHistory('/repo', base)).toBe(true)
    expect(await git.isInHeadHistory('/repo', 'c'.repeat(40))).toBe(false)
  })

  it('returns no commit for an unknown ref', async () => {
    const git = createGitRepository(fakeRunCommand({}))

    expect(await git.resolveCommit('/repo', 'deadbeef')).toBeNull()
  })
})
