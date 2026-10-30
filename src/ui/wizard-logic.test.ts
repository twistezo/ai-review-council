import { describe, expect, it } from 'vitest'

import type { AgentConfiguration, ReviewerAssignment } from '../domain/review-session.js'
import type { CatalogModel } from '../providers/model-catalog.js'
import { changeModel, choiceFromConfiguration, choiceToConfiguration, resizeReviewers } from './agent-choice.js'
import { visibleWindow } from './list-state.js'
import { summarizePrompt } from './steps/summary-step.js'
import { nextStep, numberedSteps, previousStep } from './wizard-steps.js'

const models: CatalogModel[] = [
  { provider: 'codex', id: 'sol', label: 'Sol', efforts: ['low', 'medium', 'high'] },
  { provider: 'codex', id: 'luna', label: 'Luna', efforts: ['low', 'high'] },
  { provider: 'claude', id: 'default', label: 'Default', efforts: [] },
]

const configuration: AgentConfiguration = { provider: 'codex', model: 'sol', modelLabel: 'Sol', effort: 'high' }

describe('agent choice', () => {
  it('starts from the first model and its default effort', () => {
    expect(choiceFromConfiguration(models, null)).toEqual({ modelIndex: 0, effort: 'medium' })
  })

  it('restores an earlier configuration', () => {
    expect(choiceFromConfiguration(models, configuration)).toEqual({ modelIndex: 0, effort: 'high' })
  })

  it('keeps the effort when the new model supports it, otherwise uses the model default', () => {
    expect(changeModel(models, { modelIndex: 0, effort: 'high' }, 1)).toEqual({ modelIndex: 1, effort: 'high' })
    expect(changeModel(models, { modelIndex: 0, effort: 'medium' }, 1)).toEqual({ modelIndex: 1, effort: 'low' })
    expect(changeModel(models, { modelIndex: 0, effort: 'medium' }, 2)).toEqual({ modelIndex: 2, effort: null })
  })

  it('builds the configuration of the chosen model', () => {
    expect(choiceToConfiguration(models, { modelIndex: 2, effort: null })).toEqual({
      provider: 'claude',
      model: 'default',
      modelLabel: 'Default',
      effort: null,
    })
  })
})

describe('resizeReviewers', () => {
  it('keeps existing reviewers and starts new ones from the fallback, cycling review types', () => {
    const first: ReviewerAssignment = { configuration, reviewType: 'security' }
    const fallback = { ...configuration, effort: 'low' }

    expect(resizeReviewers([first], 4, fallback)).toEqual([
      first,
      { configuration: fallback, reviewType: 'security' },
      { configuration: fallback, reviewType: 'ui-ux' },
      { configuration: fallback, reviewType: 'code' },
    ])
  })

  it('drops reviewers beyond the new count', () => {
    expect(resizeReviewers(resizeReviewers([], 3, configuration), 1, configuration)).toHaveLength(1)
  })
})

describe('wizard steps', () => {
  it('skips steps answered by options in both directions', () => {
    const skipped = ['language', 'project'] as const

    expect(nextStep('preflight', ['language'])).toBe('project')
    expect(previousStep('scope', skipped)).toBeNull()
    expect(numberedSteps(skipped)).toEqual(['scope', 'council', 'reviewers', 'prompt', 'summary'])
  })

  it('still runs preset project and scope steps forward so they get resolved', () => {
    expect(nextStep('preflight', ['language', 'project'])).toBe('project')
    expect(nextStep('project', ['language', 'project', 'scope'])).toBe('scope')
    expect(nextStep('scope', ['language', 'project', 'scope'])).toBe('council')
    expect(previousStep('council', ['language', 'project', 'scope'])).toBeNull()
  })

  it('never goes back to the requirements check', () => {
    expect(previousStep('language', [])).toBeNull()
    expect(previousStep('project', [])).toBe('language')
    expect(previousStep('summary', [])).toBe('prompt')
  })
})

describe('summarizePrompt', () => {
  it('keeps a short prompt as it is', () => {
    expect(summarizePrompt('One\nTwo\nThree')).toEqual(['One', 'Two', 'Three'])
  })

  it('cuts a long prompt to three lines ending with an ellipsis', () => {
    expect(summarizePrompt('One\nTwo\nThree\nFour\nFive')).toEqual(['One', 'Two', 'Three...'])
  })
})

describe('visibleWindow', () => {
  it('keeps the selected row inside the window', () => {
    expect(visibleWindow(30, 0, 10)).toEqual({ start: 0, end: 10 })
    expect(visibleWindow(30, 15, 10)).toEqual({ start: 10, end: 20 })
    expect(visibleWindow(30, 29, 10)).toEqual({ start: 20, end: 30 })
    expect(visibleWindow(3, 2, 10)).toEqual({ start: 0, end: 3 })
  })
})
