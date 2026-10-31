import type { ReviewScope } from '../domain/review-session.js'
import type { GitRepository } from '../git/git-repository.js'
import { isCommitHashFormat } from '../git/git-repository.js'
import { partitionReviewFiles } from './excluded-files.js'

export type ScopeRequest = { kind: 'uncommitted' } | { kind: 'since-commit'; commitRef: string }

type ScopeResult = { ok: true; scope: ReviewScope } | { ok: false; error: string }

export const buildReviewScope = async (
  git: GitRepository,
  root: string,
  request: ScopeRequest,
): Promise<ScopeResult> => {
  const ref = request.kind === 'uncommitted' ? 'HEAD' : request.commitRef.trim()
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
  const { included, excluded } = partitionReviewFiles(await git.listChangedFiles(root, base.hash))
  if (included.length === 0) {
    return {
      ok: false,
      error:
        request.kind === 'uncommitted'
          ? 'There are no uncommitted changes to review.'
          : `There are no changes after ${base.hash.slice(0, 7)} to review.`,
    }
  }

  return { ok: true, scope: { kind: request.kind, base, changedFiles: included, excludedFiles: excluded } }
}
