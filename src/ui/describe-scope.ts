import type { ReviewScope } from "../domain/review-session.js"

export const fileNoun = (count: number): string =>
  count === 1 ? "file" : "files"

export const describeScopeRange = (scope: ReviewScope): string => {
  const base = scope.base.hash.slice(0, 7)
  switch (scope.kind) {
    case "uncommitted":
      return `uncommitted changes on ${base}`
    case "since-commit":
      return `changes after ${base} ${scope.base.subject}, uncommitted included`
    case "full":
      return `entire codebase on ${base}, uncommitted included`
  }
}

export const describeScope = (scope: ReviewScope): string => {
  const changedCount = scope.changedFiles.length
  const excludedCount = scope.excludedFiles.length
  const excluded =
    excludedCount === 0
      ? ""
      : `, ${excludedCount} likely secret ${fileNoun(excludedCount)} excluded`

  return `${describeScopeRange(scope)} (${changedCount} ${fileNoun(changedCount)}${excluded})`
}
