import type { AgentPhase, AgentProgress } from '../execution/agent-progress.js'

export type RunRow = {
  id: string
  provider: string
  model: string
  effort: string
  review: string
  isCouncil: boolean
  progress: AgentProgress
}

export type StatusTone = 'pending' | 'active' | 'success' | 'failure'

export const phaseTones: Record<AgentPhase, StatusTone> = {
  waiting: 'pending',
  starting: 'active',
  reading: 'active',
  writing: 'active',
  done: 'success',
  failed: 'failure',
}

const pad = (value: number): string => String(value).padStart(2, '0')

// mm:ss, or h:mm:ss past an hour; empty before the agent starts.
export const formatElapsed = ({ startedAt, finishedAt }: AgentProgress, now: number): string => {
  if (startedAt === null) {
    return ''
  }
  const totalSeconds = Math.max(0, Math.floor(((finishedAt ?? now) - startedAt) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

const reviewerRows = (rows: readonly RunRow[]): RunRow[] => rows.filter((row) => !row.isCouncil)

// One short phrase per row: the general step, never individual tool calls.
export const describeStatus = (row: RunRow, rows: readonly RunRow[]): string => {
  const { phase, reads, note } = row.progress
  switch (phase) {
    case 'waiting': {
      if (!row.isCouncil) {
        return 'waiting'
      }
      const reviewers = reviewerRows(rows)
      const finished = reviewers.filter((reviewer) => reviewer.progress.finishedAt !== null).length

      return `waiting (${finished}/${reviewers.length} reports)`
    }
    case 'starting':
      return 'starting'
    case 'reading':
      return row.isCouncil ? `verifying (${reads} reads)` : `reading code (${reads})`
    case 'writing':
      return 'writing report'
    case 'done':
      return note === null ? 'done' : `done · ${note}`
    case 'failed':
      return `failed · ${note ?? 'unknown error'}`
  }
}

const compareText = (left: string, right: string): number => left.localeCompare(right, 'en', { sensitivity: 'base' })

// Reviewers alphabetically by provider, model and effort; the council stays last.
export const sortRunRows = (rows: readonly RunRow[]): RunRow[] =>
  [...rows].sort(
    (left, right) =>
      Number(left.isCouncil) - Number(right.isCouncil) ||
      compareText(left.provider, right.provider) ||
      compareText(left.model, right.model) ||
      compareText(left.effort, right.effort),
  )

export const isRunFinished = (rows: readonly RunRow[]): boolean =>
  rows.every((row) => row.progress.phase === 'done' || row.progress.phase === 'failed')
