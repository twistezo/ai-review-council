import { describe, expect, it } from 'vitest'

import { commandResult, fakeRunCommand } from '../test-support/fakes.js'
import { checkCliStatus } from './check-cli-status.js'
import { parseClaudeInitializeResponse } from './claude-adapter.js'
import { parseCodexModelPage } from './codex-adapter.js'
import { createCopilotAdapter } from './copilot-adapter.js'
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
  it('maps models, treats missing effort levels as no effort parameter and drops the default alias', () => {
    const models = parseClaudeInitializeResponse({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'x',
        response: {
          models: [
            { value: 'default', displayName: 'Default (recommended)', description: 'Opus 5.5 · Best for everyday' },
            { value: 'opus', displayName: 'Opus 5.5' },
            { value: 'sonnet', displayName: 'Sonnet', supportedEffortLevels: ['low', 'medium'] },
          ],
          commands: [],
        },
      },
    })

    expect(models).toEqual([
      { id: 'opus', label: 'Opus 5.5', efforts: [] },
      { id: 'sonnet', label: 'Sonnet', efforts: ['low', 'medium'] },
    ])
  })

  it('keeps the default alias when the CLI lists no other model', () => {
    const models = parseClaudeInitializeResponse({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'x',
        response: { models: [{ value: 'default', displayName: 'Default (recommended)' }], commands: [] },
      },
    })

    expect(models).toEqual([{ id: 'default', label: 'Default (recommended)', efforts: [] }])
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
      'Claude · Opus · high',
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

    expect(await checkCliStatus(run, check)).toEqual({
      provider: 'codex',
      version: 'codex-cli 0.165.0',
      problem: null,
      fix: null,
      loginChecked: true,
    })
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

  it('passes without a login check when the CLI has no login status command', async () => {
    const run = fakeRunCommand({ 'codex --version': commandResult({ stdout: 'codex-cli 0.165.0' }) })
    const status = await checkCliStatus(run, { ...check, loginStatusArgs: null })

    expect(status.problem).toBeNull()
    expect(status.loginChecked).toBe(false)
  })

  it('reports a failing CLI apart from a missing one', async () => {
    const run = fakeRunCommand({ 'codex --version': commandResult({ exitCode: 1, stderr: 'broken install' }) })
    const status = await checkCliStatus(run, check)

    expect(status.problem).toBe('`codex --version` failed: broken install')
    expect(status.fix).toBe('install')
  })
})

describe('createCopilotAdapter', () => {
  it('prefers the standalone runtime when both are installed', async () => {
    const adapter = createCopilotAdapter(
      fakeRunCommand({
        'copilot --version': commandResult({ stdout: 'standalone' }),
        'gh copilot -- --version': commandResult({ stdout: 'fallback' }),
      }),
    )
    expect((await adapter.checkStatus()).version).toBe('standalone')
    expect(adapter.command()).toBe('copilot')
  })

  it('retains the gh fallback for execution when standalone is absent', async () => {
    const adapter = createCopilotAdapter(
      fakeRunCommand({ 'gh copilot -- --version': commandResult({ stdout: 'fallback' }) }),
    )
    expect((await adapter.checkStatus()).problem).toBeNull()
    expect(adapter.command()).toBe('gh')
  })

  it('reports a broken standalone runtime rather than switching accounts through a fallback', async () => {
    const adapter = createCopilotAdapter(
      fakeRunCommand({
        'copilot --version': commandResult({ exitCode: 1, stderr: 'broken' }),
        'gh copilot -- --version': commandResult({ stdout: 'fallback' }),
      }),
    )
    expect((await adapter.checkStatus()).problem).toContain('broken')
    expect(adapter.command()).toBe('copilot')
  })

  it('offers only Auto, without a named-model catalog or a login check', async () => {
    const adapter = createCopilotAdapter(
      fakeRunCommand({ 'gh copilot -- --version': commandResult({ stdout: '1.0.105\n' }) }),
    )

    expect(await adapter.checkStatus()).toEqual({
      provider: 'copilot',
      version: '1.0.105',
      problem: null,
      fix: null,
      loginChecked: false,
    })
    expect(await adapter.listModels()).toEqual([{ id: 'auto', label: 'Auto', efforts: [] }])
  })

  it('blocks with an install fix when the CLI is missing', async () => {
    const status = await createCopilotAdapter(fakeRunCommand({})).checkStatus()

    expect(status.problem).toBe('`gh` was not found in PATH.')
    expect(status.fix).toContain('GitHub CLI')
  })
})
