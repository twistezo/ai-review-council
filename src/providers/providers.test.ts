import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'

import type { StartJsonLineProcess } from '../process/json-line-process.js'
import { commandResult, fakeRunCommand } from '../test-support/fakes.js'
import { checkCliStatus } from './check-cli-status.js'
import { createClaudeAdapter, parseClaudeInitializeResponse } from './claude-adapter.js'
import { createCodexAdapter, parseCodexModelPage } from './codex-adapter.js'
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

type FakeCatalogProcess = {
  start: StartJsonLineProcess
  sent: unknown[]
  cwds: string[]
  closedCount: () => number
}

// A catalog CLI that answers each sent message with the replies `answer` returns; a wait with no reply fails.
const fakeCatalogProcess = (answer: (message: Record<string, unknown>) => unknown[]): FakeCatalogProcess => {
  const sent: unknown[] = []
  const cwds: string[] = []
  const replies: unknown[] = []
  let closed = 0
  const start: StartJsonLineProcess = (_command, _args, { cwd }) => {
    cwds.push(cwd)

    return {
      send: (message) => {
        sent.push(message)
        replies.push(...answer(message as Record<string, unknown>))
      },
      waitFor: async (predicate) => {
        const index = replies.findIndex(predicate)
        if (index === -1) {
          throw new Error('catalog CLI exited with code 1.')
        }

        return replies.splice(index, 1)[0]
      },
      close: () => {
        closed += 1
      },
    }
  }

  return { start, sent, cwds, closedCount: () => closed }
}

const noCommands = fakeRunCommand({})

describe('Codex model catalog', () => {
  const client = { name: 'ai-review-council', version: '1.2.3' }
  const codexPage = (models: Record<string, unknown>[], nextCursor: string | null): Record<string, unknown> => ({
    data: models,
    nextCursor,
  })

  it('initializes as this app, then merges every page of visible models', async () => {
    const pages: Record<string, Record<string, unknown>> = {
      first: codexPage([codexModel('gpt-a', false), codexModel('gpt-hidden', true)], 'page-2'),
      'page-2': codexPage([codexModel('gpt-b', false)], null),
    }
    const catalog = fakeCatalogProcess((message) => {
      if (message['method'] === 'initialize') {
        return [{ id: message['id'], result: {} }]
      }
      if (message['method'] === 'model/list') {
        const { cursor } = message['params'] as { cursor: string | null }

        return [{ id: message['id'], result: pages[cursor ?? 'first'] }]
      }

      return []
    })

    const models = await createCodexAdapter(noCommands, catalog.start, client).listModels()

    expect(models.map((model) => model.id)).toEqual(['gpt-a', 'gpt-b'])
    expect(catalog.sent).toEqual([
      expect.objectContaining({
        method: 'initialize',
        params: expect.objectContaining({
          clientInfo: { name: 'ai-review-council', title: 'ai-review-council v1.2.3', version: '1.2.3' },
        }),
      }),
      { method: 'initialized' },
      expect.objectContaining({ method: 'model/list', params: { cursor: null } }),
      expect.objectContaining({ method: 'model/list', params: { cursor: 'page-2' } }),
    ])
    expect(catalog.cwds).toEqual([tmpdir()])
    expect(catalog.closedCount()).toBe(1)
  })

  it('stops asking for more pages after a bounded number of requests', async () => {
    const catalog = fakeCatalogProcess((message) => [
      { id: message['id'], result: codexPage([codexModel('gpt-a', false)], 'more') },
    ])

    const models = await createCodexAdapter(noCommands, catalog.start, client).listModels()

    expect(models).toHaveLength(20)
    expect(catalog.closedCount()).toBe(1)
  })

  it('surfaces an initialize error from the App Server and closes it', async () => {
    const catalog = fakeCatalogProcess((message) => [{ id: message['id'], error: { message: 'not logged in' } }])

    await expect(createCodexAdapter(noCommands, catalog.start, client).listModels()).rejects.toThrow(
      'Codex initialize failed: not logged in',
    )
    expect(catalog.closedCount()).toBe(1)
  })

  it('fails and closes the App Server when it exits or sends an unexpected model list', async () => {
    const exits = fakeCatalogProcess(() => [])
    const unexpected = fakeCatalogProcess((message) =>
      message['method'] === 'model/list' ? [{ id: message['id'], result: { items: [] } }] : [{ id: message['id'] }],
    )

    await expect(createCodexAdapter(noCommands, exits.start, client).listModels()).rejects.toThrow('exited with code 1')
    await expect(createCodexAdapter(noCommands, unexpected.start, client).listModels()).rejects.toThrow()
    expect(exits.closedCount()).toBe(1)
    expect(unexpected.closedCount()).toBe(1)
  })
})

