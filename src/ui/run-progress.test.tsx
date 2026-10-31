import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'

import type { AgentProgress } from '../execution/agent-progress.js'
import { waitingProgress } from '../execution/agent-progress.js'
import { columnWidths, RunProgressView } from './components/run-progress.js'
import type { RunRow } from './run-progress.js'
import { describeStatus, formatElapsed, isRunFinished, sortRunRows } from './run-progress.js'

const progress = (overrides: Partial<AgentProgress>): AgentProgress => ({ ...waitingProgress, ...overrides })

const row = (id: string, overrides: Partial<AgentProgress>, isCouncil = false): RunRow => ({
  id,
  provider: isCouncil ? 'Claude Code' : 'Codex',
  model: isCouncil ? 'Haiku 5.5' : 'GPT-6-Luna',
  effort: 'low',
  review: isCouncil ? 'council' : 'code',
  isCouncil,
  progress: progress(overrides),
})

const rows: RunRow[] = [
  row('1', { phase: 'reading', reads: 12, startedAt: 0 }),
  row('2', { phase: 'done', startedAt: 0, finishedAt: 112_000, note: '3 findings' }),
  row('3', { phase: 'failed', startedAt: 0, finishedAt: 600_000, note: 'Timed out after 10 min' }),
  row('council', {}, true),
]

describe('formatElapsed', () => {
  it('is empty before the start, then counts to now or to the finish', () => {
    expect(formatElapsed(progress({}), 5_000)).toBe('')
    expect(formatElapsed(progress({ startedAt: 1_000 }), 135_999)).toBe('02:14')
    expect(formatElapsed(progress({ startedAt: 0, finishedAt: 3_725_000 }), 9_999_999)).toBe('1:02:05')
  })
})

describe('describeStatus', () => {
  it('names only the general step of each agent', () => {
    expect(rows.map((item) => describeStatus(item, rows))).toEqual([
      'reading code · 12 lookups',
      'done · 3 findings',
      'failed · Timed out after 10 min',
      'waiting (2/3 reports)',
    ])
  })

  it('describes the council by its own steps', () => {
    const council = row('council', { phase: 'reading', reads: 4, startedAt: 0 }, true)

    expect(describeStatus(council, [council])).toBe('verifying · 4 lookups')
    expect(describeStatus({ ...council, progress: progress({ phase: 'reading', reads: 1 }) }, [council])).toBe(
      'verifying · 1 lookup',
    )
    expect(describeStatus({ ...council, progress: progress({ phase: 'writing' }) }, [council])).toBe('writing report')
  })

  it('adds the used tokens to a finished agent, rounded for a glance', () => {
    const finished = (tokens: number | null, note: string | null = '4 findings'): string =>
      describeStatus(row('1', { phase: 'done', tokens, note }), rows)

    expect(finished(null)).toBe('done · 4 findings')
    expect(finished(850)).toBe('done · 4 findings · 850 tokens')
    expect(finished(312_400)).toBe('done · 4 findings · 312k tokens')
    expect(finished(999_600)).toBe('done · 4 findings · 1.0M tokens')
    expect(finished(1_240_000, null)).toBe('done · 1.2M tokens')
  })

  it('adds the used tokens to a failed agent too', () => {
    const failed = row('1', { phase: 'failed', tokens: 48_200, note: 'Claude Code ended with error_max_turns' })

    expect(describeStatus(failed, rows)).toBe('failed · 48k tokens · Claude Code ended with error_max_turns')
  })
})

describe('sortRunRows', () => {
  it('orders reviewers by provider, model and effort, keeping the council last', () => {
    const reviewer = (id: string, provider: string, model: string, effort: string): RunRow => ({
      ...row(id, {}),
      provider,
      model,
      effort,
    })
    const unsorted = [
      row('council', {}, true),
      reviewer('1', 'Codex', 'GPT-6-Sol', 'medium'),
      reviewer('2', 'Claude Code', 'Haiku 5.5', 'low'),
      reviewer('3', 'Codex', 'GPT-6-Luna', 'low'),
      reviewer('4', 'Codex', 'GPT-6-Luna', 'high'),
    ]

    expect(sortRunRows(unsorted).map((item) => item.id)).toEqual(['2', '4', '3', '1', 'council'])
  })
})

describe('isRunFinished', () => {
  it('waits until every agent is done or failed', () => {
    expect(isRunFinished(rows)).toBe(false)
    expect(isRunFinished(rows.slice(1, 3))).toBe(true)
  })
})

describe('RunProgressView', () => {
  it('shows one aligned row per agent with status and time', () => {
    const { lastFrame } = render(<RunProgressView rows={rows} now={134_000} frame={0} windowColumns={120} />)
    const lines = (lastFrame() ?? '').split('\n')

    expect(lines[0]).toMatch(/^ Provider +Model +Effort +Review +Status +Time/)
    expect(lines[1]).toMatch(/^ Codex +GPT-6-Luna +low +code /)
    expect(lines[1]).toContain('⠋ reading code · 12 lookups')
    expect(lines[1]).toContain('02:14')
    expect(lines[2]).toContain('✔ done · 3 findings')
    expect(lines[2]).toContain('01:52')
    expect(lines[3]).toContain('✘ failed · Timed out after 10 min')
    // a separator line sets the council apart from the reviewers
    expect(lines[4]).toMatch(/^─{20,}$/)
    expect(lines[5]).toMatch(/^ Claude Code +Haiku 5\.5 +low +council /)
    expect(lines[5]).toContain('○ waiting (2/3 reports)')
    // statuses start in the same column
    expect(lines[1]?.indexOf('reading')).toBe(lines[2]?.indexOf('done') ?? 0)
  })

  it('fits a narrow window without wrapping, truncating the status first', () => {
    const windowColumns = 70
    const { lastFrame } = render(<RunProgressView rows={rows} now={134_000} frame={0} windowColumns={windowColumns} />)
    const lines = (lastFrame() ?? '').split('\n')

    // header, rows and the separator above the council
    expect(lines).toHaveLength(rows.length + 2)
    expect(lines.every((line) => line.trimEnd().length <= windowColumns)).toBe(true)
    expect(lines[3]).toContain('✘ failed')
  })
})

describe('columnWidths', () => {
  it('shrinks the status column to fit, but never below its minimum', () => {
    const total = (windowColumns: number): number => {
      const widths = columnWidths(rows, windowColumns)

      // the indent and the time column are fixed at 1 and 8
      return 1 + widths.provider + widths.model + widths.effort + widths.review + widths.status + 8
    }

    expect(columnWidths(rows, 200).status).toBe(40)
    expect(total(80)).toBeLessThanOrEqual(80 - 2)
    expect(columnWidths(rows, 80).status).toBeGreaterThan(16)
    expect(columnWidths(rows, 40).status).toBe(16)
  })
})
