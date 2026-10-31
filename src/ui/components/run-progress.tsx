import { Box, Text, useAnimation, useWindowSize } from 'ink'
import type { JSX } from 'react'

import type { RunRow, StatusTone } from '../run-progress.js'
import { describeStatus, formatElapsed, isRunFinished, phaseTones, sortRunRows } from '../run-progress.js'
import { theme } from '../theme.js'

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const
const spinnerIntervalMs = 80

const toneColors: Record<StatusTone, string> = {
  pending: theme.muted,
  active: theme.focus,
  success: theme.success,
  failure: theme.failure,
}

const toneMarks: Record<Exclude<StatusTone, 'active'>, string> = {
  pending: '○',
  success: '✔',
  failure: '✘',
}

const columnGap = 2
// one space before the first column
const indentWidth = 1
const timeWidth = 8
const minStatusWidth = 16
const maxStatusWidth = 40
const minModelWidth = 10
// paddings of the screen around the table
const outerPadding = 2

type ColumnWidths = {
  provider: number
  model: number
  effort: number
  review: number
  status: number
}

const fitColumn = (title: string, values: readonly string[]): number =>
  Math.max(title.length, ...values.map((value) => value.length)) + columnGap

// Every column has a fixed width so no line wraps; the status, then the model, shrink to fit the window.
export const columnWidths = (rows: readonly RunRow[], windowColumns: number): ColumnWidths => {
  const provider = fitColumn('Provider', rows.map((row) => row.provider))
  const effort = fitColumn('Effort', rows.map((row) => row.effort))
  const review = fitColumn('Review', rows.map((row) => row.review))
  const modelWanted = fitColumn('Model', rows.map((row) => row.model))
  const available = windowColumns - outerPadding - indentWidth - provider - effort - review - timeWidth
  const status = Math.max(minStatusWidth, Math.min(maxStatusWidth, available - modelWanted))
  const model = Math.max(minModelWidth, Math.min(modelWanted, available - status))

  return { provider, model, effort, review, status }
}

const tableWidth = (widths: ColumnWidths): number =>
  indentWidth + widths.provider + widths.model + widths.effort + widths.review + widths.status + timeWidth

type RunProgressViewProps = {
  rows: readonly RunRow[]
  now: number
  frame: number
  windowColumns: number
}

type CellsProps = {
  widths: ColumnWidths
  provider: string
  model: string
  effort: string
  review: string
  status: JSX.Element
  time: string
  // the header row is dimmed as a whole
  isDimmed?: boolean
}

const Cells = ({
  widths,
  provider,
  model,
  effort,
  review,
  status,
  time,
  isDimmed = false,
}: CellsProps): JSX.Element => (
  <Box paddingLeft={indentWidth}>
    <Box width={widths.provider} flexShrink={0}>
      <Text dimColor={isDimmed}>{provider}</Text>
    </Box>
    <Box width={widths.model} flexShrink={0}>
      <Text dimColor={isDimmed} wrap="truncate-end">
        {model}
      </Text>
    </Box>
    <Box width={widths.effort} flexShrink={0}>
      <Text dimColor={isDimmed}>{effort}</Text>
    </Box>
    <Box width={widths.review} flexShrink={0}>
      <Text dimColor={isDimmed}>{review}</Text>
    </Box>
    <Box width={widths.status} flexShrink={0}>
      {status}
    </Box>
    <Box width={timeWidth} flexShrink={0}>
      <Text dimColor>{time}</Text>
    </Box>
  </Box>
)

// Static render for a given moment; `RunProgress` drives it live.
export const RunProgressView = ({ rows: unsortedRows, now, frame, windowColumns }: RunProgressViewProps): JSX.Element => {
  const rows = sortRunRows(unsortedRows)
  const widths = columnWidths(rows, windowColumns)
  const spinner = spinnerFrames[frame % spinnerFrames.length] ?? '•'

  return (
    <Box flexDirection="column">
      <Cells
        widths={widths}
        provider="Provider"
        model="Model"
        effort="Effort"
        review="Review"
        status={<Text dimColor>Status</Text>}
        time="Time"
        isDimmed
      />
      <Box height={1} />
      {rows.map((row, index) => {
        const tone = phaseTones[row.progress.phase]
        const mark = tone === 'active' ? spinner : toneMarks[tone]
        const startsCouncil = row.isCouncil && index > 0 && rows[index - 1]?.isCouncil === false

        return (
          <Box key={row.id} flexDirection="column">
            {startsCouncil && (
              <Text dimColor>{'─'.repeat(Math.min(tableWidth(widths), windowColumns - outerPadding))}</Text>
            )}
            <Cells
              widths={widths}
              provider={row.provider}
              model={row.model}
              effort={row.effort}
              review={row.review}
              status={
                <Text color={toneColors[tone]} wrap="truncate-end">
                  {mark} {describeStatus(row, rows)}
                </Text>
              }
              time={formatElapsed(row.progress, now)}
            />
          </Box>
        )
      })}
    </Box>
  )
}

// Ticks while anything runs: spinner frames and elapsed times; follows the window width.
export const RunProgress = ({ rows }: { rows: readonly RunRow[] }): JSX.Element => {
  const { frame } = useAnimation({ interval: spinnerIntervalMs, isActive: !isRunFinished(rows) })
  const { columns } = useWindowSize()

  return <RunProgressView rows={rows} now={Date.now()} frame={frame} windowColumns={columns} />
}
