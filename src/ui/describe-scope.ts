import type { ReviewScope } from '../domain/review-session.js'

const describeRange = (scope: ReviewScope): string => {
  const base = scope.base.hash.slice(0, 7)
  switch (scope.kind) {
    case 'uncommitted':
      return `uncommitted changes on ${base}`
    case 'since-commit':
      return `changes after ${base} ${scope.base.subject}, uncommitted included`
    case 'full':
      return `entire codebase on ${base}, uncommitted included`
  }
}

export const describeScope = (scope: ReviewScope): string => {
  const excluded = scope.excludedFiles.length === 0 ? '' : `, ${scope.excludedFiles.length} likely secret file(s) excluded`

  return `${describeRange(scope)} (${scope.changedFiles.length} files${excluded})`
}
