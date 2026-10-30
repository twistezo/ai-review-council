import { writeClipboard } from './clipboard/write-clipboard.js'
import { formatReport } from './review/format-report.js'
import { describeReviewResult } from './review/review-output.js'
import type { WizardOutcome } from './ui/app.js'

const defaultColumns = 80

// A full-width line between the progress table and the report.
const separator = (): string => '─'.repeat(Math.max(1, (process.stdout.columns ?? defaultColumns) - 1))

// The same formatted text is shown and copied.
const printReport = async (rawReport: string): Promise<void> => {
  const report = await formatReport(rawReport)
  console.log(`\n${separator()}\n\n${report}\n\n${separator()}`)
  const isCopied = await writeClipboard(report)
  // the trailing empty line keeps the shell prompt apart from the message
  console.log(`${isCopied ? '✔ Report copied to the clipboard.' : '✘ Could not copy the report to the clipboard.'}\n`)
}

// Prints what the run produced and returns the exit code.
export const printOutcome = async (outcome: WizardOutcome): Promise<number> => {
  switch (outcome.kind) {
    case 'finished': {
      const { stdout, stderr, exitCode } = describeReviewResult(outcome.result)
      if (stderr !== null) {
        console.error(`\n${stderr}`)
      }
      if (stdout !== null) {
        await printReport(stdout)
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
