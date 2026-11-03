import { describe, expect, it, vi } from 'vitest'

import type { AgentConfiguration, ReviewSessionDraft } from '../domain/review-session.js'
import type { AgentLaunch } from '../execution/agent-commands.js'
import type { AgentProgress } from '../execution/agent-progress.js'
import { waitingProgress } from '../execution/agent-progress.js'
import type { AgentRunResult } from '../execution/run-agent-process.js'
import { headCommit } from '../test-support/fakes.js'
import type { ReviewRunDependencies } from './run-review.js'
import { countFindings, numberReviewers, proseLines, runReview, trimToReport } from './run-review.js'

const codexLow: AgentConfiguration = { provider: 'codex', model: 'gpt-6-luna', modelLabel: 'GPT-6-Luna', effort: 'low' }
const claudeLow: AgentConfiguration = { provider: 'claude', model: 'haiku', modelLabel: 'Haiku 5.5', effort: 'low' }

const session: ReviewSessionDraft = {
  language: 'pl',
  repository: { root: '/repo', branch: 'main', hasChanges: true },
  scope: {
    kind: 'uncommitted',
    base: headCommit,
    diffBase: headCommit.hash,
    changedFiles: [{ path: 'src/cart.ts', previousPath: null, change: 'modified' }],
    excludedFiles: [],
  },
  council: claudeLow,
  reviewers: [
    { configuration: codexLow, reviewType: 'code' },
    { configuration: claudeLow, reviewType: 'security' },
  ],
  prompt: 'Total must include VAT',
  timeoutMinutes: 3,
}

type AgentScript = (launch: AgentLaunch) => AgentRunResult

const setup = (script: AgentScript) => {
  const launches: AgentLaunch[] = []
  const timeouts: number[] = []
  const cleanup = vi.fn(async () => undefined)
  const progress = new Map<string, AgentProgress>()
  const dependencies: ReviewRunDependencies = {
    runAgent: async (launch, options) => {
      launches.push(launch)
      timeouts.push(options.timeoutMs)
      options.onEvent?.({ kind: 'read', target: 'src/cart.ts' })

      return script(launch)
    },
    prepareWorkspace: async () => ({ directory: '/tmp/council-x', diffPath: '/tmp/council-x/change.diff', cleanup }),
    readInstructions: async (files) => files.join(' + '),
    now: () => 1_000,
  }
  const onProgress = (agentId: string, change: (current: AgentProgress) => AgentProgress): void => {
    progress.set(agentId, change(progress.get(agentId) ?? waitingProgress))
  }

  return { dependencies, onProgress, launches, timeouts, cleanup, progress }
}

const isCouncil = (launch: AgentLaunch): boolean => launch.message.startsWith('# Council session')

describe('numberReviewers', () => {
  it('numbers reviewers in the table order: provider, model, effort', () => {
    expect(numberReviewers(session.reviewers).map((reviewer) => [reviewer.number, reviewer.reviewType])).toEqual([
      [1, 'security'],
      [2, 'code'],
    ])
  })
})

describe('proseLines', () => {
  it('leaves out fenced code blocks of both fence styles, keeping the original line numbers', () => {
    const text = ['# Review', '```sh', '# list files', '```', '### One', '  ~~~md', '### Not a finding', '  ~~~', '### Two'].join('\n')

    expect(proseLines(text)).toEqual([
      { line: '# Review', index: 0 },
      { line: '### One', index: 4 },
      { line: '### Two', index: 8 },
    ])
  })

  it('treats everything after an unclosed fence as code', () => {
    expect(proseLines('# Review\n```\n### Inside').map(({ line }) => line)).toEqual(['# Review'])
  })
})

describe('trimToReport', () => {
  it('drops remarks before the report title', () => {
    expect(trimToReport('All findings confirmed.\n\n# Przegląd\n## Podsumowanie')).toBe('# Przegląd\n## Podsumowanie')
  })

  it('keeps a report that starts with its title or has none', () => {
    expect(trimToReport('# Review\n### One')).toBe('# Review\n### One')
    expect(trimToReport('\nNo heading at all\n')).toBe('No heading at all')
  })
})

describe('countFindings', () => {
  it('counts level-3 headings and nothing else', () => {
    expect(countFindings('# Review\n## Findings\n### One\n- x\n### Two\n## Open questions')).toBe(2)
    expect(countFindings('No findings.')).toBe(0)
  })
})

