import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

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
})
