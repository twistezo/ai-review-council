import { describe, expect, it } from 'vitest'

import { commandResult, fakeRunCommand } from '../test-support/fakes.js'
import { checkCliStatus } from './check-cli-status.js'
import { parseClaudeInitializeResponse } from './claude-adapter.js'
import { parseCodexModelPage } from './codex-adapter.js'
import { defaultEffort, effortOptions, formatConfiguration, toCatalogModels } from './model-catalog.js'

const codexModel = (model: string, hidden: boolean): Record<string, unknown> => ({
  id: model,
  model,
  displayName: model.toUpperCase(),
  hidden,
  supportedReasoningEfforts: [
    { reasoningEffort: 'low', description: '' },
    { reasoningEffort: 'high', description: '' },
  ],
  defaultReasoningEffort: 'low',
})

describe('parseCodexModelPage', () => {
  it('maps visible models with their efforts and keeps the cursor', () => {
    const page = parseCodexModelPage({
      data: [codexModel('gpt-a', false), codexModel('gpt-hidden', true)],
      nextCursor: 'next',
    })

    expect(page).toEqual({ models: [{ id: 'gpt-a', label: 'GPT-A', efforts: ['low', 'high'] }], nextCursor: 'next' })
  })

  it('rejects an unexpected response instead of returning no models', () => {
    expect(() => parseCodexModelPage({ items: [] })).toThrow()
  })
})

describe('parseClaudeInitializeResponse', () => {
  it('maps models and treats missing effort levels as no effort parameter', () => {
    const models = parseClaudeInitializeResponse({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'x',
        response: {
          models: [
            { value: 'default', displayName: 'Default (recommended)' },
            { value: 'sonnet', displayName: 'Sonnet', supportedEffortLevels: ['low', 'medium'] },
          ],
          commands: [],
        },
      },
    })

    expect(models).toEqual([
      { id: 'default', label: 'Default (recommended)', efforts: [] },
      { id: 'sonnet', label: 'Sonnet', efforts: ['low', 'medium'] },
    ])
  })

  it('surfaces an initialize error', () => {
    expect(() =>
      parseClaudeInitializeResponse({
        type: 'control_response',
        response: { subtype: 'error', request_id: 'x', error: 'boom' },
      }),
    ).toThrow('Claude Code initialize failed: boom')
  })
})

describe('model catalog', () => {
  const [withEfforts, withoutEfforts] = toCatalogModels('claude', [
    { id: 'opus', label: 'Opus', efforts: ['low', 'high'] },
    { id: 'default', label: 'default', efforts: [] },
  ])

  it('offers a single default effort for a model without declared efforts', () => {
    expect(withoutEfforts && effortOptions(withoutEfforts)).toEqual([null])
    expect(withEfforts && effortOptions(withEfforts)).toEqual(['low', 'high'])
  })

  it('prefers medium, otherwise the first declared effort', () => {
    expect(withEfforts && defaultEffort(withEfforts)).toBe('low')
    expect(defaultEffort({ provider: 'codex', id: 'x', label: 'x', efforts: ['low', 'medium'] })).toBe('medium')
  })

  it('formats configurations for lists and the summary', () => {
    expect(formatConfiguration({ provider: 'claude', model: 'opus', modelLabel: 'Opus', effort: 'high' })).toBe(
      'Claude Code · Opus · high',
    )
    expect(formatConfiguration({ provider: 'codex', model: 'gpt', modelLabel: 'gpt', effort: null })).toBe(
      'Codex · gpt · default',
    )
  })
})

describe('checkCliStatus', () => {
  const check = {
    provider: 'codex',
    command: 'codex',
    loginStatusArgs: ['login', 'status'],
    installFix: 'install',
    loginFix: 'login',
  } as const

  it('passes when the CLI is installed and logged in', async () => {
    const run = fakeRunCommand({
      'codex --version': commandResult({ stdout: 'codex-cli 0.165.0\n' }),
      'codex login status': commandResult(),
    })

    expect(await checkCliStatus(run, check)).toEqual({ provider: 'codex', version: 'codex-cli 0.165.0', problem: null, fix: null })
  })

  it('blocks with an install fix when the CLI is missing', async () => {
    const status = await checkCliStatus(fakeRunCommand({}), check)

    expect(status.problem).toBe('`codex` was not found in PATH.')
    expect(status.fix).toBe('install')
  })

  it('blocks with a login fix when not logged in', async () => {
    const run = fakeRunCommand({
      'codex --version': commandResult({ stdout: 'codex-cli 0.165.0' }),
      'codex login status': commandResult({ exitCode: 1 }),
    })
    const status = await checkCliStatus(run, check)

    expect(status.problem).toBe('Not logged in.')
    expect(status.fix).toBe('login')
  })
})
