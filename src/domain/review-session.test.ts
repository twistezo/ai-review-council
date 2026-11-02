import { describe, expect, it } from 'vitest'

import type { AgentConfiguration } from './review-session.js'
import { reviewSessionDraftSchema } from './review-session.js'

const copilotAuto: AgentConfiguration = { provider: 'copilot', model: 'auto', modelLabel: 'Auto', effort: null }
const codexHigh: AgentConfiguration = { provider: 'codex', model: 'gpt-6-luna', modelLabel: 'GPT-6-Luna', effort: 'high' }

const draft = (council: AgentConfiguration, reviewer: AgentConfiguration): Record<string, unknown> => ({
  language: 'en',
  repository: { root: '/repo', branch: 'main', hasChanges: true },
  scope: {
    kind: 'full',
    base: { hash: 'a'.repeat(40), subject: 'Base' },
    diffBase: 'empty',
    changedFiles: [{ path: 'cart.ts', previousPath: null, change: 'modified' }],
    excludedFiles: [],
  },
  council,
  reviewers: [{ configuration: reviewer, reviewType: 'code' }],
  prompt: '',
  timeoutMinutes: 10,
})

const errorMessages = (input: Record<string, unknown>): string[] =>
  reviewSessionDraftSchema.safeParse(input).error?.issues.map((issue) => issue.message) ?? []

describe('reviewSessionDraftSchema', () => {
  it('accepts a Copilot Auto reviewer with a Codex council', () => {
    expect(reviewSessionDraftSchema.safeParse(draft(codexHigh, copilotAuto)).success).toBe(true)
  })

  it('rejects Copilot as the council agent', () => {
    expect(errorMessages(draft(copilotAuto, copilotAuto))).toEqual(['The council agent must be Codex or Claude.'])
  })

  it.each([
    { name: 'an explicit effort', reviewer: { ...copilotAuto, effort: 'high' } },
    { name: 'a named model', reviewer: { ...copilotAuto, model: 'gpt-6-luna' } },
  ])('rejects a Copilot reviewer with $name', ({ reviewer }) => {
    expect(errorMessages(draft(codexHigh, reviewer))).toEqual(['Copilot supports only Auto without reasoning effort.'])
  })
})