describe('Claude model catalog', () => {
  const answerInitialize =
    (response: Record<string, unknown>) =>
    (message: Record<string, unknown>): unknown[] => [
      { type: 'system', subtype: 'init' },
      { type: 'control_response', response: { ...response, request_id: message['request_id'] } },
    ]

  it('reads the models from the initialize response, outside the current folder, and closes the CLI', async () => {
    const catalog = fakeCatalogProcess(
      answerInitialize({ subtype: 'success', response: { models: [{ value: 'opus', displayName: 'Opus 5.5' }] } }),
    )

    expect(await createClaudeAdapter(noCommands, catalog.start).listModels()).toEqual([
      { id: 'opus', label: 'Opus 5.5', efforts: [] },
    ])
    expect(catalog.sent).toEqual([expect.objectContaining({ type: 'control_request', request: { subtype: 'initialize' } })])
    expect(catalog.cwds).toEqual([tmpdir()])
    expect(catalog.closedCount()).toBe(1)
  })

  it('ignores a control response to another request', async () => {
    const catalog = fakeCatalogProcess(() => [
      { type: 'control_response', response: { subtype: 'success', request_id: 'other', response: { models: [] } } },
    ])

    await expect(createClaudeAdapter(noCommands, catalog.start).listModels()).rejects.toThrow('exited with code 1')
    expect(catalog.closedCount()).toBe(1)
  })

  it('surfaces an initialize error and closes the CLI', async () => {
    const catalog = fakeCatalogProcess(answerInitialize({ subtype: 'error', error: 'not logged in' }))

    await expect(createClaudeAdapter(noCommands, catalog.start).listModels()).rejects.toThrow(
      'Claude Code initialize failed: not logged in',
    )
    expect(catalog.closedCount()).toBe(1)
  })
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
    })
  })

  it('blocks with an install fix when the CLI is missing', async () => {
    const status = await checkCliStatus(fakeRunCommand({}), check)

    expect(status.problem).toBe('`codex` was not found in PATH.')
    expect(status.fix).toBe('install')
  })

  it('reports the provider as unavailable when its login check fails', async () => {
    const run = fakeRunCommand({
      'codex --version': commandResult({ stdout: 'codex-cli 0.165.0' }),
      'codex login status': commandResult({ exitCode: 1 }),
    })
    const status = await checkCliStatus(run, check)

    expect(status.problem).toBe('Provider is unavailable.')
    expect(status.fix).toBeNull()
  })

  it('passes without a login check when the CLI has no login status command', async () => {
    const run = fakeRunCommand({ 'codex --version': commandResult({ stdout: 'codex-cli 0.165.0' }) })
    const status = await checkCliStatus(run, { ...check, loginStatusArgs: null })

    expect(status.problem).toBeNull()
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
    await adapter.checkStatus()

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
    })
    expect(await adapter.listModels()).toEqual([{ id: 'auto', label: 'Auto', efforts: [] }])
  })

  it('blocks with an install fix when the CLI is missing', async () => {
    const status = await createCopilotAdapter(fakeRunCommand({})).checkStatus()

    expect(status.problem).toBe('`gh` was not found in PATH.')
    expect(status.fix).toContain('GitHub CLI')
  })
})
