import type { ReviewScope } from '../domain/review-session.js'

export const describeScope = (scope: ReviewScope): string => {
  const base = scope.base.hash.slice(0, 7)
  const range =
    scope.kind === 'uncommitted'
      ? `uncommitted changes on ${base}`
      : `changes after ${base} ${scope.base.subject}, uncommitted included`
  const excluded = scope.excludedFiles.length === 0 ? '' : `, ${scope.excludedFiles.length} likely secret file(s) excluded`

  return `${range} (${scope.changedFiles.length} files${excluded})`
}
