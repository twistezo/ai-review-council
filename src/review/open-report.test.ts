import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { commandResult } from '../test-support/fakes.js'
import { createReportOpener } from './open-report.js'

describe('createReportOpener', () => {
  it('writes the report to a Markdown file and opens it with the default app', async () => {
    const calls: string[][] = []
    const openReport = createReportOpener(async (command, args) => {
      calls.push([command, ...args])

      return commandResult()
    })
    const filePath = await openReport('# Review\n\n### Typo')

    expect(filePath).toMatch(/ai-review-council-report-.+\/review\.md$/)
    expect(calls).toEqual([['open', filePath]])
    expect(await readFile(filePath ?? '', 'utf8')).toBe('# Review\n\n### Typo\n')
  })

  it('reports nothing when the file cannot be opened', async () => {
    const openReport = createReportOpener(async () => commandResult({ exitCode: 1 }))

    expect(await openReport('# Review')).toBeNull()
  })

  it('reports nothing and opens nothing when the file cannot be written', async () => {
    const calls: string[][] = []
    const openReport = createReportOpener(async (command, args) => {
      calls.push([command, ...args])

      return commandResult()
    })
    vi.stubEnv('TMPDIR', path.join('/nonexistent', 'ai-review-council-test'))
    try {
      expect(await openReport('# Review')).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
    expect(calls).toEqual([])
  })

  it('reports nothing when the open command cannot start', async () => {
    const openReport = createReportOpener(async () => commandResult({ exitCode: null, failure: 'not-found' }))

    expect(await openReport('# Review')).toBeNull()
  })
})
