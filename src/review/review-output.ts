import type { ReviewerReport } from './review-messages.js'
import { buildFallbackReport, reviewerLabel } from './review-messages.js'
import type { ReviewRunResult } from './run-review.js'

export type ReviewOutput = {
  // the copyable Markdown report
  stdout: string | null
  stderr: string | null
  exitCode: number
}

const failedReviewers = (reports: readonly ReviewerReport[]): string[] =>
  reports.flatMap(({ reviewer, error }) => (error === null ? [] : [`${reviewerLabel(reviewer)}: ${error}`]))

export const describeReviewResult = (result: ReviewRunResult): ReviewOutput => {
  switch (result.kind) {
    case 'reported': {
      const failures = failedReviewers(result.reviewerReports)

      return {
        stdout: result.report,
        stderr: failures.length === 0 ? null : `Some reviewers failed:\n${failures.join('\n')}`,
        exitCode: 0,
      }
    }
    case 'council-failed':
      return {
        stdout: buildFallbackReport(result.error, result.reviewerReports),
        stderr: `The council failed: ${result.error}`,
        exitCode: 1,
      }
    case 'reviewers-failed':
      return {
        stdout: null,
        stderr: `Every reviewer failed, so the council did not run:\n${failedReviewers(result.reviewerReports).join('\n')}`,
        exitCode: 1,
      }
    case 'cancelled':
      return { stdout: null, stderr: 'Review cancelled.', exitCode: 130 }
  }
}
