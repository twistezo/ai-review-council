import { tmpdir } from 'node:os'
import { z } from 'zod'

import type { StartJsonLineProcess } from '../process/json-line-process.js'
import type { RunCommand } from '../process/run-command.js'
import { checkCliStatus } from './check-cli-status.js'
import type { ProviderAdapter, ProviderModel } from './provider-adapter.js'
import { providerDisplayNames } from './provider-adapter.js'

const claudeModelSchema = z.object({
  value: z.string().min(1),
  displayName: z.string().optional(),
  supportedEffortLevels: z.array(z.string().min(1)).optional(),
})

const initializeResponseSchema = z.object({
  type: z.literal('control_response'),
  response: z.discriminatedUnion('subtype', [
    z.object({
      subtype: z.literal('success'),
      response: z.object({ models: z.array(claudeModelSchema) }),
    }),
    z.object({ subtype: z.literal('error'), error: z.string() }),
  ]),
})

const initializeRequestId = 'ai-review-council-catalog'
const defaultModelAlias = 'default'

export const parseClaudeInitializeResponse = (message: unknown): ProviderModel[] => {
  const { response } = initializeResponseSchema.parse(message)
  if (response.subtype === 'error') {
    throw new Error(`Claude Code initialize failed: ${response.error}`)
  }

  // `default` only points at a model already listed under its own name, e.g. Opus 5.5; kept when it is all there is.
  const { models } = response.response
  const namedModels = models.filter((model) => model.value !== defaultModelAlias)

  return (namedModels.length === 0 ? models : namedModels).map((model) => ({
    id: model.value,
    label: model.displayName || model.value,
    efforts: model.supportedEffortLevels ?? [],
  }))
}

const isInitializeResponse = (message: unknown): boolean =>
  typeof message === 'object' &&
  message !== null &&
  'type' in message &&
  message.type === 'control_response' &&
  'response' in message &&
  typeof message.response === 'object' &&
  message.response !== null &&
  'request_id' in message.response &&
  message.response.request_id === initializeRequestId

const catalogTimeoutMs = 30_000

export const createClaudeAdapter = (run: RunCommand, startProcess: StartJsonLineProcess): ProviderAdapter => ({
  id: 'claude',
  displayName: providerDisplayNames.claude,

  checkStatus: () =>
    checkCliStatus(run, {
      provider: 'claude',
      command: 'claude',
      loginStatusArgs: ['auth', 'status'],
      installFix: 'Install Claude Code and make sure `claude` is on PATH, then run this app again.',
      loginFix: 'Run `claude` in a terminal and sign in with `/login`, then run this app again.',
    }),

  // Catalog from the initialize control response; no user message is sent, so no model is called.
  // Runs in the temp directory so project settings of the current folder are not loaded.
  listModels: async () => {
    const process = startProcess(
      'claude',
      ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose'],
      { cwd: tmpdir(), timeoutMs: catalogTimeoutMs },
    )
    try {
      process.send({ type: 'control_request', request_id: initializeRequestId, request: { subtype: 'initialize' } })

      return parseClaudeInitializeResponse(await process.waitFor(isInitializeResponse))
    } finally {
      process.close()
    }
  },
})
