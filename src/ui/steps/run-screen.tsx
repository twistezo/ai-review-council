import { Box, Text } from 'ink'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import type { WriteClipboard } from '../../clipboard/write-clipboard.js'
import type { AgentConfiguration, ReviewSessionDraft } from '../../domain/review-session.js'
import { waitingProgress } from '../../execution/agent-progress.js'
import { formatEffort } from '../../providers/model-catalog.js'
import { providerDisplayNames } from '../../providers/provider-adapter.js'
import type { NumberedReviewer } from '../../review/review-messages.js'
import type { ReviewRunDependencies, ReviewRunResult } from '../../review/run-review.js'
import { councilAgentId, numberReviewers, reviewerAgentId, runReview } from '../../review/run-review.js'
import type { OpenReport } from '../../review/open-report.js'
import { describeReviewResult } from '../../review/review-output.js'
import { ReportResult } from '../components/report-result.js'
import { RunProgress } from '../components/run-progress.js'
import type { RunRow } from '../run-progress.js'

export type RunOutcome = { kind: 'finished'; result: ReviewRunResult } | { kind: 'failed'; error: string }

type RunScreenProps = {
  session: ReviewSessionDraft
  dependencies: ReviewRunDependencies
  writeClipboard: WriteClipboard
  openReport: OpenReport
  onFinished: (outcome: RunOutcome) => void
  // the run is over and its report is on screen; the app keeps running until onQuit
  onReported: (outcome: RunOutcome) => void
  onQuit: () => void
}

const agentColumns = (configuration: AgentConfiguration): Pick<RunRow, 'provider' | 'model' | 'effort'> => ({
  provider: providerDisplayNames[configuration.provider],
  model: configuration.modelLabel,
  effort: formatEffort(configuration.effort),
})

const initialRunRows = (reviewers: readonly NumberedReviewer[], council: AgentConfiguration): RunRow[] => [
  ...reviewers.map((reviewer) => ({
    id: reviewerAgentId(reviewer.number),
    ...agentColumns(reviewer.configuration),
    review: reviewer.reviewType,
    isCouncil: false,
    progress: waitingProgress,
  })),
  {
    id: councilAgentId,
    ...agentColumns(council),
    review: 'council',
    isCouncil: true,
    progress: waitingProgress,
  },
]

// Starts the review once; leaving the screen (Ctrl+C) cancels every running agent.
export const RunScreen = ({
  session,
  dependencies,
  writeClipboard,
  openReport,
  onFinished,
  onReported,
  onQuit,
}: RunScreenProps): JSX.Element => {
  const [rows, setRows] = useState(() => initialRunRows(numberReviewers(session.reviewers), session.council))
  const [outcome, setOutcome] = useState<RunOutcome | null>(null)
  const report = outcome?.kind === 'finished' ? describeReviewResult(outcome.result).stdout : null

  // Reported after the final statuses are on screen, so the frame left behind shows them. With a report the app
  // waits for a key, but the outcome is already known: Ctrl+C there quits like `q`, not as a cancelled review.
  useEffect(() => {
    if (outcome === null) {
      return
    }
    if (report === null) {
      onFinished(outcome)
    } else {
      onReported(outcome)
    }
  }, [outcome])

  useEffect(() => {
    const controller = new AbortController()
    runReview(
      session,
      dependencies,
      (agentId, change) =>
        setRows((previous) =>
          previous.map((row) => (row.id === agentId ? { ...row, progress: change(row.progress) } : row)),
        ),
      controller.signal,
    ).then(
      (result) => setOutcome({ kind: 'finished', result }),
      (error: unknown) => setOutcome({ kind: 'failed', error: error instanceof Error ? error.message : String(error) }),
    )

    return () => controller.abort()
  }, [])

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {outcome === null
          ? `Reviewing ${session.scope.changedFiles.length} file(s)`
          : `Reviewed ${session.scope.changedFiles.length} file(s)`}
      </Text>
      <Box marginTop={1}>
        <RunProgress rows={rows} />
      </Box>
      {outcome === null && (
        <Box marginTop={1}>
          <Text dimColor>Ctrl+C cancels all agents</Text>
        </Box>
      )}
      {outcome !== null && report !== null && (
        <Box flexDirection="column" marginTop={1}>
          <ReportResult
            report={report}
            writeClipboard={writeClipboard}
            openReport={openReport}
            onQuit={onQuit}
          />
        </Box>
      )}
    </Box>
  )
}
