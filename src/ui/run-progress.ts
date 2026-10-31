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

// Every Read, Grep or Glob call, or Codex shell command, so reading and searching alike.
const countLookups = (count: number): string => (count === 1 ? '1 lookup' : `${count} lookups`)

// Rounded for a glance, e.g. `850 tokens`, `312k tokens`, `1.2M tokens`.
const formatTokens = (count: number): string => {
  if (count < 1_000) {
    return `${count} tokens`
  }

  // 999,600 rounds up to a million, not to `1000k`.
  return count < 999_500 ? `${Math.round(count / 1_000)}k tokens` : `${(count / 1_000_000).toFixed(1)}M tokens`
}

const joinStatus = (parts: readonly (string | null)[]): string => parts.filter((part) => part !== null).join(' · ')

const reviewerRows = (rows: readonly RunRow[]): RunRow[] => rows.filter((row) => !row.isCouncil)

// One short phrase per row: the general step, never individual tool calls.
export const describeStatus = (row: RunRow, rows: readonly RunRow[]): string => {
  const { phase, reads, tokens, note } = row.progress
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
      return `${row.isCouncil ? 'verifying' : 'reading code'} · ${countLookups(reads)}`
    case 'writing':
      return 'writing report'
    // A failed run can still cost tokens, so both show what the provider reported. A failure reason is long and
    // the cell cuts its end, so the tokens go before it.
    case 'done':
      return joinStatus(['done', note, tokens === null ? null : formatTokens(tokens)])
    case 'failed':
      return joinStatus(['failed', tokens === null ? null : formatTokens(tokens), note ?? 'unknown error'])
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