describe('runReview', () => {
  it('runs reviewers, then the council with their reports, and cleans up', async () => {
    const run = setup((launch) =>
      isCouncil(launch)
        ? { ok: true, report: 'Verified everything.\n# Review\n### Merged finding', sessionId: 'c' }
        : { ok: true, report: `### Finding from ${launch.configuration.provider}`, sessionId: 'r' },
    )

    const result = await runReview(session, run.dependencies, run.onProgress)

    expect(result).toMatchObject({ kind: 'reported', report: '# Review\n### Merged finding' })
    const councilLaunch = run.launches.find(isCouncil)
    expect(councilLaunch?.message).toContain(
      'Language of the final report: Polish. Write every part of it in Polish: headings, field names and values included.',
    )
    expect(councilLaunch?.message).toContain('### Reviewer 1 · Claude · Haiku 5.5 · low · security')
    expect(councilLaunch?.message).toContain('### Finding from codex')
    expect(councilLaunch?.instructions).toBe(
      'common.md + council/council.md + council/code-review.md + council/security-review.md',
    )
    expect(run.launches.every((launch) => launch.readableDirectories.includes('/tmp/council-x'))).toBe(true)
    expect(run.timeouts).toEqual([180_000, 180_000, 180_000])
    expect(run.cleanup).toHaveBeenCalledOnce()
    expect(run.progress.get('reviewer-2')).toMatchObject({ phase: 'done', note: '1 finding', reads: 1 })
    expect(run.progress.get('council')).toMatchObject({ phase: 'done', note: '1 finding' })
  })

  it('passes a Copilot reviewer report to a Codex council', async () => {
    const copilotAuto: AgentConfiguration = { provider: 'copilot', model: 'auto', modelLabel: 'Auto', effort: null }
    const run = setup((launch) =>
      isCouncil(launch)
        ? { ok: true, report: '# Review\n### Verified finding', sessionId: 'c' }
        : { ok: true, report: '### Finding from Copilot', sessionId: 'r' },
    )

    const result = await runReview(
      { ...session, council: codexLow, reviewers: [{ configuration: copilotAuto, reviewType: 'code' }] },
      run.dependencies,
      run.onProgress,
    )

    expect(result).toMatchObject({ kind: 'reported', report: '# Review\n### Verified finding' })
    const councilLaunch = run.launches.find(isCouncil)
    expect(councilLaunch?.configuration.provider).toBe('codex')
    expect(councilLaunch?.message).toContain('### Reviewer 1 · Copilot · Auto')
    expect(councilLaunch?.message).toContain('### Finding from Copilot')
  })

  it('lets the council work with the reports that came in when one reviewer fails', async () => {
    const run = setup((launch) => {
      if (isCouncil(launch)) {
        return { ok: true, report: '# Review', sessionId: 'c' }
      }

      return launch.configuration.provider === 'codex'
        ? { ok: false, error: 'Timed out after 3 min', sessionId: null }
        : { ok: true, report: '### Token in code', sessionId: 'r' }
    })

    const result = await runReview(session, run.dependencies, run.onProgress)

    expect(result.kind).toBe('reported')
    expect(run.launches.find(isCouncil)?.message).toContain('This reviewer failed: Timed out after 3 min.')
    expect(run.progress.get('reviewer-2')).toMatchObject({ phase: 'failed', note: 'Timed out after 3 min' })
  })

  it('skips the council when every reviewer failed', async () => {
    const run = setup(() => ({ ok: false, error: 'auth expired', sessionId: null }))

    const result = await runReview(session, run.dependencies, run.onProgress)

    expect(result.kind).toBe('reviewers-failed')
    expect(run.launches.some(isCouncil)).toBe(false)
    expect(run.progress.get('council')).toMatchObject({ phase: 'failed', note: 'no reviewer reports' })
    expect(run.cleanup).toHaveBeenCalledOnce()
  })

  it('keeps the reviewer reports when the council fails', async () => {
    const run = setup((launch) =>
      isCouncil(launch)
        ? { ok: false, error: 'The agent finished without a report', sessionId: 'c' }
        : { ok: true, report: '### Finding', sessionId: 'r' },
    )

    const result = await runReview(session, run.dependencies, run.onProgress)

    expect(result).toMatchObject({ kind: 'council-failed', error: 'The agent finished without a report' })
    expect(result.kind === 'council-failed' && result.reviewerReports.map((report) => report.report)).toEqual([
      '### Finding',
      '### Finding',
    ])
  })

  it('starts no agents after a cancel while the diff was prepared, and still cleans up', async () => {
    const controller = new AbortController()
    const run = setup(() => ({ ok: true, report: '# Review', sessionId: null }))
    controller.abort()

    const result = await runReview(session, run.dependencies, run.onProgress, controller.signal)

    expect(result).toEqual({ kind: 'cancelled' })
    expect(run.launches).toEqual([])
    expect(run.cleanup).toHaveBeenCalledOnce()
  })

  it('skips the council after a cancel while the reviewers ran, even when they succeeded', async () => {
    const controller = new AbortController()
    const run = setup((launch) => {
      if (!isCouncil(launch)) {
        controller.abort()
      }

      return { ok: true, report: '### Finding', sessionId: 'r' }
    })

    const result = await runReview(session, run.dependencies, run.onProgress, controller.signal)

    expect(result).toEqual({ kind: 'cancelled' })
    expect(run.launches.filter((launch) => !isCouncil(launch))).toHaveLength(2)
    expect(run.launches.some(isCouncil)).toBe(false)
    expect(run.cleanup).toHaveBeenCalledOnce()
  })

  it('reports a cancel during the council as cancelled, even when the council returns a report', async () => {
    const controller = new AbortController()
    const run = setup((launch) => {
      if (isCouncil(launch)) {
        controller.abort()

        return { ok: true, report: '# Review\n### Finding', sessionId: 'c' }
      }

      return { ok: true, report: '### Finding', sessionId: 'r' }
    })

    const result = await runReview(session, run.dependencies, run.onProgress, controller.signal)

    expect(result).toEqual({ kind: 'cancelled' })
    expect(run.launches.some(isCouncil)).toBe(true)
    expect(run.cleanup).toHaveBeenCalledOnce()
  })

  it('fails only the reviewer whose agent throws, and cleans up after the others finish', async () => {
    const events: string[] = []
    const run = setup((launch) => ({ ok: true, report: isCouncil(launch) ? '# Review' : '### Finding', sessionId: null }))
    const dependencies: ReviewRunDependencies = {
      ...run.dependencies,
      runAgent: async (launch, options) => {
        if (launch.configuration.provider === 'codex') {
          throw new Error('codex crashed')
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
        events.push(isCouncil(launch) ? 'council done' : 'claude done')

        return run.dependencies.runAgent(launch, options)
      },
      prepareWorkspace: async () => ({
        directory: '/tmp/council-x',
        diffPath: '/tmp/council-x/change.diff',
        cleanup: async () => {
          events.push('cleanup')
        },
      }),
    }

    const result = await runReview(session, dependencies, run.onProgress)

    expect(result.kind).toBe('reported')
    expect(events).toEqual(['claude done', 'council done', 'cleanup'])
    expect(run.progress.get('reviewer-2')).toMatchObject({ phase: 'failed', note: 'codex crashed' })
    expect(run.launches.find(isCouncil)?.message).toContain('This reviewer failed: codex crashed.')
  })

  it('fails the reviewer whose instructions cannot be read, without stopping the run', async () => {
    const run = setup((launch) => ({ ok: true, report: isCouncil(launch) ? '# Review' : '### Finding', sessionId: null }))
    const dependencies: ReviewRunDependencies = {
      ...run.dependencies,
      readInstructions: async (files) => {
        if (files.includes('reviewer/security-review.md')) {
          throw new Error('missing reviewer/security-review.md')
        }

        return files.join(' + ')
      },
    }

    const result = await runReview(session, dependencies, run.onProgress)

    expect(result.kind).toBe('reported')
    expect(run.progress.get('reviewer-1')).toMatchObject({ phase: 'failed', note: 'missing reviewer/security-review.md' })
  })

  it('fails without starting agents when the workspace cannot be prepared', async () => {
    const run = setup(() => ({ ok: true, report: '# Review', sessionId: null }))
    const dependencies: ReviewRunDependencies = {
      ...run.dependencies,
      prepareWorkspace: async () => {
        throw new Error('Could not read the diff from Git')
      },
    }

    await expect(runReview(session, dependencies, run.onProgress)).rejects.toThrow('Could not read the diff from Git')
    expect(run.launches).toEqual([])
    expect(run.progress.size).toBe(0)
  })
})
