import { Box, Text, useInput } from 'ink'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import type { WriteClipboard } from '../../clipboard/write-clipboard.js'
import { formatReport } from '../../review/format-report.js'
import type { OpenReport } from '../../review/open-report.js'
import { previewReport } from '../../review/report-preview.js'
import { theme } from '../theme.js'

type ActionStatus = { text: string; color: string }

type ReportResultProps = {
  report: string
  writeClipboard: WriteClipboard
  openReport: OpenReport
  onQuit: () => void
}

const working = (text: string): ActionStatus => ({ text, color: theme.muted })
const succeeded = (text: string): ActionStatus => ({ text: `✔ ${text}`, color: theme.success })
const failed = (text: string): ActionStatus => ({ text: `✘ ${text}`, color: theme.failure })

// A short preview of the report; the full text is copied or opened on request.
export const ReportResult = ({ report, writeClipboard, openReport, onQuit }: ReportResultProps): JSX.Element => {
  const [status, setStatus] = useState<ActionStatus | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isQuitting, setIsQuitting] = useState(false)
  const { title, summary, findings, lineCount } = previewReport(report)

  // Quits once the hints are gone, so the frame left behind shows no keys that no longer work.
  useEffect(() => {
    if (isQuitting) {
      onQuit()
    }
  }, [isQuitting])

  // Copy and open both use the Prettier formatting, so the Markdown stays tidy.
  const runAction = (pending: string, action: (formatted: string) => Promise<ActionStatus>): void => {
    setIsBusy(true)
    setStatus(working(pending))
    void formatReport(report)
      .then(action)
      .then((result) => {
        setStatus(result)
        setIsBusy(false)
      })
  }

  useInput(
    (input, key) => {
      if (input === 'c' && !isBusy) {
        runAction('Copying…', async (formatted) =>
          (await writeClipboard(formatted))
            ? succeeded('Report copied to the clipboard.')
            : failed('Could not copy the report to the clipboard.'),
        )
      } else if (input === 'o' && !isBusy) {
        runAction('Opening…', async (formatted) => {
          const filePath = await openReport(formatted)

          return filePath === null ? failed('Could not open the report.') : succeeded(`Report opened: ${filePath}`)
        })
      } else if (input === 'q' || key.escape) {
        setIsQuitting(true)
      }
    },
    { isActive: !isQuitting },
  )

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={theme.muted} paddingX={1}>
        <Text bold color={theme.title}>
          Report
        </Text>
        {title !== null && (
          <Box marginTop={1}>
            <Text bold>{title}</Text>
          </Box>
        )}
        {summary !== null && (
          <Box marginTop={1}>
            <Text>{summary}</Text>
          </Box>
        )}
        {findings.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {findings.map((finding, index) => (
              <Text key={index}>• {finding}</Text>
            ))}
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>… {lineCount} lines in the full report</Text>
        </Box>
      </Box>
      {status !== null && <Text color={status.color}>{status.text}</Text>}
      {!isQuitting && <Text dimColor>c copy · o open · q quit</Text>}
    </Box>
  )
}
