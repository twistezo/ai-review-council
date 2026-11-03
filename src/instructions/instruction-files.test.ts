import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  allInstructionFiles,
  councilInstructionFiles,
  findMissingInstructionFiles,
  instructionsDirectory,
  readInstructions,
  reviewerInstructionFiles,
} from './instruction-files.js'

describe('instruction files', () => {
  it('gives a reviewer its role file and its review variant', () => {
    expect(reviewerInstructionFiles('security')).toEqual([
      'common.md',
      'reviewer/reviewer.md',
      'reviewer/security-review.md',
    ])
  })

  it('gives the council the variants chosen for reviewers, each once, in a stable order', () => {
    expect(councilInstructionFiles(['ui-ux', 'code', 'ui-ux'])).toEqual([
      'common.md',
      'council/council.md',
      'council/code-review.md',
      'council/ui-ux-review.md',
    ])
  })

  it('ships every instruction file in docs/', async () => {
    expect(await findMissingInstructionFiles(instructionsDirectory)).toEqual([])
  })

  it('reports every file as missing from a directory without them', async () => {
    expect(await findMissingInstructionFiles('/no/such/docs')).toEqual(allInstructionFiles())
  })

  it('covers the role and variant files of every review type, each once', () => {
    const files = allInstructionFiles()

    expect(new Set(files).size).toBe(files.length)
    expect(files).toEqual(
      expect.arrayContaining([
        ...reviewerInstructionFiles('ui-ux'),
        ...councilInstructionFiles(['code', 'security', 'ui-ux']),
      ]),
    )
  })

  it('joins the files in order, trimmed and separated', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'instructions-'))
    await writeFile(path.join(directory, 'first.md'), '\n# First\n\n')
    await writeFile(path.join(directory, 'second.md'), '# Second\n')

    try {
      expect(await readInstructions(directory, ['second.md', 'first.md'])).toBe('# Second\n\n---\n\n# First')
      await expect(readInstructions(directory, ['missing.md'])).rejects.toThrow()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
