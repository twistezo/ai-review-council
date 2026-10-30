import { describe, expect, it } from 'vitest'

import {
  allInstructionFiles,
  councilInstructionFiles,
  findMissingInstructionFiles,
  instructionsDirectory,
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

  it('lists every file once', () => {
    expect(allInstructionFiles()).toHaveLength(9)
  })

  it('ships every instruction file in docs/', async () => {
    expect(await findMissingInstructionFiles(instructionsDirectory)).toEqual([])
  })

  it('reports files missing from a directory', async () => {
    expect(await findMissingInstructionFiles('/no/such/docs')).toHaveLength(9)
  })
})
