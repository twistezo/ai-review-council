import { describeReviewResult } from './review/review-output.js'
import type { WizardOutcome } from './ui/app.js'

// Prints what the run left to say after the app closed and returns the exit code.
// The report itself stays in the app's last frame as a preview, copied with `c`.
export const printOutcome = (outcome: WizardOutcome): number => {
  switch (outcome.kind) {
    case 'finished': {
      const { stderr, exitCode } = describeReviewResult(outcome.result)
      if (stderr !== null) {
        // the trailing empty line keeps the shell prompt apart from the message
        console.error(`\n${stderr}\n`)
      }

      return exitCode
    }
    case 'failed':
      console.error(`\nThe review could not run: ${outcome.error}`)

      return 1
    case 'cancelled':
      return 130
    case 'blocked':
      return 1
  }
}
