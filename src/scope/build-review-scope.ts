import type { CommitInfo, ReviewScope } from '../domain/review-session.js'
import type { GitRepository } from '../git/git-repository.js'
import { isCommitHashFormat } from '../git/git-repository.js'
import { partitionReviewFiles } from './excluded-files.js'

export type ScopeRequest = { kind: 'uncommitted' } | { kind: 'since-commit'; commitRef: string } | { kind: 'full' }

type ScopeResult = { ok: true; scope: ReviewScope } | { ok: false; error: string }

const nothingToReview = (request: ScopeRequest, base: CommitInfo): string => {
  switch (request.kind) {
    case 'uncommitted':
      return 'There are no uncommitted changes to review.'
    case 'since-commit':
      return `There are no changes after ${base.hash.slice(0, 7)} to review.`
    case 'full':
      return 'There are no files to review.'
  }
}

export const buildReviewScope = async (
  git: GitRepository,
  root: string,
  request: ScopeRequest,
): Promise<ScopeResult> => {
  const ref = request.kind === 'since-commit' ? request.commitRef.trim() : 'HEAD'
  if (request.kind === 'since-commit' && !isCommitHashFormat(ref)) {
    return { ok: false, error: 'Enter a commit hash: 4 to 40 hexadecimal characters.' }
  }
  const base = await git.resolveCommit(root, ref)
  if (base === null) {
    return { ok: false, error: `Commit "${ref}" was not found or is ambiguous.` }
  }
  // Like `git reset --soft <hash>`: the base must lie behind the current branch tip.
  if (request.kind === 'since-commit' && !(await git.isInHeadHistory(root, base.hash))) {
    return {
      ok: false,
      error: `Commit ${base.hash.slice(0, 7)} is not in the history of the current branch. Pick one from \`git log\`.`,
    }
  }
  // The entire codebase is diffed against no files at all, so every file is new.
  const diffBase = request.kind === 'full' ? await git.readEmptyTreeHash(root) : base.hash
  if (diffBase === null) {
    return { ok: false, error: 'Git could not read the empty tree to compare the codebase with.' }
  }
  const { included, excluded } = partitionReviewFiles(await git.listChangedFiles(root, diffBase))
  if (included.length === 0) {
    return { ok: false, error: nothingToReview(request, base) }
  }

  return { ok: true, scope: { kind: request.kind, base, diffBase, changedFiles: included, excludedFiles: excluded } }
}
